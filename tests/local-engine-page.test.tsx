import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../src/lib/api';
import { LocalEnginePage } from '../src/features/local-engine/LocalEnginePage';
import type {
  BackendStatus,
  BenchmarkResult,
  HardwareSnapshot,
  RuntimeRecommendation,
} from '../src/types/domain';

vi.mock('../src/lib/api', () => ({
  detectLocalHardware: vi.fn(),
  listRuntimeBackends: vi.fn(),
  recommendModelRuntime: vi.fn(),
  estimateModelRuntime: vi.fn(),
  testModelRuntime: vi.fn(),
  benchmarkModelRuntime: vi.fn(),
}));

const GiB = 1073741824;

function hardwareSnapshot(): HardwareSnapshot {
  return {
    os: { os: 'linux', kernel: '6.9.0', distro: 'Arch Linux' },
    cpu: { model: 'AMD Ryzen 5 5500', physicalCores: 6, logicalThreads: 12 },
    memory: {
      totalBytes: 16 * GiB,
      availableBytes: 10 * GiB,
      swapTotalBytes: 8 * GiB,
      headroomBytes: Math.round(1.5 * GiB),
    },
    gpus: [{ vendor: 'amd', name: 'AMD Radeon RX 7600', vramTotalBytes: 8 * GiB, source: 'sysfs' }],
    disks: [{ mount: '/', totalBytes: 500 * GiB, availableBytes: 200 * GiB }],
    accelerators: [
      { api: 'vulkan', status: 'healthy', detail: 'radv (RADV 24.0)' },
      { api: 'rocm', status: 'unavailable', detail: 'rocm-smi não encontrado' },
    ],
    profileTags: ['amd_pc', 'amd_vulkan_pc'],
    notes: [],
    detectedAt: new Date().toISOString(),
  };
}

function backendList(): BackendStatus[] {
  return [
    {
      id: 'ollama',
      label: 'Ollama',
      availability: 'ready',
      version: '0.3.12',
      detail: 'API ativa em http://127.0.0.1:11434',
      experimental: false,
    },
    {
      id: 'llama_cpp_vulkan',
      label: 'llama.cpp (Vulkan)',
      availability: 'not_installed',
      detail: 'llama.cpp com suporte Vulkan não encontrado.',
      experimental: false,
      installPlan: 'pacman -S llama-cpp',
    },
  ];
}

function noReadyBackends(): BackendStatus[] {
  return [
    {
      id: 'llama_cpp_cpu',
      label: 'llama.cpp (CPU)',
      availability: 'not_installed',
      detail: 'Não instalado.',
      experimental: false,
    },
  ];
}

function mockRecommendation(): RuntimeRecommendation {
  return {
    backend: 'ollama',
    profile: 'balanced',
    estimate: {
      fit: 'tight',
      recommended: false,
      experimental: false,
      ramRequiredBytes: 6 * GiB,
      recommendedContext: 4096,
      usesOffload: false,
      expectedSlow: true,
      speedHint: 'Cerca de 10–15 t/s com offload parcial.',
      warnings: [{ code: 'low_ram', severity: 'warning', message: 'RAM disponível próxima do limite.' }],
    },
    score: 60,
    rationale: 'Ollama é o único backend pronto; use com atenção ao contexto.',
    message: 'Ollama pode rodar este modelo, mas com swap.',
    alternatives: ['llama_cpp_vulkan'],
  };
}

function mockBenchmarkResult(ok = true): BenchmarkResult {
  return {
    modelId: 'qwen2.5-coder:1.5b',
    backendId: 'ollama',
    kind: 'smoke',
    ok,
    tokensPerSecond: ok ? 42.1 : undefined,
    timeToFirstTokenMs: ok ? 310 : undefined,
    ramPeakBytes: ok ? 3 * GiB : undefined,
    vramPeakBytes: undefined,
    bottleneck: ok ? undefined : 'modelo não encontrado',
    detail: ok ? 'Smoke test concluído.' : 'Falhou: modelo ausente.',
    at: new Date().toISOString(),
  };
}

describe('LocalEnginePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza e carrega hardware e backends na montagem', async () => {
    vi.mocked(api.detectLocalHardware).mockResolvedValue(hardwareSnapshot());
    vi.mocked(api.listRuntimeBackends).mockResolvedValue(backendList());

    render(<LocalEnginePage />);

    await waitFor(() => {
      expect(screen.getByText('AMD Ryzen 5 5500')).toBeInTheDocument();
    });

    expect(screen.getByText('AMD Radeon RX 7600')).toBeInTheDocument();
    expect(screen.getByText('16.0 GB total')).toBeInTheDocument();
    expect(screen.getAllByText('Ollama').length).toBeGreaterThan(0);
    expect(api.detectLocalHardware).toHaveBeenCalledTimes(1);
    expect(api.listRuntimeBackends).toHaveBeenCalledTimes(1);
  });

  it('exibe estado de carregamento enquanto detecta hardware', () => {
    vi.mocked(api.detectLocalHardware).mockReturnValue(new Promise(() => undefined));
    vi.mocked(api.listRuntimeBackends).mockResolvedValue([]);

    render(<LocalEnginePage />);

    expect(screen.getByText('Detectando hardware...')).toBeInTheDocument();
  });

  it('exibe erro inline quando detectLocalHardware falha', async () => {
    vi.mocked(api.detectLocalHardware).mockRejectedValue(new Error('hw offline'));
    vi.mocked(api.listRuntimeBackends).mockResolvedValue([]);

    render(<LocalEnginePage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('hw offline');
    });
  });

  it('exibe aviso de RAM limitada para 16 GB', async () => {
    vi.mocked(api.detectLocalHardware).mockResolvedValue(hardwareSnapshot());
    vi.mocked(api.listRuntimeBackends).mockResolvedValue([]);

    render(<LocalEnginePage />);

    await waitFor(() => {
      expect(screen.getByText(/RAM limitada/)).toBeInTheDocument();
    });
  });

  it('botão Atualizar hardware chama detectLocalHardware novamente', async () => {
    vi.mocked(api.detectLocalHardware).mockResolvedValue(hardwareSnapshot());
    vi.mocked(api.listRuntimeBackends).mockResolvedValue([]);

    render(<LocalEnginePage />);

    await waitFor(() => {
      expect(screen.getByText('AMD Ryzen 5 5500')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar hardware' }));

    await waitFor(() => {
      expect(api.detectLocalHardware).toHaveBeenCalledTimes(2);
    });
  });

  it('recomendação é disparada ao submeter modelo', async () => {
    vi.mocked(api.detectLocalHardware).mockResolvedValue(hardwareSnapshot());
    vi.mocked(api.listRuntimeBackends).mockResolvedValue(backendList());
    vi.mocked(api.recommendModelRuntime).mockResolvedValue(mockRecommendation());

    render(<LocalEnginePage />);

    await waitFor(() => {
      expect(screen.getByText('AMD Ryzen 5 5500')).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox', { name: /ID do modelo para recomendar/i });
    fireEvent.change(input, { target: { value: 'qwen2.5-coder:7b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recomendar' }));

    await waitFor(() => {
      expect(api.recommendModelRuntime).toHaveBeenCalledWith({ modelId: 'qwen2.5-coder:7b' });
    });

    expect(screen.getByText('Ollama pode rodar este modelo, mas com swap.')).toBeInTheDocument();
  });

  it('benchmark indisponível não quebra quando nenhum backend está pronto', async () => {
    vi.mocked(api.detectLocalHardware).mockResolvedValue(hardwareSnapshot());
    vi.mocked(api.listRuntimeBackends).mockResolvedValue(noReadyBackends());

    render(<LocalEnginePage />);

    await waitFor(() => {
      expect(screen.getByText('AMD Ryzen 5 5500')).toBeInTheDocument();
    });

    expect(screen.getByText('Nenhum backend pronto. Instale Ollama ou llama.cpp primeiro.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Testar (rápido)' })).not.toBeInTheDocument();
  });

  it('smoke test chama testModelRuntime e exibe tokens/s', async () => {
    vi.mocked(api.detectLocalHardware).mockResolvedValue(hardwareSnapshot());
    vi.mocked(api.listRuntimeBackends).mockResolvedValue(backendList());
    vi.mocked(api.testModelRuntime).mockResolvedValue(mockBenchmarkResult(true));

    render(<LocalEnginePage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Testar (rápido)' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Testar (rápido)' }));

    await waitFor(() => {
      expect(api.testModelRuntime).toHaveBeenCalled();
    });

    expect(screen.getByText('42.1 t/s')).toBeInTheDocument();
  });
});
