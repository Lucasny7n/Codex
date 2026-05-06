import type { AppSettings } from '../../types/domain';

interface TopBarProps {
  settings?: AppSettings;
  onCreateSession: () => void;
  onOpenProject: (root: string) => void;
  onOpenLastFile: (path: string) => void;
  lastChangedFilePath?: string;
}

export function TopBar({
  settings,
  onCreateSession,
  onOpenProject,
  onOpenLastFile,
  lastChangedFilePath
}: TopBarProps): JSX.Element {
  return (
    <header className="topbar-modern">
      <div className="topbar-brand">
        <h1>Codex Command Center</h1>
        <span className="badge-modern badge-info">v0.1.0</span>
      </div>
      
      <div className="topbar-actions">
        <button className="btn-modern" type="button" onClick={onCreateSession}>
          Nova sessão
        </button>
        <button 
          className="btn-modern" 
          type="button" 
          onClick={() => onOpenProject(settings?.workspaceRoot ?? '/home/lucas/Codex')}
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
