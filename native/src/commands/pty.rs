use portable_pty::{native_ Child, CommandBuilder};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command, Emitter, Manager, RuntimeAuthToken, App};
use std::sync::{Arc, Mutex};

use std::collections::HashMap;
use std::io::{Read, Write};

use super::pty::PtyManager;

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
    let mut manager = manager.lock().unwrap();
    let result = manager.spawn(cwd, cols.unwrap_or(80), rows.unwrap_or(24))?;
    Ok(PtySpawnResult {
        id: result.0,
        pid: result.1,
    })
}

#[tauri::command]
pub async fn pty_write(id: String, data: String) -> Result<(), String> {
    let manager = app.state::<Arc<Mutex<PtyManager>>>();
    let manager = manager.lock().unwrap();
    manager.write(&id, &data)
}

#[tauri::command]
pub async fn pty_resize(id: String, cols: u16, rows: u16) -> Result<(), String> {
    let manager = app.state::<Arc<Mutex<PtyManager>>>();
    let manager = manager.lock().unwrap();
    manager.resize(&id, cols, rows)
}

#[tauri::command]
pub async fn pty_kill(id: String) -> Result<(), String> {
    let manager = app.state::<Arc<Mutex<PtyManager>>>();
    let mut manager = manager.lock().unwrap();
    manager.kill(&id)
}
