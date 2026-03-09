use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Settings {
    #[serde(default)]
    pub appearance: AppearanceSettings,
    #[serde(default)]
    pub editor: EditorSettings,
    #[serde(default)]
    pub ui: UISettings,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct AppearanceSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_font_size")]
    pub font_size: u8,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct EditorSettings {
    #[serde(default = "default_tab_size")]
    pub tab_size: u8,
    #[serde(default = "default_word_wrap")]
    pub word_wrap: bool,
    #[serde(default)]
    pub line_numbers: bool,
    #[serde(default)]
    pub font_family: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct UISettings {
    #[serde(default = "default_sidebar_width")]
    pub sidebar_width: u32,
    #[serde(default = "default_panel_width")]
    pub panel_width: u32,
}

// 默认值函数
fn default_theme() -> String {
    "dark".into()
}

fn default_language() -> String {
    "zh-CN".into()
}

fn default_font_size() -> u8 {
    14
}

fn default_tab_size() -> u8 {
    4
}

fn default_word_wrap() -> bool {
    true
}

fn default_sidebar_width() -> u32 {
    250
}

fn default_panel_width() -> u32 {
    300
}

// Config 类型
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    #[serde(default)]
    pub llm: LLMSettings,
    #[serde(default)]
    pub workspace: WorkspaceSettings,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct LLMSettings {
    #[serde(default = "default_provider")]
    pub default_provider: String,
    #[serde(default)]
    pub providers: std::collections::HashMap<String, LLMProviderConfig>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LLMProviderConfig {
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct WorkspaceSettings {
    #[serde(default)]
    pub default_directory: String,
    #[serde(default)]
    pub auto_save: bool,
}

fn default_provider() -> String {
    "anthropic".into()
}

// MCP 类型
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct MCPConfig {
    #[serde(default)]
    pub mcp_servers: Vec<MCPServer>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MCPServer {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub transport: MCPTransport,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type")]
pub enum MCPTransport {
    #[serde(rename = "stdio")]
    Stdio {
        command: String,
        args: Vec<String>,
    },
    #[serde(rename = "sse")]
    SSE { url: String },
}

// Default 实现
impl Default for Settings {
    fn default() -> Self {
        Self {
            appearance: AppearanceSettings::default(),
            editor: EditorSettings::default(),
            ui: UISettings::default(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            llm: LLMSettings::default(),
            workspace: WorkspaceSettings::default(),
        }
    }
}

// 项目管理类型
/// 项目记录信息
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProjectRecord {
    pub path: String,
    pub name: String,
    #[serde(default)]
    pub last_opened: String,
    #[serde(default)]
    pub open_files: Vec<String>,
    #[serde(default)]
    pub has_config: bool,
}

/// 项目列表配置
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct ProjectsConfig {
    #[serde(default)]
    pub recent_projects: Vec<ProjectRecord>,
    #[serde(default)]
    pub current_project: Option<String>,
}

/// 项目级配置
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct ProjectConfig {
    #[serde(default)]
    pub llm: Option<LLMSettings>,
    #[serde(default)]
    pub editor: Option<ProjectEditorSettings>,
    #[serde(default)]
    pub workspace: Option<ProjectWorkspaceSettings>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct ProjectEditorSettings {
    #[serde(default = "default_tab_size")]
    pub tab_size: u8,
    #[serde(default)]
    pub word_wrap: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct ProjectWorkspaceSettings {
    #[serde(default)]
    pub default_directory: String,
    #[serde(default)]
    pub exclude_patterns: Vec<String>,
}
