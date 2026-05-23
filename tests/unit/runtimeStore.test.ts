import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { useRuntimeStore } from '../../src/stores/runtimeStore';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('runtimeStore', () => {
  beforeEach(() => {
    useRuntimeStore.setState({
      status: {
        installed: false,
        ready: false,
        selectedModelId: null,
        loadedModelId: null,
        fallbackActive: true,
        lastRuntimeError: null,
        device: null,
        pythonVersion: null,
      },
      localModels: []
    });
    vi.clearAllMocks();
  });

  it('checkRuntimeStatus updates status correctly on success', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as Mock).mockResolvedValue({
      ok: true,
      python: '3.11.0',
      airllm_installed: true,
      device: 'cuda',
      message: 'OK'
    });

    await useRuntimeStore.getState().checkRuntimeStatus();

    const state = useRuntimeStore.getState();
    expect(state.status.ready).toBe(true);
    expect(state.status.installed).toBe(true);
    expect(state.status.pythonVersion).toBe('3.11.0');
    expect(state.status.fallbackActive).toBe(false);
  });

  it('checkRuntimeStatus updates status correctly on failure', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as Mock).mockResolvedValue({
      ok: false,
      code: 'airllm_not_installed',
      message: 'AirLLM não está instalado.'
    });

    await useRuntimeStore.getState().checkRuntimeStatus();

    const state = useRuntimeStore.getState();
    expect(state.status.ready).toBe(false);
    expect(state.status.installed).toBe(false);
    expect(state.status.fallbackActive).toBe(true);
    expect(state.status.lastRuntimeError).toBe('AirLLM não está instalado.');
  });
});
