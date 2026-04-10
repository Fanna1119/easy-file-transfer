use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    /// `user@host:/remote/path`
    pub destination: String,
    /// Optional absolute path to SSH identity file.
    pub ssh_key: Option<String>,
    pub dry_run: bool,
    pub checksum: bool,
    #[serde(default)]
    pub local_network: Option<bool>,
    /// "upload" or "download"; None means legacy profile (treated as upload).
    #[serde(default)]
    pub direction: Option<String>,
    /// Local destination folder for download-mode profiles.
    #[serde(default)]
    pub local_destination: Option<String>,
}

fn profiles_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("profiles.json"))
}

fn read_profiles(path: &PathBuf) -> Result<Vec<Profile>, String> {
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

fn write_profiles(path: &PathBuf, profiles: &[Profile]) -> Result<(), String> {
    let data = serde_json::to_string_pretty(profiles).map_err(|e| e.to_string())?;
    std::fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_profiles(app: AppHandle) -> Result<Vec<Profile>, String> {
    let path = profiles_path(&app)?;
    read_profiles(&path)
}

#[tauri::command]
pub fn save_profile(mut profile: Profile, app: AppHandle) -> Result<Profile, String> {
    let path = profiles_path(&app)?;
    let mut profiles = read_profiles(&path)?;

    if profile.id.is_empty() {
        profile.id = Uuid::new_v4().to_string();
    }

    // Replace if id already exists, otherwise append.
    let pos = profiles.iter().position(|p| p.id == profile.id);
    if let Some(idx) = pos {
        profiles[idx] = profile.clone();
    } else {
        profiles.push(profile.clone());
    }

    write_profiles(&path, &profiles)?;
    Ok(profile)
}

#[tauri::command]
pub fn delete_profile(id: String, app: AppHandle) -> Result<(), String> {
    let path = profiles_path(&app)?;
    let mut profiles = read_profiles(&path)?;
    profiles.retain(|p| p.id != id);
    write_profiles(&path, &profiles)
}
