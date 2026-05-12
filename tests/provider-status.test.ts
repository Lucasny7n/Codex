import { describe, expect, it } from 'vitest';
import { translateError } from '../src/lib/utils/errorTranslator';
import { canSelectModel, resolvePrimaryAction } from '../src/lib/providers/status';

describe('provider status engine', () => {
  it('bloqueia status sem ready e deriva acao centralizada', () => {
    expect(canSelectModel('testing')).toBe(false);
    expect(canSelectModel('requires_api_key')).toBe(false);
    expect(canSelectModel('ready')).toBe(true);
    expect(resolvePrimaryAction('testing')).toBe('Testar conexão');
    expect(resolvePrimaryAction('requires_api_key')).toBe('Adicionar API key');
  });

  it('traduz estados tecnicos para erro acionavel', () => {
    expect(translateError('requires_api_key').message).toBe('API key ausente.');
    expect(translateError('401 Unauthorized').code).toBe('invalid_api_key');
    expect(translateError('403 Forbidden').code).toBe('forbidden');
    expect(translateError('429 insufficient_quota').code).toBe('quota_exceeded');
    expect(translateError('testing').actionLabel).toBe('Testar conexão');
    expect(translateError('api_unreachable').actionLabel).toBe('Reparar');
  });
});
