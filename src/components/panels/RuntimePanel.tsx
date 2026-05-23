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

import { useApprovalStore } from '../../stores/approvalStore';

export function RuntimePanel() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { requestApproval } = useApprovalStore();

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

  const handleInstallEnv = () => {
    requestApproval({
      id: `install-airllm-${Date.now()}`,
      summary: 'Criar Ambiente Isolado (AirLLM)',
      reason: 'O Ailu precisa criar um venv seguro e instalar o AirLLM para rodar os modelos grandes sem conflitos no sistema base.',
      totalRisk: 'Seguro',
      requiresSudo: false,
      backupRequired: false,
      skillId: 'install-airllm',
      steps: [
        { order: 1, description: 'Criar diretório venv', command: 'python', args: ['-m', 'venv', '~/.local/share/ailu/airllm-venv'], riskLevel: 'Seguro', requiresSudo: false },
        { order: 2, description: 'Atualizar PIP local', command: '~/.local/share/ailu/airllm-venv/bin/pip', args: ['install', '--upgrade', 'pip'], riskLevel: 'Seguro', requiresSudo: false },
        { order: 3, description: 'Instalar AirLLM', command: '~/.local/share/ailu/airllm-venv/bin/pip', args: ['install', 'airllm'], riskLevel: 'Seguro', requiresSudo: false }
      ]
    });
  };

  if (loading) return <div className="p-4 text-gray-400">Verificando ambientes...</div>;
  if (!status) return <div className="p-4 text-red-400">Erro ao carregar status.</div>;

  return (
    <div className="p-6 bg-[var(--bg-main)] h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Runtime & Inteligência Artificial</h2>
      
      <div className="space-y-6">
        <section className="bg-[#161b22] p-6 rounded-xl border border-[#30363d]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
              <span className="text-yellow-500">🐍</span> Python Environment
            </h3>
            <span className={`px-2.5 py-0.5 rounded uppercase tracking-wider text-[10px] font-bold border ${status.python.status === 'Ready' ? 'bg-green-900/20 text-green-400 border-green-900/50' : 'bg-red-900/20 text-red-400 border-red-900/50'}`}>
              {status.python.status}
            </span>
          </div>
          <div className="text-gray-400 text-sm">
            <p>Versão Detectada: <span className="text-white font-mono bg-[#0d1117] px-2 py-0.5 rounded border border-[#30363d] ml-2">{status.python.version || 'Não instalada'}</span></p>
          </div>
        </section>

        <section className="bg-[#161b22] p-6 rounded-xl border border-[#30363d]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
              <span className="text-blue-500">🧠</span> AirLLM (Modelos Gigantes)
            </h3>
            <span className={`px-2.5 py-0.5 rounded uppercase tracking-wider text-[10px] font-bold border ${status.airllm.installed ? 'bg-green-900/20 text-green-400 border-green-900/50' : 'bg-orange-900/20 text-orange-400 border-orange-900/50'}`}>
              {status.airllm.status}
            </span>
          </div>
          <div className="text-gray-400 text-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-24 text-gray-500 font-semibold uppercase text-[10px] tracking-wider">Diretório</span>
              <span className="font-mono text-gray-300 bg-[#0d1117] px-2 py-0.5 rounded border border-[#30363d]">~/.local/share/ailu/airllm-venv</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-gray-500 font-semibold uppercase text-[10px] tracking-wider">Venv Existe</span>
              <span className={status.airllm.venv_exists ? 'text-green-400' : 'text-gray-500'}>{status.airllm.venv_exists ? 'Sim' : 'Não'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-gray-500 font-semibold uppercase text-[10px] tracking-wider">Instalado</span>
              <span className={status.airllm.installed ? 'text-green-400' : 'text-gray-500'}>{status.airllm.installed ? 'Sim' : 'Não'}</span>
            </div>
          </div>
          
          {!status.airllm.installed && (
            <div className="mt-6 p-4 bg-[#0d1117] border border-[#30363d] rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-xl">🛠️</span>
                <div>
                  <p className="font-semibold text-gray-200 mb-1">AirLLM pendente de instalação</p>
                  <p className="text-gray-400 text-sm mb-4">Crie um ambiente isolado (venv) seguro para gerenciar os modelos gigantes e evitar poluição no seu Arch Linux.</p>
                  <button onClick={handleInstallEnv} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-sm flex items-center gap-2">
                    Criar Ambiente Isolado
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
