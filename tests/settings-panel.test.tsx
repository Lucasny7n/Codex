import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '../src/components/panels/SettingsPanel';
import type { AgentProfile, AppSettings, ProviderDescriptor, ProviderRuntimeStatus } from '../src/types/domain';

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
    preferredShell: '/usr/bin/bash',
    autoApproveSafeRead: true
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

describe('SettingsPanel', () => {
  it('mostra status real do provider selecionado', () => {
    render(
      <SettingsPanel
        settings={settings()}
        providers={providers()}
        profiles={profiles()}
        onChange={vi.fn()}
        onTestProvider={vi.fn()}
      />,
    );

    expect(screen.getByText('Gemini CLI instalado.')).toBeInTheDocument();
    expect(screen.getByText('0.41.1')).toBeInTheDocument();
    expect(screen.getByText('Testar provider')).toBeInTheDocument();
  });

  it('mostra erro inline quando teste do provider falha', async () => {
    render(
      <SettingsPanel
        settings={settings()}
        providers={providers()}
        profiles={profiles()}
        onChange={vi.fn()}
        onTestProvider={vi.fn().mockResolvedValue(errorStatus)}
      />,
    );

    fireEvent.click(screen.getByText('Testar provider'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Teste do Gemini CLI falhou de forma controlada.');
    });
  });
});
