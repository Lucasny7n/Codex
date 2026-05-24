import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { getRuntimeStatus, canGenerate } from '../../src/core/runtime/runtimeClient';
import { useRuntimeStore } from '../../src/stores/runtimeStore';

vi.mock('../../src/stores/runtimeStore', () => ({
  useRuntimeStore: {
    getState: vi.fn(),
  }
}));

vi.mock('../../src/stores/modelStore', () => ({
  useModelStore: {
    getState: vi.fn(() => ({
      primaryModelId: 'qwen',
      fallbackModelId: null,
    }))
  }
}));

describe('runtimeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('canGenerate = false if not installed', () => {
    (useRuntimeStore.getState as Mock).mockReturnValue({
      status: {
        installed: false,
        ready: false,
        fallbackActive: true,
      }
    });

    expect(canGenerate()).toBe(false);
  });

  it('canGenerate = true if installed, ready and no fallback', () => {
    (useRuntimeStore.getState as Mock).mockReturnValue({
      status: {
        installed: true,
        ready: true,
        fallbackActive: false,
      }
    });

    expect(canGenerate()).toBe(true);
  });

  it('getRuntimeStatus merges selected model', () => {
    (useRuntimeStore.getState as Mock).mockReturnValue({
      status: {
        installed: true,
        ready: false,
        fallbackActive: true,
      }
    });

    const status = getRuntimeStatus();
    expect(status.installed).toBe(true);
    expect(status.ready).toBe(false);
    expect(status.selectedModelId).toBe('qwen');
  });
});
