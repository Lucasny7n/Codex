import { describe, expect, it } from 'vitest';
import { parseMemoryCommand } from '../src/lib/memory/memoryCommands';

describe('parseMemoryCommand', () => {
  it('parses "lembre que X" as a global save', () => {
    const cmd = parseMemoryCommand('lembre que eu prefiro respostas curtas');
    expect(cmd).toEqual({ type: 'save', scope: 'global', content: 'eu prefiro respostas curtas' });
  });

  it('parses "salva isso na memória: X" as a global save', () => {
    const cmd = parseMemoryCommand('salva isso na memória: uso Arch Linux');
    expect(cmd).toEqual({ type: 'save', scope: 'global', content: 'uso Arch Linux' });
  });

  it('parses "salve isso só neste projeto: X" as a project save', () => {
    const cmd = parseMemoryCommand('salve isso só neste projeto: a branch principal é main');
    expect(cmd?.type).toBe('save');
    if (cmd?.type === 'save') {
      expect(cmd.scope).toBe('project');
      expect(cmd.content).toBe('a branch principal é main');
    }
  });

  it('parses "esqueça X" as forget', () => {
    const cmd = parseMemoryCommand('esqueça que eu uso vim');
    expect(cmd).toEqual({ type: 'forget', query: 'que eu uso vim' });
  });

  it('parses "o que você lembra sobre mim?" as a global recall', () => {
    expect(parseMemoryCommand('o que você lembra sobre mim?')).toEqual({ type: 'recall', scope: 'global' });
  });

  it('parses "o que você lembra sobre este projeto?" as a project recall', () => {
    expect(parseMemoryCommand('o que você lembra sobre este projeto?')).toEqual({ type: 'recall', scope: 'project' });
  });

  it('returns undefined for normal messages', () => {
    expect(parseMemoryCommand('me ajuda a otimizar o Ailu')).toBeUndefined();
    expect(parseMemoryCommand('qual meu hardware?')).toBeUndefined();
  });
});
