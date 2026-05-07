import { useEffect, useMemo, useState } from 'react';
import {
  bootstrapState,
  createSession,
  deleteSession,
  decidePermission,
  duplicateSession,
  exportSession,
  getAppHealthCheck,
  getBasePrompt,
  getLocalRuntimeState,
  installLocalModel,
  installLocalRuntime,
  listProviderCredentials,
  listProviderProfiles,
  listPrivilegedActions,
  onCommandLog,
  onFileChanged,
  onLocalModelProgress,
  onLocalRuntimeState,
  onPermissionOutcome,
  onPermissionRaised,
  onPermissionResolved,
  onSessionChanged,
  onStatusNote,
  openFileInVscode,
  openProjectInVscode,
  removeLocalModel,
  removeProviderCredential,
  removeProviderProfile,
  requestExecution,
  requestPrivilegedAction,
  renameSession,
  renameProviderProfile,
  saveProviderProfileCredential,
  setDefaultProviderProfile,
  sendOrderToAgent,
  startLocalRuntime,
  testProviderConnection,
  updateBasePrompt,
  updateSettings,
} from './lib/api';
import { shellQuote, trimMultiline } from './lib/format';
import {
  modelRegistry,
  type CloudModelProfile,
  type LocalModelProfile,
} from './lib/modelRegistry';
import { translateError } from './lib/errorTranslator';
import {
  canSelectModel,
  resolveModelStatus,
} from './lib/providerStatus';
import type {
  AppHealthCheck,
  AppSettings,
  ExecutionMode,
  AgentSession,
  LocalModelInstallProgress,
  LocalRuntimeSnapshot,
  PrivilegedActionSpec,
  ProviderCredentialStatus,
  ProviderAccountProfile,
  ProviderRuntimeStatus,
} from './types/domain';
import { useAppStore } from './stores/appStore';

import { AppShell } from './components/layout/AppShell';
import { TopBar } from './components/layout/TopBar';
import { type InspectorTabId } from './components/layout/InspectorTabs';
import { CollapsibleSection } from './components/common/CollapsibleSection';
import { SessionsPanel } from './components/panels/SessionsPanel';
import { ChatPanel } from './components/panels/ChatPanel';
import { StatusPanel } from './components/panels/StatusPanel';
import { TasksPanel } from './components/panels/TasksPanel';
import { PermissionsPanel } from './components/panels/PermissionsPanel';
import { ChangedFilesPanel } from './components/panels/ChangedFilesPanel';
import { SettingsPanel, type SettingsTab } from './components/panels/SettingsPanel';
import { MemoryPanel } from './components/panels/MemoryPanel';
import { BasePromptPanel } from './components/panels/BasePromptPanel';
import { CommandInputPanel } from './components/panels/CommandInputPanel';
import { InspectorPanel } from './components/panels/InspectorPanel';
import { TerminalDrawer } from './components/panels/TerminalDrawer';
import { HelpDrawer } from './components/panels/HelpDrawer';
import { ModelSelector } from './components/panels/ModelSelector';

function applyTheme(accent: { accentPrimary: string; accentSecondary: string; background: string }): void {
  const root = document.documentElement;
  root.style.setProperty('--accent', accent.accentPrimary);
  root.style.setProperty('--accent-2', accent.accentSecondary);
  root.style.setProperty('--accent-strong', accent.accentSecondary);
  root.style.setProperty('--end4-background', accent.background);
}

function homeFromCodexRoot(settings?: AppSettings): string | undefined {
  if (!settings?.codexRoot) return undefined;
  return settings.codexRoot.endsWith('/.codex') ? settings.codexRoot.slice(0, -'/.codex'.length) : undefined;
}

function buildActionJsonExamples(settings?: AppSettings): Record<string, string> {
  const codexRoot = settings?.codexRoot ?? '~/.codex';
  const home = homeFromCodexRoot(settings) ?? '~';

  return {
    systemctl_enable_service: '{\n  "service": "fstrim.timer"\n}',
    systemctl_disable_service: '{\n  "service": "waydroid-container.service"\n}',
    systemctl_restart_service: '{\n  "service": "waydroid-container.service"\n}',
    systemctl_status_service: '{\n  "service": "waydroid-container.service"\n}',
    bootctl_set_default_kernel: '{\n  "entry": "arch-linux-cachyos-bore.conf"\n}',
    chmod_random_seed: '{}',
    backup_file: '{\n  "path": "/boot/loader/loader.conf"\n}',
    restore_file: `{\n  "backupPath": "${codexRoot}/codex-ui/backups/exemplo.bak",\n  "targetPath": "/boot/loader/loader.conf"\n}`,
    pacman_install_packages: '{\n  "packages": ["ripgrep"]\n}',
    paccache_keep_versions: '{\n  "keep": 2\n}',
    waydroid_start: '{}',
    waydroid_stop: '{}',
    waydroid_status: '{}',
    hyprland_verify_config: `{\n  "configPath": "${home}/.config/hypr/hyprland.conf"\n}`,
    hyprland_reload_user: '{}',
  };
}

function pushHistory(settings: AppSettings, mode: ExecutionMode, providerId: string, modelId: string): AppSettings {
  const entry = {
    mode,
    providerId,
    modelId,
    at: new Date().toISOString(),
  };

  const history = [
    entry,
    ...settings.modelSelectionHistory.filter(
      (item) => !(item.mode === mode && item.providerId === providerId && item.modelId === modelId),
    ),
  ].slice(0, 30);

  return {
    ...settings,
    modelSelectionHistory: history,
  };
}

function isLocalModelInstalled(runtime: LocalRuntimeSnapshot | undefined, modelId: string): boolean {
  if (!runtime) return false;
  return runtime.installedModels.some((model) => model.id === modelId);
}

function titleFromContent(content: string): string {
  const compact = content
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-–—\s]+/, '');
  if (!compact) {
    return `Conversa ${new Date().toLocaleString('pt-BR')}`;
  }
  return compact.length > 54 ? `${compact.slice(0, 51)}...` : compact;
}

export default function App(): JSX.Element {
  const [basePrompt, setBasePrompt] = useState('');
  const [savingBasePrompt, setSavingBasePrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [privilegedActions, setPrivilegedActions] = useState<PrivilegedActionSpec[]>([]);
  const [selectedInspectorTab, setSelectedInspectorTab] = useState<InspectorTabId>('status');
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [localRuntime, setLocalRuntime] = useState<LocalRuntimeSnapshot>();
  const [localRuntimeLoading, setLocalRuntimeLoading] = useState(false);
  const [modelActionBusyId, setModelActionBusyId] = useState<string>();
  const [installationProgress, setInstallationProgress] = useState<Record<string, LocalModelInstallProgress>>({});
  const [providerCredentials, setProviderCredentials] = useState<ProviderCredentialStatus[]>([]);
  const [providerAccountProfiles, setProviderAccountProfiles] = useState<ProviderAccountProfile[]>([]);
  const [healthCheck, setHealthCheck] = useState<AppHealthCheck>();
  const [healthLoading, setHealthLoading] = useState(false);
  const [settingsTabRequest, setSettingsTabRequest] = useState<{ tab: SettingsTab; nonce: number }>();
  const [sessionInfoId, setSessionInfoId] = useState<string>();

  const {
    booted,
    loading,
    error,
    settings,
    providers,
    providerProfiles,
    profiles,
    memory,
    theme,
    workspaceMeta,
    sessions,
    selectedSessionId,
    statusFeed,
    logs,
    changedFiles,
    pendingPermissions,
    permissionOutcomes,
    selectedModelId,
    executionMode,
    modelSelectorOpen,
    setError,
    setLoading,
    bootstrap,
    upsertSession,
    removeSession,
    selectSession,
    appendStatus,
    appendLog,
    pushFileChange,
    addPermission,
    removePermission,
    recordPermissionOutcome,
    updateSettings: syncSettings,
    updateProviderStatus,
    selectModel,
    setExecutionMode,
    setModelSelectorOpen,
  } = useAppStore();

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [sessions, selectedSessionId],
  );

  const sessionInfo = useMemo(
    () => sessions.find((session) => session.id === sessionInfoId),
    [sessionInfoId, sessions],
  );

  const actionJsonExamples = useMemo(() => buildActionJsonExamples(settings), [settings]);

  const effectiveProviderProfiles = useMemo(
    () => (providerAccountProfiles.length > 0 ? providerAccountProfiles : providerProfiles),
    [providerAccountProfiles, providerProfiles],
  );

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === settings?.selectedProviderId),
    [providers, settings?.selectedProviderId],
  );

  const selectedProviderProfile = useMemo(() => {
    if (!settings?.selectedProviderId) return undefined;
    const providerAccounts = effectiveProviderProfiles.filter(
      (profile) => profile.providerId === settings.selectedProviderId,
    );
    return (
      providerAccounts.find((profile) => profile.id === settings.selectedProviderProfileId) ??
      providerAccounts.find((profile) => profile.isDefault) ??
      providerAccounts[0]
    );
  }, [effectiveProviderProfiles, settings]);

  const selectedProviderStatus: ProviderRuntimeStatus | undefined = useMemo(
    () =>
      selectedProvider?.status ??
      (settings
        ? {
            state: 'unavailable',
            message: `Provider salvo \`${settings.selectedProviderId}\` não está registrado neste build.`,
            checkedAt: new Date().toISOString(),
          }
        : undefined),
    [selectedProvider, settings],
  );

  const activeModel = useMemo(() => {
    if (!selectedModelId && !settings?.selectedModelId) return undefined;
    return modelRegistry.byId(selectedModelId ?? settings?.selectedModelId ?? '');
  }, [selectedModelId, settings?.selectedModelId]);

  const activeModelLabel = activeModel?.displayName ?? settings?.selectedModelId ?? 'modelo não selecionado';

  const orderDisabledReason = useMemo(() => {
    if (!settings) return 'Configurações não carregadas.';

    if (executionMode === 'local') {
      if (!localRuntime) return 'Runtime local ainda não carregado.';
      if (localRuntime.state !== 'ready') {
        const translated = translateError(localRuntime.problems[0] ?? localRuntime.state, localRuntime.message);
        return `${translated.message} ${translated.actionLabel ? `Ação: ${translated.actionLabel}.` : ''}`;
      }
      const localModelId = settings.selectedLocalModelId ?? settings.selectedModelId;
      if (!localModelId || !isLocalModelInstalled(localRuntime, localModelId)) {
        const translated = translateError('model_missing');
        return `${translated.message} ${translated.actionLabel}.`;
      }
      return undefined;
    }

    if (selectedProviderStatus && selectedProviderStatus.state !== 'ready') {
      const translated = translateError(selectedProviderStatus.state, selectedProviderStatus.message);
      return `${translated.message} ${translated.actionLabel ? `Ação: ${translated.actionLabel}.` : ''}`;
    }

    if (selectedProviderProfile && selectedProviderProfile.status !== 'ready') {
      return `${selectedProviderProfile.message} Ação: ajuste o profile em Settings > Contas / Profiles.`;
    }

    return undefined;
  }, [executionMode, localRuntime, selectedProviderProfile, selectedProviderStatus, settings]);

  const workspacePath = (relativePath: string): string | undefined => {
    if (!settings?.workspaceRoot) return undefined;
    return `${settings.workspaceRoot.replace(/\/$/, '')}/${relativePath}`;
  };

  useEffect(() => {
    let mounted = true;
    const unlisteners: Array<() => void> = [];

    async function init(): Promise<void> {
      setLoading(true);
      try {
        const payload = await bootstrapState();
        if (!mounted) return;
        bootstrap(payload);
        applyTheme(payload.theme);
        const promptBase = await getBasePrompt();
        const actionCatalog = await listPrivilegedActions();
        if (mounted) {
          setBasePrompt(promptBase);
          setPrivilegedActions(actionCatalog);
        }
        const credentials = await listProviderCredentials();
        const accountProfiles = await listProviderProfiles();
        if (mounted) {
          setProviderCredentials(credentials);
          setProviderAccountProfiles(accountProfiles);
        }

        setLocalRuntimeLoading(true);
        const runtimeSnapshot = await getLocalRuntimeState();
        if (mounted) {
          setLocalRuntime(runtimeSnapshot);
          setLocalRuntimeLoading(false);
        }

        unlisteners.push(await onStatusNote((note) => appendStatus(note)));
        unlisteners.push(await onCommandLog((chunk) => appendLog(chunk)));
        unlisteners.push(await onFileChanged((change) => pushFileChange(change)));
        unlisteners.push(await onSessionChanged((session) => upsertSession(session)));
        unlisteners.push(await onPermissionRaised((request) => addPermission(request)));
        unlisteners.push(await onPermissionResolved((requestId) => removePermission(requestId)));
        unlisteners.push(await onPermissionOutcome((outcome) => recordPermissionOutcome(outcome)));
        unlisteners.push(
          await onLocalRuntimeState((snapshot) => {
            setLocalRuntime(snapshot);
          }),
        );
        unlisteners.push(
          await onLocalModelProgress((progress) => {
            setInstallationProgress((current) => ({
              ...current,
              [progress.modelId]: progress,
            }));
          }),
        );
      } catch (cause) {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : 'Falha ao inicializar aplicação.');
      } finally {
        if (mounted) {
          setLoading(false);
          setLocalRuntimeLoading(false);
        }
      }
    }

    void init();

    return () => {
      mounted = false;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [
    addPermission,
    appendLog,
    appendStatus,
    bootstrap,
    pushFileChange,
    recordPermissionOutcome,
    removePermission,
    setError,
    setLoading,
    upsertSession,
  ]);

  useEffect(() => {
    if (theme) {
      applyTheme(theme);
    }
  }, [theme]);

  async function ensureSession(seed: string): Promise<string> {
    if (selectedSessionId) {
      return selectedSessionId;
    }
    const created = await createSession(titleFromContent(seed));
    upsertSession(created);
    selectSession(created.id);
    return created.id;
  }

  function handleCreateSession(): void {
    selectSession(undefined);
  }

  async function handleSendPrompt(prompt: string): Promise<void> {
    const cleaned = trimMultiline(prompt);
    if (!cleaned) return;
    setBusy(true);
    try {
      const sessionId = await ensureSession(cleaned);
      const updated = await sendOrderToAgent(sessionId, cleaned);
      upsertSession(updated);
    } finally {
      setBusy(false);
    }
  }

  async function handleExecuteCommand(command: string): Promise<void> {
    const cleaned = trimMultiline(command);
    if (!cleaned) return;
    setBusy(true);
    try {
      const sessionId = await ensureSession(cleaned);
      const response = await requestExecution({
        sessionId,
        command: cleaned,
        cwd: settings?.workspaceRoot,
        reason: 'Comando solicitado pelo usuário na central.',
      });
      if (response.permissionRequest) {
        addPermission(response.permissionRequest);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestPrivilegedAction(actionId: string, args: Record<string, unknown>, dryRun: boolean): Promise<void> {
    setBusy(true);
    try {
      const sessionId = await ensureSession(actionId);
      const request = await requestPrivilegedAction({
        sessionId,
        actionId,
        args,
        reason: 'Ação privilegiada solicitada pelo usuário no painel de permissões.',
        dryRun,
      });
      addPermission(request);
    } finally {
      setBusy(false);
    }
  }

  async function applySettings(next: AppSettings): Promise<void> {
    const updated = await updateSettings(next);
    syncSettings(updated);
  }

  async function handleUpdateSettings(next: AppSettings): Promise<void> {
    let normalized = next;
    if (next.selectedProviderId === 'local-ollama') {
      normalized = {
        ...next,
        executionMode: 'local',
        selectedLocalModelId: next.selectedModelId,
      };
    } else if (next.executionMode === 'local') {
      normalized = {
        ...next,
        executionMode: 'cloud',
      };
    }
    await applySettings(normalized);
  }

  function openSettingsTab(tab: SettingsTab): void {
    setSettingsTabRequest({ tab, nonce: Date.now() });
    setSelectedInspectorTab('settings');
  }

  async function handleTestProvider(providerId: string): Promise<ProviderRuntimeStatus> {
    const status = await testProviderConnection(providerId);
    updateProviderStatus(providerId, status);
    return status;
  }

  async function refreshProviderCredentials(): Promise<void> {
    const credentials = await listProviderCredentials();
    const accountProfiles = await listProviderProfiles();
    setProviderCredentials(credentials);
    setProviderAccountProfiles(accountProfiles);
  }

  async function handleRemoveProviderCredential(providerId: string): Promise<ProviderCredentialStatus> {
    const status = await removeProviderCredential(providerId);
    await refreshProviderCredentials();
    const runtimeStatus = await handleTestProvider(providerId);
    updateProviderStatus(providerId, runtimeStatus);
    return status;
  }

  async function handleSaveProviderProfileCredential(
    providerId: string,
    profileId: string | undefined,
    name: string,
    key: string,
    makeDefault: boolean,
  ): Promise<ProviderAccountProfile> {
    const profile = await saveProviderProfileCredential(providerId, profileId, name, key, makeDefault);
    await refreshProviderCredentials();
    return profile;
  }

  async function handleRemoveProviderProfile(profileId: string): Promise<void> {
    await removeProviderProfile(profileId);
    await refreshProviderCredentials();
  }

  async function handleSetDefaultProviderProfile(providerId: string, profileId: string): Promise<void> {
    await setDefaultProviderProfile(providerId, profileId);
    await refreshProviderCredentials();
    if (settings) {
      await applySettings({
        ...settings,
        selectedProviderId: providerId,
        selectedProviderProfileId: profileId,
      });
    }
  }

  async function handleRenameProviderProfile(profileId: string, name: string): Promise<void> {
    await renameProviderProfile(profileId, name);
    await refreshProviderCredentials();
  }

  async function refreshHealthCheck(): Promise<AppHealthCheck> {
    setHealthLoading(true);
    try {
      const snapshot = await getAppHealthCheck();
      setHealthCheck(snapshot);
      setLocalRuntime(snapshot.ollama);
      return snapshot;
    } finally {
      setHealthLoading(false);
    }
  }

  async function handlePermission(requestId: string, approve: boolean): Promise<void> {
    await decidePermission(requestId, approve ? 'allow_once' : 'deny_once');
    removePermission(requestId);
  }

  async function handleRunCheckEnvironment(): Promise<void> {
    const scriptPath = workspacePath('scripts/check-environment.sh');
    if (!settings?.workspaceRoot || !scriptPath) {
      setError('Workspace ainda não carregado para rodar check-environment.');
      return;
    }

    setBusy(true);
    try {
      const sessionId = await ensureSession('Check environment');
      const response = await requestExecution({
        sessionId,
        command: `bash ${shellQuote(scriptPath)}`,
        cwd: settings.workspaceRoot,
        reason: 'Checklist de ambiente acionado pelo painel Primeiros Passos.',
      });
      if (response.permissionRequest) {
        addPermission(response.permissionRequest);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleChangeMode(mode: ExecutionMode): Promise<void> {
    if (!settings) return;
    setExecutionMode(mode);

    let next = { ...settings, executionMode: mode };
    if (mode === 'local' && settings.selectedLocalModelId) {
      next = {
        ...next,
        selectedProviderId: 'local-ollama',
        selectedModelId: settings.selectedLocalModelId,
      };
    }

    if (mode === 'cloud' && settings.selectedProviderId === 'local-ollama') {
      const fallbackProvider = providers.find((provider) => provider.id !== 'local-ollama') ?? providers[0];
      if (fallbackProvider) {
        next = {
          ...next,
          selectedProviderId: fallbackProvider.id,
          selectedModelId: fallbackProvider.models[0]?.id ?? next.selectedModelId,
        };
      }
    }

    await applySettings(next);
  }

  async function handleActivateCloud(model: CloudModelProfile): Promise<void> {
    if (!settings) return;

    const provider = providers.find((item) => item.id === model.providerId);
    if (!provider) {
      setError(`Provider ${model.providerLabel} não está registrado neste build.`);
      return;
    }

    const status = resolveModelStatus(model, provider.status, localRuntime);
    if (!canSelectModel(status)) {
      const translated = translateError(status, provider.status.message);
      setError(translated.message);
      openSettingsTab('providers');
      setModelSelectorOpen(false);
      return;
    }

    const providerAccounts = effectiveProviderProfiles.filter((profile) => profile.providerId === model.providerId);
    const readyProfile =
      providerAccounts.find((profile) => profile.isDefault && profile.status === 'ready') ??
      providerAccounts.find((profile) => profile.status === 'ready');
    if (providerAccounts.length > 0 && !readyProfile) {
      setError('Nenhum profile pronto para este provider. Configure ou teste a conta antes de selecionar.');
      openSettingsTab('accounts');
      setModelSelectorOpen(false);
      return;
    }

    setModelActionBusyId(model.id);
    try {
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'cloud',
          selectedProviderId: model.providerId,
          selectedModelId: model.modelId,
          selectedProviderProfileId: readyProfile?.id ?? settings.selectedProviderProfileId,
        },
        'cloud',
        model.providerId,
        model.modelId,
      );

      await applySettings(next);
      setExecutionMode('cloud');
      selectModel(model.id);
      setModelSelectorOpen(false);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleActivateLocal(model: LocalModelProfile): Promise<void> {
    if (!settings) return;

    const status = resolveModelStatus(model, selectedProviderStatus, localRuntime);
    if (!canSelectModel(status)) {
      const translated = translateError(status, localRuntime?.message);
      setError(translated.message);
      openSettingsTab('local');
      setModelSelectorOpen(false);
      return;
    }

    setModelActionBusyId(model.id);
    try {
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'local',
          selectedProviderId: 'local-ollama',
          selectedModelId: model.modelId,
          selectedLocalModelId: model.modelId,
        },
        'local',
        'local-ollama',
        model.modelId,
      );

      await applySettings(next);
      setExecutionMode('local');
      selectModel(model.id);
      setModelSelectorOpen(false);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function refreshLocalRuntime(): Promise<void> {
    const snapshot = await getLocalRuntimeState();
    setLocalRuntime(snapshot);
  }

  async function handleInstallRuntime(): Promise<void> {
    setModelActionBusyId('runtime');
    try {
      const snapshot = await installLocalRuntime();
      setLocalRuntime(snapshot);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao instalar runtime local.');
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleStartRuntime(): Promise<void> {
    setModelActionBusyId('runtime');
    try {
      const snapshot = await startLocalRuntime();
      setLocalRuntime(snapshot);
      if (snapshot.state !== 'ready') {
        setError(translateError(snapshot.problems[0] ?? snapshot.state, snapshot.message).message);
      } else {
        setError(undefined);
      }
    } catch (cause) {
      setError(translateError(cause instanceof Error ? cause.message : 'ollama_service_offline').message);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleInstallLocalModel(model: LocalModelProfile): Promise<void> {
    setModelActionBusyId(model.id);
    try {
      const snapshot = await installLocalModel(model.modelId);
      setLocalRuntime(snapshot);
      await handleActivateLocal(model);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao instalar modelo local.');
      await refreshLocalRuntime();
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleRemoveLocalModel(model: LocalModelProfile): Promise<void> {
    setModelActionBusyId(model.id);
    try {
      const snapshot = await removeLocalModel(model.modelId);
      setLocalRuntime(snapshot);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao remover modelo local.');
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleRenameSession(session: AgentSession): Promise<void> {
    const nextTitle = window.prompt('Novo nome da sessão', session.title);
    if (!nextTitle || nextTitle.trim() === session.title) return;
    const updated = await renameSession(session.id, nextTitle);
    upsertSession(updated);
  }

  async function handleDeleteSession(session: AgentSession): Promise<void> {
    const confirmed = window.confirm(`Excluir a sessão "${session.title}"? Esta ação remove o arquivo salvo.`);
    if (!confirmed) return;
    await deleteSession(session.id);
    removeSession(session.id);
    if (sessionInfoId === session.id) {
      setSessionInfoId(undefined);
    }
  }

  async function handleDuplicateSession(session: AgentSession): Promise<void> {
    const duplicated = await duplicateSession(session.id);
    upsertSession(duplicated);
    selectSession(duplicated.id);
  }

  async function handleExportSession(session: AgentSession, format: 'markdown' | 'json'): Promise<void> {
    const result = await exportSession(session.id, format);
    window.alert(`Sessão exportada: ${result.path}`);
  }

  function handleOpenGuide(): void {
    const path = workspacePath('docs/GUIA_DE_USO.md');
    if (path) void openFileInVscode(path);
  }

  function handleOpenQuickstart(): void {
    const path = workspacePath('docs/QUICKSTART.md');
    if (path) void openFileInVscode(path);
  }

  function handleOpenWorkspace(): void {
    if (settings?.workspaceRoot) void openProjectInVscode(settings.workspaceRoot);
  }

  function handleOpenCodexRoot(): void {
    if (settings?.codexRoot) void openProjectInVscode(settings.codexRoot);
  }

  function handleOpenLogs(): void {
    if (settings?.codexRoot) void openProjectInVscode(`${settings.codexRoot}/codex-ui/logs`);
  }

  if (loading) return <div className="centered" style={{ height: '100vh' }}>Inicializando central...</div>;
  if (error && !booted) return <div className="centered error" style={{ height: '100vh' }}>{error}</div>;

  return (
    <>
      <AppShell
        header={
          <TopBar
            settings={settings}
            workspaceMeta={workspaceMeta}
            providerLabel={selectedProvider?.label}
            providerStatus={selectedProviderStatus}
            executionMode={executionMode}
            activeModelLabel={activeModelLabel}
            localRuntime={localRuntime}
            onCreateSession={handleCreateSession}
            onOpenProject={(root) => void openProjectInVscode(root)}
            onOpenInspector={() => {
              setSelectedInspectorTab('settings');
            }}
            onOpenModelSelector={() => setModelSelectorOpen(true)}
          />
        }
        sidebarLeft={
          <div className="left-sidebar-stack">
            <SessionsPanel
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              onNewSession={handleCreateSession}
              onSelect={selectSession}
              onRename={(session) => void handleRenameSession(session)}
              onDelete={(session) => void handleDeleteSession(session)}
              onExport={(session, format) => void handleExportSession(session, format)}
              onDuplicate={(session) => void handleDuplicateSession(session)}
              onInfo={(session) => setSessionInfoId(session.id)}
            />
            <CollapsibleSection
              title="Tarefas"
              description="Timeline da sessão"
              defaultOpen={Boolean(selectedSession?.tasks.length)}
              badge={selectedSession?.tasks.length ?? 0}
            >
              <TasksPanel session={selectedSession} />
            </CollapsibleSection>
            <CollapsibleSection
              title="Memória"
              description="Snapshot do contexto"
              badge={memory ? 1 : 0}
            >
              <MemoryPanel memory={memory} />
            </CollapsibleSection>
          </div>
        }
        main={
          <div className="main-workspace">
            {error ? (
              <div className="actionable-error-banner" role="alert">
                <strong>{translateError(error).message}</strong>
                <button type="button" className="btn-modern" onClick={() => setError(undefined)}>
                  Dispensar
                </button>
              </div>
            ) : null}
            <ChatPanel session={selectedSession} onQuickAction={handleSendPrompt} />
            <CommandInputPanel
              busy={busy}
              privilegedActions={privilegedActions}
              onSendOrder={handleSendPrompt}
              onExecuteCommand={handleExecuteCommand}
              onRequestPrivilegedAction={handleRequestPrivilegedAction}
              actionJsonExamples={actionJsonExamples}
              orderDisabledReason={orderDisabledReason}
              executionMode={executionMode}
              activeModelLabel={activeModelLabel}
              providerLabel={selectedProvider?.label}
              runtimeState={executionMode === 'local' ? localRuntime?.state : selectedProviderStatus?.state}
              onOpenModelSelector={() => setModelSelectorOpen(true)}
            />
            <TerminalDrawer logs={logs} open={terminalOpen} onToggle={() => setTerminalOpen((current) => !current)} />
          </div>
        }
        sidebarRight={
          <InspectorPanel
            selectedTab={selectedInspectorTab}
            onSelectTab={setSelectedInspectorTab}
            pendingApprovals={pendingPermissions.length}
            changedFiles={changedFiles.length}
            statusNotes={statusFeed.length}
            onOpenHelp={() => setHelpOpen(true)}
            approvalsContent={
              <PermissionsPanel
                requests={pendingPermissions}
                outcomes={permissionOutcomes}
                onApprove={(requestId) => void handlePermission(requestId, true)}
                onReject={(requestId) => void handlePermission(requestId, false)}
              />
            }
            filesContent={<ChangedFilesPanel entries={changedFiles} onOpen={(path) => void openFileInVscode(path)} />}
            statusContent={<StatusPanel feed={statusFeed} />}
            settingsContent={
              <SettingsPanel
                key={settingsTabRequest?.nonce ?? 'settings-panel'}
                settings={settings}
                providers={providers}
              providerProfiles={effectiveProviderProfiles}
                profiles={profiles}
                credentials={providerCredentials}
                localRuntime={localRuntime}
                sessions={sessions}
                healthCheck={healthCheck}
                healthLoading={healthLoading}
                onChange={(next) => handleUpdateSettings(next)}
                onTestProvider={(providerId) => handleTestProvider(providerId)}
                onSaveProviderProfileCredential={handleSaveProviderProfileCredential}
                onRemoveProviderCredential={(providerId) => handleRemoveProviderCredential(providerId)}
                onRemoveProviderProfile={handleRemoveProviderProfile}
                onSetDefaultProviderProfile={handleSetDefaultProviderProfile}
                onRenameProviderProfile={handleRenameProviderProfile}
                onInstallRuntime={handleInstallRuntime}
                onStartRuntime={handleStartRuntime}
                onRunHealthCheck={refreshHealthCheck}
                initialTab={settingsTabRequest?.tab}
              />
            }
            promptContent={
              <BasePromptPanel
                content={basePrompt}
                saving={savingBasePrompt}
                onChange={setBasePrompt}
                onSave={async () => {
                  setSavingBasePrompt(true);
                  try {
                    await updateBasePrompt(basePrompt);
                  } finally {
                    setSavingBasePrompt(false);
                  }
                }}
              />
            }
          />
        }
      />

      <ModelSelector
        open={modelSelectorOpen}
        mode={executionMode}
        activeModelId={selectedModelId}
        providers={providers}
        credentials={providerCredentials}
          providerProfiles={effectiveProviderProfiles}
        localRuntime={localRuntime}
        installationProgress={installationProgress}
        busyModelId={modelActionBusyId}
        onClose={() => setModelSelectorOpen(false)}
        onModeChange={(mode) => {
          void handleChangeMode(mode);
        }}
        onActivateCloud={handleActivateCloud}
        onActivateLocal={handleActivateLocal}
        onInstallLocalModel={handleInstallLocalModel}
        onRemoveLocalModel={handleRemoveLocalModel}
        onInstallRuntime={handleInstallRuntime}
        onStartRuntime={handleStartRuntime}
        onConfigureProvider={(providerId) => {
          openSettingsTab(providerId === 'local-ollama' ? 'local' : 'providers');
          setModelSelectorOpen(false);
        }}
      />

      <HelpDrawer
        open={helpOpen}
        busy={busy || localRuntimeLoading}
        onClose={() => setHelpOpen(false)}
        onOpenGuide={handleOpenGuide}
        onOpenQuickstart={handleOpenQuickstart}
        onOpenWorkspace={handleOpenWorkspace}
        onOpenCodexRoot={handleOpenCodexRoot}
        onOpenLogs={handleOpenLogs}
        onRunCheckEnvironment={() => void handleRunCheckEnvironment()}
      />

      {sessionInfo ? (
        <div className="session-info-overlay" role="dialog" aria-modal="true" aria-label="Informações da sessão">
          <section className="session-info-dialog">
            <header>
              <div>
                <h2>{sessionInfo.title}</h2>
                <p>{sessionInfo.id}</p>
              </div>
              <button type="button" className="btn-modern" onClick={() => setSessionInfoId(undefined)}>
                Fechar
              </button>
            </header>
            <div className="session-info-grid">
              <span>Criada: <strong>{new Date(sessionInfo.createdAt).toLocaleString('pt-BR')}</strong></span>
              <span>Atualizada: <strong>{new Date(sessionInfo.updatedAt).toLocaleString('pt-BR')}</strong></span>
              <span>Status: <strong>{sessionInfo.status.replace('_', ' ')}</strong></span>
              <span>Mensagens: <strong>{sessionInfo.messages.length}</strong></span>
              <span>Provider: <strong>{sessionInfo.providerId ?? settings?.selectedProviderId ?? 'não definido'}</strong></span>
              <span>Modelo: <strong>{sessionInfo.modelId ?? settings?.selectedModelId ?? 'não definido'}</strong></span>
              <span>Perfil: <strong>{sessionInfo.agentProfileId ?? settings?.selectedAgentId ?? 'não definido'}</strong></span>
            </div>
            <div className="session-info-actions">
              <button type="button" className="btn-modern" onClick={() => void handleRenameSession(sessionInfo)}>
                Renomear
              </button>
              <button type="button" className="btn-modern" onClick={() => void handleExportSession(sessionInfo, 'markdown')}>
                Exportar .md
              </button>
              <button type="button" className="btn-modern" onClick={() => void handleExportSession(sessionInfo, 'json')}>
                Exportar .json
              </button>
              <button type="button" className="btn-modern" onClick={() => void handleDuplicateSession(sessionInfo)}>
                Duplicar
              </button>
              <button type="button" className="btn-modern btn-danger" onClick={() => void handleDeleteSession(sessionInfo)}>
                Excluir
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
