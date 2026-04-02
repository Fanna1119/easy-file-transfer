use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBrowseParams {
    /// e.g. `user@host`
    pub host: String,
    /// Remote directory to list.
    pub path: String,
    /// Optional path to SSH identity file.
    pub ssh_key: Option<String>,
    /// Maximum directory depth (default 1).
    pub max_depth: Option<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDir {
    pub path: String,
    pub name: String,
}

#[tauri::command]
pub async fn list_remote_dirs(params: RemoteBrowseParams) -> Result<Vec<RemoteDir>, String> {
    let depth = params.max_depth.unwrap_or(1);

    // Build find command to list immediate subdirectories.
    let remote_cmd = format!(
        "find '{}' -maxdepth {} -mindepth 1 -type d 2>/dev/null | sort",
        params.path.replace('\'', "'\\''"),
        depth
    );

    let mut cmd = tokio::process::Command::new("ssh");

    if let Some(ref key) = params.ssh_key {
        cmd.arg("-i").arg(key);
        cmd.arg("-o").arg("IdentitiesOnly=yes");
    }

    cmd.arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg("BatchMode=yes")
        .arg(&params.host)
        .arg(&remote_cmd);

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run ssh: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("SSH error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
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
