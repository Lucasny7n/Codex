export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  reasoningSummary?: string;
  attachments?: ChatAttachment[];
}

export interface AgentSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  messages: ChatMessage[];
  tasks: SessionTask[];
  archived?: boolean;
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

export type FileEntryKind =
  | 'directory'
  | 'pdf'
  | 'zip'
  | 'text'
  | 'json'
  | 'image'
  | 'code'
  | 'audio'
  | 'video'
  | 'generic';

export interface FileShortcut {
  id: string;
  label: string;
  path: string;
  exists: boolean;
}

export interface FileBrowserEntry {
  name: string;
  path: string;
  kind: FileEntryKind;
  extension?: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: string;
}

export interface FileDirectoryListing {
  path: string;
  parentPath?: string;
  entries: FileBrowserEntry[];
  shortcuts: FileShortcut[];
  truncated: boolean;
}

export interface SelectedFileAttachment {
  name: string;
  path: string;
  kind: FileEntryKind;
  extension?: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: string;
  preview?: string;
  previewKind?: 'text' | 'pdf' | 'zip' | 'unavailable';
  previewTruncated: boolean;
}

export interface ChatAttachment {
  path: string;
  name: string;
  mimeType?: string;
  size?: number;
  kind: FileEntryKind;
  previewAvailable: boolean;
  previewTextLimited?: string;
  hidden?: boolean;
  contextText?: string;
  contextSource?: 'document' | 'preset' | 'project_memory' | 'memory' | 'system';
}

export interface ProcessEntry {
  user: string;
  pid: string;
  cpu: string;
  mem: string;
  command: string;
}

export interface ProcessListReport {
  os: string;
  commandUsed: string;
  timestamp: string;
  processes: ProcessEntry[];
  error?: string;
}

export interface TtsStatus {
  available: boolean;
  engine?: string;
  detail: string;
  installHint?: string;
}

export type VoiceTranscriptionResultStatus = 'done' | 'missing_backend' | 'error';

export interface VoiceTranscriptionResult {
  status: VoiceTranscriptionResultStatus;
  text?: string;
  message: string;
  backend?: string;
  command?: string;
  technicalDetails?: string;
  captureStatus?: 'ok' | 'error';
  captureBackend?: string;
}

export interface LocalSttToolStatus {
  id: string;
  label: string;
  installed: boolean;
  path?: string;
  ready: boolean;
  message: string;
}

export interface LocalSttModelCandidate {
  label: string;
  path: string;
  source: string;
  exists: boolean;
}

export interface LocalSttCaptureSnapshot {
  webviewStatus: 'ok' | 'warning' | 'error';
  webviewMessage: string;
  nativeStatus: 'ok' | 'warning' | 'error';
  nativeMessage: string;
  nativeTools: string[];
}

export interface LocalSttConfigSnapshot {
  ffmpeg: LocalSttToolStatus;
  backends: LocalSttToolStatus[];
  modelPath?: string;
  modelExists: boolean;
  modelCandidates: LocalSttModelCandidate[];
  ready: boolean;
  installCommand: string;
  message: string;
  capture: LocalSttCaptureSnapshot;
  checkedAt: string;
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
  | 'invalid_api_key'
  | 'forbidden'
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
  | 'provider_unavailable'
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
  | 'invalid_api_key'
  | 'forbidden'
  | 'requires_login'
  | 'requires_oauth'
  | 'requires_cli_auth'
  | 'testing'
  | 'misconfigured'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'provider_unavailable'
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
export type ThemePreference = 'system' | 'light' | 'dark';
export type AiResponseLanguage = 'pt-BR' | 'en' | 'es';

export interface AppPersonalizationSettings {
  memoriesStored: boolean;
  referenceChatHistory: boolean;
  customizeAilu: boolean;
  manageCookies: boolean;
  webPageExtraction: boolean;
  imageSearch: boolean;
  webSearch: boolean;
  imageGeneration: boolean;
  codeInterpreter: boolean;
  recoverHistoricalMemories: boolean;
  imageEditing: boolean;
  memoryUpdate: boolean;
  localImageUpscaling: boolean;
}

export type AiFallbackPolicy = 'automatic' | 'fast_first' | 'cloud_first' | 'local_first' | 'code' | 'cost_low';

export interface AiFallbackModelConfig {
  providerId: string;
  modelId: string;
  accountProfileId?: string;
  enabled: boolean;
  label?: string;
  timeoutMs?: number;
}

export interface AiRoutingSettings {
  fallbackEnabled: boolean;
  fallbackPolicy: AiFallbackPolicy;
  fallbackModels: AiFallbackModelConfig[];
}

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
  themePreference?: ThemePreference;
  aiResponseLanguage?: AiResponseLanguage;
  autoGenerateTitles?: boolean;
  autoCopyResponses?: boolean;
  pasteLargeTextAsFile?: boolean;
  personalization?: AppPersonalizationSettings;
  developerMode?: boolean;
  aiRouting?: AiRoutingSettings;
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

export interface ModelComparisonTarget {
  providerId: string;
  modelId: string;
  accountProfileId?: string;
  label?: string;
}

export interface ModelComparisonRequest {
  prompt: string;
  targets: ModelComparisonTarget[];
}

export interface ModelComparisonResult {
  providerId: string;
  modelId: string;
  label?: string;
  ok: boolean;
  content?: string;
  error?: string;
  command?: string;
}

export interface ModelComparisonResponse {
  prompt: string;
  results: ModelComparisonResult[];
  completedAt: string;
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
  downloaded?: string;
  total?: string;
  speed?: string;
  digest?: string;
  layer?: string;
  message: string;
  at: string;
}

export interface OllamaModelDetails {
  id: string;
  raw: string;
  family?: string;
  parameterSize?: string;
  quantization?: string;
  format?: string;
  digest?: string;
  size?: string;
  modifiedAt?: string;
}

export interface OllamaLibrarySearchResult {
  modelId: string;
  label: string;
  family: string;
  sizeLabel?: string;
}

// ─── Local Engine: Hardware Detection ────────────────────────────────────────

export type GpuVendor = 'amd' | 'nvidia' | 'intel' | 'other' | 'unknown';

export type AcceleratorApi = 'cuda' | 'rocm' | 'hip' | 'vulkan' | 'sycl' | 'open_cl' | 'cpu';

export type AcceleratorStatus = 'healthy' | 'present' | 'unavailable' | 'unknown';

export interface AcceleratorInfo {
  api: AcceleratorApi;
  status: AcceleratorStatus;
  detail: string;
}

export interface OsInfo {
  os: string;
  kernel?: string;
  distro?: string;
}

export interface CpuInfo {
  model?: string;
  physicalCores?: number;
  logicalThreads?: number;
}

export interface MemoryInfo {
  totalBytes: number;
  availableBytes?: number;
  swapTotalBytes: number;
  headroomBytes: number;
}

export interface GpuDevice {
  vendor: GpuVendor;
  name?: string;
  vramTotalBytes?: number;
  vramUsedBytes?: number;
  source: string;
}

export interface DiskInfo {
  mount: string;
  totalBytes: number;
  availableBytes: number;
}

export type HardwareProfileTag =
  | 'weak_pc'
  | 'medium_pc'
  | 'low_ram_pc'
  | 'high_ram_pc'
  | 'amd_pc'
  | 'amd_vulkan_pc'
  | 'amd_rocm_pc'
  | 'nvidia_pc'
  | 'intel_arc_pc'
  | 'server'
  | 'experimental';

export interface HardwareSnapshot {
  os: OsInfo;
  cpu: CpuInfo;
  memory: MemoryInfo;
  gpus: GpuDevice[];
  disks: DiskInfo[];
  accelerators: AcceleratorInfo[];
  profileTags: HardwareProfileTag[];
  notes: string[];
  detectedAt: string;
}

// ─── Local Engine: Backends ───────────────────────────────────────────────────

export type RuntimeBackendId =
  | 'ollama'
  | 'llama_cpp_cpu'
  | 'llama_cpp_vulkan'
  | 'llama_cpp_rocm'
  | 'llama_cpp_hip'
  | 'llama_cpp_cuda'
  | 'llama_cpp_sycl'
  | 'llama_cpp_server'
  | 'open_ai_compatible'
  | 'air_llm'
  | 'vllm'
  | 'ex_llama_v2'
  | 'mlc_llm'
  | 'tensor_rt_llm'
  | 'sg_lang'
  | 'flex_gen'
  | 'transformers_accelerate'
  | 'kobold_cpp'
  | 'cloud_fallback';

export type BackendAvailability =
  | 'ready'
  | 'installed'
  | 'not_installed'
  | 'experimental'
  | 'future_available'
  | 'unknown';

export interface BackendStatus {
  id: RuntimeBackendId;
  label: string;
  availability: BackendAvailability;
  version?: string;
  detail: string;
  experimental: boolean;
  installPlan?: string;
}

// ─── Local Engine: Estimation & Recommendation ───────────────────────────────

export type ExecutionProfile =
  | 'safe'
  | 'fast'
  | 'balanced'
  | 'heavy'
  | 'max'
  | 'vram_saver'
  | 'ram_saver'
  | 'long_context'
  | 'code'
  | 'chat'
  | 'agent'
  | 'rag';

export type FitClass = 'excellent' | 'fits' | 'tight' | 'slow_swap' | 'wont_run' | 'unknown';

export type WarningSeverity = 'info' | 'warning' | 'strong';

export interface RuntimeWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
}

export interface RuntimeEstimate {
  fit: FitClass;
  recommended: boolean;
  experimental: boolean;
  vramRequiredBytes?: number;
  ramRequiredBytes: number;
  recommendedContext: number;
  usesOffload: boolean;
  expectedSlow: boolean;
  speedHint: string;
  warnings: RuntimeWarning[];
}

export interface RuntimeRecommendation {
  backend: RuntimeBackendId;
  profile: ExecutionProfile;
  estimate: RuntimeEstimate;
  score: number;
  rationale: string;
  message: string;
  alternatives: RuntimeBackendId[];
}

export interface ModelRuntimeRequest {
  modelId: string;
  parameterLabel?: string;
  quantization?: string;
  fileBytes?: number;
  contextSize?: number;
  profile?: ExecutionProfile;
}

// ─── Local Engine: Benchmark ──────────────────────────────────────────────────

export type BenchmarkKind = 'smoke' | 'quick';

export interface BenchmarkResult {
  modelId: string;
  backendId: RuntimeBackendId;
  kind: BenchmarkKind;
  ok: boolean;
  tokensPerSecond?: number;
  timeToFirstTokenMs?: number;
  ramPeakBytes?: number;
  vramPeakBytes?: number;
  bottleneck?: string;
  detail: string;
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

export interface SystemHealthItem {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
  action?: string;
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
  items?: SystemHealthItem[];
  recentErrors: ActionableError[];
  overallStatus: 'ok' | 'warning' | 'error';
  actions: AppHealthAction[];
}

export type SessionExportFormat = 'markdown' | 'json' | 'txt';

export interface SessionExportResult {
  path: string;
  format: SessionExportFormat;
  bytes: number;
}

export interface ConversationImportResult {
  imported: number;
  skipped: number;
  reassignedIds: number;
  sessions: AgentSession[];
}

export interface EnvironmentSelectionInput {
  providerId: string;
  modelId: string;
  agentProfileId: string;
  accountProfileId?: string;
}

export interface GlobalEnvironmentConfig {
  defaultProviderId: string;
  defaultModelId: string;
  defaultProfileId: string;
  defaultMode: ExecutionMode;
}

export type SkillKind = 'software' | 'hardware';

export type SkillCategory = 'file' | 'package' | 'git' | 'audio' | 'bluetooth' | 'gpu' | 'network' | 'other';

export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  riskLevel: RiskLevel;
  scriptPath: string;
  checksum?: string;
  trusted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type SkillExecutionMode = 'vm_tested' | 'manual_dry_run';

export interface SkillExecutionPlan {
  skillId: string;
  kind: SkillKind;
  mode: SkillExecutionMode;
  requiresManualApproval: boolean;
  supportsDryRun: boolean;
  dryRunCommand: string;
  runCommand: string;
  rationale: string;
  spokenSummary: string;
}

export type SkillVmOutcome = 'passed' | 'rolled_back' | 'blocked';

export interface SkillVmReport {
  skillId: string;
  snapshotName: string;
  outcome: SkillVmOutcome;
  exitCode?: number;
  stdoutTail: string;
  stderrTail: string;
  functionalTestPassed?: boolean;
  rolledBack: boolean;
  steps: string[];
  alternatives: string[];
  at: string;
}

export type MemoryEntryKind = 'preference' | 'fact' | 'policy' | 'fix' | 'note';

export type MemoryScope = 'global' | 'project';

export type MemoryOrigin = 'user' | 'inferred' | 'imported';

export type MemoryRecallMode = 'default' | 'project_only';

export interface MemoryEntry {
  id: string;
  content: string;
  kind: MemoryEntryKind;
  scope: MemoryScope;
  project?: string;
  origin: MemoryOrigin;
  confidence: number;
  manual: boolean;
  createdAt: string;
  updatedAt?: string;
}
