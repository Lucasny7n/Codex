import { useApprovalStore } from '../../stores/approvalStore';
import { ExecutionStep } from '../../types/approval';

export function ApprovalModal() {
  const { pendingPlan, resolveApproval } = useApprovalStore();

  if (!pendingPlan) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-[var(--border-color)]">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              ⚠️ Aprovação Necessária
            </h2>
            <span className={`px-3 py-1 rounded text-sm font-bold ${
              pendingPlan.totalRisk === 'Crítico' ? 'bg-red-900/50 text-red-400 border border-red-900' :
              pendingPlan.totalRisk === 'Alto' ? 'bg-orange-900/50 text-orange-400 border border-orange-900' :
              'bg-yellow-900/50 text-yellow-400 border border-yellow-900'
            }`}>
              Risco: {pendingPlan.totalRisk}
            </span>
          </div>
          <p className="text-gray-300">{pendingPlan.summary}</p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-[var(--bg-main)]">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Motivo</h3>
            <p className="text-gray-300 bg-[var(--bg-panel)] p-3 rounded-lg border border-[var(--border-color)]">
              {pendingPlan.reason}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Passos a Executar</h3>
            <div className="space-y-3">
              {pendingPlan.steps.map((step: ExecutionStep) => (
                <div key={step.order} className="bg-[var(--bg-panel)] rounded-lg border border-[var(--border-color)] overflow-hidden">
                  <div className="p-3 border-b border-[var(--border-color)] bg-[#1a1a1f] flex justify-between items-center">
                    <span className="font-medium text-gray-200">{step.order}. {step.description}</span>
                    {step.requiresSudo && <span className="text-xs bg-red-900/50 text-red-400 px-2 py-1 rounded border border-red-900">SUDO</span>}
                  </div>
                  <div className="p-3 bg-black/50 font-mono text-sm text-green-400 overflow-x-auto">
                    {step.command} {step.args.join(' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-[var(--border-color)] bg-[var(--bg-panel)] flex justify-end gap-3 rounded-b-xl">
          <button 
            onClick={() => resolveApproval(false)}
            className="px-6 py-2.5 rounded-lg font-medium text-gray-300 hover:bg-[var(--bg-hover)] transition-colors"
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
