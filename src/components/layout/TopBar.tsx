import type {
  AppSettings,
  ExecutionMode,
  LocalRuntimeSnapshot,
  ProviderRuntimeStatus,
  WorkspaceMeta,
} from '../../types/domain';

interface TopBarProps {
  settings?: AppSettings;
  workspaceMeta?: WorkspaceMeta;
  providerLabel?: string;
  providerStatus?: ProviderRuntimeStatus;
  executionMode: ExecutionMode;
  activeModelLabel: string;
  localRuntime?: LocalRuntimeSnapshot;
  onCreateSession: () => void;
  onOpenProject: (root: string) => void;
  onOpenInspector: () => void;
  onOpenModelSelector: () => void;
}

function modeLabel(mode: ExecutionMode): string {
  return mode === 'local' ? 'Local' : 'Nuvem';
}

export function TopBar({
  settings,
  workspaceMeta,
  providerLabel,
  providerStatus,
  executionMode,
  activeModelLabel,
  localRuntime,
  onCreateSession,
  onOpenProject,
  onOpenInspector,
  onOpenModelSelector,
}: TopBarProps): JSX.Element {
  const workspaceRoot = settings?.workspaceRoot;
  const repoName = workspaceMeta?.repoName ?? workspaceRoot?.split('/').filter(Boolean).pop() ?? 'workspace';
  const branch = workspaceMeta?.branch ?? 'sem branch';
  const provider = providerLabel ?? settings?.selectedProviderId ?? 'provider';
  const providerStatusLabel = providerStatus?.state.replace('_', ' ') ?? 'indisponível';

  return (
    <header className="topbar-clean">
      <div className="topbar-clean-brand">
        <h1>AI Command Center</h1>
        <div className="topbar-clean-repo">
          <span>{repoName}</span>
          <span className="topbar-separator" aria-hidden="true">•</span>
          <span>{branch}</span>
          {workspaceMeta?.dirty ? <span className="workspace-dirty">dirty</span> : null}
        </div>
      </div>

      <button type="button" className="model-switcher-button" onClick={onOpenModelSelector}>
        <span className="model-switcher-label">IA Ativa</span>
        <strong>{activeModelLabel}</strong>
        <span>
          {modeLabel(executionMode)}
          {executionMode === 'local' && localRuntime ? ` • ${localRuntime.state.replace('_', ' ')}` : ` • ${provider}`}
        </span>
      </button>

      <div className={`provider-summary provider-${providerStatus?.state ?? 'unavailable'}`}>
        <span className="provider-summary-name">{provider}</span>
        <span className="provider-summary-state">{providerStatusLabel}</span>
      </div>

      <div className="topbar-clean-actions">
        <button className="btn-modern" type="button" onClick={onCreateSession}>
          Nova conversa
        </button>
        <button
          className="btn-modern"
          type="button"
          disabled={!workspaceRoot}
          onClick={() => {
            if (workspaceRoot) onOpenProject(workspaceRoot);
          }}
        >
          Projeto
        </button>
        <button className="btn-modern btn-modern-primary" type="button" onClick={onOpenInspector}>
          Inspector
        </button>
      </div>
    </header>
  );
}
