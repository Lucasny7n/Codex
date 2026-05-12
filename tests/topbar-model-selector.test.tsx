import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopBar } from '../src/components/layout/TopBar';
import type { ModelCatalogOption } from '../src/lib/modelCatalogService';
import type { LocalRuntimeSnapshot } from '../src/types/domain';

const now = new Date().toISOString();

function metadata(type: 'cloud' | 'local') {
  return {
    provider: type === 'cloud' ? 'openai-api' : 'local-ollama',
    type,
    capabilities: ['text'],
    multimodal: false,
    promptPresetIds: [],
    contextFragmentScopes: [],
    technicalLogScope: type === 'cloud' ? 'provider' as const : 'runtime' as const,
    ragReady: false,
    toolPermissionScopes: [],
  };
}

function cloudOption(overrides: Partial<ModelCatalogOption> = {}): ModelCatalogOption {
  return {
    id: 'gpt-5.5',
    label: 'GPT-5.5',
    source: 'cloud',
    providerType: 'cloud',
    modelId: 'gpt-5.5',
    providerId: 'openai-api',
    providerLabel: 'OpenAI API',
    status: 'ready',
    statusLabel: 'Configurado',
    available: true,
    installed: false,
    configured: true,
    ready: true,
    metadata: metadata('cloud'),
    searchTerms: ['openai', 'gpt'],
    ...overrides,
  };
}

function localOption(overrides: Partial<ModelCatalogOption> = {}): ModelCatalogOption {
  return {
    id: 'qwen2.5-coder:1.5b',
    label: 'qwen2.5-coder:1.5b',
    source: 'local',
    providerType: 'local',
    modelId: 'qwen2.5-coder:1.5b',
    providerId: 'local-ollama',
    providerLabel: 'Local Ollama',
    family: 'Qwen',
    status: 'ready',
    statusLabel: 'Instalado',
    available: true,
    installed: true,
    configured: false,
    ready: true,
    runtimeLabel: 'Ollama',
    metadata: metadata('local'),
    searchTerms: ['qwen', 'ollama', 'local'],
    ...overrides,
  };
}

function runtime(): LocalRuntimeSnapshot {
  return {
    state: 'ready',
    message: 'Ollama pronto',
    modelsDir: '/tmp/.codex/models',
    installedModels: [{ id: 'qwen2.5-coder:1.5b' }],
    installed: true,
    serviceActive: true,
    apiReachable: true,
    apiUrl: 'http://127.0.0.1:11434',
    canUsePacman: true,
    hasPkexec: true,
    hasSudo: true,
    diskOk: true,
    problems: [],
    repairActions: [],
    at: now,
  };
}

describe('TopBar model selector', () => {
  it('bloqueia mistura visual entre Nuvem e Local e abre candidato Ollama sem selecionar', () => {
    const onSelectModel = vi.fn();
    render(
      <TopBar
        providerStatus={{ state: 'ready', message: 'Provider pronto', checkedAt: now }}
        executionMode="cloud"
        activeModelLabel="Mock"
        selectedModelLabel="Mock"
        selectedModelId="mock-model"
        cloudModels={[
          cloudOption(),
          localOption({ id: 'leak-local', modelId: 'qwen2.5-coder:7b', label: 'qwen2.5-coder:7b' }),
        ]}
        localModels={[
          localOption(),
          cloudOption({ id: 'leak-cloud', modelId: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', providerId: 'gemini-api', providerLabel: 'Gemini API' }),
        ]}
        localRuntime={runtime()}
        onSelectModel={onSelectModel}
        onConfigureModels={vi.fn()}
        onStartTemporaryChat={vi.fn()}
        onExitTemporaryChat={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle(/Mock/));
    expect(screen.queryByTestId('model-row-leak-local')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'qwen2.5-coder' } });
    expect(screen.queryByTestId('model-row-leak-local')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum modelo cloud configurado encontrado.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Local' }));
    expect(screen.getByTestId('model-row-qwen2.5-coder:1.5b')).toBeInTheDocument();
    expect(screen.queryByTestId('model-row-leak-cloud')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'GPT-5.5' } });
    expect(screen.queryByTestId('model-row-leak-cloud')).not.toBeInTheDocument();
    expect(screen.getByText('Modelo não instalado. Você pode baixar pelo Ollama.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'gpt oss' } });
    expect(screen.getByTestId('model-row-ollama-pull:gpt-oss')).toBeInTheDocument();
    expect(screen.getByText('gpt-oss')).toBeInTheDocument();
    expect(screen.getByText('Disponível para baixar')).toBeInTheDocument();
    expect(screen.queryByText('Disponível para pull')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('model-row-ollama-pull:gpt-oss'));
    fireEvent.click(screen.getByLabelText('Configurar gpt-oss'));

    expect(onSelectModel).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'gpt-oss' })).toBeInTheDocument();
  });
});
