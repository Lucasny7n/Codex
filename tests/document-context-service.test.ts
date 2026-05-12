import { describe, expect, it } from 'vitest';
import {
  buildDocumentPromptContext,
  indexDocumentChunks,
  redactDocumentSecrets,
  searchDocumentChunks,
} from '../src/lib/documentContextService';
import type { ChatAttachment } from '../src/types/domain';

function attachment(text: string): ChatAttachment {
  return {
    path: '/tmp/caso.md',
    name: 'caso.md',
    kind: 'text',
    previewAvailable: true,
    previewTextLimited: text,
  };
}

describe('documentContextService', () => {
  it('redige secrets antes de criar contexto de documento', () => {
    expect(redactDocumentSecrets('token=sk-test-secret-value-123456')).not.toContain('sk-test-secret');
    expect(redactDocumentSecrets('api_key: abcdefghijklmnop')).toContain('[segredo-mascarado]');
  });

  it('indexa documento em chunks e busca lexical retorna trecho relevante', () => {
    const chunks = indexDocumentChunks([
      attachment('Alpha geral sem relação.\n\nFalha visual no botão enviar dentro do composer premium.'),
    ]);

    expect(chunks.length).toBeGreaterThan(0);
    const result = searchDocumentChunks('corrigir botão enviar', chunks);
    expect(result[0]?.text).toContain('botão enviar');
  });

  it('monta contexto RAG sem despejar arquivo inteiro sempre', () => {
    const long = `${'texto irrelevante '.repeat(400)}\n\nqwen2.5-coder aparece neste trecho usado.`;
    const context = buildDocumentPromptContext('qual trecho fala de qwen2.5-coder?', [attachment(long)]);

    expect(context).toContain('documento: caso.md');
    expect(context).toContain('qwen2.5-coder');
    expect(context.length).toBeLessThan(long.length);
  });
});
