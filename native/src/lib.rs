#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_workspace_dir,
            commands::read_workspace_text_file,
            commands::get_config,
            commands::update_settings,
            commands::get_config_path,
            commands::open_config_folder,
            commands::set_project_dir,
            commands::get_recent_projects,
            commands::remove_recent_project,
            commands::get_current_project_path,
        ])
        .setup(|app| {
            let manager = config::ConfigManager::new()
                .map_err(|e| e.to_string())?;
            app.manage(std::sync::Mutex::new(manager));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
