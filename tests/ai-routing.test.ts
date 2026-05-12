import { describe, expect, it } from 'vitest';
import { buildFallbackPlan } from '../src/lib/models/aiRouting';
import type { AiFallbackModelConfig } from '../src/types/domain';

const fallbacks: AiFallbackModelConfig[] = [
  {
    providerId: 'local-ollama',
    modelId: 'qwen2.5-coder:7b',
    enabled: true,
  },
  {
    providerId: 'openai-api',
    modelId: 'gpt-5.4-mini',
    accountProfileId: 'openai-api:principal',
    enabled: true,
  },
  {
    providerId: 'anthropic-api',
    modelId: 'claude-sonnet-4',
    enabled: false,
  },
];

describe('aiRouting', () => {
  it('não adiciona fallback sem modo desenvolvedor e opt-in explícito', () => {
    const plan = buildFallbackPlan(
      { providerId: 'openai-api', modelId: 'gpt-5.5' },
      fallbacks,
      'automatic',
      false,
      true,
    );

    expect(plan).toEqual([{ providerId: 'openai-api', modelId: 'gpt-5.5' }]);
  });

  it('prioriza local quando a política é local first', () => {
    const plan = buildFallbackPlan(
      { providerId: 'openai-api', modelId: 'gpt-5.5' },
      fallbacks,
      'local_first',
      true,
      true,
    );

    expect(plan.map((item) => item.providerId)).toEqual(['openai-api', 'local-ollama', 'openai-api']);
  });

  it('prioriza modelos de código na política de código', () => {
    const plan = buildFallbackPlan(
      { providerId: 'gemini-api', modelId: 'gemini-2.5-pro' },
      fallbacks,
      'code',
      true,
      true,
    );

    expect(plan[1]).toMatchObject({ providerId: 'local-ollama', modelId: 'qwen2.5-coder:7b' });
    expect(plan.some((item) => item.providerId === 'anthropic-api')).toBe(false);
  });
});
