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
}

export type SessionStatus =
  | 'idle'
  | 'planning'
  | 'diagnosing'
  | 'waiting_approval'
  | 'executing'
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

export interface ProviderDescriptor {
  id: string;
  label: string;
  configurable: boolean;
  enabled: boolean;
  models: ModelDescriptor[];
}

export interface SystemTheme {
  source: string;
  accentPrimary: string;
  accentSecondary: string;
  background: string;
}

export interface AppSettings {
  workspaceRoot: string;
  codexRoot: string;
  selectedProviderId: string;
  selectedModelId: string;
  selectedAgentId: string;
  preferredShell: string;
  autoApproveSafeRead: boolean;
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
  sessions: AgentSession[];
  pendingPermissions: PermissionRequest[];
  providers: ProviderDescriptor[];
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
