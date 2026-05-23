
import { useModelStore } from '../../stores/modelStore';
import { useRuntimeStore } from '../../stores/runtimeStore';

interface HeaderProps {
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
}

export function Header({ toggleRightPanel }: HeaderProps) {
  const { primaryModelId, fallbackModelId } = useModelStore();
  const { runtime, hardware } = useRuntimeStore();

  let runtimeStatus = 'Verificando...';
  let runtimeBadgeClass = 'app-badge-muted';
  
  if (runtime) {
    if (runtime.airllm_installed) {
      runtimeStatus = 'Runtime: AirLLM Pronto';
      runtimeBadgeClass = 'app-badge-success';
    } else {
      runtimeStatus = 'Runtime: AirLLM Não Instalado';
      runtimeBadgeClass = 'app-badge-danger';
    }
  }

  // Model states (loaded vs selected)
  // At the MVP phase, we just mock "Loaded" based on whether it's primary or fallback.
  // The user prompt: "Não misturar selecionado com carregado. Se nenhum modelo carregado: Modelo carregado: nenhum"
  // For now, let's treat selection.
  const selectedModel = primaryModelId || fallbackModelId || 'Nenhum';
  const loadedModel = 'Nenhum';

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span className={`app-badge ${runtimeBadgeClass}`}>
          {runtimeStatus}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--bg-input)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
            <strong style={{ color: 'var(--text-main)' }}>Selecionado:</strong> {selectedModel}
          </span>
          <span style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--bg-input)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
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
