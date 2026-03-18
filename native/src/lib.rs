#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod commands;
mod mcp;
mod utils;

mod pty;

use crate::config::ConfigManager;
use crate::mcp::McpManager;
use crate::pty::PtyManager;
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // workspace
            commands::read_workspace_dir,
            commands::read_workspace_text_file,
            // config
            commands::get_config,
            commands::update_settings,
            commands::get_config_path,
            commands::open_config_folder,
            commands::set_project_dir,
            commands::get_recent_projects,
            commands::remove_recent_project,
            commands::get_current_project_path,
            // mcp
            commands::list_mcp_servers,
            commands::upsert_mcp_server,
            commands::remove_mcp_server,
            commands::set_mcp_server_enabled,
            commands::retry_mcp_server,
            commands::list_mcp_tools,
            commands::call_mcp_tool,
            // pty
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
        ])
        .setup(|app| {
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link()
                    .register_all()
                    .map_err(|error| error.to_string())?;
            }

            let manager = ConfigManager::new().map_err(|e| e.to_string())?;
            let effective_mcp_servers = manager
                .get_effective_mcp_servers()
                .map_err(|e| e.to_string())?;

            let mcp_manager = McpManager::new(app.handle().clone());
            app.manage(mcp_manager.clone());
            app.manage(Mutex::new(manager));

            let pty_manager = Arc::new(Mutex::new(PtyManager::new(app.handle().clone())));
            app.manage(pty_manager);

            tauri::async_runtime::spawn(async move {
                if let Err(error) = mcp_manager.apply_servers(effective_mcp_servers).await {
                    eprintln!("failed to initialize MCP servers: {}", error);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
