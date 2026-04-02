mod profiles;
mod ssh;
mod transfer;

use std::{collections::HashMap, sync::Mutex};
use transfer::TransferState;

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
            ssh::list_remote_dirs,
            profiles::load_profiles,
            profiles::save_profile,
            profiles::delete_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
