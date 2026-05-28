import { describe, expect, it } from 'vitest';
import { resolveModelForTask, type RoutableModel } from '../src/lib/models/routing';

const fastCloud: RoutableModel = { providerId: 'groq', modelId: 'llama-fast', mode: 'cloud', speed: 5, codeQuality: 2, reasoningQuality: 2, available: true };
const codeCloud: RoutableModel = { providerId: 'openai', modelId: 'gpt-coder', mode: 'cloud', speed: 3, codeQuality: 5, reasoningQuality: 3, available: true };
const reasoningCloud: RoutableModel = { providerId: 'anthropic', modelId: 'claude-think', mode: 'cloud', speed: 2, codeQuality: 4, reasoningQuality: 5, available: true };
const localCode: RoutableModel = { providerId: 'ollama', modelId: 'qwen2.5-coder:7b', mode: 'local', speed: 3, codeQuality: 4, reasoningQuality: 3, available: true };

const allCloud = [fastCloud, codeCloud, reasoningCloud];

describe('resolveModelForTask', () => {
  it('modo rápido escolhe o modelo mais rápido', () => {
    const r = resolveModelForTask({ mode: 'fast', availableLocalModels: [], availableCloudModels: allCloud });
    expect(r.model).toBe('llama-fast');
  });

  it('modo código escolhe o modelo de melhor qualidade de código', () => {
    const r = resolveModelForTask({ mode: 'code', availableLocalModels: [], availableCloudModels: allCloud });
    expect(r.model).toBe('gpt-coder');
  });

  it('modo pensamento escolhe o modelo de melhor raciocínio', () => {
    const r = resolveModelForTask({ mode: 'thinking', availableLocalModels: [], availableCloudModels: allCloud });
    expect(r.model).toBe('claude-think');
  });

  it('modo terminal usa o modelo padrão (sem trocar)', () => {
    const r = resolveModelForTask({
      mode: 'terminal',
      defaultModel: { providerId: 'openai', modelId: 'gpt-coder' },
      availableLocalModels: [],
      availableCloudModels: allCloud,
    });
    expect(r.model).toBe('gpt-coder');
    expect(r.fallbackUsed).toBe(false);
    expect(r.reason).toMatch(/aprovação/i);
  });

  it('automático usa o modelo padrão', () => {
    const r = resolveModelForTask({
      mode: 'auto',
      defaultModel: { providerId: 'anthropic', modelId: 'claude-think' },
      availableLocalModels: [],
      availableCloudModels: allCloud,
    });
    expect(r.model).toBe('claude-think');
    expect(r.fallbackUsed).toBe(false);
  });

  it('fallback funciona quando o modelo padrão não existe', () => {
    const r = resolveModelForTask({
      mode: 'auto',
      defaultModel: { providerId: 'openai', modelId: 'inexistente' },
      availableLocalModels: [],
      availableCloudModels: allCloud,
    });
    expect(r.fallbackUsed).toBe(true);
    expect(allCloud.some((m) => m.modelId === r.model)).toBe(true);
  });

  it('local preferido prioriza o modelo local disponível', () => {
    const r = resolveModelForTask({
      mode: 'code',
      localPreferred: true,
      availableLocalModels: [localCode],
      availableCloudModels: allCloud,
    });
    expect(r.provider).toBe('ollama');
    expect(r.model).toBe('qwen2.5-coder:7b');
  });

  it('local preferido cai para nuvem quando não há local disponível', () => {
    const r = resolveModelForTask({
      mode: 'code',
      localPreferred: true,
      availableLocalModels: [],
      availableCloudModels: allCloud,
    });
    expect(r.provider).toBe('openai');
    expect(r.model).toBe('gpt-coder');
    expect(r.fallbackUsed).toBe(true);
    expect(r.reason).toMatch(/nuvem/i);
  });

  it('nunca quebra: sem modelos disponíveis retorna o padrão', () => {
    const r = resolveModelForTask({
      mode: 'fast',
      defaultModel: { providerId: 'openai', modelId: 'gpt-coder' },
      availableLocalModels: [],
      availableCloudModels: [],
    });
    expect(r.model).toBe('gpt-coder');
    expect(r.fallbackUsed).toBe(true);
  });

  it('ignora modelos marcados como indisponíveis', () => {
    const r = resolveModelForTask({
      mode: 'fast',
      availableLocalModels: [],
      availableCloudModels: [{ ...fastCloud, available: false }, codeCloud],
    });
    expect(r.model).toBe('gpt-coder');
  });
});
