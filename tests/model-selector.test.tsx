import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModelSelector } from '../src/components/panels/ModelSelector';
import { localCompatibility, modelRegistry } from '../src/lib/modelRegistry';
import type { LocalRuntimeSnapshot, ProviderDescriptor } from '../src/types/domain';

function provider(id: string, state: ProviderDescriptor['status']['state']): ProviderDescriptor {
  return {
    id,
    label: id,
    configurable: true,
    enabled: state === 'ready',
    status: {
      state,
      message: `${id} ${state}`,
      checkedAt: new Date().toISOString()
    },
    models: []
  };
}

function runtime(overrides: Partial<LocalRuntimeSnapshot> = {}): LocalRuntimeSnapshot {
  return {
    state: 'ready',
    message: 'Ollama pronto',
    modelsDir: '/tmp/.codex/models',
    installedModels: [],
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
    at: new Date().toISOString(),
    ...overrides
  };
}

describe('ModelSelector', () => {
  it('cloud sem key mostra Adicionar API key e nao Selecionar', () => {
    render(
      <ModelSelector
        open
        mode="cloud"
        providers={[provider('openai-api', 'requires_api_key')]}
        credentials={[]}
        installationProgress={{}}
        onClose={vi.fn()}
        onModeChange={vi.fn()}
        onActivateCloud={vi.fn()}
        onActivateLocal={vi.fn()}
        onInstallLocalModel={vi.fn()}
        onRemoveLocalModel={vi.fn()}
        onInstallRuntime={vi.fn()}
        onStartRuntime={vi.fn()}
        onConfigureProvider={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Adicionar API key').length).toBeGreaterThan(0);
    expect(screen.queryByText('Selecionar')).not.toBeInTheDocument();
  });

  it('provider configurado permite selecionar', () => {
    render(
      <ModelSelector
        open
        mode="cloud"
        providers={[provider('openai-api', 'ready')]}
        credentials={[]}
        installationProgress={{}}
        onClose={vi.fn()}
        onModeChange={vi.fn()}
        onActivateCloud={vi.fn()}
        onActivateLocal={vi.fn()}
        onInstallLocalModel={vi.fn()}
        onRemoveLocalModel={vi.fn()}
        onInstallRuntime={vi.fn()}
        onStartRuntime={vi.fn()}
        onConfigureProvider={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Selecionar').length).toBeGreaterThan(0);
  });

  it('provider com credencial nao testada pede teste de conexao', () => {
    render(
      <ModelSelector
        open
        mode="cloud"
        providers={[provider('openai-api', 'testing')]}
        credentials={[]}
        installationProgress={{}}
        onClose={vi.fn()}
        onModeChange={vi.fn()}
        onActivateCloud={vi.fn()}
        onActivateLocal={vi.fn()}
        onInstallLocalModel={vi.fn()}
        onRemoveLocalModel={vi.fn()}
        onInstallRuntime={vi.fn()}
        onStartRuntime={vi.fn()}
        onConfigureProvider={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Testar conexão').length).toBeGreaterThan(0);
    expect(screen.queryByText('Selecionar')).not.toBeInTheDocument();
  });

  it('local sem runtime mostra instalar runtime', () => {
    render(
      <ModelSelector
        open
        mode="local"
        providers={[]}
        credentials={[]}
        localRuntime={runtime({ installed: false, state: 'unavailable', apiReachable: false })}
        installationProgress={{}}
        onClose={vi.fn()}
        onModeChange={vi.fn()}
        onActivateCloud={vi.fn()}
        onActivateLocal={vi.fn()}
        onInstallLocalModel={vi.fn()}
        onRemoveLocalModel={vi.fn()}
        onInstallRuntime={vi.fn()}
        onStartRuntime={vi.fn()}
        onConfigureProvider={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Instalar runtime').length).toBeGreaterThan(0);
  });

  it('local sem modelo mostra instalar modelo', () => {
    render(
      <ModelSelector
        open
        mode="local"
        providers={[]}
        credentials={[]}
        localRuntime={runtime()}
        installationProgress={{}}
        onClose={vi.fn()}
        onModeChange={vi.fn()}
        onActivateCloud={vi.fn()}
        onActivateLocal={vi.fn()}
        onInstallLocalModel={vi.fn()}
        onRemoveLocalModel={vi.fn()}
        onInstallRuntime={vi.fn()}
        onStartRuntime={vi.fn()}
        onConfigureProvider={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Instalar modelo').length).toBeGreaterThan(0);
  });

  it('detalhes ficam sob demanda', () => {
    render(
      <ModelSelector
        open
        mode="local"
        providers={[]}
        credentials={[]}
        localRuntime={runtime()}
        installationProgress={{}}
        onClose={vi.fn()}
        onModeChange={vi.fn()}
        onActivateCloud={vi.fn()}
        onActivateLocal={vi.fn()}
        onInstallLocalModel={vi.fn()}
        onRemoveLocalModel={vi.fn()}
        onInstallRuntime={vi.fn()}
        onStartRuntime={vi.fn()}
        onConfigureProvider={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/Privacidade:/)[0]).not.toBeVisible();
    fireEvent.click(screen.getAllByText('Detalhes')[0]);
    expect(screen.getAllByText(/Privacidade:/)[0]).toBeVisible();
  });

  it('filtro compatível com meu PC esconde modelos 32B não recomendados', () => {
    render(
      <ModelSelector
        open
        mode="local"
        providers={[]}
        credentials={[]}
        localRuntime={runtime()}
        installationProgress={{}}
        onClose={vi.fn()}
        onModeChange={vi.fn()}
        onActivateCloud={vi.fn()}
        onActivateLocal={vi.fn()}
        onInstallLocalModel={vi.fn()}
        onRemoveLocalModel={vi.fn()}
        onInstallRuntime={vi.fn()}
        onStartRuntime={vi.fn()}
        onConfigureProvider={vi.fn()}
      />,
    );

    expect(screen.getByText('Qwen2.5 Coder 32B')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Compatíveis com meu PC'));
    expect(screen.queryByText('Qwen2.5 Coder 32B')).not.toBeInTheDocument();
  });
});

describe('modelRegistry', () => {
  it('nao aceita modelo sem status e setupRequirement', () => {
    for (const model of modelRegistry.all()) {
      expect(model.baseStatus).toBeTruthy();
      expect(model.setupRequirement).toBeTruthy();
      expect(model.actionLabel).toBeTruthy();
    }
  });

  it('classifica 32B como nao recomendado para 16 GB RAM', () => {
    const model = modelRegistry.byId('qwen2.5-coder:32b');
    expect(model).toBeTruthy();
    expect(localCompatibility(model!)).toBe('not_recommended');
  });
});
