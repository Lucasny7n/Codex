
interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
}

export function Sidebar({ isOpen, toggle, activeView, setActiveView }: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        {isOpen && <span className="sidebar-title">Ailu Studio</span>}
        <button onClick={toggle} className="icon-btn">
          ☰
        </button>
      </div>
      
      <nav className="sidebar-nav">
        <NavItem icon="⚡" label="Operador" isOpen={isOpen} active={activeView === 'operator'} onClick={() => setActiveView('operator')} />
        <NavItem icon="🧠" label="Modelos" isOpen={isOpen} active={activeView === 'models'} onClick={() => setActiveView('models')} />
        <NavItem icon="🖥️" label="Runtime" isOpen={isOpen} active={activeView === 'runtime'} onClick={() => setActiveView('runtime')} />
        <NavItem icon="💾" label="Memória" isOpen={isOpen} active={activeView === 'memory'} onClick={() => setActiveView('memory')} />
        <NavItem icon="🎙️" label="Voz" isOpen={isOpen} active={activeView === 'voice'} onClick={() => setActiveView('voice')} />
      </nav>

      <div className="sidebar-footer">
        <NavItem icon="⚙️" label="Configurações" isOpen={isOpen} />
      </div>
    </aside>
  );
}

function NavItem({ icon, label, isOpen, active, onClick }: { icon: string, label: string, isOpen: boolean, active?: boolean, onClick?: () => void }) {
  return (
    <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-item-icon">{icon}</span>
      {isOpen && <span className="nav-item-label">{label}</span>}
    </div>
  );
}
