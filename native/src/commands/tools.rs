use serde::{Deserialize, Serialize};
use which::which;

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolInfo {
    pub name: String,
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstalledTools {
    pub tools: Vec<ToolInfo>,
}

// 常用开发工具列表
const COMMON_TOOLS: &[&str] = &[
    "node",
    "npm",
    "pnpm",
    "yarn",
    "git",
    "python",
    "python3",
    "pip",
    "rustc",
    "cargo",
    "go",
    "java",
    "javac",
    "docker",
    "docker-compose",
];

#[tauri::command]
pub async fn get_installed_tools() -> Result<InstalledTools, String> {
    let mut tools = Vec::new();

    for tool_name in COMMON_TOOLS {
        let result = which(tool_name);
        let installed = result.is_ok();
        let path = result.ok().map(|p| p.to_string_lossy().to_string());

        tools.push(ToolInfo {
            name: tool_name.to_string(),
            installed,
            path,
            version: None, // 版本检测可以后续添加
        });
    }

    Ok(InstalledTools { tools })
}
