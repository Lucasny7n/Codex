import { describe, expect, it } from 'vitest';
import { fuzzyMatch } from '../src/lib/models/fuzzyMatch';

const HAYSTACK = 'qwen2.5-coder:7b Qwen Coder ollama local code q4_K_M 7b instruct';

describe('fuzzyMatch', () => {
  it('query vazia casa com tudo', () => {
    expect(fuzzyMatch('', HAYSTACK)).toBe(true);
    expect(fuzzyMatch('   ', HAYSTACK)).toBe(true);
  });

  it('casa por substring e nome parcial', () => {
    expect(fuzzyMatch('coder', HAYSTACK)).toBe(true);
    expect(fuzzyMatch('qwen', HAYSTACK)).toBe(true);
  });

  it('casa por família, tamanho e quantização', () => {
    expect(fuzzyMatch('7b', HAYSTACK)).toBe(true);
    expect(fuzzyMatch('q4', HAYSTACK)).toBe(true);
    expect(fuzzyMatch('ollama', HAYSTACK)).toBe(true);
  });

  it('tolera um erro pequeno de digitação em palavras longas', () => {
    expect(fuzzyMatch('qwne', HAYSTACK)).toBe(true); // qwen
    expect(fuzzyMatch('codre', HAYSTACK)).toBe(true); // coder
  });

  it('exige que todas as palavras casem', () => {
    expect(fuzzyMatch('qwen coder', HAYSTACK)).toBe(true);
    expect(fuzzyMatch('qwen mistral', HAYSTACK)).toBe(false);
  });

  it('não casa termos sem relação', () => {
    expect(fuzzyMatch('gemini', HAYSTACK)).toBe(false);
    expect(fuzzyMatch('zzzzzz', HAYSTACK)).toBe(false);
  });
});
