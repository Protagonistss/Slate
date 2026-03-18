use tauri::{command, AppHandle, Manager};
use serde::{Deserialize, Serialize};

use super::PtyManager;
use std::sync::{Arc, Mutex};

#[derive(Clone, Serialize)]
pub struct PtySpawnResult {
    pub id: String,
    pub pid: u32,
}

#[tauri::command]
pub async fn pty_spawn(
    app: AppHandle,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<PtySpawnResult, String> {
    let manager = app.state::<Arc<Mutex<PtyManager>>>();
    let manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    let result = manager.spawn(
        cwd.as_deref(),
        cols.unwrap_or(80),
        rows.unwrap_or(24),
    )?;
    Ok(PtySpawnResult {
        id: result.0,
        pid: result.1,
    })
}

#[tauri::command]
pub async fn pty_write(
    app: AppHandle,
    id: String,
    data: String,
) -> Result<(), String> {
    let manager = app.state::<Arc<Mutex<PtyManager>>>();
    let manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.write(&id, &data)
}

#[tauri::command]
pub async fn pty_resize(
    app: AppHandle,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let manager = app.state::<Arc<Mutex<PtyManager>>>();
    let manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.resize(&id, cols, rows)
}

#[tauri::command]
pub async fn pty_kill(
    app: AppHandle,
    id: String,
) -> Result<(), String> {
    let manager = app.state::<Arc<Mutex<PtyManager>>>();
    let mut manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.kill(&id)
}
