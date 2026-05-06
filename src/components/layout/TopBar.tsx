import type { AppSettings, ProviderRuntimeStatus, WorkspaceMeta } from '../../types/domain';

interface TopBarProps {
  settings?: AppSettings;
  workspaceMeta?: WorkspaceMeta;
  providerLabel?: string;
  providerStatus?: ProviderRuntimeStatus;
  onCreateSession: () => void;
  onOpenProject: (root: string) => void;
  onOpenInspector: () => void;
}

export function TopBar({
  settings,
  workspaceMeta,
  providerLabel,
  providerStatus,
  onCreateSession,
  onOpenProject,
  onOpenInspector
}: TopBarProps): JSX.Element {
  const workspaceRoot = settings?.workspaceRoot;
  const repoName = workspaceMeta?.repoName ?? workspaceRoot?.split('/').filter(Boolean).pop() ?? 'workspace';
  const branch = workspaceMeta?.branch ?? 'sem branch';
  const provider = providerLabel ?? settings?.selectedProviderId ?? 'provider';
  const providerStatusLabel = providerStatus?.state.replace('_', ' ') ?? 'indisponível';

  return (
    <header className="topbar-clean">
      <div className="topbar-clean-brand">
        <h1>Codex Command Center</h1>
        <div className="topbar-clean-repo">
          <span>{repoName}</span>
          <span className="topbar-separator" aria-hidden="true">•</span>
          <span>{branch}</span>
        </div>
      </div>

      <div className={`provider-summary provider-${providerStatus?.state ?? 'unavailable'}`}>
        <span className="provider-summary-name">{provider}</span>
        <span className="provider-summary-state">{providerStatusLabel}</span>
      </div>

      <div className="topbar-clean-actions">
        <button className="btn-modern" type="button" onClick={onCreateSession}>
          Nova sessão
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
          Settings / Inspector
        </button>
      </div>
    </header>
  );
}
