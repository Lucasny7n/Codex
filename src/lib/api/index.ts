import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import type {
  BootstrapPayload,
  ExecutionRequestInput,
  ExecutionResponse,
  PrivilegedActionRequestInput,
  PrivilegedActionSpec,
  PermissionOutcome,
  PermissionDecision,
  StatusNote,
  CommandLogChunk,
  FileChangeEntry,
  FileDirectoryListing,
  SelectedFileAttachment,
  AgentSession,
  PermissionRequest,
  AppSettings,
  AppHealthCheck,
  ProviderAccountProfile,
  ProviderRuntimeStatus,
  ProviderCredentialStatus,
  LocalRuntimeSnapshot,
  OllamaModelDetails,
  OllamaLibrarySearchResult,
  LocalModelInstallProgress,
  SessionExportFormat,
  SessionExportResult,
  ConversationImportResult,
  EnvironmentSelectionInput,
  VoiceTranscriptionResult,
  LocalSttConfigSnapshot,
  ChatAttachment,
  ModelComparisonRequest,
  ModelComparisonResponse,
} from '../../types/domain';

export async function bootstrapState(): Promise<BootstrapPayload> {
  return invoke('bootstrap_state');
}

export async function createSession(title: string): Promise<AgentSession> {
  return invoke('create_session', { title });
}

export async function renameSession(sessionId: string, title: string): Promise<AgentSession> {
  return invoke('rename_session', { sessionId, title });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await invoke('delete_session', { sessionId });
}

export async function archiveSession(sessionId: string): Promise<AgentSession> {
  return invoke('archive_session', { sessionId });
}

export async function restoreSession(sessionId: string): Promise<AgentSession> {
  return invoke('restore_session', { sessionId });
}

export async function listArchivedSessions(): Promise<AgentSession[]> {
  return invoke('list_archived_sessions');
}

export async function archiveAllSessions(): Promise<AgentSession[]> {
  return invoke('archive_all_sessions');
}

export async function deleteAllSessions(): Promise<number> {
  return invoke('delete_all_sessions');
}

export async function duplicateSession(sessionId: string): Promise<AgentSession> {
  return invoke('duplicate_session', { sessionId });
}

export async function exportSession(sessionId: string, format: SessionExportFormat): Promise<SessionExportResult> {
  return invoke('export_session', { sessionId, format });
}

export async function exportAllConversations(): Promise<SessionExportResult> {
  return invoke('export_all_conversations');
}

export async function importConversations(path: string): Promise<ConversationImportResult> {
  return invoke('import_conversations', { path });
}

export async function updateSessionEnvironment(
  sessionId: string,
  input: EnvironmentSelectionInput,
): Promise<AgentSession> {
  return invoke('update_session_environment', {
    sessionId,
    providerId: input.providerId,
    modelId: input.modelId,
    agentProfileId: input.agentProfileId,
    accountProfileId: input.accountProfileId,
  });
}

export async function applyEnvironmentToAllSessions(input: EnvironmentSelectionInput): Promise<AgentSession[]> {
  return invoke('apply_environment_to_all_sessions', {
    providerId: input.providerId,
    modelId: input.modelId,
    agentProfileId: input.agentProfileId,
    accountProfileId: input.accountProfileId,
  });
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!/^https?:\/\//u.test(url)) {
    throw new Error('external_url_blocked');
  }
  await open(url);
}

export async function listFileDirectory(path?: string): Promise<FileDirectoryListing> {
  return invoke('list_file_directory', { path });
}

export async function getFileAttachment(path: string): Promise<SelectedFileAttachment> {
  return invoke('get_file_attachment', { path });
}

export async function getSttConfigState(modelPath?: string): Promise<LocalSttConfigSnapshot> {
  return invoke('get_stt_config_state', { modelPath });
}

export async function transcribeAudio(audioBytes: number[], mimeType?: string, modelPath?: string): Promise<VoiceTranscriptionResult> {
  return invoke('transcribe_audio', { audioBytes, mimeType, modelPath });
}

export async function recordAndTranscribeShortTest(modelPath?: string): Promise<VoiceTranscriptionResult> {
  return invoke('record_and_transcribe_short_test', { modelPath });
}

export async function appendUserMessage(sessionId: string, content: string): Promise<AgentSession> {
  return invoke('append_user_message', { sessionId, content });
}

export async function sendOrderToAgent(
  sessionId: string,
  content: string,
  mode?: string,
  attachments: ChatAttachment[] = [],
): Promise<AgentSession> {
  return invoke('send_order_to_agent', { sessionId, content, mode, attachments });
}

export async function sendTemporaryOrderToAgent(
  messages: AgentSession['messages'],
  content: string,
  mode?: string,
  attachments: ChatAttachment[] = [],
): Promise<AgentSession> {
  return invoke('send_temporary_order_to_agent', { messages, content, mode, attachments });
}

export async function compareModels(input: ModelComparisonRequest): Promise<ModelComparisonResponse> {
  return invoke('compare_models', { input });
}

export async function requestExecution(input: ExecutionRequestInput): Promise<ExecutionResponse> {
  return invoke('request_execution', { input });
}

export async function testProviderConnection(providerId: string): Promise<ProviderRuntimeStatus> {
  return invoke('test_provider_connection', { providerId });
}

export async function listProviderCredentials(): Promise<ProviderCredentialStatus[]> {
  return invoke('list_provider_credentials');
}

export async function listProviderProfiles(): Promise<ProviderAccountProfile[]> {
  return invoke('list_provider_profiles');
}

export async function saveProviderCredential(providerId: string, key: string): Promise<ProviderCredentialStatus> {
  return invoke('save_provider_credential', { providerId, key });
}

export async function saveProviderProfileCredential(
  providerId: string,
  profileId: string | undefined,
  name: string,
  key: string,
  makeDefault: boolean,
): Promise<ProviderAccountProfile> {
  return invoke('save_credential', { providerId, profileId, name, key, makeDefault });
}

export async function removeProviderCredential(providerId: string): Promise<ProviderCredentialStatus> {
  return invoke('remove_provider_credential', { providerId });
}

export async function removeProviderProfile(profileId: string): Promise<void> {
  await invoke('remove_provider_profile', { profileId });
}

export async function setDefaultProviderProfile(providerId: string, profileId: string): Promise<void> {
  await invoke('set_default_provider_profile', { providerId, profileId });
}

export async function renameProviderProfile(profileId: string, name: string): Promise<void> {
  await invoke('rename_provider_profile', { profileId, name });
}

export async function getAppHealthCheck(): Promise<AppHealthCheck> {
  return invoke('get_app_health_check');
}

export async function getLocalRuntimeState(): Promise<LocalRuntimeSnapshot> {
  return invoke('get_local_runtime_state');
}

export async function startLocalRuntime(): Promise<LocalRuntimeSnapshot> {
  return invoke('start_local_runtime');
}

export async function installLocalRuntime(): Promise<LocalRuntimeSnapshot> {
  return invoke('install_local_runtime');
}

export async function installLocalModel(modelId: string): Promise<LocalRuntimeSnapshot> {
  return invoke('install_local_model', { modelId });
}

export async function removeLocalModel(modelId: string): Promise<LocalRuntimeSnapshot> {
  return invoke('remove_local_model', { modelId });
}

export async function showLocalModel(modelId: string): Promise<OllamaModelDetails> {
  return invoke('show_local_model', { modelId });
}

export async function searchOllamaLibrary(query: string): Promise<OllamaLibrarySearchResult[]> {
  return invoke('search_ollama_library', { query });
}

export async function testLocalModel(modelId: string): Promise<ProviderRuntimeStatus> {
  return invoke('test_local_model', { modelId });
}

export async function listPrivilegedActions(): Promise<PrivilegedActionSpec[]> {
  return invoke('list_privileged_actions');
}

export async function requestPrivilegedAction(input: PrivilegedActionRequestInput): Promise<PermissionRequest> {
  return invoke('request_privileged_action', { input });
}

export async function decidePermission(requestId: string, decision: PermissionDecision): Promise<void> {
  await invoke('decide_permission', { requestId, decision });
}

export async function openProjectInVscode(path: string): Promise<void> {
  await invoke('open_project_in_vscode', { path });
}

export async function openFileInVscode(path: string, line?: number): Promise<void> {
  await invoke('open_file_in_vscode', { path, line });
}

export async function openDiffInVscode(leftPath: string, rightPath: string): Promise<void> {
  await invoke('open_diff_in_vscode', { leftPath, rightPath });
}

export async function updateSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke('update_settings', { settings });
}

export async function listSessions(): Promise<AgentSession[]> {
  return invoke('list_sessions');
}

export async function listPendingPermissions(): Promise<PermissionRequest[]> {
  return invoke('list_pending_permissions');
}

export async function getBasePrompt(): Promise<string> {
  return invoke('get_base_prompt');
}

export async function updateBasePrompt(content: string): Promise<void> {
  await invoke('update_base_prompt', { content });
}

export async function onStatusNote(handler: (note: StatusNote) => void): Promise<UnlistenFn> {
  return listen<StatusNote>('status-note', (event) => handler(event.payload));
}

export async function onCommandLog(handler: (chunk: CommandLogChunk) => void): Promise<UnlistenFn> {
  return listen<CommandLogChunk>('command-log', (event) => handler(event.payload));
}

export async function onFileChanged(handler: (event: FileChangeEntry) => void): Promise<UnlistenFn> {
  return listen<FileChangeEntry>('file-changed', (e) => handler(e.payload));
}

export async function onSessionChanged(handler: (session: AgentSession) => void): Promise<UnlistenFn> {
  return listen<AgentSession>('session-changed', (event) => handler(event.payload));
}

export async function onPermissionRaised(handler: (request: PermissionRequest) => void): Promise<UnlistenFn> {
  return listen<PermissionRequest>('permission-raised', (event) => handler(event.payload));
}

export async function onPermissionResolved(handler: (requestId: string) => void): Promise<UnlistenFn> {
  return listen<string>('permission-resolved', (event) => handler(event.payload));
}

export async function onPermissionOutcome(handler: (outcome: PermissionOutcome) => void): Promise<UnlistenFn> {
  return listen<PermissionOutcome>('permission-outcome', (event) => handler(event.payload));
}

export async function onLocalRuntimeState(handler: (snapshot: LocalRuntimeSnapshot) => void): Promise<UnlistenFn> {
  return listen<LocalRuntimeSnapshot>('local-runtime-state', (event) => handler(event.payload));
}

export async function onLocalModelProgress(
  handler: (progress: LocalModelInstallProgress) => void,
): Promise<UnlistenFn> {
  return listen<LocalModelInstallProgress>('local-model-progress', (event) => handler(event.payload));
}
