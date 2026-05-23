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
    <div style={{ padding: 'var(--space-6)', backgroundColor: 'var(--bg-main)', height: '100%', overflowY: 'auto' }}>
      <h2 className="app-section-title">Runtime & Inteligência Artificial</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <section className="app-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ color: 'var(--color-warning)' }}>🐍</span> Python Environment
            </h3>
            <span className={`app-badge ${status.python.status === 'Ready' ? 'app-badge-success' : 'app-badge-danger'}`}>
              {status.python.status}
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              Versão Detectada: 
              <span style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'var(--bg-input)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                {status.python.version || 'Não instalada'}
              </span>
            </p>
          </div>
        </section>

        <section className="app-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ color: 'var(--color-primary)' }}>🧠</span> AirLLM (Modelos Gigantes)
            </h3>
            <span className={`app-badge ${status.airllm.installed ? 'app-badge-success' : 'app-badge-warning'}`}>
              {status.airllm.status}
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ width: '100px', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.625rem', letterSpacing: '0.05em' }}>Diretório</span>
              <span style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'var(--bg-input)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>~/.local/share/ailu/airllm-venv</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ width: '100px', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.625rem', letterSpacing: '0.05em' }}>Venv Existe</span>
              <span style={{ color: status.airllm.venv_exists ? 'var(--color-success)' : 'var(--text-muted)' }}>{status.airllm.venv_exists ? 'Sim' : 'Não'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ width: '100px', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.625rem', letterSpacing: '0.05em' }}>Instalado</span>
              <span style={{ color: status.airllm.installed ? 'var(--color-success)' : 'var(--text-muted)' }}>{status.airllm.installed ? 'Sim' : 'Não'}</span>
            </div>
          </div>
          
          {!status.airllm.installed && (
            <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <span style={{ fontSize: '1.5rem' }}>🛠️</span>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 'var(--space-1)' }}>AirLLM pendente de instalação</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>Crie um ambiente isolado (venv) seguro para gerenciar os modelos gigantes e evitar poluição no seu Arch Linux.</p>
                  <button onClick={handleInstallEnv} className="app-button app-button-primary">
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
