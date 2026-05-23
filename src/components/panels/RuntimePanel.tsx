import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface RuntimeStatus {
  python: {
    installed: boolean;
    version: string | null;
    status: string;
  };
  airllm: {
    venv_exists: boolean;
    installed: boolean;
    status: string;
  };
}

export function RuntimePanel() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      setLoading(true);
      try {
        const data = await invoke<RuntimeStatus>('get_runtime_status');
        if (active) setStatus(data);
      } catch (err) {
        console.error("Erro ao carregar runtime", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadStatus();
    return () => { active = false; };
  }, []);

  if (loading) return <div className="p-4 text-gray-400">Verificando ambientes...</div>;
  if (!status) return <div className="p-4 text-red-400">Erro ao carregar status.</div>;

  return (
    <div className="p-6 bg-[var(--bg-main)] h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Runtime & Inteligência Artificial</h2>
      
      <div className="space-y-6">
        <section className="bg-[var(--bg-panel)] p-6 rounded-xl border border-[var(--border-color)]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
              <span className="text-yellow-500">🐍</span> Python Environment
            </h3>
            <span className={`px-2 py-1 rounded text-xs font-bold ${status.python.status === 'Ready' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
              {status.python.status}
            </span>
          </div>
          <div className="text-gray-400 text-sm">
            <p>Versão Detectada: <span className="text-white font-mono">{status.python.version || 'Não instalada'}</span></p>
          </div>
        </section>

        <section className="bg-[var(--bg-panel)] p-6 rounded-xl border border-[var(--border-color)]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
              <span className="text-blue-500">🧠</span> AirLLM (Modelos Gigantes)
            </h3>
            <span className={`px-2 py-1 rounded text-xs font-bold ${status.airllm.installed ? 'bg-green-900/50 text-green-400' : 'bg-orange-900/50 text-orange-400'}`}>
              {status.airllm.status}
            </span>
          </div>
          <div className="text-gray-400 text-sm space-y-2">
            <p>Diretório Venv: <span className="font-mono text-gray-300">~/.local/share/ailu/airllm-venv</span></p>
            <p>Venv Existe: <span className="text-white">{status.airllm.venv_exists ? 'Sim' : 'Não'}</span></p>
            <p>AirLLM Instalado: <span className="text-white">{status.airllm.installed ? 'Sim' : 'Não'}</span></p>
          </div>
          
          {!status.airllm.installed && (
            <div className="mt-4 p-4 bg-orange-900/20 border border-orange-900/50 rounded-lg text-orange-200 text-sm">
              <p className="font-semibold mb-1">AirLLM não instalado.</p>
              <p>Crie um ambiente isolado para usar modelos grandes locais.</p>
              <button className="mt-3 px-4 py-2 bg-[var(--bg-hover)] hover:bg-[#3a3a40] text-white rounded transition-colors">
                Instalar Ambiente (Requer Aprovação)
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
