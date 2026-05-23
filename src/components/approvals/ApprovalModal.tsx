import { useApprovalStore } from '../../stores/approvalStore';
import { useLogStore } from '../../stores/logStore';
import { ExecutionStep } from '../../types/approval';

export function ApprovalModal() {
  const { pendingPlan, resolveApproval } = useApprovalStore();
  const { addLog } = useLogStore();

  if (!pendingPlan) return null;

  const copyCommands = () => {
    const cmds = pendingPlan.steps.map((s: ExecutionStep) => `${s.command} ${s.args.join(' ')}`).join('\n');
    navigator.clipboard.writeText(cmds);
    addLog('approval', 'info', `Comandos copiados para a área de transferência: ${pendingPlan.id}`);
  };

  const handleResolve = (approved: boolean) => {
    addLog('approval', approved ? 'success' : 'warn', `Plano ${pendingPlan.id} ${approved ? 'aprovado' : 'bloqueado'}.`);
    resolveApproval(approved);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="p-6 border-b border-[#30363d] bg-[#161b22] rounded-t-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <span className="text-2xl">⚠️</span> Aprovação Necessária
            </h2>
            <div className="flex gap-2">
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase border ${
                pendingPlan.totalRisk === 'Crítico' ? 'bg-red-900/30 text-red-400 border-red-900/50' :
                pendingPlan.totalRisk === 'Alto' ? 'bg-orange-900/30 text-orange-400 border-orange-900/50' :
                'bg-yellow-900/30 text-yellow-400 border-yellow-900/50'
              }`}>
                Risco: {pendingPlan.totalRisk}
              </span>
            </div>
          </div>
          <p className="text-gray-300 mb-5 text-lg">{pendingPlan.summary}</p>
          
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider font-bold">
            {pendingPlan.requiresSudo && <span className="px-3 py-1 bg-red-900/20 text-red-400 rounded-lg border border-red-900/50 flex items-center gap-1.5"><span className="text-sm">🔒</span> Requer SUDO</span>}
            {pendingPlan.requiresInternet && <span className="px-3 py-1 bg-blue-900/20 text-blue-400 rounded-lg border border-blue-900/50 flex items-center gap-1.5"><span className="text-sm">🌐</span> Usa Internet</span>}
            {pendingPlan.modifiesFiles && <span className="px-3 py-1 bg-orange-900/20 text-orange-400 rounded-lg border border-orange-900/50 flex items-center gap-1.5"><span className="text-sm">📁</span> Edita Arquivos</span>}
            {pendingPlan.modifiesServices && <span className="px-3 py-1 bg-purple-900/20 text-purple-400 rounded-lg border border-purple-900/50 flex items-center gap-1.5"><span className="text-sm">⚙️</span> Altera Serviços</span>}
            {pendingPlan.backupRequired && <span className="px-3 py-1 bg-green-900/20 text-green-400 rounded-lg border border-green-900/50 flex items-center gap-1.5"><span className="text-sm">💾</span> Backup Inclusivo</span>}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-8">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Motivo da Execução</h3>
            <p className="text-gray-300 bg-[#161b22] p-5 rounded-xl border border-[#30363d] leading-relaxed">
              {pendingPlan.reason}
            </p>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Passos a Executar</h3>
              <button onClick={copyCommands} className="text-xs px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-lg text-gray-300 hover:text-white hover:bg-[#30363d] transition-colors flex items-center gap-2">
                📋 Copiar Scripts
              </button>
            </div>
            <div className="space-y-4">
              {pendingPlan.steps.map((step: ExecutionStep) => (
                <div key={step.order} className="bg-[#161b22] rounded-xl border border-[#30363d] overflow-hidden">
                  <div className="p-4 border-b border-[#30363d] bg-[#1a1a20] flex justify-between items-center">
                    <span className="font-semibold text-gray-200 text-sm">{step.order}. {step.description}</span>
                    <div className="flex gap-2">
                      {step.requiresSudo && <span className="text-[10px] font-bold uppercase tracking-wider bg-red-900/30 text-red-400 px-2 py-1 rounded border border-red-900/50">SUDO</span>}
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#21262d] text-gray-400 px-2 py-1 rounded border border-[#30363d]">{step.riskLevel}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-[#09090b] font-mono text-sm text-green-400 overflow-x-auto">
                    {step.command} {step.args.join(' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {pendingPlan.rollbackPlan && (
             <div className="mt-8 pt-8 border-t border-[#30363d]">
               <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Plano de Rollback</h3>
               <div className="p-4 bg-yellow-900/10 border border-yellow-900/30 rounded-xl font-mono text-sm text-yellow-500/80 overflow-x-auto">
                 {pendingPlan.rollbackPlan}
               </div>
             </div>
          )}
        </div>

        <div className="p-5 border-t border-[#30363d] bg-[#161b22] flex justify-end gap-3 rounded-b-2xl">
          <button 
            onClick={() => handleResolve(false)}
            className="px-6 py-2.5 rounded-lg font-medium text-gray-300 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] transition-colors"
          >
            Cancelar (Bloquear)
          </button>
          <button 
            onClick={() => handleResolve(true)}
            className="px-6 py-2.5 rounded-lg font-medium bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 transition-all border border-red-500"
          >
            Aprovar Execução
          </button>
        </div>
      </div>
    </div>
  );
}
