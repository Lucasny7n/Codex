import { useEffect, useMemo, useState } from 'react';
import {
  appendUserMessage,
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
  updateBasePrompt,
  updateSettings
} from './lib/api';
import { trimMultiline } from './lib/format';
import type { PrivilegedActionSpec } from './types/domain';
import { useAppStore } from './stores/appStore';

import { AppShell } from './components/layout/AppShell';
import { TopBar } from './components/layout/TopBar';
import { SessionsPanel } from './components/panels/SessionsPanel';
import { ChatPanel } from './components/panels/ChatPanel';
import { StatusPanel } from './components/panels/StatusPanel';
import { TasksPanel } from './components/panels/TasksPanel';
import { TerminalPanel } from './components/panels/TerminalPanel';
import { PermissionsPanel } from './components/panels/PermissionsPanel';
import { ChangedFilesPanel } from './components/panels/ChangedFilesPanel';
import { SettingsPanel } from './components/panels/SettingsPanel';
import { MemoryPanel } from './components/panels/MemoryPanel';
import { BasePromptPanel } from './components/panels/BasePromptPanel';
import { OnboardingPanel } from './components/panels/OnboardingPanel';
import { CommandInputPanel } from './components/panels/CommandInputPanel';

const ACTION_JSON_EXAMPLES: Record<string, string> = {
  systemctl_enable_service: '{\n  "service": "fstrim.timer"\n}',
  systemctl_disable_service: '{\n  "service": "waydroid-container.service"\n}',
  systemctl_restart_service: '{\n  "service": "waydroid-container.service"\n}',
  systemctl_status_service: '{\n  "service": "waydroid-container.service"\n}',
  bootctl_set_default_kernel: '{\n  "entry": "arch-linux-cachyos-bore.conf"\n}',
  chmod_random_seed: '{}',
  backup_file: '{\n  "path": "/boot/loader/loader.conf"\n}',
  restore_file: '{\n  "backupPath": "/home/lucas/.codex/codex-ui/backups/exemplo.bak",\n  "targetPath": "/boot/loader/loader.conf"\n}',
  pacman_install_packages: '{\n  "packages": ["ripgrep"]\n}',
  paccache_keep_versions: '{\n  "keep": 2\n}',
  waydroid_start: '{}',
  waydroid_stop: '{}',
  waydroid_status: '{}',
  hyprland_verify_config: '{\n  "configPath": "/home/lucas/.config/hypr/hyprland.conf"\n}',
  hyprland_reload_user: '{}'
};

function applyTheme(accent: { accentPrimary: string; accentSecondary: string; background: string }): void {
  const root = document.documentElement;
  root.style.setProperty('--accent', accent.accentPrimary);
  root.style.setProperty('--accent-2', accent.accentSecondary);
  root.style.setProperty('--surface-base', accent.background);
}

export default function App(): JSX.Element {
  const [basePrompt, setBasePrompt] = useState('');
  const [savingBasePrompt, setSavingBasePrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [privilegedActions, setPrivilegedActions] = useState<PrivilegedActionSpec[]>([]);

  const {
    booted,
    loading,
    error,
    settings,
    providers,
    profiles,
    memory,
    theme,
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
    updateSettings: syncSettings
  } = useAppStore();

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [sessions, selectedSessionId]
  );
  
  const shouldHighlightOnboarding = booted && sessions.length === 0;

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
      const updated = await appendUserMessage(sessionId, cleaned);
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

  async function handlePermission(requestId: string, approve: boolean): Promise<void> {
    await decidePermission(requestId, approve ? 'allow_once' : 'deny_once');
    removePermission(requestId);
  }

  async function handleRunCheckEnvironment(): Promise<void> {
    setBusy(true);
    try {
      const sessionId = await ensureSession();
      const response = await requestExecution({
        sessionId,
        command: 'bash /home/lucas/Codex/scripts/check-environment.sh',
        cwd: settings?.workspaceRoot ?? '/home/lucas/Codex',
        reason: 'Checklist de ambiente acionado pelo painel Primeiros Passos.'
      });
      if (response.permissionRequest) {
        addPermission(response.permissionRequest);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="centered" style={{ height: '100vh' }}>Inicializando central...</div>;
  if (error) return <div className="centered error" style={{ height: '100vh' }}>{error}</div>;

  return (
    <AppShell
      header={
        <TopBar 
          settings={settings}
          onCreateSession={() => void handleCreateSession()}
          onOpenProject={(root) => void openProjectInVscode(root)}
          onOpenLastFile={(path) => void openFileInVscode(path)}
          lastChangedFilePath={changedFiles[0]?.path}
        />
      }
      sidebarLeft={
        <>
          <SessionsPanel sessions={sessions} selectedSessionId={selectedSessionId} onSelect={selectSession} />
          <TasksPanel session={selectedSession} />
          <MemoryPanel memory={memory} />
        </>
      }
      main={
        <>
          <ChatPanel session={selectedSession} />
          <CommandInputPanel 
            busy={busy}
            privilegedActions={privilegedActions}
            onSendOrder={handleSendPrompt}
            onExecuteCommand={handleExecuteCommand}
            onRequestPrivilegedAction={handleRequestPrivilegedAction}
            actionJsonExamples={ACTION_JSON_EXAMPLES}
          />
          <TerminalPanel logs={logs} />
        </>
      }
      sidebarRight={
        <>
          <PermissionsPanel
            requests={pendingPermissions}
            outcomes={permissionOutcomes}
            onApprove={(requestId) => void handlePermission(requestId, true)}
            onReject={(requestId) => void handlePermission(requestId, false)}
          />
          <OnboardingPanel
            busy={busy}
            highlight={shouldHighlightOnboarding}
            onOpenGuide={() => void openFileInVscode('/home/lucas/Codex/docs/GUIA_DE_USO.md')}
            onOpenQuickstart={() => void openFileInVscode('/home/lucas/Codex/docs/QUICKSTART.md')}
            onOpenWorkspace={() => void openProjectInVscode(settings?.workspaceRoot ?? '/home/lucas/Codex')}
            onOpenCodexRoot={() => void openProjectInVscode(settings?.codexRoot ?? '/home/lucas/.codex')}
            onOpenLogs={() => void openProjectInVscode(`${settings?.codexRoot ?? '/home/lucas/.codex'}/codex-ui/logs`)}
            onRunCheckEnvironment={() => void handleRunCheckEnvironment()}
          />
          <ChangedFilesPanel entries={changedFiles} onOpen={(path) => void openFileInVscode(path)} />
          <StatusPanel feed={statusFeed} />
          <SettingsPanel
            settings={settings}
            providers={providers}
            profiles={profiles}
            onChange={(next) => handleUpdateSettings(next)}
          />
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
        </>
      }
    />
  );
}
