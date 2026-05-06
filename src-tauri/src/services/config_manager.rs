use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};
use crate::models::AppSettings;

#[derive(Debug, Clone)]
pub struct ConfigManager {
    codex_root: PathBuf,
    data_root: PathBuf,
    settings_path: PathBuf,
    sessions_dir: PathBuf,
    memory_dir: PathBuf,
    backups_dir: PathBuf,
}

impl ConfigManager {
    pub fn new() -> AppResult<Self> {
        let home = std::env::var("HOME")
            .map(PathBuf::from)
            .map_err(|_| AppError::Message("Não foi possível resolver HOME".to_owned()))?;

        let codex_root = home.join(".codex");
        let data_root = codex_root.join("codex-ui");
        let settings_path = data_root.join("settings.json");
        let sessions_dir = data_root.join("sessions");
        let memory_dir = data_root.join("memory");
        let backups_dir = data_root.join("backups");

        let manager = Self {
            codex_root,
            data_root,
            settings_path,
            sessions_dir,
            memory_dir,
            backups_dir,
        };
        manager.ensure_dirs()?;
        Ok(manager)
    }

    fn ensure_dirs(&self) -> AppResult<()> {
        fs::create_dir_all(&self.data_root)?;
        fs::create_dir_all(&self.sessions_dir)?;
        fs::create_dir_all(&self.memory_dir)?;
        fs::create_dir_all(&self.backups_dir)?;
        Ok(())
    }

    pub fn load_or_create_settings(&self) -> AppResult<AppSettings> {
        if self.settings_path.exists() {
            let raw = fs::read_to_string(&self.settings_path)?;
            let settings: AppSettings = serde_json::from_str(&raw)?;
            return Ok(settings);
        }

        let defaults = AppSettings::defaults(
            &self
                .home_dir()
                .to_str()
                .ok_or_else(|| AppError::Message("HOME inválido".to_owned()))?
                .to_owned(),
        );
        self.save_settings(&defaults)?;
        Ok(defaults)
    }

    pub fn save_settings(&self, settings: &AppSettings) -> AppResult<()> {
        let body = serde_json::to_string_pretty(settings)?;
        fs::write(&self.settings_path, body)?;
        Ok(())
    }

    pub fn update_settings(&self, settings: AppSettings) -> AppResult<AppSettings> {
        self.save_settings(&settings)?;
        Ok(settings)
    }

    pub fn codex_root(&self) -> &Path {
        &self.codex_root
    }

    pub fn sessions_dir(&self) -> &Path {
        &self.sessions_dir
    }

    pub fn memory_dir(&self) -> &Path {
        &self.memory_dir
    }

    pub fn home_dir(&self) -> PathBuf {
        self.codex_root
            .parent()
            .map_or_else(|| PathBuf::from("/home/lucas"), PathBuf::from)
    }

    pub fn make_backup(&self, source: &Path, prefix: &str) -> AppResult<Option<PathBuf>> {
        if !source.exists() {
            return Ok(None);
        }
        let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S").to_string();
        let file_name = source
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| AppError::Message("Nome de arquivo inválido para backup".to_owned()))?;
        let backup = self
            .backups_dir
            .join(format!("{prefix}-{timestamp}-{file_name}.bak"));
        fs::copy(source, &backup)?;
        Ok(Some(backup))
    }
}
