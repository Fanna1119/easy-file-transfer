mod profiles;
mod ssh;
mod transfer;

use serde::Serialize;
use std::{collections::HashMap, sync::Mutex};
use transfer::TransferState;

/// Unified file-entry type returned by both `list_local_dir` and `list_remote_dir`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    /// Byte size (0 for directories).
    pub size: u64,
    /// Unix timestamp string (local) or `ls -la` date string (remote).
    pub modified: String,
    pub is_dir: bool,
    pub permissions: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(TransferState(Mutex::new(HashMap::new())))
        .invoke_handler(tauri::generate_handler![
            transfer::start_transfer,
            transfer::cancel_transfer,
            transfer::get_file_sizes,
            transfer::list_local_dir,
            transfer::rename_local,
            transfer::create_local_dir,
            transfer::delete_local,
            ssh::list_remote_dirs,
            ssh::list_remote_dir,
            ssh::test_ssh_connection,
            ssh::rename_remote,
            ssh::create_remote_dir,
            ssh::delete_remote,
            profiles::load_profiles,
            profiles::save_profile,
            profiles::delete_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
