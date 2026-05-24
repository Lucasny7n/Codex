
interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
}

export function Sidebar({ isOpen, toggle, activeView, setActiveView }: SidebarProps) {
  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-4)', borderBottom: '1px solid var(--border-color)' }}>
        {isOpen && <span style={{ fontWeight: 700, fontSize: '1.25rem', color: '#fff' }}>Ailu Studio</span>}
        <button onClick={toggle} className="app-button app-button-ghost" style={{ padding: '0.5rem' }}>
          ☰
        </button>
      </div>
      
      <nav style={{ flex: 1, padding: 'var(--space-4) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <NavItem icon="⚡" label="Operador" isOpen={isOpen} active={activeView === 'operator'} onClick={() => setActiveView('operator')} />
        <NavItem icon="🧠" label="Modelos" isOpen={isOpen} active={activeView === 'models'} onClick={() => setActiveView('models')} />
        <NavItem icon="🖥️" label="Runtime" isOpen={isOpen} active={activeView === 'runtime'} onClick={() => setActiveView('runtime')} />
        <NavItem icon="💾" label="Memória" isOpen={isOpen} active={activeView === 'memory'} onClick={() => setActiveView('memory')} />
        <NavItem icon="🎙️" label="Voz" isOpen={isOpen} active={activeView === 'voice'} onClick={() => setActiveView('voice')} />
      </nav>

      <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
        <NavItem icon="⚙️" label="Configurações" isOpen={isOpen} />
      </div>
    </aside>
  );
}

function NavItem({ icon, label, isOpen, active, onClick }: { icon: string, label: string, isOpen: boolean, active?: boolean, onClick?: () => void }) {
  const bgColor = active ? 'rgba(37, 99, 235, 0.15)' : 'transparent';
  const color = active ? 'var(--color-primary)' : 'var(--text-muted)';
  
  return (
    <button 
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: bgColor, color: color,
        cursor: 'pointer', transition: 'all 0.2s', width: '100%', textAlign: 'left'
      }}
      onMouseOver={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-main)'; }}
      onMouseOut={(e) => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
    >
      <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      {isOpen && <span style={{ fontWeight: 500 }}>{label}</span>}
    </button>
  );
}
