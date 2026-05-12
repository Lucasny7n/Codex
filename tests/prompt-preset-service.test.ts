import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  allPromptPresets,
  presetContextAttachment,
  removeCustomPromptPreset,
  saveCustomPromptPreset,
} from '../src/lib/promptPresetService';

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

describe('promptPresetService', () => {
  beforeEach(() => installStorage());

  it('inclui os presets iniciais obrigatórios', () => {
    const labels = allPromptPresets().map((preset) => preset.label);
    expect(labels).toEqual(expect.arrayContaining([
      'Geral',
      'Programador',
      'Terminal seguro',
      'Bug visual',
      'Linux/Arch',
      'Revisor de código',
      'Documentação',
      'Prompt engineer',
      'Professor',
      'Jurídico/caso',
    ]));
  });

  it('salva, edita e remove preset customizado', () => {
    let custom = saveCustomPromptPreset({ id: 'custom-1', label: 'Meu preset', systemPrompt: 'Contexto A' });
    expect(custom[0]).toMatchObject({ id: 'custom-1', label: 'Meu preset', builtIn: false });

    custom = saveCustomPromptPreset({ id: 'custom-1', label: 'Meu preset editado', systemPrompt: 'Contexto B' });
    expect(custom[0].label).toBe('Meu preset editado');

    custom = removeCustomPromptPreset('custom-1');
    expect(custom).toHaveLength(0);
  });

  it('gera contexto oculto para o provider sem chip visível', () => {
    const preset = allPromptPresets().find((item) => item.id === 'programador')!;
    const attachment = presetContextAttachment(preset);

    expect(attachment.hidden).toBe(true);
    expect(attachment.contextSource).toBe('preset');
    expect(attachment.contextText).toContain('engenheiro de software');
  });
});
