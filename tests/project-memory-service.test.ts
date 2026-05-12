import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildProjectMemoryAttachment,
  clearProjectMemory,
  readProjectMemory,
  setProjectMemoryEnabled,
  updateProjectMemoryFromExchange,
} from '../src/lib/memory/projectMemoryService';

function installStorage(): void {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    },
  });
}

describe('projectMemoryService', () => {
  beforeEach(() => installStorage());

  it('mantém memória isolada por projeto', () => {
    updateProjectMemoryFromExchange('Projeto A', 'corrigir UI', 'feito');
    updateProjectMemoryFromExchange('Projeto B', 'outro tema', 'feito');

    expect(readProjectMemory('Projeto A').summary).toContain('corrigir UI');
    expect(readProjectMemory('Projeto A').summary).not.toContain('outro tema');
  });

  it('não cria contexto quando memória do projeto está desligada e não há instruções', () => {
    setProjectMemoryEnabled('Projeto A', false);

    expect(buildProjectMemoryAttachment('Projeto A')).toBeUndefined();
  });

  it('cria contexto oculto e permite limpar memória', () => {
    updateProjectMemoryFromExchange('Projeto A', 'usar qwen', 'resposta');
    const attachment = buildProjectMemoryAttachment('Projeto A', 'Instrução fixa');

    expect(attachment?.hidden).toBe(true);
    expect(attachment?.contextSource).toBe('project_memory');
    expect(attachment?.contextText).toContain('Instrução fixa');
    expect(attachment?.contextText).toContain('usar qwen');

    clearProjectMemory('Projeto A');
    expect(readProjectMemory('Projeto A').summary).toBe('');
  });
});
