use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: ChatRole,
    pub content: String,
    pub created_at: String,
    pub reasoning_summary: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChatRole {
    User,
    Assistant,
    System,
    Tool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSession {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub status: SessionStatus,
    pub messages: Vec<ChatMessage>,
    pub tasks: Vec<SessionTask>,
    #[serde(default)]
    pub provider_id: Option<String>,
    #[serde(default)]
    pub model_id: Option<String>,
    #[serde(default)]
    pub agent_profile_id: Option<String>,
    #[serde(default)]
    pub account_profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Idle,
    Planning,
    Diagnosing,
    WaitingApproval,
    Executing,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTask {
    pub id: String,
    pub title: String,
    pub status: TaskStatus,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    Running,
    Done,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionCategory {
    SafeRead,
    WorkspaceWrite,
    ExternalWrite,
    Network,
    Privileged,
    PackageInstall,
    CriticalSystem,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionRequestStatus {
    Pending,
    Approved,
    Denied,
    Running,
    Success,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionDecision {
    AllowOnce,
    DenyOnce,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRequest {
    pub id: String,
    pub title: String,
    pub description: String,
    pub session_id: String,
    pub command: String,
    pub action_id: Option<String>,
    pub dry_run: bool,
    pub cwd: String,
    pub category: PermissionCategory,
    pub risk: String,
    pub risk_level: RiskLevel,
    pub requires_high_confirmation: bool,
    pub target: String,
    pub rollback: Option<String>,
    pub reason: String,
    pub requested_at: String,
    pub status: PermissionRequestStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandLogChunk {
    pub execution_id: String,
    pub session_id: String,
    pub stream: LogStream,
    pub line: String,
    pub at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogStream {
    Stdout,
    Stderr,
    Meta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeEntry {
    pub path: String,
    pub event: FileEventKind,
    pub at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileEventKind {
    Create,
    Modify,
    Remove,
    Rename,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProfile {
    pub id: String,
    pub label: String,
    pub description: String,
    pub mode: AgentMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentMode {
    Rapido,
    Equilibrado,
    Profundo,
    Agressivo,
    Seguro,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDescriptor {
    pub id: String,
    pub label: String,
    pub provider_id: String,
    pub context_window: Option<u32>,
    pub supports_tools: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderStatusState {
    Mock,
    Unavailable,
    NotConfigured,
    Ready,
    Running,
    Error,
    RequiresApiKey,
    InvalidApiKey,
    Forbidden,
    RequiresLogin,
    RequiresOauth,
    RequiresCliAuth,
    NotInstalled,
    ServiceOffline,
    ApiUnreachable,
    ModelMissing,
    Installing,
    Pulling,
    Testing,
    QuotaExceeded,
    RateLimited,
    ProviderUnavailable,
    Misconfigured,
    Experimental,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRuntimeStatus {
    pub state: ProviderStatusState,
    pub message: String,
    pub command: Option<String>,
    pub version: Option<String>,
    pub checked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderDescriptor {
    pub id: String,
    pub label: String,
    pub configurable: bool,
    pub enabled: bool,
    pub status: ProviderRuntimeStatus,
    pub models: Vec<ModelDescriptor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCredentialStatus {
    pub provider_id: String,
    pub has_credential: bool,
    pub masked_key: Option<String>,
    pub source: Option<String>,
    pub checked_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderAuthType {
    ApiKey,
    Oauth,
    CliAuth,
    Local,
    Login,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderAccountStatus {
    Ready,
    RequiresApiKey,
    InvalidApiKey,
    Forbidden,
    RequiresLogin,
    RequiresOauth,
    RequiresCliAuth,
    Testing,
    Misconfigured,
    QuotaExceeded,
    RateLimited,
    ProviderUnavailable,
    Experimental,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderAccountProfile {
    pub id: String,
    pub provider_id: String,
    pub provider_label: String,
    pub name: String,
    pub auth_type: ProviderAuthType,
    pub status: ProviderAccountStatus,
    pub masked_credential: Option<String>,
    pub source: Option<String>,
    pub last_tested_at: Option<String>,
    pub default_model_id: Option<String>,
    pub is_default: bool,
    pub message: String,
    pub limits_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemTheme {
    pub source: String,
    pub accent_primary: String,
    pub accent_secondary: String,
    pub background: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMeta {
    pub root: String,
    pub repo_name: String,
    pub branch: Option<String>,
    pub head_short: Option<String>,
    pub dirty: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionMode {
    Cloud,
    Local,
}

impl Default for ExecutionMode {
    fn default() -> Self {
        Self::Cloud
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ThemePreference {
    System,
    Light,
    Dark,
}

impl Default for ThemePreference {
    fn default() -> Self {
        Self::Dark
    }
}

fn default_ai_response_language() -> String {
    "pt-BR".to_owned()
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPersonalizationSettings {
    pub memories_stored: bool,
    pub reference_chat_history: bool,
    pub web_page_extraction: bool,
    pub image_search: bool,
    pub web_search: bool,
    pub image_generation: bool,
    pub code_interpreter: bool,
    pub recover_historical_memories: bool,
    pub image_editing: bool,
    pub memory_update: bool,
    pub local_image_upscaling: bool,
}

impl Default for AppPersonalizationSettings {
    fn default() -> Self {
        Self {
            memories_stored: true,
            reference_chat_history: true,
            web_page_extraction: false,
            image_search: false,
            web_search: true,
            image_generation: false,
            code_interpreter: true,
            recover_historical_memories: true,
            image_editing: false,
            memory_update: true,
            local_image_upscaling: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSelectionHistoryEntry {
    pub mode: ExecutionMode,
    pub provider_id: String,
    pub model_id: String,
    pub at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub workspace_root: String,
    pub codex_root: String,
    pub selected_provider_id: String,
    pub selected_model_id: String,
    pub selected_agent_id: String,
    #[serde(default)]
    pub selected_provider_profile_id: Option<String>,
    pub preferred_shell: String,
    pub auto_approve_safe_read: bool,
    #[serde(default)]
    pub execution_mode: ExecutionMode,
    #[serde(default)]
    pub selected_local_model_id: Option<String>,
    #[serde(default)]
    pub model_selection_history: Vec<ModelSelectionHistoryEntry>,
    #[serde(default = "default_local_models_root")]
    pub local_models_root: String,
    #[serde(default)]
    pub theme_preference: ThemePreference,
    #[serde(default = "default_ai_response_language")]
    pub ai_response_language: String,
    #[serde(default = "default_true")]
    pub auto_generate_titles: bool,
    #[serde(default)]
    pub auto_copy_responses: bool,
    #[serde(default = "default_true")]
    pub paste_large_text_as_file: bool,
    #[serde(default)]
    pub personalization: AppPersonalizationSettings,
}

impl AppSettings {
    pub fn defaults(home: &str) -> Self {
        Self {
            workspace_root: default_workspace_root(home),
            codex_root: format!("{home}/.codex"),
            selected_provider_id: "gemini-cli".to_owned(),
            selected_model_id: "gemini-cli-default".to_owned(),
            selected_agent_id: "equilibrado".to_owned(),
            selected_provider_profile_id: None,
            preferred_shell: "/usr/bin/bash".to_owned(),
            auto_approve_safe_read: true,
            execution_mode: ExecutionMode::Cloud,
            selected_local_model_id: None,
            model_selection_history: Vec::new(),
            local_models_root: format!("{home}/.codex/models"),
            theme_preference: ThemePreference::Dark,
            ai_response_language: default_ai_response_language(),
            auto_generate_titles: true,
            auto_copy_responses: false,
            paste_large_text_as_file: true,
            personalization: AppPersonalizationSettings::default(),
        }
    }
}

fn default_local_models_root() -> String {
    if let Ok(home) = std::env::var("HOME") {
        return format!("{home}/.codex/models");
    }
    "~/.codex/models".to_owned()
}

fn default_workspace_root(home: &str) -> String {
    let path = format!("{home}/Codex-Codex");
    if Path::new(&path).exists() {
        return path;
    }
    home.to_owned()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySnapshot {
    pub profile_summary: String,
    pub user_preferences: Vec<String>,
    pub active_projects: Vec<String>,
    pub important_fix_history: Vec<String>,
    pub operational_policies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapPayload {
    pub settings: AppSettings,
    pub workspace_meta: WorkspaceMeta,
    pub sessions: Vec<AgentSession>,
    pub pending_permissions: Vec<PermissionRequest>,
    pub providers: Vec<ProviderDescriptor>,
    pub provider_profiles: Vec<ProviderAccountProfile>,
    pub agent_profiles: Vec<AgentProfile>,
    pub memory: MemorySnapshot,
    pub theme: SystemTheme,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LocalRuntimeState {
    Ready,
    NotConfigured,
    Unavailable,
    Running,
    Installing,
    ServiceOffline,
    ApiUnreachable,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalInstalledModel {
    pub id: String,
    pub size: Option<String>,
    pub modified_at: Option<String>,
    pub digest: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRuntimeSnapshot {
    pub state: LocalRuntimeState,
    pub message: String,
    pub command: Option<String>,
    pub version: Option<String>,
    pub runtime_path: Option<String>,
    pub install_command: Option<String>,
    pub models_dir: String,
    pub installed_models: Vec<LocalInstalledModel>,
    pub active_model_id: Option<String>,
    pub installed: bool,
    pub service_active: bool,
    pub api_reachable: bool,
    pub api_url: String,
    pub can_use_pacman: bool,
    pub has_pkexec: bool,
    pub has_sudo: bool,
    pub disk_ok: Option<bool>,
    pub problems: Vec<String>,
    pub repair_actions: Vec<String>,
    pub at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LocalModelInstallState {
    Running,
    Completed,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelInstallProgress {
    pub model_id: String,
    pub state: LocalModelInstallState,
    pub progress_percent: Option<u8>,
    pub message: String,
    pub at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionRequestInput {
    pub session_id: String,
    pub command: String,
    pub cwd: Option<String>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionResponse {
    pub execution_id: Option<String>,
    pub approval_required: bool,
    pub permission_request: Option<PermissionRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderGenerateRequest {
    pub provider_id: String,
    pub model_id: String,
    pub prompt: String,
    #[serde(default)]
    pub attachments: Vec<Value>,
    pub workspace_root: String,
    #[serde(default)]
    pub account_profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRunResult {
    pub content: String,
    pub status: ProviderRuntimeStatus,
    pub command: Option<String>,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusNote {
    pub id: String,
    pub session_id: String,
    pub kind: StatusKind,
    pub title: String,
    pub detail: String,
    pub at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionableErrorSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionableError {
    pub code: String,
    pub severity: ActionableErrorSeverity,
    pub message: String,
    pub action_label: Option<String>,
    pub action_target: Option<String>,
    pub technical_details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppHealthProvider {
    pub id: String,
    pub status: ProviderRuntimeStatus,
    pub has_key: bool,
    pub profile_count: Option<usize>,
    pub selected_profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppHealthAction {
    pub label: String,
    pub command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AppHealthOverallStatus {
    Ok,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppHealthCheck {
    pub base_dir: String,
    pub expected_base_dir: String,
    pub correct_base_dir: bool,
    pub branch: Option<String>,
    pub node_ok: bool,
    pub npm_ok: bool,
    pub cargo_ok: bool,
    pub tauri_ok: bool,
    pub providers: Vec<AppHealthProvider>,
    pub ollama: LocalRuntimeSnapshot,
    pub sessions_count: Option<usize>,
    pub active_session_id: Option<String>,
    pub storage_root: Option<String>,
    pub credentials_encrypted: Option<bool>,
    pub recent_errors: Vec<ActionableError>,
    pub overall_status: AppHealthOverallStatus,
    pub actions: Vec<AppHealthAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionExportFormat {
    Markdown,
    Json,
    Txt,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionExportResult {
    pub path: String,
    pub format: SessionExportFormat,
    pub bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StatusKind {
    Info,
    Success,
    Warn,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandRunIntent {
    pub request: PermissionRequest,
    pub kind: PendingIntentKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivilegedActionRequestInput {
    pub session_id: String,
    pub action_id: String,
    pub args: serde_json::Value,
    pub reason: String,
    pub dry_run: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PendingIntentKind {
    Command(ExecutionRequestInput),
    Privileged(PrivilegedActionRequestInput),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivilegedActionSpec {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: PermissionCategory,
    pub risk_level: RiskLevel,
    pub target_hint: String,
    pub rollback_hint: Option<String>,
    pub requires_high_confirmation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionOutcomeStatus {
    Success,
    Failed,
    Denied,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionOutcome {
    pub request_id: String,
    pub session_id: String,
    pub status: PermissionOutcomeStatus,
    pub summary: String,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
    pub at: String,
}

pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}
