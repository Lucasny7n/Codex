use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: ChatRole,
    pub content: String,
    pub created_at: String,
    pub reasoning_summary: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub workspace_root: String,
    pub codex_root: String,
    pub selected_provider_id: String,
    pub selected_model_id: String,
    pub selected_agent_id: String,
    pub preferred_shell: String,
    pub auto_approve_safe_read: bool,
}

impl AppSettings {
    pub fn defaults(home: &str) -> Self {
        Self {
            workspace_root: default_workspace_root(home),
            codex_root: format!("{home}/.codex"),
            selected_provider_id: "gemini-cli".to_owned(),
            selected_model_id: "gemini-cli-default".to_owned(),
            selected_agent_id: "equilibrado".to_owned(),
            preferred_shell: "/usr/bin/bash".to_owned(),
            auto_approve_safe_read: true,
        }
    }
}

fn default_workspace_root(home: &str) -> String {
    for candidate in ["Codex-Codex", "Codex"] {
        let path = format!("{home}/{candidate}");
        if Path::new(&path).exists() {
            return path;
        }
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
    pub agent_profiles: Vec<AgentProfile>,
    pub memory: MemorySnapshot,
    pub theme: SystemTheme,
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
    pub workspace_root: String,
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
