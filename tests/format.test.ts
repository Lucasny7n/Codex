import { describe, expect, it } from 'vitest';
import { shellQuote, shortPath, trimMultiline } from '../src/lib/utils/format';

describe('format helpers', () => {
  it('preserva quebras internas e remove espaço final', () => {
    expect(trimMultiline('  a\n\n b  \n')).toBe('  a\n\n b');
  });

  it('encurta path mantendo sufixo', () => {
    expect(shortPath('/tmp/ailu-workspace/src/app/App.tsx', 3)).toBe('.../src/app/App.tsx');
  });

  it('escapa path para shell sem perder aspas simples', () => {
    expect(shellQuote("/tmp/a'b")).toBe("'/tmp/a'\\''b'");
  });
});
