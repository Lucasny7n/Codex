
interface HeaderProps {
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
}

export function Header({ toggleRightPanel }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-stats">
        <div className="header-stat-group">
          <span className="status-dot" />
          <span>AirLLM (Qwen2.5-Coder)</span>
        </div>
        <div className="header-stat-group header-stat-divider">
          <span>RAM: 32%</span>
          <span>CPU: 12%</span>
        </div>
      </div>
      
      <div className="header-actions">
        <button className="btn-danger">
          ⚠️ Modo Seguro
        </button>
        <button onClick={toggleRightPanel} className="icon-btn">
          Contexto 🔍
        </button>
      </div>
    </header>
  );
}
