import { describe, expect, it } from 'vitest';
import {
  bestCopyFromComparison,
  comparisonHasPartialFailure,
  parseComparisonTargets,
} from '../src/lib/modelComparisonService';

describe('modelComparisonService', () => {
  it('parseia alvos de comparação sem iniciar chamada automática', () => {
    expect(parseComparisonTargets('local-ollama/qwen2.5-coder:7b\nopenai-api/gpt-5.4-mini @ openai:principal')).toEqual([
      { providerId: 'local-ollama', modelId: 'qwen2.5-coder:7b', accountProfileId: undefined, label: 'local-ollama/qwen2.5-coder:7b' },
      { providerId: 'openai-api', modelId: 'gpt-5.4-mini', accountProfileId: 'openai:principal', label: 'openai-api/gpt-5.4-mini' },
    ]);
  });

  it('suporta sucesso parcial sem quebrar todos os resultados', () => {
    const results = [
      { providerId: 'local-ollama', modelId: 'qwen', ok: true, content: 'ok' },
      { providerId: 'openai-api', modelId: 'gpt', ok: false, error: 'sem key' },
    ];

    expect(comparisonHasPartialFailure(results)).toBe(true);
    expect(bestCopyFromComparison(results[0])).toBe('ok');
    expect(bestCopyFromComparison(results[1])).toBe('sem key');
  });
});
