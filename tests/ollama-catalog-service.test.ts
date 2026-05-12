import { describe, expect, it, vi } from 'vitest';
import * as api from '../src/lib/api';
import {
  pullOllamaModel,
  removeOllamaModel,
  showOllamaModel,
} from '../src/lib/ollama/catalogService';
import type { LocalRuntimeSnapshot, OllamaModelDetails } from '../src/types/domain';

vi.mock('../src/lib/api', () => ({
  installLocalModel: vi.fn(),
  removeLocalModel: vi.fn(),
  showLocalModel: vi.fn(),
}));

const now = new Date().toISOString();

function runtime(modelIds: string[]): LocalRuntimeSnapshot {
  return {
    state: 'ready',
    message: 'Ollama pronto',
    modelsDir: '/tmp/.codex/models',
    installedModels: modelIds.map((id) => ({ id })),
    installed: true,
    serviceActive: true,
    apiReachable: true,
    apiUrl: 'http://127.0.0.1:11434',
    canUsePacman: true,
    hasPkexec: true,
    hasSudo: true,
    diskOk: true,
    problems: [],
    repairActions: [],
    at: now,
  };
}

describe('ollamaCatalogService', () => {
  it('pull só resolve como instalado depois do refresh retornado pelo backend', async () => {
    vi.mocked(api.installLocalModel).mockResolvedValueOnce(runtime(['gpt-oss:latest']));

    await expect(pullOllamaModel('gpt oss')).resolves.toMatchObject({
      installedModels: [{ id: 'gpt-oss:latest' }],
    });
    expect(api.installLocalModel).toHaveBeenCalledWith('gpt-oss');
  });

  it('pull falha se o backend concluir sem o modelo aparecer no snapshot Ollama', async () => {
    vi.mocked(api.installLocalModel).mockResolvedValueOnce(runtime(['llama3.2:latest']));

    await expect(pullOllamaModel('gpt-oss')).rejects.toThrow('/api/tags');
  });

  it('delegates show e remove para os comandos Ollama reais', async () => {
    const details: OllamaModelDetails = {
      id: 'qwen2.5-coder:1.5b',
      raw: '{}',
      family: 'qwen2',
    };
    vi.mocked(api.showLocalModel).mockResolvedValueOnce(details);
    vi.mocked(api.removeLocalModel).mockResolvedValueOnce(runtime([]));

    await expect(showOllamaModel('qwen2.5-coder:1.5b')).resolves.toBe(details);
    await expect(removeOllamaModel('qwen2.5-coder:1.5b')).resolves.toMatchObject({ installedModels: [] });
  });
});
