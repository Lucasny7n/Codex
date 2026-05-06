import { useEffect, useMemo, useState } from 'react';
import {
  bootstrapState,
  createSession,
  decidePermission,
  getBasePrompt,
  listPrivilegedActions,
  onCommandLog,
  onFileChanged,
  onPermissionOutcome,
  onPermissionRaised,
  onPermissionResolved,
  onSessionChanged,
  onStatusNote,
  openFileInVscode,
  openProjectInVscode,
  requestPrivilegedAction,
  requestExecution,
  sendOrderToAgent,
  testProviderConnection,
  updateBasePrompt,
  updateSettings
} from './lib/api';
import { shellQuote, trimMultiline } from './lib/format';
import type { AppSettings, PrivilegedActionSpec, ProviderRuntimeStatus } from './types/domain';
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
import { SettingsPanel } from './components/panels/SettingsPanel';
import { MemoryPanel } from './components/panels/MemoryPanel';
import { BasePromptPanel } from './components/panels/BasePromptPanel';
import { OnboardingPanel } from './components/panels/OnboardingPanel';
import { CommandInputPanel } from './components/panels/CommandInputPanel';
import { InspectorPanel } from './components/panels/InspectorPanel';
import { TerminalDrawer } from './components/panels/TerminalDrawer';
import { HelpDrawer } from './components/panels/HelpDrawer';

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
    hyprland_reload_user: '{}'
  };
}

export default function App(): JSX.Element {
  const [basePrompt, setBasePrompt] = useState('');
  const [savingBasePrompt, setSavingBasePrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [privilegedActions, setPrivilegedActions] = useState<PrivilegedActionSpec[]>([]);
  const [selectedInspectorTab, setSelectedInspectorTab] = useState<InspectorTabId>('status');
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const {
    booted,
    loading,
    error,
    settings,
    providers,
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
    setError,
    setLoading,
    bootstrap,
    upsertSession,
    selectSession,
    appendStatus,
    appendLog,
    pushFileChange,
    addPermission,
    removePermission,
    recordPermissionOutcome,
    updateSettings: syncSettings,
    updateProviderStatus
  } = useAppStore();

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  const actionJsonExamples = useMemo(() => buildActionJsonExamples(settings), [settings]);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === settings?.selectedProviderId),
    [providers, settings?.selectedProviderId]
  );

  const selectedProviderStatus: ProviderRuntimeStatus | undefined = selectedProvider?.status ?? (settings
    ? {
        state: 'unavailable',
        message: `Provider salvo \`${settings.selectedProviderId}\` não está registrado neste build.`,
        checkedAt: new Date().toISOString()
      }
    : undefined);

  const orderDisabledReason = selectedProviderStatus && !['ready', 'mock'].includes(selectedProviderStatus.state)
    ? `Provider ${selectedProviderStatus.state}: ${selectedProviderStatus.message}`
    : undefined;

  const workspacePath = (relativePath: string): string | undefined => {
    if (!settings?.workspaceRoot) return undefined;
    return `${settings.workspaceRoot.replace(/\/$/, '')}/${relativePath}`;
  };

  const showOnboardingEmptyState = booted && sessions.length === 0;

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

        unlisteners.push(await onStatusNote((note) => appendStatus(note)));
        unlisteners.push(await onCommandLog((chunk) => appendLog(chunk)));
        unlisteners.push(await onFileChanged((change) => pushFileChange(change)));
        unlisteners.push(await onSessionChanged((session) => upsertSession(session)));
        unlisteners.push(await onPermissionRaised((request) => addPermission(request)));
        unlisteners.push(await onPermissionResolved((requestId) => removePermission(requestId)));
        unlisteners.push(await onPermissionOutcome((outcome) => recordPermissionOutcome(outcome)));
      } catch (cause) {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : 'Falha ao inicializar aplicação.');
      } finally {
        if (mounted) {
          setLoading(false);
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
  }, [addPermission, appendLog, appendStatus, bootstrap, pushFileChange, recordPermissionOutcome, removePermission, setError, setLoading, upsertSession]);

  useEffect(() => {
    if (theme) {
      applyTheme(theme);
    }
  }, [theme]);

  async function ensureSession(): Promise<string> {
    if (selectedSessionId) {
      return selectedSessionId;
    }
    const created = await createSession('Sessão inicial');
    upsertSession(created);
    selectSession(created.id);
    return created.id;
  }

  async function handleCreateSession(): Promise<void> {
    const created = await createSession(`Sessão ${new Date().toLocaleTimeString('pt-BR')}`);
    upsertSession(created);
    selectSession(created.id);
  }

  async function handleSendPrompt(prompt: string): Promise<void> {
    const cleaned = trimMultiline(prompt);
    if (!cleaned) return;
    setBusy(true);
    try {
      const sessionId = await ensureSession();
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
      const sessionId = await ensureSession();
      const response = await requestExecution({
        sessionId,
        command: cleaned,
        cwd: settings?.workspaceRoot,
        reason: 'Comando solicitado pelo usuário na central.'
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
      const sessionId = await ensureSession();
      const request = await requestPrivilegedAction({
        sessionId,
        actionId,
        args,
        reason: 'Ação privilegiada solicitada pelo usuário no painel de permissões.',
        dryRun
      });
      addPermission(request);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateSettings(next: NonNullable<typeof settings>): Promise<void> {
    const updated = await updateSettings(next);
    syncSettings(updated);
  }

  async function handleTestProvider(providerId: string): Promise<ProviderRuntimeStatus> {
    const status = await testProviderConnection(providerId);
    updateProviderStatus(providerId, status);
    return status;
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
      const sessionId = await ensureSession();
      const response = await requestExecution({
        sessionId,
        command: `bash ${shellQuote(scriptPath)}`,
        cwd: settings.workspaceRoot,
        reason: 'Checklist de ambiente acionado pelo painel Primeiros Passos.'
      });
      if (response.permissionRequest) {
        addPermission(response.permissionRequest);
      }
    } finally {
      setBusy(false);
    }
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
  if (error) return <div className="centered error" style={{ height: '100vh' }}>{error}</div>;

  return (
    <>
      <AppShell
        header={
          <TopBar
            settings={settings}
            workspaceMeta={workspaceMeta}
            providerLabel={selectedProvider?.label}
            providerStatus={selectedProviderStatus}
            onCreateSession={() => void handleCreateSession()}
            onOpenProject={(root) => void openProjectInVscode(root)}
            onOpenInspector={() => {
              setSelectedInspectorTab('settings');
            }}
          />
        }
        sidebarLeft={
          <div className="left-sidebar-stack">
            <SessionsPanel sessions={sessions} selectedSessionId={selectedSessionId} onSelect={selectSession} />
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
            {showOnboardingEmptyState ? (
              <div className="onboarding-empty-state" data-testid="onboarding-empty-state">
                <OnboardingPanel
                  busy={busy}
                  highlight
                  onOpenGuide={handleOpenGuide}
                  onOpenQuickstart={handleOpenQuickstart}
                  onOpenWorkspace={handleOpenWorkspace}
                  onOpenCodexRoot={handleOpenCodexRoot}
                  onOpenLogs={handleOpenLogs}
                  onRunCheckEnvironment={() => void handleRunCheckEnvironment()}
                />
              </div>
            ) : (
              <>
                <ChatPanel session={selectedSession} />
                <CommandInputPanel
                  busy={busy}
                  privilegedActions={privilegedActions}
                  onSendOrder={handleSendPrompt}
                  onExecuteCommand={handleExecuteCommand}
                  onRequestPrivilegedAction={handleRequestPrivilegedAction}
                  actionJsonExamples={actionJsonExamples}
                  orderDisabledReason={orderDisabledReason}
                />
                <TerminalDrawer logs={logs} open={terminalOpen} onToggle={() => setTerminalOpen((current) => !current)} />
              </>
            )}
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
                settings={settings}
                providers={providers}
                profiles={profiles}
                onChange={(next) => handleUpdateSettings(next)}
                onTestProvider={(providerId) => handleTestProvider(providerId)}
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

      <HelpDrawer
        open={helpOpen}
        busy={busy}
        onClose={() => setHelpOpen(false)}
        onOpenGuide={handleOpenGuide}
        onOpenQuickstart={handleOpenQuickstart}
        onOpenWorkspace={handleOpenWorkspace}
        onOpenCodexRoot={handleOpenCodexRoot}
        onOpenLogs={handleOpenLogs}
        onRunCheckEnvironment={() => void handleRunCheckEnvironment()}
      />
    </>
  );
}
