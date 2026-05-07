import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '../src/components/panels/SettingsPanel';
import type {
  AgentProfile,
  AppHealthCheck,
  AppSettings,
  LocalRuntimeSnapshot,
  ProviderCredentialStatus,
  ProviderDescriptor,
  ProviderRuntimeStatus
} from '../src/types/domain';

const readyStatus: ProviderRuntimeStatus = {
  state: 'ready',
  message: 'Gemini CLI instalado.',
  command: '/home/lucas/.local/bin/gemini --version',
  version: '0.41.1',
  checkedAt: new Date().toISOString()
};

const errorStatus: ProviderRuntimeStatus = {
  state: 'error',
  message: 'Teste do Gemini CLI falhou de forma controlada.',
  command: 'gemini --prompt <teste>',
  checkedAt: new Date().toISOString()
};

function settings(): AppSettings {
  return {
    workspaceRoot: '/tmp/workspace',
    codexRoot: '/tmp/codex',
      selectedProviderId: 'gemini-cli',
      selectedModelId: 'gemini-cli-default',
      selectedAgentId: 'equilibrado',
      selectedProviderProfileId: 'gemini-cli:default',
    preferredShell: '/usr/bin/bash',
    autoApproveSafeRead: true,
    executionMode: 'cloud',
    selectedLocalModelId: undefined,
    modelSelectionHistory: [],
    localModelsRoot: '/tmp/.codex/models'
  };
}

function providers(status: ProviderRuntimeStatus = readyStatus): ProviderDescriptor[] {
  return [
    {
      id: 'gemini-cli',
      label: 'Gemini CLI',
      configurable: true,
      enabled: status.state === 'ready',
      status,
      models: [
        {
          id: 'gemini-cli-default',
          label: 'Gemini CLI padrão',
          providerId: 'gemini-cli',
          supportsTools: false
        }
      ]
    },
    {
      id: 'mock-development',
      label: 'Mock Provider (desenvolvimento)',
      configurable: false,
      enabled: true,
      status: {
        state: 'mock',
        message: 'Mock explícito.',
        checkedAt: new Date().toISOString()
      },
      models: [
        {
          id: 'mock-development-model',
          label: 'Mock de desenvolvimento',
          providerId: 'mock-development',
          supportsTools: false
        }
      ]
    }
  ];
}

function profiles(): AgentProfile[] {
  return [
    {
      id: 'equilibrado',
      label: 'Equilibrado',
      description: 'Diagnóstico sólido.',
      mode: 'equilibrado'
    }
  ];
}

function credentials(): ProviderCredentialStatus[] {
  return [];
}

function localRuntime(): LocalRuntimeSnapshot {
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
    at: new Date().toISOString()
  };
}

function health(): AppHealthCheck {
  return {
    baseDir: '/tmp/workspace',
    expectedBaseDir: '/tmp/workspace',
    correctBaseDir: true,
    nodeOk: true,
    npmOk: true,
    cargoOk: true,
    tauriOk: true,
    providers: [],
    ollama: localRuntime(),
    recentErrors: [],
    overallStatus: 'ok',
    actions: []
  };
}

function renderSettings(overrides: Partial<ComponentProps<typeof SettingsPanel>> = {}) {
  return render(
    <SettingsPanel
      settings={settings()}
      providers={providers()}
      providerProfiles={[]}
      profiles={profiles()}
      credentials={credentials()}
      sessions={[]}
      localRuntime={localRuntime()}
      healthCheck={health()}
      healthLoading={false}
      onChange={vi.fn()}
      onTestProvider={vi.fn()}
      onSaveProviderProfileCredential={vi.fn()}
      onRemoveProviderCredential={vi.fn()}
      onRemoveProviderProfile={vi.fn()}
      onSetDefaultProviderProfile={vi.fn()}
      onRenameProviderProfile={vi.fn()}
      onInstallRuntime={vi.fn()}
      onStartRuntime={vi.fn()}
      onRunHealthCheck={vi.fn()}
      {...overrides}
    />,
  );
}

describe('SettingsPanel', () => {
  it('mostra status real do provider selecionado', () => {
    renderSettings();

    fireEvent.click(screen.getByText('IA / Providers'));
    expect(screen.getByText('Gemini CLI instalado.')).toBeInTheDocument();
    expect(screen.getByText('0.41.1')).toBeInTheDocument();
    expect(screen.getAllByText('Testar conexão')[0]).toBeInTheDocument();
  });

  it('mostra erro inline quando teste do provider falha', async () => {
    renderSettings({ onTestProvider: vi.fn().mockResolvedValue(errorStatus) });

    fireEvent.click(screen.getByText('IA / Providers'));
    fireEvent.click(screen.getAllByText('Testar conexão')[0]);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Provider indisponível');
    });
  });

  it('renderiza abas essenciais', () => {
    renderSettings();

    expect(screen.getByText('Geral')).toBeInTheDocument();
    expect(screen.getByText('IA / Providers')).toBeInTheDocument();
    expect(screen.getByText('Contas / Profiles')).toBeInTheDocument();
    expect(screen.getByText('Modelos locais')).toBeInTheDocument();
    expect(screen.getByText('Sessões')).toBeInTheDocument();
    expect(screen.getByText('Terminal & Permissões')).toBeInTheDocument();
    expect(screen.getByText('Diagnóstico')).toBeInTheDocument();
  });

  it('abre aba solicitada pelo seletor de modelos', () => {
    renderSettings({ initialTab: 'providers' });

    expect(screen.getByText('Gemini CLI instalado.')).toBeInTheDocument();
  });
});
