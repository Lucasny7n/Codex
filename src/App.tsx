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
  const [prompt, setPrompt] = useState('');
  const [command, setCommand] = useState('');
  const [basePrompt, setBasePrompt] = useState('');
  const [savingBasePrompt, setSavingBasePrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [privilegedActions, setPrivilegedActions] = useState<PrivilegedActionSpec[]>([]);
  const [selectedActionId, setSelectedActionId] = useState('');
  const [actionArgsText, setActionArgsText] = useState('{}');
  const [actionDryRun, setActionDryRun] = useState(true);
  const [copiedActionId, setCopiedActionId] = useState<string>();

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
  const selectedPrivilegedAction = useMemo(
    () => privilegedActions.find((action) => action.id === selectedActionId),
    [privilegedActions, selectedActionId]
  );
  const selectedActionExample = ACTION_JSON_EXAMPLES[selectedActionId] ?? '{}';
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
          setSelectedActionId(actionCatalog[0]?.id ?? '');
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

  async function handleSendPrompt(): Promise<void> {
    const cleaned = trimMultiline(prompt);
    if (!cleaned) return;
    setBusy(true);
    try {
      const sessionId = await ensureSession();
      const updated = await appendUserMessage(sessionId, cleaned);
      upsertSession(updated);
      setPrompt('');
    } finally {
      setBusy(false);
    }
  }

  async function handleExecuteCommand(): Promise<void> {
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
      if (!response.approvalRequired) {
        setCommand('');
      }
      if (response.permissionRequest) {
        addPermission(response.permissionRequest);
      }
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

  async function handleCopyActionExample(): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selectedActionExample);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = selectedActionExample;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copied) {
          throw new Error('clipboard indisponível');
        }
      }

      const actionId = selectedActionId;
      setCopiedActionId(actionId);
      window.setTimeout(() => {
        setCopiedActionId((current) => (current === actionId ? undefined : current));
      }, 1600);
    } catch (cause) {
      setError(cause instanceof Error ? `Falha ao copiar JSON: ${cause.message}` : 'Falha ao copiar JSON.');
    }
  }

  async function handleRequestPrivilegedAction(): Promise<void> {
    if (!selectedActionId) {
      setError('Selecione uma ação privilegiada.');
      return;
    }

    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = JSON.parse(actionArgsText) as Record<string, unknown>;
    } catch {
      setError('Argumentos JSON inválidos para ação privilegiada.');
      return;
    }

    setBusy(true);
    try {
      const sessionId = await ensureSession();
      const request = await requestPrivilegedAction({
        sessionId,
        actionId: selectedActionId,
        args: parsedArgs,
        reason: 'Ação privilegiada solicitada pelo usuário no painel de permissões.',
        dryRun: actionDryRun
      });
      addPermission(request);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-root">
      <header className="topbar">
        <div>
          <h1>Codex Command Center</h1>
          <p>
            cockpit de agentes com execução controlada, memórias em <code>~/.codex</code> e fluxo de VS Code.
          </p>
        </div>
        <div className="top-actions">
          <button className="btn" type="button" onClick={() => void handleCreateSession()}>
            Nova sessão
          </button>
          <button className="btn" type="button" onClick={() => void openProjectInVscode(settings?.workspaceRoot ?? '/home/lucas/Codex')}>
            Abrir projeto no VS Code
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              const latest = changedFiles[0]?.path;
              if (latest) {
                void openFileInVscode(latest);
              }
            }}
          >
            Abrir último arquivo alterado
          </button>
        </div>
      </header>

      {loading ? <div className="blocking-state">Inicializando central...</div> : null}
      {!loading && error ? <div className="blocking-state error">{error}</div> : null}

      {booted && !error ? (
        <main className="app-grid">
          <aside className="col-left">
            <SessionsPanel sessions={sessions} selectedSessionId={selectedSessionId} onSelect={selectSession} />
            <TasksPanel session={selectedSession} />
            <MemoryPanel memory={memory} />
          </aside>

          <section className="col-main">
            <ChatPanel session={selectedSession} />

            <section className="panel input-panel">
              <header className="panel-header">
                <h2>Ordem e Execução</h2>
              </header>
              <div className="panel-body input-stack">
                <label>
                  Ordem para o agente
                  <textarea
                    rows={3}
                    placeholder="ex.: diagnostique o projeto e implemente integração X"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                </label>
                <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void handleSendPrompt()}>
                  Enviar ordem
                </button>

                <label>
                  Comando de terminal
                  <textarea
                    rows={2}
                    placeholder="ex.: npm run test"
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                  />
                </label>
                <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void handleExecuteCommand()}>
                  Executar via camada de permissão
                </button>

                <div className="privileged-box">
                  <h3>Ação Privilegiada (via helper/pkexec)</h3>
                  <label>
                    Ação
                    <select value={selectedActionId} onChange={(event) => setSelectedActionId(event.target.value)}>
                      {privilegedActions.map((action) => (
                        <option key={action.id} value={action.id}>
                          {action.title} ({action.riskLevel})
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedPrivilegedAction ? (
                    <>
                      <p className="muted">
                        {selectedPrivilegedAction.description} | risco {selectedPrivilegedAction.riskLevel} | alvo padrão:{' '}
                        {selectedPrivilegedAction.targetHint}
                      </p>
                      <p className="muted">
                        Exemplo JSON para essa ação:
                      </p>
                      <pre className="json-example">{selectedActionExample}</pre>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void handleCopyActionExample()}
                        >
                          {copiedActionId === selectedActionId ? 'Copiado!' : 'Copiar JSON de exemplo'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setActionArgsText(selectedActionExample)}
                        >
                          Usar exemplo no campo JSON
                        </button>
                      </div>
                    </>
                  ) : null}
                  <label>
                    Argumentos JSON
                    <textarea
                      rows={4}
                      placeholder='{"service":"waydroid-container.service"}'
                      value={actionArgsText}
                      onChange={(event) => setActionArgsText(event.target.value)}
                    />
                  </label>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={actionDryRun} onChange={(event) => setActionDryRun(event.target.checked)} />
                    executar em dry-run
                  </label>
                  <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void handleRequestPrivilegedAction()}>
                    Solicitar ação privilegiada
                  </button>
                </div>
              </div>
            </section>

            <TerminalPanel logs={logs} />
          </section>

          <aside className="col-right">
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
          </aside>
        </main>
      ) : null}
    </div>
  );
}
