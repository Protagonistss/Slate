use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDirEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub is_file: bool,
}

#[tauri::command]
pub async fn read_workspace_dir(path: String) -> Result<Vec<WorkspaceDirEntry>, String> {
    let dir_path = PathBuf::from(&path);
    let entries = fs::read_dir(&dir_path)
        .map_err(|e| format!("Failed to read directory '{}': {}", dir_path.display(), e))?;

    let mut result = Vec::new();
    for item in entries {
        let entry = item.map_err(|e| format!("Failed to iterate directory '{}': {}", path, e))?;
        let entry_path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata '{}': {}", entry_path.display(), e))?;

        result.push(WorkspaceDirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry_path.to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            is_file: metadata.is_file(),
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn read_workspace_text_file(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read text file '{}': {}", file_path.display(), e))
}

#[tauri::command]
pub async fn is_directory(path: String) -> Result<bool, String> {
    let path_buf = PathBuf::from(&path);
    println!("[is_directory] Checking path: {}", path);
    println!("[is_directory] PathBuf: {:?}", path_buf);

    let metadata = fs::metadata(&path_buf)
        .map_err(|e| {
            println!("[is_directory] Error reading metadata: {}", e);
            format!("Failed to read metadata '{}': {}", path_buf.display(), e)
        })?;

    let is_dir = metadata.is_dir();
    println!("[is_directory] Result: is_dir={}, is_file={}", is_dir, metadata.is_file());

    Ok(is_dir)
}
