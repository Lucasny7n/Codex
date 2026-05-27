import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../src/lib/api';
import { runTool } from '../src/lib/tools/runner';
import type { AppHealthCheck, HardwareSnapshot, LocalRuntimeSnapshot } from '../src/types/domain';

vi.mock('../src/lib/api', () => ({
  detectLocalHardware: vi.fn(),
  getLocalRuntimeState: vi.fn(),
  getAppHealthCheck: vi.fn(),
  listRunningProcesses: vi.fn(),
  requestExecution: vi.fn(),
}));

const ctx = { ensureSession: vi.fn().mockResolvedValue('session-1') };

function hardware(): HardwareSnapshot {
  return {
    os: { os: 'linux', distro: 'Arch' },
    cpu: { model: 'AMD Ryzen 5 5500', physicalCores: 6, logicalThreads: 12 },
    memory: { totalBytes: 16 * 1024 ** 3, availableBytes: 11 * 1024 ** 3, swapTotalBytes: 8 * 1024 ** 3, headroomBytes: 0 },
    gpus: [{ vendor: 'amd', name: 'RX 7600', vramTotalBytes: 8 * 1024 ** 3, source: 'sysfs' }],
    disks: [],
    accelerators: [{ api: 'vulkan', status: 'present', detail: '' }],
    profileTags: [],
    notes: [],
    detectedAt: 'now',
  };
}

function runtime(models: string[]): LocalRuntimeSnapshot {
  return {
    state: 'ready',
    message: '',
    modelsDir: '/m',
    installedModels: models.map((id) => ({ id })),
    installed: true,
    serviceActive: true,
    apiReachable: true,
    apiUrl: 'http://127.0.0.1:11434',
    canUsePacman: true,
    hasPkexec: false,
    hasSudo: true,
    problems: [],
    repairActions: [],
    at: 'now',
  } as LocalRuntimeSnapshot;
}

afterEach(() => vi.clearAllMocks());

describe('runTool', () => {
  it('get_hardware_summary returns real detected data, not generic text', async () => {
    vi.mocked(api.detectLocalHardware).mockResolvedValue(hardware());
    const result = await runTool('get_hardware_summary', ctx);
    expect(api.detectLocalHardware).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('Ryzen 5 5500');
    expect(result.summary).toContain('RX 7600');
  });

  it('list_local_models queries the runtime and lists models', async () => {
    vi.mocked(api.getLocalRuntimeState).mockResolvedValue(runtime(['llama3:8b', 'qwen2.5:7b']));
    const result = await runTool('list_local_models', ctx);
    expect(api.getLocalRuntimeState).toHaveBeenCalled();
    expect(result.summary).toContain('llama3:8b');
    expect(result.summary).toContain('qwen2.5:7b');
  });

  it('get_health_status uses real/mocked health data', async () => {
    vi.mocked(api.getAppHealthCheck).mockResolvedValue({
      providers: [],
      nodeOk: true,
      npmOk: true,
      cargoOk: false,
      ollama: runtime([]),
    } as unknown as AppHealthCheck);
    const result = await runTool('get_health_status', ctx);
    expect(api.getAppHealthCheck).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('Diagnóstico');
  });

  it('list_running_processes returns real process data, not generic OS text', async () => {
    vi.mocked(api.listRunningProcesses).mockResolvedValue({
      os: 'linux',
      commandUsed: 'ps aux --sort=-%mem | head -20',
      timestamp: 'now',
      processes: [
        { user: 'lucas', pid: '1234', cpu: '3.0', mem: '12.5', command: '/usr/lib/firefox/firefox' },
        { user: 'lucas', pid: '5678', cpu: '1.0', mem: '4.2', command: 'ollama serve' },
      ],
    });
    const result = await runTool('list_running_processes', ctx);
    expect(api.listRunningProcesses).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('Linux');
    expect(result.summary).toContain('firefox');
    expect(result.summary).not.toContain('Windows');
  });

  it('list_running_processes surfaces a human error when ps fails', async () => {
    vi.mocked(api.listRunningProcesses).mockResolvedValue({
      os: 'linux',
      commandUsed: 'ps aux --sort=-%mem | head -20',
      timestamp: 'now',
      processes: [],
      error: '`ps` retornou erro: permissão negada',
    });
    const result = await runTool('list_running_processes', ctx);
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('permissão negada');
  });

  it('request_system_update creates an approval and never executes directly', async () => {
    vi.mocked(api.requestExecution).mockResolvedValue({
      approvalRequired: true,
      permissionRequest: { id: 'perm-1' } as never,
    });
    const result = await runTool('request_system_update', ctx);
    expect(api.requestExecution).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(api.requestExecution).mock.calls[0][0];
    expect(sent.command).toContain('pacman');
    expect(result.approvalRequested).toBe(true);
    expect(result.permissionRequest).toBeDefined();
    expect(result.summary).toContain('aprova');
  });

  it('turns a tool failure into a human error (no stack trace)', async () => {
    vi.mocked(api.detectLocalHardware).mockRejectedValue(new Error('falha ao ler /proc/meminfo'));
    const result = await runTool('get_hardware_summary', ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('falha ao ler /proc/meminfo');
  });

  it('reports unknown tools as not-yet-available with a safe path', async () => {
    const result = await runTool('reformat_disk', ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ainda não está disponível');
  });
});
