import { describe, expect, it } from 'vitest';
import { shortPath, trimMultiline } from '../src/lib/format';

describe('format helpers', () => {
  it('remove linhas vazias e espaços extras', () => {
    expect(trimMultiline('  a\n\n b  \n')).toBe('a\nb');
  });

  it('encurta path mantendo sufixo', () => {
    expect(shortPath('/home/lucas/Codex/src/App.tsx', 2)).toBe('.../src/App.tsx');
  });
});
