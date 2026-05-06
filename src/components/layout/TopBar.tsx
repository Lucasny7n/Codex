import type { AppSettings, ProviderRuntimeStatus, WorkspaceMeta } from '../../types/domain';

type VisualSessionState = 'idle' | 'planning' | 'running' | 'waiting_permission' | 'error' | 'done';

interface TopBarProps {
  settings?: AppSettings;
  workspaceMeta?: WorkspaceMeta;
  providerLabel?: string;
  modelLabel?: string;
  profileLabel?: string;
  sessionState?: VisualSessionState;
  providerStatus?: ProviderRuntimeStatus;
  pendingPermissions: number;
  onCreateSession: () => void;
  onOpenProject: (root: string) => void;
  onOpenLastFile: (path: string) => void;
  lastChangedFilePath?: string;
}

export function TopBar({
  settings,
  workspaceMeta,
  providerLabel,
  modelLabel,
  profileLabel,
  sessionState = 'idle',
  providerStatus,
  pendingPermissions,
  onCreateSession,
  onOpenProject,
  onOpenLastFile,
  lastChangedFilePath
}: TopBarProps): JSX.Element {
  const workspaceRoot = settings?.workspaceRoot;
  const repoName = workspaceMeta?.repoName ?? workspaceRoot?.split('/').filter(Boolean).pop() ?? 'workspace';
  const branch = workspaceMeta?.branch ?? 'sem branch';
  const model = modelLabel ?? settings?.selectedModelId ?? 'modelo';
  const provider = providerLabel ?? settings?.selectedProviderId ?? 'provider';
  const profile = profileLabel ?? settings?.selectedAgentId ?? 'perfil';
  const statusLabel = sessionState.replace('_', ' ');
  const providerStatusLabel = providerStatus?.state.replace('_', ' ') ?? 'indisponível';

  return (
    <header className="topbar-modern">
      <div className="topbar-left">
        <div className="topbar-mark" aria-hidden="true">CC</div>
        <div className="topbar-title-stack">
          <div className="topbar-kicker">Command Center</div>
          <h1>{repoName}</h1>
        </div>
      </div>

      <div className="topbar-meta" aria-label="Contexto do workspace">
        <span className="meta-pill meta-branch">{branch}</span>
        {workspaceMeta?.dirty ? <span className="meta-pill meta-warn">mudanças locais</span> : null}
        <span className={`meta-pill status-pill status-${sessionState}`}>{statusLabel}</span>
        <span className={`meta-pill provider-pill provider-${providerStatus?.state ?? 'unavailable'}`}>
          {provider}: {providerStatusLabel}
        </span>
        <span className="meta-pill">{model}</span>
        <span className="meta-pill">{profile}</span>
        {pendingPermissions > 0 ? <span className="meta-pill meta-warn">{pendingPermissions} aprovações</span> : null}
      </div>

      <div className="topbar-actions">
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
          Abrir Projeto
        </button>
        {lastChangedFilePath && (
          <button
            className="btn-modern btn-modern-primary"
            type="button"
            onClick={() => onOpenLastFile(lastChangedFilePath)}
          >
            Editar: {lastChangedFilePath.split('/').pop()}
          </button>
        )}
      </div>
    </header>
  );
}
