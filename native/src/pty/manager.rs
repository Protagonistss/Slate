use portable_pty::{CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub type PtyId = String;

pub struct PtySession {
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub child: Arc<Mutex<Box<dyn portable_pty::Child + Send>>>,
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<PtyId, PtySession>>>,
    app_handle: AppHandle,
}

impl PtyManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
        }
    }

    pub fn spawn(&self, cwd: Option<&str>, cols: u16, rows: u16) -> Result<(PtyId, u32), String> {
        let pty_system = portable_pty::native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to create PTY: {}", e))?;

        let shell = if cfg!(target_os = "windows") {
            // Prefer PowerShell for a nicer default; fallback to cmd if missing.
            "powershell.exe".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        };

        let mut cmd = CommandBuilder::new(shell);
        if cfg!(target_os = "windows") {
            cmd.arg("-NoLogo");
        } else {
            cmd.arg("-i");
        }

        if let Some(cwd) = cwd {
            cmd.cwd(cwd);
        }

        cmd.env("TERM", "xterm-256color");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        let mut master = pair.master;

        let reader = master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;
        let writer = master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        let id = format!(
            "pty-{}-{}",
            chrono::Utc::now().timestamp_millis(),
            rand::random::<u32>()
        );

        let pid = child.process_id().unwrap_or(0);

        let session = PtySession {
            master,
            writer: Arc::new(Mutex::new(writer)),
            child: Arc::new(Mutex::new(child)),
        };

        self.sessions.lock().unwrap().insert(id.clone(), session);

        let sessions = self.sessions.clone();
        let app_handle = self.app_handle.clone();
        let id_clone = id.clone();

        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            let mut reader = reader;
            loop {
                // Session removed => stop the reader thread.
                if !sessions.lock().unwrap().contains_key(&id_clone) {
                    break;
                }

                match reader.read(&mut buf) {
                    Ok(0) => {
                        let mut sessions_guard = sessions.lock().unwrap();
                        sessions_guard.remove(&id_clone);
                        let _ = app_handle.emit(
                            "pty-exit",
                            serde_json::json!({
                                "id": id_clone,
                                "code": 0,
                            }),
                        );
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]);
                        let _ = app_handle.emit(
                            "pty-data",
                            serde_json::json!({
                                "id": id_clone,
                                "data": data.to_string(),
                            }),
                        );
                    }
                    Err(e) => {
                        eprintln!("PTY read error: {}", e);
                        break;
                    }
                }
            }
        });

        Ok((id, pid))
    }

    pub fn write(&self, id: &PtyId, data: &str) -> Result<(), String> {
        let writer = {
            let sessions = self.sessions.lock().unwrap();
            let session = sessions.get(id).ok_or_else(|| format!("Session {} not found", id))?;
            session.writer.clone()
        };

        let mut writer = writer.lock().map_err(|e| format!("Lock error: {}", e))?;
        writer
                .write_all(data.as_bytes())
                .map_err(|e| format!("Failed to write: {}", e))?;
        writer
                .flush()
                .map_err(|e| format!("Failed to flush: {}", e))?;
        Ok(())
    }

    pub fn resize(&self, id: &PtyId, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get(id) {
            session
                .master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize: {}", e))?;
            Ok(())
        } else {
            Err(format!("Session {} not found", id))
        }
    }

    pub fn kill(&self, id: &PtyId) -> Result<(), String> {
        let session = self
            .sessions
            .lock()
            .unwrap()
            .remove(id)
            .ok_or_else(|| format!("Session {} not found", id))?;

        if let Ok(mut child) = session.child.lock() {
            let _ = child.kill();
        }

        let _ = self.app_handle.emit(
            "pty-exit",
            serde_json::json!({
                "id": id,
                "code": 0,
            }),
        );

        Ok(())
    }
}
