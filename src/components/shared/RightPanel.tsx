import { useContextStore } from '../../stores/contextStore';

interface RightPanelProps {
  isOpen: boolean;
  toggle: () => void;
}

export function RightPanel({ isOpen, toggle }: RightPanelProps) {
  const { activeContext, clearContext } = useContextStore();

  return (
    <aside className={`right-panel ${isOpen ? 'open' : 'closed'}`}>
      <div className="right-panel-header">
        <span className="right-panel-title">Contexto Ativo</span>
        <button onClick={toggle} className="icon-btn">✕</button>
      </div>
      <div className="right-panel-content" style={activeContext ? { justifyContent: 'flex-start' } : {}}>
        {!activeContext ? (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>🔍</div>
            <p style={{ textAlign: 'center' }}>Nenhum contexto selecionado.</p>
            <p style={{ textAlign: 'center', marginTop: '0.5rem', opacity: 0.5 }}>Abra um arquivo, projeto ou erro para inspecionar.</p>
          </>
        ) : (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ padding: '2px 8px', backgroundColor: 'var(--bg-hover)', borderRadius: '4px', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                {activeContext.type}
              </span>
              <button onClick={clearContext} className="btn-danger" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>Limpar</button>
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              {activeContext.label}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {activeContext.summary}
            </p>
            
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px', fontSize: '0.75rem', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
              <pre>{JSON.stringify(activeContext.data, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
