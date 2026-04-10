use serde::{Deserialize, Serialize};

// ── Connection params ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBrowseParams {
    pub user: String,
    pub host: String,
    pub port: Option<u16>,
    pub path: String,
    pub ssh_key: Option<String>,
    pub passphrase: Option<String>,
    /// Maximum directory depth (only used by `list_remote_dirs`).
    pub max_depth: Option<u8>,
}

// ── Legacy dir-only type (kept for compatibility) ─────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDir {
    pub path: String,
    pub name: String,
}

// ── Shared SSH runner ─────────────────────────────────────────────────────────

/// Build the SSH CLI arguments (everything before the target host).
fn base_ssh_args(params: &RemoteBrowseParams) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    if let Some(ref key) = params.ssh_key {
        args.push("-i".into());
        args.push(key.clone());
        args.push("-o".into());
        args.push("IdentitiesOnly=yes".into());
    }

    if let Some(port) = params.port {
        args.push("-p".into());
        args.push(port.to_string());
    }

    args.push("-o".into());
    args.push("StrictHostKeyChecking=accept-new".into());
    args.push("-o".into());
    args.push("ConnectTimeout=10".into());

    args
}

/// Spawn an SSH command and return stdout as a string.
/// When a passphrase is provided, it is supplied via SSH_ASKPASS instead of
/// using BatchMode so the key challenge can be answered non-interactively.
async fn run_remote(params: &RemoteBrowseParams, remote_cmd: &str) -> Result<String, String> {
    let mut cmd = tokio::process::Command::new("ssh");
    cmd.args(base_ssh_args(params));
    cmd.env(
        "PATH",
        "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    );

    let askpass_path = match &params.passphrase {
        Some(phrase) if !phrase.is_empty() => {
            let p = crate::transfer::create_askpass_script(phrase).map_err(|e| e.to_string())?;
            cmd.env("SSH_ASKPASS", &p);
            cmd.env("SSH_ASKPASS_REQUIRE", "force");
            cmd.env("DISPLAY", ":0");
            Some(p)
        }
        _ => {
            cmd.arg("-o").arg("BatchMode=yes");
            None
        }
    };

    let target = format!("{}@{}", params.user, params.host);
    cmd.arg(&target).arg(remote_cmd);

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run ssh: {}", e))?;

    if let Some(p) = askpass_path {
        let _ = std::fs::remove_file(p);
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("SSH error: {}", stderr.trim()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// List immediate subdirectories (legacy tree-browser command).
#[tauri::command]
pub async fn list_remote_dirs(params: RemoteBrowseParams) -> Result<Vec<RemoteDir>, String> {
    let depth = params.max_depth.unwrap_or(1);
    let base = if params.path == "~" {
        "$HOME".to_string()
    } else if params.path.starts_with("~/") {
        format!("$HOME/{}", &params.path[2..].replace('\'', "'\\''"))
    } else {
        format!("'{}'", params.path.replace('\'', "'\\''"))
    };
    let remote_cmd = format!(
        "find {} -maxdepth {} -mindepth 1 -type d 2>/dev/null | sort",
        base, depth
    );

    let stdout = run_remote(&params, &remote_cmd).await?;

    let dirs = stdout
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|line| {
            let path = line.trim().to_string();
            let name = std::path::Path::new(&path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&path)
                .to_string();
            RemoteDir { path, name }
        })
        .collect();

    Ok(dirs)
}

/// List all files and directories in a remote path, returning rich metadata.
#[tauri::command]
pub async fn list_remote_dir(params: RemoteBrowseParams) -> Result<Vec<crate::FileEntry>, String> {
    // Single-quoting '~' prevents shell tilde expansion; handle it explicitly.
    let remote_cmd = if params.path == "~" {
        "ls -la ~".to_string()
    } else if params.path.starts_with("~/") {
        let rest = &params.path[2..];
        let safe = rest.replace('\'', "'\\''");
        format!("ls -la ~/'{}'", safe)
    } else {
        let safe_path = params.path.replace('\'', "'\\''");
        format!("ls -la '{}'", safe_path)
    };

    let stdout = run_remote(&params, &remote_cmd).await?;

    let mut entries: Vec<crate::FileEntry> = stdout
        .lines()
        .filter_map(|line| parse_ls_line(line, &params.path))
        .collect();

    // Directories first, then alphabetical (case-insensitive).
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

/// Test an SSH connection; returns "Connected" on success, or an error string.
#[tauri::command]
pub async fn test_ssh_connection(params: RemoteBrowseParams) -> Result<String, String> {
    run_remote(&params, "echo connected")
        .await
        .map(|_| "Connected".to_string())
}

/// Rename a remote file or directory (new_name is a bare name, not a full path).
#[tauri::command]
pub async fn rename_remote(params: RemoteBrowseParams, new_name: String) -> Result<(), String> {
    let safe_from = params.path.replace('\'', "'\\''");
    // Build destination alongside source
    let parent = params.path.rsplit_once('/').map(|(p, _)| p).unwrap_or(".");
    let safe_dest = format!("{}/{}", parent, new_name.trim_matches('/')).replace('\'', "'\\''");
    let cmd = format!("mv '{}' '{}'", safe_from, safe_dest);
    run_remote(&params, &cmd).await.map(|_| ())
}

/// Create a new remote directory.
#[tauri::command]
pub async fn create_remote_dir(params: RemoteBrowseParams, name: String) -> Result<(), String> {
    let safe_parent = params.path.replace('\'', "'\\''");
    let safe_name = name.trim_matches('/').replace('\'', "'\\''");
    let cmd = format!("mkdir -p '{}/{}' ", safe_parent, safe_name);
    run_remote(&params, &cmd).await.map(|_| ())
}

/// Delete remote files/directories. Each path is removed with `rm -rf`.
#[tauri::command]
pub async fn delete_remote(params: RemoteBrowseParams, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    // Build a single `rm -rf 'path1' 'path2' …` command.
    let args: String = paths
        .iter()
        .map(|p| format!("'{}'", p.replace('\'', "'\\''")))
        .collect::<Vec<_>>()
        .join(" ");
    let cmd = format!("rm -rf {}", args);
    run_remote(&params, &cmd).await.map(|_| ())
}

// ── ls -la parser ─────────────────────────────────────────────────────────────

/// Parse a single `ls -la` output line into a FileEntry.
///
/// Expected format (BSD and GNU):
/// `drwxr-xr-x  2 user  group    64 Apr  9 12:00 dirname`
fn parse_ls_line(line: &str, parent_path: &str) -> Option<crate::FileEntry> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with("total") {
        return None;
    }

    let all_fields: Vec<&str> = trimmed.split_whitespace().collect();
    if all_fields.len() < 9 {
        return None;
    }

    let permissions = all_fields[0].to_string();
    let is_dir = permissions.starts_with('d');
    let size: u64 = all_fields[4].parse().unwrap_or(0);
    let modified = format!("{} {} {}", all_fields[5], all_fields[6], all_fields[7]);

    // Name: everything from field 8 onward (handles spaces in filenames).
    let raw_name = all_fields[8..].join(" ");

    if raw_name == "." || raw_name == ".." {
        return None;
    }

    // Strip symlink target (" -> /some/path").
    let name = if let Some(pos) = raw_name.find(" -> ") {
        raw_name[..pos].to_string()
    } else {
        raw_name
    };

    let path = if parent_path.ends_with('/') {
        format!("{}{}", parent_path, name)
    } else {
        format!("{}/{}", parent_path, name)
    };

    Some(crate::FileEntry {
        name,
        path,
        size,
        modified,
        is_dir,
        permissions,
    })
}
