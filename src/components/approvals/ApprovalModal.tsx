import { useApprovalStore } from '../../stores/approvalStore';
import { useLogStore } from '../../stores/logStore';
import { SkillStep } from '../../core/skills/skillTypes';

export function ApprovalModal() {
  const { pendingPlan, resolveApproval } = useApprovalStore();
  const { addLog } = useLogStore();

  if (!pendingPlan) return null;

  const isExecuting = pendingPlan.status === 'executing';

  const copyCommands = () => {
    const cmds = pendingPlan.steps.map((s: SkillStep) => `${s.command} ${s.args.join(' ')}`).join('\n');
    navigator.clipboard.writeText(cmds);
    addLog('approval', 'info', `Comandos copiados para a área de transferência: ${pendingPlan.id}`);
  };

  const handleResolve = (approved: boolean) => {
    addLog('approval', approved ? 'success' : 'warn', `Plano ${pendingPlan.id} ${approved ? 'aprovado' : 'bloqueado'}.`);
    resolveApproval(approved);
  };

  return (
    <div className="app-modal-backdrop">
      <div className="app-modal">
        <div style={{ padding: 'var(--space-6)', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: '1.5rem' }}>{isExecuting ? '⏳' : '⚠️'}</span> 
              {isExecuting ? 'Executando Plano...' : 'Aprovação Necessária'}
            </h2>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <span className={`app-badge ${
                pendingPlan.totalRisk === 'Crítico' ? 'app-badge-danger' :
                pendingPlan.totalRisk === 'Alto' ? 'app-badge-warning' :
                'app-badge-warning'
              }`}>
                Risco: {pendingPlan.totalRisk}
              </span>
            </div>
          </div>
          <p style={{ color: 'var(--text-main)', marginBottom: 'var(--space-4)', fontSize: '1.125rem' }}>{pendingPlan.summary}</p>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {pendingPlan.requiresSudo && <span className="app-badge app-badge-danger"><span style={{ marginRight: '4px' }}>🔒</span> Requer SUDO</span>}
            {pendingPlan.requiresInternet && <span className="app-badge app-badge-info"><span style={{ marginRight: '4px' }}>🌐</span> Usa Internet</span>}
            {pendingPlan.modifiesFiles && <span className="app-badge app-badge-warning"><span style={{ marginRight: '4px' }}>📁</span> Edita Arquivos</span>}
            {pendingPlan.modifiesServices && <span className="app-badge app-badge-warning"><span style={{ marginRight: '4px' }}>⚙️</span> Altera Serviços</span>}
            {pendingPlan.backupRequired && <span className="app-badge app-badge-success"><span style={{ marginRight: '4px' }}>💾</span> Backup Inclusivo</span>}
          </div>
        </div>

        <div style={{ padding: 'var(--space-6)', overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-main)' }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>Motivo da Execução</h3>
            <p style={{ color: 'var(--text-main)', backgroundColor: 'var(--bg-panel)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', lineHeight: 1.6, fontSize: '0.875rem' }}>
              {pendingPlan.reason}
            </p>
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h3 style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Passos a Executar</h3>
              {!isExecuting && (
                <button onClick={copyCommands} className="app-button app-button-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                  📋 Copiar Scripts
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {pendingPlan.steps.map((step: SkillStep) => (
                <div key={step.order} className="app-card" style={{ padding: 0, overflow: 'hidden', opacity: isExecuting ? 0.7 : 1 }}>
                  <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>{step.order}. {step.description}</span>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      {step.requiresSudo && <span className="app-badge app-badge-danger">SUDO</span>}
                      <span className="app-badge app-badge-muted">{step.riskLevel}</span>
                    </div>
                  </div>
                  <div style={{ padding: 'var(--space-3)', backgroundColor: '#09090b', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: isExecuting ? 'var(--color-warning)' : 'var(--color-success)', overflowX: 'auto' }}>
                    {step.command} {step.args.join(' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          {isExecuting ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="animate-spin">⚙️</span> Executando no ambiente Arch...
            </div>
          ) : (
            <>
              <button 
                onClick={() => handleResolve(false)}
                className="app-button app-button-secondary"
              >
                Cancelar (Bloquear)
              </button>
              <button 
                onClick={() => handleResolve(true)}
                className="app-button app-button-danger"
              >
                Aprovar Execução
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
