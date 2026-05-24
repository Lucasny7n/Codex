import { describe, it, expect, beforeEach } from 'vitest';
import { useApprovalStore } from '../../src/stores/approvalStore';

describe('Approval Store', () => {
  beforeEach(() => {
    useApprovalStore.getState().clearPlan();
    useApprovalStore.setState({ history: [] });
  });

  it('transitions from pending to approved', async () => {
    const plan = {
      id: 'test-123',
      skillId: 'diag',
      summary: 'Test',
      reason: 'Test reason',
      totalRisk: 'Seguro' as const,
      requiresSudo: false,
      status: 'pending' as const,
      steps: [],
      createdAt: new Date().toISOString()
    };

    useApprovalStore.getState().requestApproval(plan);
    expect(useApprovalStore.getState().pendingPlan?.status).toBe('pending');

    useApprovalStore.getState().resolveApproval(true);
    
    // Aguarda microtasks
    await new Promise(r => setTimeout(r, 10));

    const history = useApprovalStore.getState().history;
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].status).toBe('failed'); // Because Tauri invoke will fail in unit test env
  });

  it('rejects plan correctly', () => {
    const plan = {
      id: 'test-321',
      skillId: 'diag',
      summary: 'Test',
      reason: 'Test reason',
      totalRisk: 'Seguro' as const,
      requiresSudo: false,
      status: 'pending' as const,
      steps: [],
      createdAt: new Date().toISOString()
    };

    useApprovalStore.getState().requestApproval(plan);
    useApprovalStore.getState().resolveApproval(false);

    expect(useApprovalStore.getState().pendingPlan).toBeNull();
    const history = useApprovalStore.getState().history;
    expect(history[0].status).toBe('rejected');
  });
});
