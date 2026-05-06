use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::{Mutex, RwLock};
use serde_json::Value;

use crate::error::AppResult;
use crate::models::{AppSettings, SystemTheme};
use crate::services::command_executor::CommandExecutor;
use crate::services::config_manager::ConfigManager;
use crate::services::credential_store::CredentialStore;
use crate::services::file_watcher::{FileWatcherService, RunningWatcher};
use crate::services::local_runtime::LocalRuntimeService;
use crate::services::memory_manager::MemoryManager;
use crate::services::permission_manager::PermissionManager;
use crate::services::privileged_helper_client::PrivilegedHelperClient;
use crate::services::provider_registry::ProviderRegistry;
use crate::services::session_manager::SessionManager;
use crate::services::vscode_bridge::VscodeBridge;

pub struct AppState {
    pub config_manager: Arc<ConfigManager>,
    pub session_manager: Arc<SessionManager>,
    pub memory_manager: Arc<MemoryManager>,
    pub permission_manager: Arc<PermissionManager>,
    pub privileged_helper_client: Arc<PrivilegedHelperClient>,
    pub credential_store: Arc<CredentialStore>,
    pub provider_registry: Arc<ProviderRegistry>,
    pub local_runtime_service: Arc<LocalRuntimeService>,
    pub command_executor: Arc<CommandExecutor>,
    pub vscode_bridge: Arc<VscodeBridge>,
    pub file_watcher_service: Arc<FileWatcherService>,
    pub file_watcher: Mutex<Option<RunningWatcher>>,
    settings: RwLock<AppSettings>,
}

impl AppState {
    pub fn new() -> AppResult<Self> {
        let config_manager = Arc::new(ConfigManager::new()?);
        let settings = config_manager.load_or_create_settings()?;
        let workspace_root = settings.workspace_root.clone();
        let codex_data_root = config_manager.codex_root().join("codex-ui");
        let session_manager = Arc::new(SessionManager::new(config_manager.sessions_dir())?);
        let memory_manager = Arc::new(MemoryManager::new(
            config_manager.codex_root(),
            config_manager.memory_dir(),
        )?);
        let credential_store = Arc::new(CredentialStore::new(config_manager.credentials_path())?);

        Ok(Self {
            config_manager,
            session_manager,
            memory_manager,
            permission_manager: Arc::new(PermissionManager::new()),
            privileged_helper_client: Arc::new(PrivilegedHelperClient::new(
                codex_data_root.as_path(),
                PathBuf::from(workspace_root).as_path(),
            )),
            credential_store: credential_store.clone(),
            provider_registry: Arc::new(ProviderRegistry::new(credential_store)),
            local_runtime_service: Arc::new(LocalRuntimeService::new()),
            command_executor: Arc::new(CommandExecutor),
            vscode_bridge: Arc::new(VscodeBridge),
            file_watcher_service: Arc::new(FileWatcherService),
            file_watcher: Mutex::new(None),
            settings: RwLock::new(settings),
        })
    }

    pub fn settings(&self) -> AppSettings {
        self.settings.read().clone()
    }

    pub fn set_settings(&self, settings: AppSettings) {
        *self.settings.write() = settings;
    }

    pub fn load_system_theme(&self) -> SystemTheme {
        let home = self.config_manager.home_dir();
        let generated = home.join(".local/state/quickshell/user/generated/colors.json");

        if let Ok(content) = fs::read_to_string(generated) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                let accent_primary = json
                    .get("primary")
                    .and_then(Value::as_str)
                    .unwrap_or("#2d95ec")
                    .to_owned();
                let accent_secondary = json
                    .get("primary_container")
                    .and_then(Value::as_str)
                    .or_else(|| json.get("secondary").and_then(Value::as_str))
                    .or_else(|| json.get("surface_tint").and_then(Value::as_str))
                    .unwrap_or("#9dcaff")
                    .to_owned();
                let background = json
                    .get("background")
                    .and_then(Value::as_str)
                    .unwrap_or("#000000")
                    .to_owned();

                return SystemTheme {
                    source: "~/.local/state/quickshell/user/generated/colors.json".to_owned(),
                    accent_primary,
                    accent_secondary,
                    background,
                };
            }
        }

        SystemTheme {
            source: "fallback".to_owned(),
            accent_primary: "#2d95ec".to_owned(),
            accent_secondary: "#9dcaff".to_owned(),
            background: "#000000".to_owned(),
        }
    }
}
