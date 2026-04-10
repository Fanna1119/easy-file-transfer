use std::{
    collections::HashMap,
    os::unix::fs::PermissionsExt,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::{io::AsyncReadExt, process::Child};
use uuid::Uuid;

// ── Shared state ──────────────────────────────────────────────────────────────

/// Value: (child process, cancelled flag)
pub struct TransferState(pub Mutex<HashMap<String, (Child, Arc<AtomicBool>)>>);

// ── Public types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferConfig {
    pub files: Vec<String>,
    pub destination: String,
    pub ssh_key: Option<String>,
    pub passphrase: Option<String>,
    pub resumable: bool,
    pub checksum: bool,
    /// When true: LAN mode — disables delta algorithm and compression for raw throughput.
    /// When false (default): WAN mode — enables compression for bandwidth efficiency.
    #[serde(default)]
    pub local_network: bool,
    #[allow(dead_code)]
    pub base_path: Option<String>,
    /// "upload" (local → remote) or "download" (remote → local)
    #[serde(default = "default_direction")]
    pub direction: String,
    /// Local destination folder used in download mode.
    pub local_destination: Option<String>,
    /// Optional SSH port (defaults to 22).
    pub port: Option<u16>,
}

fn default_direction() -> String {
    "upload".to_string()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub transfer_id: String,
    pub bytes_transferred: u64,
    pub percent: u8,
    pub speed: String,
    pub eta: String,
    pub xfr_current: Option<u32>,
    pub xfr_total: Option<u32>,
    pub current_file: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteEvent {
    pub transfer_id: String,
    pub success: bool,
    pub message: String,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

pub fn create_askpass_script(passphrase: &str) -> std::io::Result<std::path::PathBuf> {
    let escaped = passphrase.replace('\'', "'\\''");
    let content = format!("#!/bin/sh\nprintf '%s' '{}'\n", escaped);
    let path = std::env::temp_dir().join(format!("eft_askpass_{}.sh", Uuid::new_v4()));
    std::fs::write(&path, content)?;
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700))?;
    Ok(path)
}

fn expand_tilde(path: &str) -> String {
    if path == "~" || path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return path.replacen('~', &home, 1);
        }
    }
    path.to_string()
}

fn find_rsync() -> (String, bool) {
    // Try Homebrew GNU rsync first — supports --info=progress2
    for path in ["/opt/homebrew/bin/rsync", "/usr/local/bin/rsync"] {
        if std::path::Path::new(path).exists() {
            return (path.to_string(), true);
        }
    }
    // Fall back to system rsync (openrsync on macOS — no --info=progress2)
    ("/usr/bin/rsync".to_string(), false)
}

fn build_rsync_args(cfg: &TransferConfig, gnu_rsync: bool) -> Vec<String> {
    let mut args: Vec<String> = vec!["--archive".into(), "--verbose".into()];

    if cfg.resumable {
        args.push("--partial-dir=.rsync-partial".into());
    }

    // --info=progress2 = GNU rsync only; --progress works everywhere
    if gnu_rsync {
        args.push("--info=progress2".into());
    } else {
        args.push("--progress".into());
    }

    // LAN mode: skip delta algorithm and compression for maximum raw throughput.
    // WAN mode (default): enable compression to reduce bandwidth usage.
    if cfg.local_network {
        args.push("--whole-file".into());
        args.push("--no-compress".into());
    } else {
        args.push("--compress".into());
    }

    if cfg.checksum {
        args.push("--checksum".into());
    }

    let port_flag = cfg.port.map(|p| format!("-p {}", p)).unwrap_or_default();

    if let Some(ref key) = cfg.ssh_key {
        args.push("-e".into());
        args.push(format!(
            "ssh {} -i {} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new",
            port_flag, key
        ));
    } else {
        args.push("-e".into());
        args.push(format!(
            "ssh {} -o StrictHostKeyChecking=accept-new",
            port_flag
        ));
    }

    if cfg.direction == "download" {
        // Remote source → local destination
        args.push(cfg.destination.clone());
        let dest = expand_tilde(cfg.local_destination.as_deref().unwrap_or("."));
        args.push(dest);
    } else {
        // Upload: local files → remote destination
        for file in &cfg.files {
            args.push(file.clone());
        }
        args.push(cfg.destination.clone());
    }

    args
}

fn parse_progress_line(line: &str, transfer_id: &str) -> Option<ProgressEvent> {
    // C locale: bytes use comma as thousands separator, speed uses dot as decimal.
    let re = Regex::new(
        r"^\s*([\d,]+)\s+(\d+)%\s+([\d.]+\s*\S+/s)\s+(\d+:\d+:\d+)(?:\s+\(xfr#(\d+),\s*(?:to-chk|ir-chk)=(\d+)/(\d+)\))?",
    )
    .ok()?;
    let caps = re.captures(line)?;
    let bytes_str = caps.get(1)?.as_str().replace(',', "");
    Some(ProgressEvent {
        transfer_id: transfer_id.to_string(),
        bytes_transferred: bytes_str.parse().ok()?,
        percent: caps.get(2)?.as_str().parse().ok()?,
        speed: caps.get(3)?.as_str().trim().to_string(),
        eta: caps.get(4)?.as_str().to_string(),
        xfr_current: caps.get(5).and_then(|m| m.as_str().parse().ok()),
        xfr_total: caps.get(7).and_then(|m| m.as_str().parse().ok()),
        current_file: None,
    })
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_transfer(
    cfg: TransferConfig,
    app: AppHandle,
    state: State<'_, TransferState>,
) -> Result<String, String> {
    let transfer_id = Uuid::new_v4().to_string();
    let (rsync_bin, gnu_rsync) = find_rsync();
    let args = build_rsync_args(&cfg, gnu_rsync);

    let mut cmd = tokio::process::Command::new(&rsync_bin);
    cmd.args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    // Force C locale so rsync output (numbers, units) is always in a predictable format,
    // regardless of the user's system locale. Also ensure ssh is findable via PATH.
    cmd.env("LC_ALL", "C").env(
        "PATH",
        "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    );

    // Passphrase: write a temporary askpass script, set env vars, then remove after spawn.
    let askpass_cleanup = if let Some(ref phrase) = cfg.passphrase {
        if !phrase.is_empty() {
            let p = create_askpass_script(phrase).map_err(|e| e.to_string())?;
            cmd.env("SSH_ASKPASS", &p);
            cmd.env("SSH_ASKPASS_REQUIRE", "force");
            cmd.env("DISPLAY", ":0");
            Some(p)
        } else {
            None
        }
    } else {
        None
    };

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn rsync: {}", e))?;

    if let Some(p) = askpass_cleanup {
        let _ = std::fs::remove_file(p);
    }

    let stdout = child.stdout.take().ok_or("No stdout")?;
    let stderr = child.stderr.take().ok_or("No stderr")?;

    let cancelled = Arc::new(AtomicBool::new(false));
    {
        let mut map = state.0.lock().map_err(|e| e.to_string())?;
        map.insert(transfer_id.clone(), (child, cancelled.clone()));
    }

    spawn_reader(transfer_id.clone(), stdout, stderr, app, cancelled);
    Ok(transfer_id)
}

fn spawn_reader(
    tid: String,
    stdout: tokio::process::ChildStdout,
    stderr: tokio::process::ChildStderr,
    app: AppHandle,
    cancelled: Arc<AtomicBool>,
) {
    let app_task = app.clone();
    let tid2 = tid.clone();

    tokio::spawn(async move {
        // Run both stream readers concurrently; each returns collected error lines.
        let (out_errors, err_errors) = tokio::join!(
            read_stream(stdout, &app_task, &tid2),
            read_stream(stderr, &app_task, &tid2),
        );
        let error_lines: Vec<String> = out_errors.into_iter().chain(err_errors).collect();

        let maybe_entry = {
            let state = app_task.state::<TransferState>();
            let mut map = state.0.lock().unwrap();
            map.remove(&tid2)
        };
        let success = if let Some((mut child, _)) = maybe_entry {
            matches!(child.wait().await, Ok(s) if s.success())
        } else {
            false
        };

        let was_cancelled = cancelled.load(Ordering::Relaxed);
        let message = if success {
            "Transfer complete".into()
        } else if was_cancelled {
            "Transfer cancelled".into()
        } else if !error_lines.is_empty() {
            error_lines.join("\n")
        } else {
            "Transfer failed".into()
        };

        let _ = app_task.emit(
            &format!("transfer://complete/{}", tid2),
            CompleteEvent {
                transfer_id: tid2,
                success,
                message,
            },
        );
    });
}

/// Read a stream splitting on both \r and \n so rsync --info=progress2 lines
/// (which use \r to overwrite in-place) are emitted as individual events.
async fn read_stream<R: AsyncReadExt + Unpin>(
    mut stream: R,
    app: &AppHandle,
    tid: &str,
) -> Vec<String> {
    let mut buf = [0u8; 8192];
    let mut leftover = String::new();
    let mut errors: Vec<String> = Vec::new();

    loop {
        match stream.read(&mut buf).await {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                leftover.push_str(&String::from_utf8_lossy(&buf[..n]));
                loop {
                    match leftover.find(|c: char| c == '\r' || c == '\n') {
                        None => break,
                        Some(pos) => {
                            let line = leftover[..pos].to_string();
                            // Skip \r\n as a single delimiter
                            let skip = if leftover.as_bytes().get(pos) == Some(&b'\r')
                                && leftover.as_bytes().get(pos + 1) == Some(&b'\n')
                            {
                                2
                            } else {
                                1
                            };
                            leftover = leftover[pos + skip..].to_string();
                            emit_line(app, tid, &line, &mut errors);
                        }
                    }
                }
            }
        }
    }
    // Flush anything remaining (no trailing delimiter)
    emit_line(app, tid, &leftover, &mut errors);
    errors
}

fn emit_line(app: &AppHandle, tid: &str, line: &str, errors: &mut Vec<String>) {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return;
    }
    if let Some(ev) = parse_progress_line(trimmed, tid) {
        let _ = app.emit(&format!("transfer://progress/{}", tid), ev);
    } else if !trimmed.contains('%') {
        let lower = trimmed.to_ascii_lowercase();
        if lower.starts_with("rsync:")
            || lower.starts_with("openrsync:")
            || lower.starts_with("ssh:")
            || lower.contains("error")
            || lower.contains("failed")
            || lower.contains("refused")
            || lower.contains("denied")
            || lower.contains("no such")
            || lower.contains("permission")
        {
            errors.push(trimmed.to_string());
        }
        let _ = app.emit(
            &format!("transfer://progress/{}", tid),
            ProgressEvent {
                transfer_id: tid.to_string(),
                bytes_transferred: 0,
                percent: 0,
                speed: String::new(),
                eta: String::new(),
                xfr_current: None,
                xfr_total: None,
                current_file: Some(trimmed.to_string()),
            },
        );
    }
}

#[tauri::command]
pub fn cancel_transfer(transfer_id: String, state: State<'_, TransferState>) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|e| e.to_string())?;
    if let Some((child, cancelled)) = map.remove(&transfer_id) {
        cancelled.store(true, Ordering::Relaxed);
        if let Some(pid) = child.id() {
            // Send SIGTERM so rsync can gracefully save the partial file to
            // --partial-dir before exiting. SIGKILL would leave a random-suffix
            // temp file behind that rsync can never resume.
            let _ = std::process::Command::new("kill")
                .args(["-TERM", &pid.to_string()])
                .output();
            // Also SIGTERM any SSH child spawned by rsync (avoids orphan SSH).
            let _ = std::process::Command::new("pkill")
                .args(["-TERM", "-P", &pid.to_string()])
                .output();
        }
        // Fall back to SIGKILL if the process doesn't exit on its own.
        // We drop `child` here; Tokio will reap it when it eventually exits.
        drop(child);
    }
    Ok(())
}

/// Returns the total size in bytes of the given local file paths.
#[tauri::command]
pub fn get_file_sizes(paths: Vec<String>) -> Result<u64, String> {
    let mut total: u64 = 0;
    for path in &paths {
        let meta = std::fs::metadata(path).map_err(|e| format!("{}: {}", path, e))?;
        if meta.is_dir() {
            total += dir_size(std::path::Path::new(path))?;
        } else {
            total += meta.len();
        }
    }
    Ok(total)
}

fn dir_size(path: &std::path::Path) -> Result<u64, String> {
    let mut total = 0u64;
    for entry in std::fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if meta.is_dir() {
            total += dir_size(&entry.path())?;
        } else {
            total += meta.len();
        }
    }
    Ok(total)
}

/// List the entries in a local directory, expanding a leading `~`.
#[tauri::command]
pub fn list_local_dir(path: String) -> Result<Vec<crate::FileEntry>, String> {
    use std::os::unix::fs::PermissionsExt;

    // Expand ~ to $HOME.
    let expanded = if path == "~" {
        std::env::var("HOME").unwrap_or_else(|_| "/".to_string())
    } else if path.starts_with("~/") {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
        format!("{}{}", home, &path[1..])
    } else {
        path
    };

    let dir_path = std::path::Path::new(&expanded);

    if !dir_path.is_dir() {
        return Err(format!("Not a directory: {}", expanded));
    }

    let mut entries: Vec<crate::FileEntry> = Vec::new();

    for entry in std::fs::read_dir(dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let entry_path = entry.path().to_string_lossy().to_string();
        let size = if meta.is_dir() { 0 } else { meta.len() };

        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs().to_string())
            .unwrap_or_default();

        let mode = meta.permissions().mode();
        let permissions = format_mode(mode, meta.is_dir());

        entries.push(crate::FileEntry {
            name,
            path: entry_path,
            size,
            modified,
            is_dir: meta.is_dir(),
            permissions,
        });
    }

    // Directories first, then alphabetical (case-insensitive).
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

fn format_mode(mode: u32, is_dir: bool) -> String {
    let d = if is_dir { 'd' } else { '-' };
    let bits = [
        (0o400, 'r'),
        (0o200, 'w'),
        (0o100, 'x'),
        (0o040, 'r'),
        (0o020, 'w'),
        (0o010, 'x'),
        (0o004, 'r'),
        (0o002, 'w'),
        (0o001, 'x'),
    ];
    let s: String = bits
        .iter()
        .map(|&(b, c)| if mode & b != 0 { c } else { '-' })
        .collect();
    format!("{}{}", d, s)
}
