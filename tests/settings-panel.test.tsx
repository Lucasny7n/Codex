import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '../src/components/panels/SettingsPanel';
import type {
  AgentProfile,
  AppHealthCheck,
  AppSettings,
  LocalRuntimeSnapshot,
  ProviderDescriptor,
  ProviderRuntimeStatus,
} from '../src/types/domain';

const readyStatus: ProviderRuntimeStatus = {
  state: 'ready',
  message: 'Gemini CLI instalado.',
  command: '/home/lucas/.local/bin/gemini --version',
  version: '0.41.1',
  checkedAt: new Date().toISOString(),
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
    selectedLocalModelId: 'qwen2.5-coder:1.5b',
    modelSelectionHistory: [],
    localModelsRoot: '/tmp/.codex/models',
    themePreference: 'dark',
    aiResponseLanguage: 'pt-BR',
    autoGenerateTitles: true,
    autoCopyResponses: false,
    pasteLargeTextAsFile: true,
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
          supportsTools: false,
        },
      ],
    },
  ];
}

function profiles(): AgentProfile[] {
  return [
    {
      id: 'equilibrado',
      label: 'Equilibrado',
      description: 'Diagnóstico sólido.',
      mode: 'equilibrado',
    },
  ];
}

function localRuntime(): LocalRuntimeSnapshot {
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
    at: new Date().toISOString(),
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
    actions: [],
  };
}

function renderSettings(overrides: Partial<ComponentProps<typeof SettingsPanel>> = {}) {
  return render(
    <SettingsPanel
      settings={settings()}
      providers={providers()}
      providerProfiles={[]}
      profiles={profiles()}
      credentials={[]}
      sessions={[]}
      localRuntime={localRuntime()}
      healthCheck={health()}
      healthLoading={false}
      onChange={vi.fn().mockResolvedValue(undefined)}
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
  it('renderiza somente as abas principais e remove telas antigas', () => {
    renderSettings();

    for (const label of ['Geral', 'Interface', 'Modelos', 'Conversas', 'Personalização']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }

    for (const label of ['Conta', 'Sobre', 'Áudio', 'Voz', 'Terminal', 'Sessões', 'Diagnóstico', 'Avançado', 'Conexões', 'Ambiente', 'Abrir Ambiente', 'Controle']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('Geral mostra tema e idioma da IA, salvando preferência', () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    renderSettings({ onChange });

    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Claro' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Escuro' })).toBeInTheDocument();
    expect(screen.getByText('Idioma das respostas da IA')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Português (Brasil)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Claro' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ themePreference: 'light' }));

    fireEvent.change(screen.getByDisplayValue('Português (Brasil)'), { target: { value: 'en' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ aiResponseLanguage: 'en' }));
  });

  it('Interface contém switches visuais simples', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Interface' }));

    expect(screen.getByText('Geração automática de título')).toBeInTheDocument();
    expect(screen.getByText('Cópia automática da resposta para área de transferência')).toBeInTheDocument();
    expect(screen.getByText('Colar texto grande como arquivo')).toBeInTheDocument();
    expect(screen.getAllByRole('switch').length).toBe(3);
  });

  it('Modelos mostra accordions informativos sem configuração de credencial', () => {
    renderSettings({ initialTab: 'models' });

    expect(screen.getByText('GPT-5.5')).toBeInTheDocument();
    expect(screen.getByText('GPT-5.4 Mini via OpenRouter')).toBeInTheDocument();
    expect(screen.getByText('Qwen2.5 Coder 1.5B')).toBeInTheDocument();
    expect(screen.getByText('Gemini 2.5 Flash')).toBeInTheDocument();
    expect(screen.getByText('Comprimento máximo do contexto')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor')).toBeInTheDocument();
    expect(screen.queryByText('API Key')).not.toBeInTheDocument();
    expect(screen.queryByText('Salvar API')).not.toBeInTheDocument();
  });

  it('Conversas mostra ações principais com confirmação para exclusão', () => {
    renderSettings({ initialTab: 'conversations' });

    expect(screen.getByText('Importar Conversas')).toBeInTheDocument();
    expect(screen.getByText('Exportar Conversas')).toBeInTheDocument();
    expect(screen.getByText('Arquivar todos os chats')).toBeInTheDocument();
    expect(screen.getByText('Excluir todas as conversas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Confirmar exclusão');
  });

  it('Personalização mostra memória e funções avançadas persistíveis', () => {
    renderSettings({ initialTab: 'personalization' });

    expect(screen.getByText('Memórias guardadas')).toBeInTheDocument();
    expect(screen.getByText('Histórico de chat de referência')).toBeInTheDocument();
    expect(screen.getByText('Personalizar o Codex/Qwen')).toBeInTheDocument();
    expect(screen.getByText('Gerenciar Cookies')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Avançado/ }));

    for (const label of [
      'Extração da página web',
      'Pesquisa por imagens',
      'Pesquisa na web',
      'Geração de imagens',
      'Interpretador de código',
      'Recuperar memórias históricas',
      'Edição de imagens',
      'Atualizar memória',
      'Ampliação local da imagem',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
