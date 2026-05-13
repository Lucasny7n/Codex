export interface PromptPreset {
  id: string;
  label: string;
  description: string;
  systemPrompt: string;
  builtIn: boolean;
}

const CUSTOM_PRESETS_KEY = 'ailu-ai-studio-custom-prompt-presets';
const LEGACY_CUSTOM_PRESETS_KEY = 'codex-command-center-custom-prompt-presets';

export const BUILT_IN_PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'geral',
    label: 'Geral',
    description: 'Resposta direta e bem estruturada.',
    systemPrompt: 'Atue como assistente geral. Seja direto, útil e honesto sobre limites.',
    builtIn: true,
  },
  {
    id: 'programador',
    label: 'Programador',
    description: 'Código, arquitetura e validação.',
    systemPrompt: 'Atue como engenheiro de software. Priorize diagnóstico, patch pequeno, testes e riscos técnicos.',
    builtIn: true,
  },
  {
    id: 'terminal-seguro',
    label: 'Terminal seguro',
    description: 'Comandos com risco e rollback.',
    systemPrompt: 'Planeje comandos de terminal com categoria de risco, impacto, rollback e validação antes de execução.',
    builtIn: true,
  },
  {
    id: 'bug-visual',
    label: 'Bug visual',
    description: 'UI, responsividade e polish.',
    systemPrompt: 'Foque em bugs visuais, alinhamento, contraste, responsividade e estados interativos sem quebrar funcionalidade.',
    builtIn: true,
  },
  {
    id: 'linux-arch',
    label: 'Linux/Arch',
    description: 'Diagnóstico de host Arch Linux.',
    systemPrompt: 'Atue como engenheiro de sistema Arch Linux. Verifique estado real antes de sugerir mudanças e nunca use sudo sem confirmação.',
    builtIn: true,
  },
  {
    id: 'revisor-codigo',
    label: 'Revisor de código',
    description: 'Review orientado a bugs.',
    systemPrompt: 'Faça revisão de código priorizando bugs, regressões, riscos e lacunas de teste, com referências objetivas.',
    builtIn: true,
  },
  {
    id: 'documentacao',
    label: 'Documentação',
    description: 'Guias claros e usáveis.',
    systemPrompt: 'Escreva documentação prática, com passos claros, exemplos válidos e sem listas quebradas.',
    builtIn: true,
  },
  {
    id: 'prompt-engineer',
    label: 'Prompt engineer',
    description: 'Melhoria de instruções.',
    systemPrompt: 'Melhore prompts com objetivo, contexto, restrições, formato de saída e critérios de aceitação.',
    builtIn: true,
  },
  {
    id: 'professor',
    label: 'Professor',
    description: 'Explicação passo a passo.',
    systemPrompt: 'Explique de forma didática, com passos graduais, exemplos e checagem de entendimento.',
    builtIn: true,
  },
  {
    id: 'juridico-organizacao',
    label: 'Jurídico/caso',
    description: 'Organização sem promessa legal.',
    systemPrompt: 'Organize fatos, documentos, prazos e perguntas para caso jurídico, sem prometer orientação legal definitiva.',
    builtIn: true,
  },
];

export function readCustomPromptPresets(): PromptPreset[] {
  try {
    const raw = window.localStorage?.getItem(CUSTOM_PRESETS_KEY) ?? window.localStorage?.getItem(LEGACY_CUSTOM_PRESETS_KEY);
    if (raw && !window.localStorage?.getItem(CUSTOM_PRESETS_KEY)) {
      window.localStorage?.setItem(CUSTOM_PRESETS_KEY, raw);
      window.localStorage?.removeItem(LEGACY_CUSTOM_PRESETS_KEY);
    }
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PromptPreset => {
        if (!item || typeof item !== 'object') return false;
        const candidate = item as Partial<PromptPreset>;
        return Boolean(candidate.id && candidate.label && candidate.systemPrompt);
      })
      .map((preset) => ({ ...preset, builtIn: false }));
  } catch {
    return [];
  }
}

export function allPromptPresets(): PromptPreset[] {
  return [...BUILT_IN_PROMPT_PRESETS, ...readCustomPromptPresets()];
}

export function saveCustomPromptPreset(input: { id?: string; label: string; description?: string; systemPrompt: string }): PromptPreset[] {
  const label = input.label.trim();
  const systemPrompt = input.systemPrompt.trim();
  if (!label || !systemPrompt) return readCustomPromptPresets();
  const id = input.id?.trim() || `custom-${Date.now()}`;
  const nextPreset: PromptPreset = {
    id,
    label,
    description: input.description?.trim() || 'Preset customizado',
    systemPrompt,
    builtIn: false,
  };
  const next = [
    nextPreset,
    ...readCustomPromptPresets().filter((preset) => preset.id !== id),
  ].slice(0, 40);
  window.localStorage?.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(next));
  window.localStorage?.removeItem(LEGACY_CUSTOM_PRESETS_KEY);
  return next;
}

export function removeCustomPromptPreset(id: string): PromptPreset[] {
  const next = readCustomPromptPresets().filter((preset) => preset.id !== id);
  window.localStorage?.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(next));
  window.localStorage?.removeItem(LEGACY_CUSTOM_PRESETS_KEY);
  return next;
}

export function presetContextAttachment(preset: PromptPreset) {
  return {
    path: `preset:${preset.id}`,
    name: `Preset: ${preset.label}`,
    kind: 'text' as const,
    previewAvailable: false,
    hidden: true,
    contextSource: 'preset' as const,
    contextText: `[preset selecionado]\n${preset.systemPrompt}`,
  };
}
