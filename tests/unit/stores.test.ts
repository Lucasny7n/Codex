import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores/chatStore';
import { useApprovalStore } from '../../src/stores/approvalStore';
import { useModelStore, CATALOG } from '../../src/stores/modelStore';
import { calculateCompatibility } from '../../src/utils/compatibility';

describe('Stores and Utils', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [] });
    useApprovalStore.setState({ pendingPlan: null });
    useModelStore.setState({ models: CATALOG, primaryModelId: 'qwen2.5-coder-14b' });
  });

  it('ChatStore adds message', () => {
    const store = useChatStore.getState();
    store.addMessage({ sender: 'user', content: 'hello' });
    expect(useChatStore.getState().messages.length).toBe(1);
  });

  it('ApprovalStore requests plan', () => {
    const store = useApprovalStore.getState();
    store.requestApproval({ 
      id: '1', 
      skillId: 'mock-skill',
      summary: 'test', 
      reason: 'r', 
      steps: [], 
      totalRisk: 'Seguro', 
      requiresSudo: false, 
      backupRequired: false
    });
    expect(useApprovalStore.getState().pendingPlan).not.toBeNull();
  });

  it('ModelStore filters and catalog', () => {
    const models = useModelStore.getState().models;
    expect(models.length).toBe(10);
    expect(models.find(m => m.id === 'gpt-oss-120b')?.tags).toContain('experimental');
  });

  it('Hardware Compatibility calculates correctly', () => {
    const hw = { cpu_name: 'test', total_ram_gb: 16, free_ram_gb: 8, swap_total_gb: 0, zram_detected: false, os_name: 'Linux', kernel_version: '6.0', wayland_detected: true };
    
    // Model requiring 8GB on 16GB total RAM -> 0.5 ratio -> 'Bom'
    expect(calculateCompatibility(8, hw, false)).toBe('Bom');
    
    // Model requiring 10GB on 16GB -> 0.625 -> 'Usável'
    expect(calculateCompatibility(10, hw, false)).toBe('Usável');
    
    // Model requiring 32GB on 16GB RAM -> 2.0 ratio -> 'Não recomendado' / 'Impossível' se > 2.0
    expect(calculateCompatibility(32, hw, false)).toBe('Não recomendado');
    expect(calculateCompatibility(40, hw, false)).toBe('Impossível');
    
    // Experimental tag
    expect(calculateCompatibility(32, hw, true)).toBe('Impossível'); // 32 > 16 * 1.5 (24) -> Impossível
    expect(calculateCompatibility(16, hw, true)).toBe('Experimental');
  });
});
