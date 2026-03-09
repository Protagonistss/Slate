use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub hostname: String,
    pub username: String,
    pub home_dir: Option<String>,
    pub current_dir: String,
    pub shell: Option<String>,
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let os = env::consts::OS.to_string();
    let arch = env::consts::ARCH.to_string();
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    let username = whoami::username();
    let home_dir = dirs::home_dir().map(|p| p.to_string_lossy().to_string());
    let current_dir = env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| ".".to_string());

    // 获取默认 shell
    let shell = if cfg!(target_os = "windows") {
        env::var("COMSPEC").ok()
    } else {
        env::var("SHELL").ok()
    };

    Ok(SystemInfo {
        os,
        arch,
        hostname,
        username,
        home_dir,
        current_dir,
        shell,
    })
}
