import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores/chatStore';
import { useApprovalStore } from '../../src/stores/approvalStore';

describe('ChatStore', () => {
  beforeEach(() => {
    useChatStore.getState().clearMessages();
  });

  it('adds a message correctly', () => {
    useChatStore.getState().addMessage({ sender: 'user', content: 'oi' });
    const msgs = useChatStore.getState().messages;
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toBe('oi');
  });
});

describe('ApprovalStore', () => {
  beforeEach(() => {
    useApprovalStore.getState().clearPlan();
  });

  it('requests and clears approval plan', () => {
    useApprovalStore.getState().requestApproval({
      id: '1', summary: 'Teste', reason: 'motivo', steps: [], totalRisk: 'Seguro', requiresSudo: false, backupRequired: false
    });
    
    expect(useApprovalStore.getState().pendingPlan).not.toBeNull();
    
    useApprovalStore.getState().resolveApproval(false);
    expect(useApprovalStore.getState().pendingPlan).toBeNull();
  });
});
