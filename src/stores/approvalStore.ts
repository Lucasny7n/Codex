import { create } from 'zustand';
import { ExecutionPlan } from '../core/skills/skillTypes';
import { invoke } from '@tauri-apps/api/core';
import { useLogStore } from './logStore';

interface ApprovalStore {
  pendingPlan: ExecutionPlan | null;
  history: ExecutionPlan[];
  requestApproval: (plan: Omit<ExecutionPlan, 'status' | 'createdAt'>) => void;
  resolveApproval: (approved: boolean) => void;
  executeApprovedPlan: (planId: string) => Promise<void>;
  clearPlan: () => void;
}

export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  pendingPlan: null,
  history: [],
  requestApproval: (plan) => {
    set({ pendingPlan: { ...plan, status: 'pending', createdAt: new Date().toISOString() } as ExecutionPlan });
  },
  resolveApproval: (approved) => {
    const { pendingPlan } = get();
    if (!pendingPlan) return;

    if (approved) {
      const approvedPlan = { ...pendingPlan, status: 'approved' as const, approvedAt: new Date().toISOString() };
      set({ pendingPlan: approvedPlan });
      // Inicia execução
      get().executeApprovedPlan(approvedPlan.id);
    } else {
      set({ 
        pendingPlan: null, 
        history: [...get().history, { ...pendingPlan, status: 'rejected' }] 
      });
    }
  },
  executeApprovedPlan: async (planId) => {
    const { pendingPlan, history } = get();
    if (!pendingPlan || pendingPlan.id !== planId || pendingPlan.status !== 'approved') return;

    set({ pendingPlan: { ...pendingPlan, status: 'executing' } });

    try {
      await invoke('execute_approved_plan', { plan: { ...pendingPlan, status: 'approved' } });
      set({ 
        pendingPlan: null,
        history: [...history, { ...pendingPlan, status: 'completed' }]
      });
      useLogStore.getState().addLog('approval', 'success', `Plano ${planId} executado com sucesso.`, planId);
    } catch (err) {
      set({ 
        pendingPlan: null,
        history: [...history, { ...pendingPlan, status: 'failed' }]
      });
      useLogStore.getState().addLog('approval', 'error', `Falha ao executar plano ${planId}: ${err}`, planId);
    }
  },
  clearPlan: () => set({ pendingPlan: null })
}));
