import { useEffect, useMemo, useState } from 'react';
import {
  bootstrapState,
  applyEnvironmentToAllSessions,
  createSession,
  deleteSession,
  duplicateSession,
  exportSession,
  getAppHealthCheck,
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
  updateSessionEnvironment,
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
  ProviderStatusState,
  EnvironmentSelectionInput,
} from './types/domain';
import { useAppStore } from './stores/appStore';

import { AppShell } from './components/layout/AppShell';
import { TopBar } from './components/layout/TopBar';
import { SessionsPanel } from './components/panels/SessionsPanel';
import { ChatPanel } from './components/panels/ChatPanel';
import { SettingsPanel, type SettingsTab } from './components/panels/SettingsPanel';
import { CommandInputPanel } from './components/panels/CommandInputPanel';
import { TerminalDrawer } from './components/panels/TerminalDrawer';
import { HelpDrawer } from './components/panels/HelpDrawer';
import { ModelSelector, type EnvironmentTab } from './components/panels/ModelSelector';
import {
  ConfirmDialog,
  ExportDialog,
  PremiumModal,
  ToastViewport,
  type ToastMessage,
} from './components/common/PremiumUI';

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

function accountStatusFromProviderState(
  state: ProviderStatusState,
  profile: ProviderAccountProfile,
): ProviderAccountProfile['status'] {
  if (state === 'ready') return 'ready';
  if (state === 'requires_api_key') return profile.maskedCredential ? 'testing' : 'requires_api_key';
  if (state === 'invalid_api_key') return 'invalid_api_key';
  if (state === 'forbidden') return 'forbidden';
  if (state === 'requires_login') return 'requires_login';
  if (state === 'requires_oauth') return 'requires_oauth';
  if (state === 'requires_cli_auth') return 'requires_cli_auth';
  if (state === 'testing' || state === 'running') return 'testing';
  if (state === 'quota_exceeded') return 'quota_exceeded';
  if (state === 'rate_limited') return 'rate_limited';
  if (state === 'provider_unavailable') return 'provider_unavailable';
  if (state === 'misconfigured' || state === 'not_configured') return 'misconfigured';
  if (state === 'experimental' || state === 'mock') return 'experimental';
  return 'unavailable';
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
  const [busy, setBusy] = useState(false);
  const [privilegedActions, setPrivilegedActions] = useState<PrivilegedActionSpec[]>([]);
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
  const [environmentTabRequest, setEnvironmentTabRequest] = useState<{ tab: EnvironmentTab; nonce: number }>();
  const [sessionInfoId, setSessionInfoId] = useState<string>();
  const [controlModalOpen, setControlModalOpen] = useState(false);
  const [renameSessionTarget, setRenameSessionTarget] = useState<AgentSession>();
  const [renameSessionTitle, setRenameSessionTitle] = useState('');
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<AgentSession>();
  const [exportSessionTarget, setExportSessionTarget] = useState<AgentSession>();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const {
    booted,
    loading,
    error,
    settings,
    providers,
    providerProfiles,
    profiles,
    theme,
    sessions,
    selectedSessionId,
    logs,
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

  const effectiveProviderProfiles = useMemo(() => {
    const source = providerAccountProfiles.length > 0 ? providerAccountProfiles : providerProfiles;
    return source.map((profile) => {
      const provider = providers.find((item) => item.id === profile.providerId);
      if (!provider) return profile;
      const status = accountStatusFromProviderState(provider.status.state, profile);
      return {
        ...profile,
        providerLabel: provider.label,
        status,
        message: status === profile.status ? profile.message : provider.status.message,
        lastTestedAt: status === 'ready' ? provider.status.checkedAt : profile.lastTestedAt,
        lastValidatedAt: status === 'ready' ? provider.status.checkedAt : profile.lastValidatedAt,
      };
    });
  }, [providerAccountProfiles, providerProfiles, providers]);

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

  const activeModelLabel = useMemo(() => {
    if (executionMode === 'cloud' && selectedProviderStatus?.state !== 'ready') return 'Configurar Ambiente';
    if (executionMode === 'cloud' && selectedProviderProfile && selectedProviderProfile.status !== 'ready') return 'Configurar Ambiente';
    if (executionMode === 'local' && localRuntime?.state !== 'ready') return 'Configurar Ambiente local';
    return activeModel?.displayName ?? settings?.selectedModelId ?? 'modelo não selecionado';
  }, [
    activeModel?.displayName,
    executionMode,
    localRuntime?.state,
    selectedProviderProfile,
    selectedProviderStatus?.state,
    settings?.selectedModelId,
  ]);

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
      return `${selectedProviderProfile.message} Ação: ajuste o profile em Ambiente > Contas.`;
    }

    return undefined;
  }, [executionMode, localRuntime, selectedProviderProfile, selectedProviderStatus, settings]);

  const workspacePath = (relativePath: string): string | undefined => {
    if (!settings?.workspaceRoot) return undefined;
    return `${settings.workspaceRoot.replace(/\/$/, '')}/${relativePath}`;
  };

  function pushToast(tone: ToastMessage['tone'], message: string): void {
    setToasts((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        tone,
        message,
      },
    ]);
  }

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
        const actionCatalog = await listPrivilegedActions();
        if (mounted) {
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

  function openEnvironmentTab(tab: EnvironmentTab = 'ready'): void {
    setEnvironmentTabRequest({ tab, nonce: Date.now() });
    setModelSelectorOpen(true);
  }

  async function handleTestProvider(providerId: string): Promise<ProviderRuntimeStatus> {
    const status = await testProviderConnection(providerId);
    updateProviderStatus(providerId, status);
    await refreshProviderCredentials();
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
      openEnvironmentTab('configure');
      setModelSelectorOpen(false);
      return;
    }

    const providerAccounts = effectiveProviderProfiles.filter((profile) => profile.providerId === model.providerId);
    const readyProfile =
      providerAccounts.find((profile) => profile.isDefault && profile.status === 'ready') ??
      providerAccounts.find((profile) => profile.status === 'ready');
    if (providerAccounts.length > 0 && !readyProfile) {
      setError('Nenhum profile pronto para este provider. Configure ou teste a conta antes de selecionar.');
      openEnvironmentTab('accounts');
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
      openEnvironmentTab('local');
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

  function cloudEnvironmentInput(model: CloudModelProfile): EnvironmentSelectionInput | undefined {
    if (!settings) return undefined;
    const provider = providers.find((item) => item.id === model.providerId);
    if (!provider) {
      setError(`Provider ${model.providerLabel} não está registrado neste build.`);
      return undefined;
    }
    const status = resolveModelStatus(model, provider.status, localRuntime);
    if (!canSelectModel(status)) {
      setError(translateError(status, provider.status.message).message);
      openEnvironmentTab('configure');
      return undefined;
    }
    const providerAccounts = effectiveProviderProfiles.filter((profile) => profile.providerId === model.providerId);
    const readyProfile =
      providerAccounts.find((profile) => profile.isDefault && profile.status === 'ready') ??
      providerAccounts.find((profile) => profile.status === 'ready');
    if (providerAccounts.length > 0 && !readyProfile) {
      setError('Nenhum profile pronto para este provider. Configure ou teste a conta antes de selecionar.');
      openEnvironmentTab('accounts');
      return undefined;
    }
    return {
      providerId: model.providerId,
      modelId: model.modelId,
      agentProfileId: settings.selectedAgentId,
      accountProfileId: readyProfile?.id ?? settings.selectedProviderProfileId,
    };
  }

  function localEnvironmentInput(model: LocalModelProfile): EnvironmentSelectionInput | undefined {
    if (!settings) return undefined;
    const status = resolveModelStatus(model, selectedProviderStatus, localRuntime);
    if (!canSelectModel(status)) {
      setError(translateError(status, localRuntime?.message).message);
      openEnvironmentTab('local');
      return undefined;
    }
    return {
      providerId: 'local-ollama',
      modelId: model.modelId,
      agentProfileId: settings.selectedAgentId,
      accountProfileId: undefined,
    };
  }

  async function handleUseCloudInChat(model: CloudModelProfile): Promise<void> {
    const input = cloudEnvironmentInput(model);
    if (!input) return;
    if (!selectedSessionId) {
      await handleSetGlobalCloud(model);
      pushToast('info', 'Ambiente definido como padrão para o próximo chat.');
      return;
    }
    setModelActionBusyId(model.id);
    try {
      const updated = await updateSessionEnvironment(selectedSessionId, input);
      upsertSession(updated);
      selectModel(model.id);
      setModelSelectorOpen(false);
      pushToast('success', `Ambiente aplicado neste chat: ${model.displayName}`);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleUseLocalInChat(model: LocalModelProfile): Promise<void> {
    const input = localEnvironmentInput(model);
    if (!input) return;
    if (!selectedSessionId) {
      await handleSetGlobalLocal(model);
      pushToast('info', 'Ambiente local definido como padrão para o próximo chat.');
      return;
    }
    setModelActionBusyId(model.id);
    try {
      const updated = await updateSessionEnvironment(selectedSessionId, input);
      upsertSession(updated);
      selectModel(model.id);
      setModelSelectorOpen(false);
      pushToast('success', `Ambiente aplicado neste chat: ${model.displayName}`);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleSetGlobalCloud(model: CloudModelProfile): Promise<void> {
    const input = cloudEnvironmentInput(model);
    if (!settings || !input) return;
    setModelActionBusyId(model.id);
    try {
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'cloud',
          selectedProviderId: input.providerId,
          selectedModelId: input.modelId,
          selectedProviderProfileId: input.accountProfileId,
        },
        'cloud',
        input.providerId,
        input.modelId,
      );
      await applySettings(next);
      setExecutionMode('cloud');
      selectModel(model.id);
      setModelSelectorOpen(false);
      pushToast('success', `Padrão global definido: ${model.displayName}`);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleSetGlobalLocal(model: LocalModelProfile): Promise<void> {
    const input = localEnvironmentInput(model);
    if (!settings || !input) return;
    setModelActionBusyId(model.id);
    try {
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'local',
          selectedProviderId: 'local-ollama',
          selectedModelId: input.modelId,
          selectedLocalModelId: input.modelId,
        },
        'local',
        'local-ollama',
        input.modelId,
      );
      await applySettings(next);
      setExecutionMode('local');
      selectModel(model.id);
      setModelSelectorOpen(false);
      pushToast('success', `Padrão global local definido: ${model.displayName}`);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleApplyCloudToAll(model: CloudModelProfile): Promise<void> {
    const input = cloudEnvironmentInput(model);
    if (!settings || !input) return;
    setModelActionBusyId(model.id);
    try {
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'cloud',
          selectedProviderId: input.providerId,
          selectedModelId: input.modelId,
          selectedProviderProfileId: input.accountProfileId,
        },
        'cloud',
        input.providerId,
        input.modelId,
      );
      await applySettings(next);
      const updated = await applyEnvironmentToAllSessions(input);
      for (const session of updated) upsertSession(session);
      setExecutionMode('cloud');
      selectModel(model.id);
      setModelSelectorOpen(false);
      pushToast('success', `Ambiente aplicado a ${updated.length} chat(s).`);
    } finally {
      setModelActionBusyId(undefined);
    }
  }

  async function handleApplyLocalToAll(model: LocalModelProfile): Promise<void> {
    const input = localEnvironmentInput(model);
    if (!settings || !input) return;
    setModelActionBusyId(model.id);
    try {
      const next = pushHistory(
        {
          ...settings,
          executionMode: 'local',
          selectedProviderId: 'local-ollama',
          selectedModelId: input.modelId,
          selectedLocalModelId: input.modelId,
        },
        'local',
        'local-ollama',
        input.modelId,
      );
      await applySettings(next);
      const updated = await applyEnvironmentToAllSessions(input);
      for (const session of updated) upsertSession(session);
      setExecutionMode('local');
      selectModel(model.id);
      setModelSelectorOpen(false);
      pushToast('success', `Ambiente local aplicado a ${updated.length} chat(s).`);
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
    const nextTitle = renameSessionTitle.trim();
    if (!nextTitle || nextTitle === session.title) {
      setRenameSessionTarget(undefined);
      return;
    }
    const updated = await renameSession(session.id, nextTitle);
    upsertSession(updated);
    setRenameSessionTarget(undefined);
    setRenameSessionTitle('');
  }

  async function handleDeleteSession(session: AgentSession): Promise<void> {
    await deleteSession(session.id);
    removeSession(session.id);
    if (sessionInfoId === session.id) {
      setSessionInfoId(undefined);
    }
    setDeleteSessionTarget(undefined);
    pushToast('success', 'Sessão excluída.');
  }

  async function handleDuplicateSession(session: AgentSession): Promise<void> {
    const duplicated = await duplicateSession(session.id);
    upsertSession(duplicated);
    selectSession(duplicated.id);
  }

  async function handleExportSession(session: AgentSession, format: 'markdown' | 'json' | 'txt'): Promise<void> {
    const result = await exportSession(session.id, format);
    setExportSessionTarget(undefined);
    pushToast('success', `Sessão exportada: ${result.path}`);
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
        sidebarLeft={
          <SessionsPanel
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onNewSession={handleCreateSession}
            onSelect={selectSession}
            onRename={(session) => {
              setRenameSessionTarget(session);
              setRenameSessionTitle(session.title);
            }}
            onDelete={(session) => setDeleteSessionTarget(session)}
            onExport={(session, format) => void handleExportSession(session, format)}
            onDuplicate={(session) => void handleDuplicateSession(session)}
            onInfo={(session) => setSessionInfoId(session.id)}
          />
        }
        main={
          <div className={`main-workspace ${selectedSession ? '' : 'main-workspace-home'}`}>
            <TopBar
              providerStatus={selectedProviderStatus}
              executionMode={executionMode}
              activeModelLabel={activeModelLabel}
              onOpenInspector={() => {
                setSettingsTabRequest({ tab: 'general', nonce: Date.now() });
                setControlModalOpen(true);
              }}
              onOpenModelSelector={() => openEnvironmentTab('ready')}
            />
            {error ? (
              <div className="actionable-error-banner" role="alert">
                <strong>{translateError(error).message}</strong>
                <button type="button" className="btn-modern" onClick={() => setError(undefined)}>
                  Dispensar
                </button>
              </div>
            ) : null}
            <ChatPanel session={selectedSession} onOpenEnvironment={() => openEnvironmentTab('accounts')} />
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
              providerLabel={selectedProviderStatus?.state === 'ready' ? selectedProvider?.label : 'Configurar'}
              runtimeState={executionMode === 'local' ? localRuntime?.state : undefined}
              onOpenModelSelector={() => openEnvironmentTab('ready')}
              onOpenTerminal={() => setTerminalOpen(true)}
            />
            {terminalOpen ? <TerminalDrawer logs={logs} open={terminalOpen} onToggle={() => setTerminalOpen((current) => !current)} /> : null}
          </div>
        }
        sidebarRightVisible={false}
        sidebarRight={null}
      />

      <PremiumModal
        open={controlModalOpen}
        title="Controle"
        description="Configurações, IA, contas, terminal, sessões e diagnóstico em área ampla."
        onClose={() => setControlModalOpen(false)}
        className="control-modal"
      >
        <SettingsPanel
          key={settingsTabRequest?.nonce ?? 'settings-modal-panel'}
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
          onOpenEnvironment={(tab) => openEnvironmentTab(tab)}
          initialTab={settingsTabRequest?.tab ?? 'general'}
        />
      </PremiumModal>

      <ModelSelector
        key={environmentTabRequest?.nonce ?? 'environment-modal'}
        open={modelSelectorOpen}
        initialTab={environmentTabRequest?.tab ?? 'ready'}
        mode={executionMode}
        activeModelId={selectedModelId}
        settings={settings}
        selectedSession={selectedSession}
        sessions={sessions}
        providers={providers}
        credentials={providerCredentials}
        providerProfiles={effectiveProviderProfiles}
        localRuntime={localRuntime}
        healthCheck={healthCheck}
        installationProgress={installationProgress}
        busyModelId={modelActionBusyId}
        onClose={() => setModelSelectorOpen(false)}
        onModeChange={(mode) => {
          void handleChangeMode(mode);
        }}
        onActivateCloud={handleActivateCloud}
        onActivateLocal={handleActivateLocal}
        onUseCloudInChat={handleUseCloudInChat}
        onUseLocalInChat={handleUseLocalInChat}
        onSetGlobalCloud={handleSetGlobalCloud}
        onSetGlobalLocal={handleSetGlobalLocal}
        onApplyCloudToAll={handleApplyCloudToAll}
        onApplyLocalToAll={handleApplyLocalToAll}
        onInstallLocalModel={handleInstallLocalModel}
        onRemoveLocalModel={handleRemoveLocalModel}
        onInstallRuntime={handleInstallRuntime}
        onStartRuntime={handleStartRuntime}
        onTestProvider={handleTestProvider}
        onSaveProviderProfileCredential={handleSaveProviderProfileCredential}
        onRemoveProviderCredential={handleRemoveProviderCredential}
        onRemoveProviderProfile={handleRemoveProviderProfile}
        onSetDefaultProviderProfile={handleSetDefaultProviderProfile}
        onConfigureProvider={(providerId) => {
          openEnvironmentTab(providerId === 'local-ollama' ? 'local' : 'configure');
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

      <PremiumModal
        open={Boolean(renameSessionTarget)}
        title="Renomear sessão"
        onClose={() => setRenameSessionTarget(undefined)}
        className="compact-modal"
      >
        <div className="credential-modal-form">
          <label>
            Nome da sessão
            <input value={renameSessionTitle} onChange={(event) => setRenameSessionTitle(event.target.value)} />
          </label>
          <div className="dialog-actions">
            <button type="button" className="btn-modern" onClick={() => setRenameSessionTarget(undefined)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-modern btn-modern-primary"
              disabled={!renameSessionTitle.trim()}
              onClick={() => {
                if (renameSessionTarget) void handleRenameSession(renameSessionTarget);
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      </PremiumModal>

      <ConfirmDialog
        open={Boolean(deleteSessionTarget)}
        title="Excluir sessão"
        message={deleteSessionTarget ? `Excluir "${deleteSessionTarget.title}"? Esta ação remove o arquivo salvo.` : ''}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeleteSessionTarget(undefined)}
        onConfirm={() => {
          if (deleteSessionTarget) void handleDeleteSession(deleteSessionTarget);
        }}
      />

      <ExportDialog
        open={Boolean(exportSessionTarget)}
        title={exportSessionTarget?.title ?? ''}
        onCancel={() => setExportSessionTarget(undefined)}
        onExport={(format) => {
          if (exportSessionTarget) void handleExportSession(exportSessionTarget, format);
        }}
      />

      <ToastViewport
        toasts={toasts}
        onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
      />

      <PremiumModal
        open={Boolean(sessionInfo)}
        title={sessionInfo?.title ?? 'Informações da sessão'}
        description={sessionInfo?.id}
        onClose={() => setSessionInfoId(undefined)}
        className="compact-modal"
      >
        {sessionInfo ? (
          <section className="session-info-dialog session-info-dialog-compact">
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
              <button
                type="button"
                className="btn-modern"
                onClick={() => {
                  setRenameSessionTarget(sessionInfo);
                  setRenameSessionTitle(sessionInfo.title);
                }}
              >
                Renomear
              </button>
              <button type="button" className="btn-modern" onClick={() => setExportSessionTarget(sessionInfo)}>
                Exportar
              </button>
              <button type="button" className="btn-modern" onClick={() => void handleDuplicateSession(sessionInfo)}>
                Duplicar
              </button>
              <button type="button" className="btn-modern btn-danger" onClick={() => setDeleteSessionTarget(sessionInfo)}>
                Excluir
              </button>
            </div>
          </section>
        ) : null}
      </PremiumModal>
    </>
  );
}
