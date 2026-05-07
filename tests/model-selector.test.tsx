import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModelSelector } from '../src/components/panels/ModelSelector';
import { openExternalUrl } from '../src/lib/api';
import { localCompatibility, modelRegistry } from '../src/lib/modelRegistry';
import type { LocalRuntimeSnapshot, ProviderAccountProfile, ProviderDescriptor } from '../src/types/domain';

vi.mock('../src/lib/api', () => ({
  openExternalUrl: vi.fn()
}));

function provider(id: string, state: ProviderDescriptor['status']['state']): ProviderDescriptor {
  return {
    id,
    label: id === 'openai-api' ? 'OpenAI API' : id,
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

function accountProfile(overrides: Partial<ProviderAccountProfile> = {}): ProviderAccountProfile {
  return {
    id: 'openai-api:trabalho',
    providerId: 'openai-api',
    providerLabel: 'OpenAI API',
    name: 'Conta Trabalho',
    authType: 'api_key',
    status: 'ready',
    maskedCredential: 'sk-t********6789',
    source: 'config_file',
    isDefault: true,
    defaultModelId: 'gpt-5.5',
    message: 'Profile pronto',
    ...overrides
  };
}

describe('ModelSelector', () => {
  it('cloud sem key fica oculto em Prontos e vai para Configurar', () => {
    render(
      <ModelSelector
        open
        mode="cloud"
        providers={[provider('openai-api', 'requires_api_key')]}
        credentials={[]}
        providerProfiles={[]}
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

    expect(screen.getByText('Nenhum modelo pronto ainda')).toBeInTheDocument();
    expect(screen.queryByText('Usar neste chat')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Configurar modelos'));
    expect(screen.getByText('OpenAI API')).toBeInTheDocument();
    expect(screen.getByText('Adicionar API key')).toBeInTheDocument();
  });

  it('provider configurado permite selecionar', () => {
    render(
      <ModelSelector
        open
        mode="cloud"
        providers={[provider('openai-api', 'ready')]}
        credentials={[]}
        providerProfiles={[]}
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

    expect(screen.getAllByText('Usar neste chat').length).toBeGreaterThan(0);
  });

  it('salva e testa API key pelo Ambiente', async () => {
    const onSave = vi.fn().mockResolvedValue(accountProfile({ status: 'testing' }));
    const onTest = vi.fn().mockResolvedValue({
      state: 'ready',
      message: 'OpenAI respondeu.',
      checkedAt: new Date().toISOString()
    });

    render(
      <ModelSelector
        open
        mode="cloud"
        providers={[provider('openai-api', 'requires_api_key')]}
        credentials={[]}
        providerProfiles={[]}
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
        onSaveProviderProfileCredential={onSave}
        onTestProvider={onTest}
      />,
    );

    fireEvent.click(screen.getByText('Configurar modelos'));
    fireEvent.click(screen.getByText('Adicionar API key'));
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test-123456789' } });
    fireEvent.click(screen.getByText('Salvar e testar'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('openai-api', undefined, 'Principal', 'sk-test-123456789', true);
      expect(onTest).toHaveBeenCalledWith('openai-api');
    });
  });

  it('login web abre URL real e exige verificação antes de ready', async () => {
    vi.mocked(openExternalUrl).mockResolvedValue(undefined);

    render(
      <ModelSelector
        open
        mode="cloud"
        providers={[provider('opencode-zen', 'requires_login')]}
        credentials={[]}
        providerProfiles={[]}
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
        onTestProvider={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Configurar modelos'));
    fireEvent.click(screen.getByText('Fazer login'));

    await waitFor(() => {
      expect(openExternalUrl).toHaveBeenCalledWith('https://opencode.ai/zen');
      expect(screen.getByText('Verificar login')).toBeInTheDocument();
    });
    expect(screen.queryByText('Usar neste chat')).not.toBeInTheDocument();
  });

  it('confirmacao global separa novas mensagens de todas as sessões', async () => {
    const onSetGlobal = vi.fn().mockResolvedValue(undefined);
    const onApplyAll = vi.fn().mockResolvedValue(undefined);

    render(
      <ModelSelector
        open
        mode="cloud"
        providers={[provider('openai-api', 'ready')]}
        credentials={[]}
        providerProfiles={[accountProfile()]}
        sessions={[{
          id: 'session-1',
          title: 'Sessão 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'idle',
          messages: [],
          tasks: []
        }]}
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
        onSetGlobalCloud={onSetGlobal}
        onApplyCloudToAll={onApplyAll}
      />,
    );

    fireEvent.click(screen.getAllByText('Aplicar para todos')[0]);
    expect(screen.getByText('Somente novas mensagens')).toBeInTheDocument();
    expect(screen.getByText('Aplicar a todas sessões')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Aplicar a todas sessões'));

    await waitFor(() => {
      expect(onApplyAll).toHaveBeenCalledTimes(1);
    });
    expect(onSetGlobal).not.toHaveBeenCalled();
  });

  it('ESC fecha primeiro o modal interno de API key', async () => {
    render(
      <ModelSelector
        open
        mode="cloud"
        providers={[provider('openai-api', 'requires_api_key')]}
        credentials={[]}
        providerProfiles={[]}
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

    fireEvent.click(screen.getByText('Configurar modelos'));
    fireEvent.click(screen.getByText('Adicionar API key'));
    expect(screen.getByText('Configurar OpenAI API')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('Configurar OpenAI API')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Ambiente')).toBeInTheDocument();
  });

  it('mostra profile ativo no item cloud', () => {
    render(
      <ModelSelector
        open
        mode="cloud"
        providers={[provider('openai-api', 'ready')]}
        credentials={[]}
        providerProfiles={[accountProfile()]}
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

    expect(screen.getAllByText(/Conta: Conta Trabalho/).length).toBeGreaterThan(0);
  });

  it('provider com credencial nao testada fica fora do Environment selector', () => {
    render(
      <ModelSelector
        open
        mode="cloud"
        providers={[provider('openai-api', 'testing')]}
        credentials={[]}
        providerProfiles={[]}
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

    expect(screen.getByText('Nenhum modelo pronto ainda')).toBeInTheDocument();
    expect(screen.queryByText('Usar neste chat')).not.toBeInTheDocument();
  });

  it('local sem runtime fica fora do Environment selector e aponta configuração', () => {
    render(
      <ModelSelector
        open
        mode="local"
        providers={[]}
        credentials={[]}
        providerProfiles={[]}
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

    expect(screen.getByText('Nenhum modelo pronto ainda')).toBeInTheDocument();
  });

  it('local sem modelo pronto fica vazio', () => {
    render(
      <ModelSelector
        open
        mode="local"
        providers={[]}
        credentials={[]}
        providerProfiles={[]}
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

    expect(screen.getByText('Nenhum modelo pronto ainda')).toBeInTheDocument();
  });

  it('detalhes ficam sob demanda', () => {
    render(
      <ModelSelector
        open
        mode="local"
        providers={[]}
        credentials={[]}
        providerProfiles={[]}
        localRuntime={runtime({ installedModels: [{ id: 'qwen2.5-coder:7b' }] })}
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

  it('esconde modelos 32B não recomendados nas listas compatíveis', () => {
    render(
      <ModelSelector
        open
        mode="local"
        providers={[]}
        credentials={[]}
        providerProfiles={[]}
        localRuntime={runtime({
          installedModels: [
            { id: 'qwen2.5-coder:7b' },
            { id: 'qwen2.5-coder:32b' }
          ]
        })}
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

    expect(screen.getByText('Qwen2.5 Coder 7B')).toBeInTheDocument();
    expect(screen.queryByText('Qwen2.5 Coder 32B')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Locais'));
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
