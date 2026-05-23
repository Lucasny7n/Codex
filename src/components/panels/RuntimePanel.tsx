import { useEffect, useState } from 'react';
import { useRuntimeStore } from '../../stores/runtimeStore';
import { useApprovalStore } from '../../stores/approvalStore';

export function RuntimePanel() {
  const { status, checkRuntimeStatus, generateText, createSetupPlan } = useRuntimeStore();
  const { requestApproval } = useApprovalStore();
  const [testPrompt, setTestPrompt] = useState('Olá! Como você está?');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (msg: string) => setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  useEffect(() => {
    checkRuntimeStatus();
  }, [checkRuntimeStatus]);

  const handleInstallEnv = async () => {
    addLog('Solicitando plano de setup AirLLM...');
    try {
      const plan = await createSetupPlan();
      requestApproval(plan as unknown as import('../../core/skills/skillTypes').ExecutionPlan);
      addLog('Plano gerado e pendente de aprovação.');
    } catch (e) {
      addLog(`Erro ao criar plano: ${e}`);
    }
  };

  const handleTestGenerate = async () => {
    if (!status.selectedModelId) {
      addLog('Selecione um modelo local no catálogo primeiro.');
      return;
    }
    
    addLog(`Testando geração com modelo ${status.selectedModelId}...`);
    setTestResult('Gerando...');
    
    try {
      // Assuming model is installed in ~/.local/share/ailu/models/<id>
      const path = `~/.local/share/ailu/models/${status.selectedModelId}`;
      const res = await generateText(path, testPrompt);
      if (res.ok) {
        addLog(`Sucesso: ${res.tokens_per_second} tokens/s`);
        setTestResult(res.response || '');
      } else {
        addLog(`Falha do Sidecar: ${res.message}`);
        setTestResult(`Erro: ${res.message}`);
      }
    } catch (e) {
      addLog(`Falha Crítica: ${e}`);
      setTestResult(`Falha: ${e}`);
    }
  };

  const handleCheckStatus = async () => {
    addLog('Verificando status do Sidecar...');
    await checkRuntimeStatus();
    addLog('Status atualizado.');
  };

  return (
    <div style={{ padding: 'var(--space-6)', backgroundColor: 'var(--bg-main)', height: '100%', overflowY: 'auto' }}>
      <h2 className="app-section-title">Runtime Local via Sidecar (AirLLM)</h2>
      
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <button onClick={handleCheckStatus} className="app-button app-button-secondary">
          🔄 Verificar Runtime
        </button>
        <button onClick={handleCheckStatus} className="app-button app-button-secondary">
          🩺 Testar status do Sidecar
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <section className="app-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Python & AirLLM State</h3>
            <span className={`app-badge ${status.installed ? 'app-badge-success' : 'app-badge-danger'}`}>
              {status.installed ? 'Instalado' : 'Não Instalado'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: '0.875rem' }}>
            <div><strong>Python:</strong> {status.pythonVersion || 'Desconhecido'}</div>
            <div><strong>Device:</strong> {status.device || 'Desconhecido'}</div>
            <div><strong>Ready (Sidecar OK):</strong> {status.ready ? 'Sim' : 'Não'}</div>
            {status.lastRuntimeError && (
              <div style={{ color: 'var(--color-danger)' }}><strong>Erro:</strong> {status.lastRuntimeError}</div>
            )}
          </div>
          
          {!status.installed && (
             <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
               <h4 style={{ marginBottom: 'var(--space-2)' }}>Instalação Pendente</h4>
               <button onClick={handleInstallEnv} className="app-button app-button-primary">
                 Criar plano de ambiente AirLLM
               </button>
             </div>
          )}
        </section>

        <section className="app-panel">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Testar Prompt</h3>
          <input 
            value={testPrompt} 
            onChange={e => setTestPrompt(e.target.value)} 
            className="app-textarea" 
            style={{ marginBottom: 'var(--space-4)' }}
          />
          <button onClick={handleTestGenerate} className="app-button app-button-primary" disabled={!status.installed}>
            🚀 Testar Prompt
          </button>
          {testResult && (
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', backgroundColor: 'var(--bg-input)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
              {testResult}
            </div>
          )}
        </section>

        <section className="app-panel">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Logs do Runtime</h3>
          <div style={{ backgroundColor: 'black', color: 'lime', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', maxHeight: '200px', overflowY: 'auto' }}>
            {logs.length === 0 ? 'Sem logs.' : logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
