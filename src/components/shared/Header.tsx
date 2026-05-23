
import { useRuntimeStore } from '../../stores/runtimeStore';
import { getRuntimeStatus } from '../../core/runtime/runtimeClient';

interface HeaderProps {
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
}

export function Header({ toggleRightPanel }: HeaderProps) {
  const { hardware } = useRuntimeStore();
  
  const status = getRuntimeStatus();

  let runtimeStatus = 'Verificando...';
  let runtimeBadgeClass = 'app-badge-muted';
  
  if (status.ready) {
    runtimeStatus = 'Runtime: AirLLM Pronto';
    runtimeBadgeClass = 'app-badge-success';
  } else if (status.installed) {
    runtimeStatus = 'Runtime: AirLLM Indisponível';
    runtimeBadgeClass = 'app-badge-danger';
  } else {
    runtimeStatus = 'Runtime: Fallback Local';
    runtimeBadgeClass = 'app-badge-danger';
  }

  const selectedModel = status.selectedModelId || 'Nenhum';
  const loadedModel = status.loadedModelId || 'Nenhum';

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span className={`app-badge ${runtimeBadgeClass}`} title={status.lastRuntimeError || ''}>
          {runtimeStatus}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--bg-input)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
            <strong style={{ color: 'var(--text-main)' }}>Selecionado:</strong> {selectedModel}
          </span>
          <span style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--bg-input)', borderRadius: '4px', border: '1px solid var(--border-color)', color: loadedModel === 'Nenhum' ? 'var(--text-danger)' : 'var(--text-main)' }}>
            <strong style={{ color: 'var(--text-main)' }}>Carregado:</strong> {loadedModel}
          </span>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {hardware && (
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>RAM Livre: <strong style={{ color: 'var(--text-main)' }}>{hardware.free_ram_gb.toFixed(1)} GB</strong></span>
            <span>OS: <strong style={{ color: 'var(--text-main)' }}>{hardware.os_name}</strong></span>
          </div>
        )}
        <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-color)' }} />
        <button className="app-button app-button-secondary" onClick={toggleRightPanel}>
          Contexto Ativo 🔍
        </button>
      </div>
    </header>
  );
}
