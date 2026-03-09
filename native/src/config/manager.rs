use super::types::*;
use super::error::ConfigError;
use std::path::{Path, PathBuf};
use std::fs;
use dirs::home_dir;

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

        Ok(Self {
            user_config_dir,
            project_config_dir: None,
            projects_config,
        })
    }

    pub fn set_project_dir(&mut self, path: &Path) {
        // 只记录项目配置目录路径，不主动创建
        // 项目配置文件仅在用户手动添加时才创建
        self.project_config_dir = Some(path.join(".slate"));
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

        // mcp.json - 按需创建，不在首次启动时创建

        Ok(())
    }

    pub fn get_merged_config(&self) -> Result<MergedConfig, ConfigError> {
        // 读取用户配置
        let settings: Settings = self.read_json("settings.json")?;
        let config: Config = self.read_json("config.json")?;

        // mcp.json 按需读取，如果不存在则返回空配置
        let mcp: MCPConfig = self.read_json_optional("mcp.json")?;

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

    pub fn get_config_dir(&self) -> &PathBuf {
        &self.user_config_dir
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MergedConfig {
    pub settings: Settings,
    pub config: Config,
    pub mcp: MCPConfig,
}
