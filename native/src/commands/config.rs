use crate::config::{ConfigManager, ProjectRecord};
use crate::mcp::McpManager;
use crate::utils::validate_project_path;
use tauri::{AppHandle, State};
use tauri_plugin_shell::ShellExt;
use std::path::PathBuf;
use std::sync::Mutex;

#[tauri::command]
pub async fn get_config(
    manager: State<'_, Mutex<ConfigManager>>,
) -> Result<crate::config::MergedConfig, String> {
    manager.lock().unwrap().get_merged_config()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_settings(
    manager: State<'_, Mutex<ConfigManager>>,
    settings: crate::config::Settings,
) -> Result<(), String> {
    manager.lock().unwrap().save_settings(&settings)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_config_path(
    manager: State<'_, Mutex<ConfigManager>>,
) -> Result<String, String> {
    Ok(manager.lock().unwrap().get_config_dir().to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_config_folder(app: AppHandle) -> Result<(), String> {
    let config_dir = dirs::home_dir()
        .ok_or("Cannot find home directory")?
        .join(".slate");
    app.shell()
        .open(config_dir.to_string_lossy().to_string(), None)
        .map_err(|e| format!("Failed to open: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn set_project_dir(
    manager: State<'_, Mutex<ConfigManager>>,
    mcp_manager: State<'_, McpManager>,
    path: String,
) -> Result<(), String> {
    // 验证路径
    validate_project_path(&path)?;

    let path = PathBuf::from(path);
    let effective_servers = {
        let mut manager = manager.lock().unwrap();
        manager.set_and_record_project(&path)
            .map_err(|e| e.to_string())?;
        manager.get_effective_mcp_servers()
            .map_err(|e| e.to_string())?
    };

    mcp_manager.apply_servers(effective_servers).await
}

#[tauri::command]
pub async fn get_recent_projects(
    manager: State<'_, Mutex<ConfigManager>>,
) -> Result<Vec<ProjectRecord>, String> {
    Ok(manager.lock().unwrap().get_recent_projects().to_vec())
}

#[tauri::command]
pub async fn remove_recent_project(
    manager: State<'_, Mutex<ConfigManager>>,
    path: String,
) -> Result<(), String> {
    manager.lock().unwrap().remove_project(&path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_current_project_path(
    manager: State<'_, Mutex<ConfigManager>>,
) -> Result<Option<String>, String> {
    Ok(manager.lock().unwrap().get_current_project().map(|s| s.to_string()))
}
