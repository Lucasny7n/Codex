import { create } from 'zustand';
import { ExecutionPlan } from '../types/approval';

interface ApprovalStore {
  pendingPlan: ExecutionPlan | null;
  requestApproval: (plan: ExecutionPlan) => void;
  resolveApproval: (approved: boolean) => void;
  clearPlan: () => void;
  onResolve: ((approved: boolean) => void) | null;
}

export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  pendingPlan: null,
  onResolve: null,
  requestApproval: (plan) => {
    // Para simplificar no MVP, substituímos qualquer plano anterior não resolvido
    set({ pendingPlan: plan });
  },
  resolveApproval: (approved) => {
    const { onResolve } = get();
    if (onResolve) {
      onResolve(approved);
    }
    set({ pendingPlan: null, onResolve: null });
  },
  clearPlan: () => set({ pendingPlan: null, onResolve: null })
}));

export const requestExecutionAsync = (plan: ExecutionPlan): Promise<boolean> => {
  return new Promise((resolve) => {
    useApprovalStore.setState({
      pendingPlan: plan,
      onResolve: resolve
    });
  });
};
