
import { useModelStore } from '../../stores/modelStore';
import { useRuntimeStore } from '../../stores/runtimeStore';

interface HeaderProps {
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
}

export function Header({ toggleRightPanel }: HeaderProps) {
  const { primaryModelId } = useModelStore();
  const { runtime, hardware } = useRuntimeStore();

  let runtimeStatus = 'Verificando...';
  let runtimeColor = 'bg-gray-500';
  if (runtime) {
    if (runtime.airllm_installed) {
      runtimeStatus = 'AirLLM Pronto';
      runtimeColor = 'bg-green-500';
    } else {
      runtimeStatus = 'AirLLM Não Instalado';
      runtimeColor = 'bg-red-500';
    }
  }

  let modelDisplay = primaryModelId ? `Modelo: ${primaryModelId}` : 'Fallback Conversacional';

  return (
    <header className="app-header bg-[#121216] border-b border-[var(--border-color)]">
      <div className="header-stats">
        <div className="header-stat-group gap-2">
          <span className={`w-2 h-2 rounded-full ${runtimeColor} shadow-[0_0_8px_currentColor]`} />
          <span className="font-semibold text-gray-200">{runtimeStatus}</span>
          <span className="text-gray-500 mx-1">|</span>
          <span className="text-gray-400">{modelDisplay}</span>
        </div>
        {hardware && (
          <div className="header-stat-group header-stat-divider text-gray-400 gap-4">
            <span>RAM Livre: {hardware.free_ram_gb.toFixed(1)} GB</span>
            <span>OS: {hardware.os_name}</span>
          </div>
        )}
      </div>
      
      <div className="header-actions">
        <button className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-900/50 rounded-lg text-sm font-medium">
          🛡️ Modo Operador Local
        </button>
        <button onClick={toggleRightPanel} className="icon-btn hover:bg-gray-800 p-2 rounded">
          Contexto 🔍
        </button>
      </div>
    </header>
  );
}
