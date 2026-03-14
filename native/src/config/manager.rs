use super::types::*;
use super::error::ConfigError;
use crate::mcp::{
    compute_approval_fingerprint, validate_mcp_server, McpConfigScope, McpFileConfig,
    McpServerConfig, ResolvedMcpServerConfig,
};
use std::path::{Path, PathBuf};
use std::fs;
use dirs::home_dir;

const MCP_FILE_NAME: &str = "mcps.json";
const LEGACY_MCP_FILE_NAME: &str = "mcp.json";

pub struct ConfigManager {
    user_config_dir: PathBuf,
    project_config_dir: Option<PathBuf>,
    projects_config: ProjectsConfig,
}

impl ConfigManager {
    pub fn new() -> Result<Self, ConfigError> {
        let user_config_dir = home_dir()
            .ok_or(ConfigError::HomeDirNotFound)?
            .join(".slate");

        // 创建用户配置目录
        fs::create_dir_all(&user_config_dir)?;

        // 创建默认配置文件（如果不存在）
        Self::create_default_configs(&user_config_dir)?;

        // 读取 projects.json
        let projects_config = Self::load_projects_config(&user_config_dir)?;

        let project_config_dir = projects_config
            .current_project
            .as_ref()
            .map(|path| PathBuf::from(path).join(".slate"));

        Ok(Self {
            user_config_dir,
            project_config_dir,
            projects_config,
        })
    }

    fn load_projects_config(dir: &PathBuf) -> Result<ProjectsConfig, ConfigError> {
        let path = dir.join("projects.json");
        if !path.exists() {
            return Ok(ProjectsConfig::default());
        }
        let content = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&content)?)
    }

    fn save_projects_config(&mut self) -> Result<(), ConfigError> {
        let path = self.user_config_dir.join("projects.json");
        let content = serde_json::to_string_pretty(&self.projects_config)?;
        fs::write(&path, content)?;
        Ok(())
    }

    pub fn set_and_record_project(&mut self, path: &Path) -> Result<(), ConfigError> {
        let project_path = path.to_string_lossy().to_string();
        let project_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        // 检查是否有项目配置
        let has_config = path.join(".slate/config.json").exists();

        // 更新或添加项目记录
        let record = ProjectRecord {
            path: project_path.clone(),
            name: project_name.clone(),
            last_opened: chrono::Utc::now().to_rfc3339(),
            open_files: Vec::new(),
            has_config,
        };

        self.projects_config.recent_projects
            .retain(|p| p.path != project_path);
        self.projects_config.recent_projects.insert(0, record);

        // 只保留最近 20 个项目
        if self.projects_config.recent_projects.len() > 20 {
            self.projects_config.recent_projects.truncate(20);
        }

        self.projects_config.current_project = Some(project_path.clone());
        self.project_config_dir = Some(path.join(".slate"));

        self.save_projects_config()?;
        Ok(())
    }

    pub fn get_recent_projects(&self) -> &[ProjectRecord] {
        &self.projects_config.recent_projects
    }

    pub fn get_current_project(&self) -> Option<&str> {
        self.projects_config.current_project.as_deref()
    }

    pub fn remove_project(&mut self, path: &str) -> Result<(), ConfigError> {
        self.projects_config.recent_projects
            .retain(|p| p.path != path);

        // 如果删除的是当前项目，清除当前项目
        if self.projects_config.current_project.as_deref() == Some(path) {
            self.projects_config.current_project = None;
        }

        self.save_projects_config()?;
        Ok(())
    }

    fn create_default_configs(dir: &PathBuf) -> Result<(), ConfigError> {
        // settings.json - 首次启动时创建
        let settings_path = dir.join("settings.json");
        if !settings_path.exists() {
            let default_settings = Settings::default();
            let content = serde_json::to_string_pretty(&default_settings)?;
            fs::write(&settings_path, content)?;
        }

        // config.json - 首次启动时创建
        let config_path = dir.join("config.json");
        if !config_path.exists() {
            let default_config = Config::default();
            let content = serde_json::to_string_pretty(&default_config)?;
            fs::write(&config_path, content)?;
        }

        // mcps.json - 按需创建，不在首次启动时创建

        Ok(())
    }

    pub fn get_merged_config(&self) -> Result<MergedConfig, ConfigError> {
        // 读取用户配置
        let settings: Settings = self.read_json("settings.json")?;
        let config: Config = self.read_json("config.json")?;

        // mcps.json 按需读取，并兼容旧版 mcp.json
        let mcp: MCPConfig =
            self.read_json_optional_with_fallback(MCP_FILE_NAME, LEGACY_MCP_FILE_NAME)?;

        // TODO: 如果有项目配置，合并配置

        Ok(MergedConfig {
            settings,
            config,
            mcp,
        })
    }

    fn read_json_optional<T>(&self, filename: &str) -> Result<T, ConfigError>
    where
        T: for<'de> serde::Deserialize<'de> + Default,
    {
        let path = self.user_config_dir.join(filename);
        if !path.exists() {
            return Ok(T::default());
        }
        let content = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&content)?)
    }

    fn read_json_optional_with_fallback<T>(
        &self,
        filename: &str,
        fallback_filename: &str,
    ) -> Result<T, ConfigError>
    where
        T: for<'de> serde::Deserialize<'de> + Default,
    {
        let primary_path = self.user_config_dir.join(filename);
        if primary_path.exists() {
            let content = fs::read_to_string(&primary_path)?;
            return Ok(serde_json::from_str(&content)?);
        }

        self.read_json_optional(fallback_filename)
    }

    fn read_json<T>(&self, filename: &str) -> Result<T, ConfigError>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let path = self.user_config_dir.join(filename);
        let content = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&content)?)
    }

    pub fn save_settings(&self, settings: &Settings) -> Result<(), ConfigError> {
        let path = self.user_config_dir.join("settings.json");
        let content = serde_json::to_string_pretty(settings)?;
        fs::write(&path, content)?;
        Ok(())
    }

    pub fn get_effective_mcp_servers(&self) -> Result<Vec<ResolvedMcpServerConfig>, ConfigError> {
        let global_config = self.read_mcp_scope(McpConfigScope::Global)?;
        let project_config = self.read_mcp_scope_optional(McpConfigScope::Project)?;

        let mut order = Vec::new();
        let mut merged = std::collections::HashMap::new();

        for server in global_config.servers {
            let id = server.id.clone();
            order.push(id.clone());
            merged.insert(
                id,
                ResolvedMcpServerConfig {
                    server,
                    scope: McpConfigScope::Global,
                },
            );
        }

        if let Some(project) = project_config {
            for server in project.servers {
                let id = server.id.clone();
                if !merged.contains_key(&id) {
                    order.push(id.clone());
                }
                merged.insert(
                    id.clone(),
                    ResolvedMcpServerConfig {
                        server,
                        scope: McpConfigScope::Project,
                    },
                );
            }
        }

        Ok(order
            .into_iter()
            .filter_map(|id| merged.remove(&id))
            .collect())
    }

    pub fn upsert_mcp_server(
        &self,
        scope: McpConfigScope,
        mut server: McpServerConfig,
        approve: bool,
    ) -> Result<(), ConfigError> {
        validate_mcp_server(&server).map_err(ConfigError::InvalidConfig)?;

        let mut config = self.read_mcp_scope(scope)?;
        let current_fingerprint = compute_approval_fingerprint(&server);
        let existing = config.servers.iter().find(|item| item.id == server.id);

        server.approval_fingerprint = if approve {
            Some(current_fingerprint)
        } else if let Some(existing) = existing {
            if existing
                .approval_fingerprint
                .as_deref()
                == Some(current_fingerprint.as_str())
            {
                Some(current_fingerprint)
            } else {
                None
            }
        } else {
            None
        };

        if let Some(existing) = config.servers.iter_mut().find(|item| item.id == server.id) {
            *existing = server;
        } else {
            config.servers.push(server);
        }

        self.write_mcp_scope(scope, &config)?;
        Ok(())
    }

    pub fn remove_mcp_server(
        &self,
        scope: McpConfigScope,
        id: &str,
    ) -> Result<(), ConfigError> {
        let mut config = self.read_mcp_scope(scope)?;
        config.servers.retain(|server| server.id != id);
        self.write_mcp_scope(scope, &config)?;
        Ok(())
    }

    pub fn set_mcp_server_enabled(
        &self,
        scope: McpConfigScope,
        id: &str,
        enabled: bool,
        approve: bool,
    ) -> Result<(), ConfigError> {
        let mut config = self.read_mcp_scope(scope)?;
        let server = config
            .servers
            .iter_mut()
            .find(|server| server.id == id)
            .ok_or_else(|| ConfigError::PathNotFound(format!("MCP server not found: {}", id)))?;

        server.enabled = enabled;
        if approve {
            server.approval_fingerprint = Some(compute_approval_fingerprint(server));
        }

        self.write_mcp_scope(scope, &config)?;
        Ok(())
    }

    pub fn approve_mcp_server(
        &self,
        scope: McpConfigScope,
        id: &str,
    ) -> Result<(), ConfigError> {
        let mut config = self.read_mcp_scope(scope)?;
        let server = config
            .servers
            .iter_mut()
            .find(|server| server.id == id)
            .ok_or_else(|| ConfigError::PathNotFound(format!("MCP server not found: {}", id)))?;
        server.approval_fingerprint = Some(compute_approval_fingerprint(server));
        self.write_mcp_scope(scope, &config)?;
        Ok(())
    }

    pub fn get_config_dir(&self) -> &PathBuf {
        &self.user_config_dir
    }

    fn read_mcp_scope_optional(
        &self,
        scope: McpConfigScope,
    ) -> Result<Option<McpFileConfig>, ConfigError> {
        let (path, legacy_path) = match self.get_mcp_scope_paths(scope)? {
            Some(paths) => paths,
            None => return Ok(None),
        };

        let target_path = if path.exists() {
            path
        } else if let Some(legacy_path) = legacy_path.filter(|legacy| legacy.exists()) {
            legacy_path
        } else {
            return Ok(None);
        };

        let content = fs::read_to_string(&target_path)?;
        let config: McpFileConfig = serde_json::from_str(&content)?;
        Ok(Some(config))
    }

    fn read_mcp_scope(&self, scope: McpConfigScope) -> Result<McpFileConfig, ConfigError> {
        Ok(self.read_mcp_scope_optional(scope)?.unwrap_or_default())
    }

    fn write_mcp_scope(
        &self,
        scope: McpConfigScope,
        config: &McpFileConfig,
    ) -> Result<(), ConfigError> {
        let (path, legacy_path) = self
            .get_mcp_scope_paths(scope)?
            .ok_or_else(|| ConfigError::InvalidConfig("当前没有打开项目，无法写入项目级 MCP 配置".into()))?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(config)?;
        fs::write(&path, content)?;

        if let Some(legacy_path) = legacy_path {
            if legacy_path.exists() {
                let _ = fs::remove_file(legacy_path);
            }
        }

        Ok(())
    }

    fn get_mcp_scope_paths(
        &self,
        scope: McpConfigScope,
    ) -> Result<Option<(PathBuf, Option<PathBuf>)>, ConfigError> {
        match scope {
            McpConfigScope::Global => Ok(Some((
                self.user_config_dir.join(MCP_FILE_NAME),
                Some(self.user_config_dir.join(LEGACY_MCP_FILE_NAME)),
            ))),
            McpConfigScope::Project => Ok(self.project_config_dir.as_ref().map(|dir| {
                (
                    dir.join(MCP_FILE_NAME),
                    Some(dir.join(LEGACY_MCP_FILE_NAME)),
                )
            })),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MergedConfig {
    pub settings: Settings,
    pub config: Config,
    pub mcp: MCPConfig,
}
