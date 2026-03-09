use std::fmt;

/// 配置管理相关错误
#[derive(Debug)]
pub enum ConfigError {
    /// IO 操作错误
    Io(std::io::Error),

    /// JSON 序列化/反序列化错误
    Json(serde_json::Error),

    /// 路径不存在
    PathNotFound(String),

    /// 无效配置
    InvalidConfig(String),

    /// 主目录不存在
    HomeDirNotFound,
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConfigError::Io(e) => write!(f, "文件操作失败: {}", e),
            ConfigError::Json(e) => write!(f, "配置解析失败: {}", e),
            ConfigError::PathNotFound(p) => write!(f, "路径不存在: {}", p),
            ConfigError::InvalidConfig(msg) => write!(f, "无效配置: {}", msg),
            ConfigError::HomeDirNotFound => write!(f, "无法找到用户主目录"),
        }
    }
}

impl std::error::Error for ConfigError {}

// 从 std::io::Error 转换
impl From<std::io::Error> for ConfigError {
    fn from(err: std::io::Error) -> Self {
        ConfigError::Io(err)
    }
}

// 从 serde_json::Error 转换
impl From<serde_json::Error> for ConfigError {
    fn from(err: serde_json::Error) -> Self {
        ConfigError::Json(err)
    }
}

// 转换为 String (用于 Tauri 命令返回)
impl From<ConfigError> for String {
    fn from(err: ConfigError) -> Self {
        err.to_string()
    }
}
