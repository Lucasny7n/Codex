
interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
}

export function Sidebar({ isOpen, toggle }: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        {isOpen && <span className="sidebar-title">Ailu Studio</span>}
        <button onClick={toggle} className="icon-btn">
          ☰
        </button>
      </div>
      
      <nav className="sidebar-nav">
        <NavItem icon="⚡" label="Operador" isOpen={isOpen} active />
        <NavItem icon="🧠" label="Modelos" isOpen={isOpen} />
        <NavItem icon="🖥️" label="Sistema" isOpen={isOpen} />
        <NavItem icon="🛠️" label="Skills" isOpen={isOpen} />
        <NavItem icon="💾" label="Memória" isOpen={isOpen} />
        <NavItem icon="📁" label="Arquivos" isOpen={isOpen} />
      </nav>

      <div className="sidebar-footer">
        <NavItem icon="⚙️" label="Configurações" isOpen={isOpen} />
      </div>
    </aside>
  );
}

function NavItem({ icon, label, isOpen, active }: { icon: string, label: string, isOpen: boolean, active?: boolean }) {
  return (
    <div className={`nav-item ${active ? 'active' : ''}`}>
      <span className="nav-item-icon">{icon}</span>
      {isOpen && <span className="nav-item-label">{label}</span>}
    </div>
  );
}
