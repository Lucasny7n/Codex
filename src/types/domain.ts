export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  reasoningSummary?: string;
}

export interface AgentSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  messages: ChatMessage[];
  tasks: SessionTask[];
  providerId?: string;
  modelId?: string;
  agentProfileId?: string;
  accountProfileId?: string;
}

export type SessionStatus =
  | 'idle'
  | 'ready'
  | 'planning'
  | 'diagnosing'
  | 'waiting_approval'
  | 'executing'
  | 'running'
  | 'installing'
  | 'completed'
  | 'error';

export interface SessionTask {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

export type PermissionCategory =
  | 'safe_read'
  | 'workspace_write'
  | 'external_write'
  | 'network'
  | 'privileged'
  | 'package_install'
  | 'critical_system';

export type PermissionDecision = 'allow_once' | 'deny_once';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type PermissionRequestStatus = 'pending' | 'approved' | 'denied' | 'running' | 'success' | 'failed';

export interface PermissionRequest {
  id: string;
  title: string;
  description: string;
  sessionId: string;
  command: string;
  actionId?: string;
  dryRun: boolean;
  cwd: string;
  category: PermissionCategory;
  risk: string;
  riskLevel: RiskLevel;
  requiresHighConfirmation: boolean;
  target: string;
  rollback?: string;
  reason: string;
  requestedAt: string;
  status: PermissionRequestStatus;
}

export interface PermissionOutcome {
  requestId: string;
  sessionId: string;
  status: 'success' | 'failed' | 'denied' | 'blocked';
  summary: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  at: string;
}

export interface CommandLogChunk {
  executionId: string;
  sessionId: string;
  stream: 'stdout' | 'stderr' | 'meta';
  line: string;
  at: string;
}

export interface FileChangeEntry {
  path: string;
  event: 'create' | 'modify' | 'remove' | 'rename';
  at: string;
}

export interface AgentProfile {
  id: string;
  label: string;
  description: string;
  mode: 'rapido' | 'equilibrado' | 'profundo' | 'agressivo' | 'seguro';
}

export interface ModelDescriptor {
  id: string;
  label: string;
  providerId: string;
  contextWindow?: number;
  supportsTools: boolean;
}

export type ProviderStatusState =
  | 'mock'
  | 'unavailable'
  | 'not_configured'
  | 'ready'
  | 'running'
  | 'error'
  | 'requires_api_key'
  | 'requires_login'
  | 'requires_oauth'
  | 'requires_cli_auth'
  | 'not_installed'
  | 'service_offline'
  | 'api_unreachable'
  | 'model_missing'
  | 'installing'
  | 'pulling'
  | 'testing'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'misconfigured'
  | 'experimental';

export interface ProviderRuntimeStatus {
  state: ProviderStatusState;
  message: string;
  command?: string;
  version?: string;
  checkedAt: string;
}

export interface ProviderDescriptor {
  id: string;
  label: string;
  configurable: boolean;
  enabled: boolean;
  status: ProviderRuntimeStatus;
  models: ModelDescriptor[];
}

export interface ProviderCredentialStatus {
  providerId: string;
  hasCredential: boolean;
  maskedKey?: string;
  source?: string;
  checkedAt: string;
}

export type ProviderAuthType = 'api_key' | 'oauth' | 'cli_auth' | 'local' | 'login' | 'none';
export type ProviderAccountStatus =
  | 'ready'
  | 'requires_api_key'
  | 'requires_login'
  | 'requires_oauth'
  | 'requires_cli_auth'
  | 'testing'
  | 'misconfigured'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'experimental'
  | 'unavailable';

export interface ProviderAccountProfile {
  id: string;
  providerId: string;
  providerLabel: string;
  name: string;
  authType: ProviderAuthType;
  status: ProviderAccountStatus;
  maskedCredential?: string;
  source?: string;
  lastTestedAt?: string;
  lastValidatedAt?: string;
  defaultModelId?: string;
  isDefault: boolean;
  message: string;
  limitsHint?: string;
}

export interface SystemTheme {
  source: string;
  accentPrimary: string;
  accentSecondary: string;
  background: string;
}

export interface WorkspaceMeta {
  root: string;
  repoName: string;
  branch?: string;
  headShort?: string;
  dirty: boolean;
}

export type ExecutionMode = 'cloud' | 'local';

export interface ModelSelectionHistoryEntry {
  mode: ExecutionMode;
  providerId: string;
  modelId: string;
  at: string;
}

export interface AppSettings {
  workspaceRoot: string;
  codexRoot: string;
  selectedProviderId: string;
  selectedModelId: string;
  selectedAgentId: string;
  selectedProviderProfileId?: string;
  preferredShell: string;
  autoApproveSafeRead: boolean;
  executionMode: ExecutionMode;
  selectedLocalModelId?: string;
  modelSelectionHistory: ModelSelectionHistoryEntry[];
  localModelsRoot: string;
}

export interface MemorySnapshot {
  profileSummary: string;
  userPreferences: string[];
  activeProjects: string[];
  importantFixHistory: string[];
  operationalPolicies: string[];
}

export interface BootstrapPayload {
  settings: AppSettings;
  workspaceMeta: WorkspaceMeta;
  sessions: AgentSession[];
  pendingPermissions: PermissionRequest[];
  providers: ProviderDescriptor[];
  providerProfiles: ProviderAccountProfile[];
  agentProfiles: AgentProfile[];
  memory: MemorySnapshot;
  theme: SystemTheme;
}

export interface ExecutionRequestInput {
  sessionId: string;
  command: string;
  cwd?: string;
  reason: string;
}

export interface PrivilegedActionRequestInput {
  sessionId: string;
  actionId: string;
  args: Record<string, unknown>;
  reason: string;
  dryRun: boolean;
}

export interface PrivilegedActionSpec {
  id: string;
  title: string;
  description: string;
  category: PermissionCategory;
  riskLevel: RiskLevel;
  targetHint: string;
  rollbackHint?: string;
  requiresHighConfirmation: boolean;
}

export interface ExecutionResponse {
  executionId?: string;
  approvalRequired: boolean;
  permissionRequest?: PermissionRequest;
}

export interface StatusNote {
  id: string;
  sessionId: string;
  kind: 'info' | 'success' | 'warn' | 'error';
  title: string;
  detail: string;
  at: string;
}

export type LocalRuntimeState =
  | 'ready'
  | 'not_configured'
  | 'unavailable'
  | 'running'
  | 'installing'
  | 'service_offline'
  | 'api_unreachable'
  | 'error';

export interface LocalInstalledModel {
  id: string;
  size?: string;
  modifiedAt?: string;
  digest?: string;
}

export interface LocalRuntimeSnapshot {
  state: LocalRuntimeState;
  message: string;
  command?: string;
  version?: string;
  runtimePath?: string;
  installCommand?: string;
  modelsDir: string;
  installedModels: LocalInstalledModel[];
  activeModelId?: string;
  installed: boolean;
  serviceActive: boolean;
  apiReachable: boolean;
  apiUrl: string;
  canUsePacman: boolean;
  hasPkexec: boolean;
  hasSudo: boolean;
  diskOk?: boolean;
  problems: string[];
  repairActions: string[];
  at: string;
}

export type LocalModelInstallState = 'running' | 'completed' | 'error';

export interface LocalModelInstallProgress {
  modelId: string;
  state: LocalModelInstallState;
  progressPercent?: number;
  message: string;
  at: string;
}

export interface ActionableError {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  actionLabel?: string;
  actionTarget?: string;
  technicalDetails?: string;
}

export interface AppHealthProvider {
  id: string;
  status: ProviderRuntimeStatus;
  hasKey: boolean;
  profileCount?: number;
  selectedProfileId?: string;
}

export interface AppHealthAction {
  label: string;
  command?: string;
}

export interface AppHealthCheck {
  baseDir: string;
  expectedBaseDir: string;
  correctBaseDir: boolean;
  branch?: string;
  nodeOk: boolean;
  npmOk: boolean;
  cargoOk: boolean;
  tauriOk: boolean;
  providers: AppHealthProvider[];
  ollama: LocalRuntimeSnapshot;
  sessionsCount?: number;
  activeSessionId?: string;
  storageRoot?: string;
  credentialsEncrypted?: boolean;
  recentErrors: ActionableError[];
  overallStatus: 'ok' | 'warning' | 'error';
  actions: AppHealthAction[];
}

export type SessionExportFormat = 'markdown' | 'json';

export interface SessionExportResult {
  path: string;
  format: SessionExportFormat;
  bytes: number;
}
