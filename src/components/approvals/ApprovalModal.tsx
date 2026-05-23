import { useApprovalStore } from '../../stores/approvalStore';
import { ExecutionStep } from '../../types/approval';

export function ApprovalModal() {
  const { pendingPlan, resolveApproval } = useApprovalStore();

  if (!pendingPlan) return null;

  const copyCommands = () => {
    const cmds = pendingPlan.steps.map((s: ExecutionStep) => `${s.command} ${s.args.join(' ')}`).join('\n');
    navigator.clipboard.writeText(cmds);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-[var(--border-color)]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              ⚠️ Aprovação Necessária
            </h2>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded text-sm font-bold ${
                pendingPlan.totalRisk === 'Crítico' ? 'bg-red-900/50 text-red-400 border border-red-900' :
                pendingPlan.totalRisk === 'Alto' ? 'bg-orange-900/50 text-orange-400 border border-orange-900' :
                'bg-yellow-900/50 text-yellow-400 border border-yellow-900'
              }`}>
                Risco: {pendingPlan.totalRisk}
              </span>
            </div>
          </div>
          <p className="text-gray-300 mb-4">{pendingPlan.summary}</p>
          
          <div className="flex flex-wrap gap-2 text-xs">
            {pendingPlan.requiresSudo && <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded border border-red-900/50">🔒 Requer SUDO</span>}
            {pendingPlan.requiresInternet && <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded border border-blue-900/50">🌐 Usa Internet</span>}
            {pendingPlan.modifiesFiles && <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded border border-orange-900/50">📁 Edita Arquivos</span>}
            {pendingPlan.modifiesServices && <span className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded border border-purple-900/50">⚙️ Altera Serviços</span>}
            {pendingPlan.backupRequired && <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded border border-green-900/50">💾 Backup será feito</span>}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-[var(--bg-main)]">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Motivo da Execução</h3>
            <p className="text-gray-300 bg-[var(--bg-panel)] p-4 rounded-lg border border-[var(--border-color)]">
              {pendingPlan.reason}
            </p>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Passos a Executar</h3>
              <button onClick={copyCommands} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Copiar Comandos</button>
            </div>
            <div className="space-y-3">
              {pendingPlan.steps.map((step: ExecutionStep) => (
                <div key={step.order} className="bg-[var(--bg-panel)] rounded-lg border border-[var(--border-color)] overflow-hidden">
                  <div className="p-3 border-b border-[var(--border-color)] bg-[#1a1a1f] flex justify-between items-center">
                    <span className="font-medium text-gray-200">{step.order}. {step.description}</span>
                    <div className="flex gap-2">
                      {step.requiresSudo && <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded border border-red-900">SUDO</span>}
                      <span className="text-xs bg-[var(--bg-hover)] text-gray-400 px-2 py-0.5 rounded border border-[var(--border-color)]">{step.riskLevel}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-black/50 font-mono text-sm text-green-400 overflow-x-auto">
                    {step.command} {step.args.join(' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {pendingPlan.rollbackPlan && (
             <div>
               <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Plano de Rollback</h3>
               <div className="p-3 bg-black/50 border border-[var(--border-color)] rounded-lg font-mono text-sm text-yellow-500 overflow-x-auto">
                 {pendingPlan.rollbackPlan}
               </div>
             </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-panel)] flex justify-end gap-3 rounded-b-xl">
          <button 
            onClick={() => resolveApproval(false)}
            className="px-6 py-2.5 rounded-lg font-medium text-gray-300 hover:bg-[var(--bg-hover)] border border-[var(--border-color)] transition-colors"
          >
            Cancelar (Bloquear)
          </button>
          <button 
            onClick={() => resolveApproval(true)}
            className="px-6 py-2.5 rounded-lg font-medium bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 transition-all"
          >
            Permitir Execução
          </button>
        </div>
      </div>
    </div>
  );
}
