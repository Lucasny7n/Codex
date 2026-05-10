import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import * as api from '../src/lib/api';
import { useAppStore } from '../src/stores/appStore';
import type { AgentSession, BootstrapPayload } from '../src/types/domain';

vi.mock('../src/lib/api', () => ({
  archiveAllSessions: vi.fn(),
  archiveSession: vi.fn(),
  bootstrapState: vi.fn(),
  createSession: vi.fn(),
  deleteAllSessions: vi.fn(),
  deleteSession: vi.fn(),
  decidePermission: vi.fn(),
  duplicateSession: vi.fn(),
  exportSession: vi.fn(),
  exportAllConversations: vi.fn(),
  getBasePrompt: vi.fn(),
  getAppHealthCheck: vi.fn(),
  getFileAttachment: vi.fn(),
  getLocalRuntimeState: vi.fn(),
  getSttConfigState: vi.fn(),
  installLocalModel: vi.fn(),
  installLocalRuntime: vi.fn(),
  importConversations: vi.fn(),
  listProviderProfiles: vi.fn(),
  listProviderCredentials: vi.fn(),
  listFileDirectory: vi.fn(),
  listArchivedSessions: vi.fn(),
  listPrivilegedActions: vi.fn(),
  onCommandLog: vi.fn(),
  onFileChanged: vi.fn(),
  onLocalModelProgress: vi.fn(),
  onLocalRuntimeState: vi.fn(),
  onPermissionOutcome: vi.fn(),
  onPermissionRaised: vi.fn(),
  onPermissionResolved: vi.fn(),
  onSessionChanged: vi.fn(),
  onStatusNote: vi.fn(),
  openFileInVscode: vi.fn(),
  openProjectInVscode: vi.fn(),
  removeLocalModel: vi.fn(),
  removeProviderCredential: vi.fn(),
  removeProviderProfile: vi.fn(),
  requestPrivilegedAction: vi.fn(),
  requestExecution: vi.fn(),
  renameSession: vi.fn(),
  renameProviderProfile: vi.fn(),
  restoreSession: vi.fn(),
  saveProviderProfileCredential: vi.fn(),
  saveProviderCredential: vi.fn(),
  setDefaultProviderProfile: vi.fn(),
  sendOrderToAgent: vi.fn(),
  sendTemporaryOrderToAgent: vi.fn(),
  startLocalRuntime: vi.fn(),
  testProviderConnection: vi.fn(),
  transcribeAudio: vi.fn(),
  updateBasePrompt: vi.fn(),
  updateSessionEnvironment: vi.fn(),
  applyEnvironmentToAllSessions: vi.fn(),
  updateSettings: vi.fn()
}));

function baseSession(): AgentSession {
  const now = new Date().toISOString();
  return {
    id: 'session-1',
    title: 'Sessão 1',
    createdAt: now,
    updatedAt: now,
    status: 'idle',
    messages: [],
    tasks: []
  };
}

function payload(sessions: AgentSession[]): BootstrapPayload {
  return {
    settings: {
      workspaceRoot: '/tmp/workspace',
      codexRoot: '/tmp/.codex',
      selectedProviderId: 'mock-development',
      selectedModelId: 'mock-development-model',
      selectedAgentId: 'equilibrado',
      selectedProviderProfileId: 'mock-development:default',
      preferredShell: '/usr/bin/bash',
      autoApproveSafeRead: true,
      executionMode: 'cloud',
      selectedLocalModelId: undefined,
      modelSelectionHistory: [],
      localModelsRoot: '/tmp/.codex/models'
    },
    workspaceMeta: {
      root: '/tmp/workspace',
      repoName: 'Codex-Codex',
      branch: 'codex-cloud-end4-ui-v2',
      headShort: 'abc1234',
      dirty: false
    },
    sessions,
    pendingPermissions: [],
    providers: [
      {
        id: 'mock-development',
        label: 'Mock Provider (desenvolvimento)',
        configurable: false,
        enabled: true,
        status: {
          state: 'ready',
          message: 'Provider de teste pronto.',
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
      },
      {
        id: 'openai-api',
        label: 'OpenAI API',
        configurable: true,
        enabled: false,
        status: {
          state: 'requires_api_key',
          message: 'OpenAI API sem API key configurada.',
          checkedAt: new Date().toISOString()
        },
        models: [
          {
            id: 'gpt-5.5',
            label: 'GPT-5.5',
            providerId: 'openai-api',
            supportsTools: false
          }
        ]
      }
    ],
    providerProfiles: [],
    agentProfiles: [
      {
        id: 'equilibrado',
        label: 'Equilibrado',
        description: 'Diagnóstico sólido.',
        mode: 'equilibrado'
      }
    ],
    memory: {
      profileSummary: 'Resumo',
      userPreferences: [],
      activeProjects: [],
      importantFixHistory: [],
      operationalPolicies: []
    },
    theme: {
      source: 'test',
      accentPrimary: '#9dcaff',
      accentSecondary: '#2d95ec',
      background: '#000000'
    }
  };
}

function installLocalStorageMock(): void {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
      clear: vi.fn(() => values.clear()),
    },
  });
}

describe('App layout visibility', () => {
  beforeEach(() => {
    installLocalStorageMock();
    useAppStore.setState({
      booted: false,
      loading: true,
      error: undefined,
      settings: undefined,
      workspaceMeta: undefined,
      providers: [],
      providerProfiles: [],
      profiles: [],
      memory: undefined,
      theme: undefined,
      sessions: [],
      selectedSessionId: undefined,
      logs: [],
      changedFiles: [],
      statusFeed: [],
      pendingPermissions: [],
      permissionOutcomes: [],
      selectedModelId: undefined,
      executionMode: 'cloud',
      modelSelectorOpen: false
    });

    const mockedApi = vi.mocked(api);
    mockedApi.getBasePrompt.mockResolvedValue('prompt base');
    mockedApi.updateSettings.mockImplementation(async (next) => next);
    mockedApi.listPrivilegedActions.mockResolvedValue([]);
    mockedApi.listArchivedSessions.mockResolvedValue([]);
    mockedApi.listProviderCredentials.mockResolvedValue([]);
    mockedApi.listProviderProfiles.mockResolvedValue([]);
    mockedApi.saveProviderProfileCredential.mockResolvedValue({
      id: 'openai-api:principal',
      providerId: 'openai-api',
      providerLabel: 'OpenAI API',
      name: 'Principal',
      authType: 'api_key',
      status: 'testing',
      maskedCredential: 'sk-t****1234',
      source: 'config_file',
      isDefault: true,
      message: 'Credencial salva; teste conexão antes de usar como ready.'
    });
    mockedApi.getLocalRuntimeState.mockResolvedValue({
      state: 'ready',
      message: 'Runtime pronto',
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
    });
    mockedApi.onStatusNote.mockResolvedValue(() => undefined);
    mockedApi.onCommandLog.mockResolvedValue(() => undefined);
    mockedApi.onFileChanged.mockResolvedValue(() => undefined);
    mockedApi.onLocalRuntimeState.mockResolvedValue(() => undefined);
    mockedApi.onLocalModelProgress.mockResolvedValue(() => undefined);
    mockedApi.onSessionChanged.mockResolvedValue(() => undefined);
    mockedApi.onPermissionRaised.mockResolvedValue(() => undefined);
    mockedApi.onPermissionResolved.mockResolvedValue(() => undefined);
    mockedApi.onPermissionOutcome.mockResolvedValue(() => undefined);
  });

  it('abre em nova conversa sem criar sessão permanente no boot', async () => {
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([baseSession()]));

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('Nova Conversa').length).toBeGreaterThan(0);
    });

    expect(screen.queryByTestId('onboarding-empty-state')).not.toBeInTheDocument();
    expect(vi.mocked(api.createSession)).not.toHaveBeenCalled();
  });

  it('home renderiza blueprint limpo sem inspector ou blocos técnicos', async () => {
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([baseSession()]));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('O que gostaria de explorar?')).toBeInTheDocument();
    });

    expect(screen.getByText('Nuvem')).toBeInTheDocument();
    expect(screen.getByText('mock-development-model')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Como posso ajudá-lo hoje?')).toBeInTheDocument();
    expect(screen.queryByText('Auditar projeto')).not.toBeInTheDocument();
    expect(screen.queryByText('Validar build')).not.toBeInTheDocument();
    expect(screen.queryByText('Revisar providers')).not.toBeInTheDocument();
    expect(screen.queryByText('Analisar riscos')).not.toBeInTheDocument();
    expect(screen.queryByText('Abrir terminal')).not.toBeInTheDocument();
    expect(screen.queryByText('Comando Principal')).not.toBeInTheDocument();
    expect(screen.queryByText('Terminal e logs')).not.toBeInTheDocument();
    expect(screen.queryByText('Inspector')).not.toBeInTheDocument();
    expect(screen.queryByText('READY')).not.toBeInTheDocument();
    expect(screen.queryByText('requires_cli_auth')).not.toBeInTheDocument();
  });

  it('lista, restaura e exclui conversas arquivadas pelo menu do usuário', async () => {
    const visible = baseSession();
    const archived: AgentSession = {
      ...baseSession(),
      id: 'archived-1',
      title: 'Conversa arquivada',
      archived: true,
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'conteúdo antigo',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([visible]));
    vi.mocked(api.listArchivedSessions).mockResolvedValue([archived]);
    vi.mocked(api.restoreSession).mockResolvedValue({ ...archived, archived: false });
    vi.mocked(api.deleteSession).mockResolvedValue(undefined);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('O que gostaria de explorar?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Menu do usuário'));
    fireEvent.click(screen.getByText('Conversas arquivadas'));

    expect(await screen.findByRole('dialog', { name: 'Conversas arquivadas' })).toBeInTheDocument();
    expect(await screen.findByText('Conversa arquivada')).toBeInTheDocument();
    expect(screen.queryAllByText('Conversa arquivada')).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('Buscar conversa arquivada'), { target: { value: 'antigo' } });
    expect(screen.getByText('Conversa arquivada')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Restaurar'));
    await waitFor(() => {
      expect(api.restoreSession).toHaveBeenCalledWith('archived-1');
      expect(screen.queryByText('Conversa arquivada')).not.toBeInTheDocument();
    });

    vi.mocked(api.listArchivedSessions).mockResolvedValue([archived]);
    fireEvent.click(screen.getByText('Atualizar'));
    expect(await screen.findByText('Conversa arquivada')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Excluir definitivamente'));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => {
      expect(api.deleteSession).toHaveBeenCalledWith('archived-1');
      expect(screen.queryByText('Conversa arquivada')).not.toBeInTheDocument();
    });
  });

  it('abre dropdown de modelos pela topbar sem mostrar menu Ambiente antigo', async () => {
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([baseSession()]));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('mock-development-model')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle(/mock-development-model/));

    expect(screen.getByText('Modelos')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar modelo ou provedor')).toBeInTheDocument();
    expect(screen.getByText('Provedores')).toBeInTheDocument();
    expect(screen.queryByText('Fabricantes / Provedores')).not.toBeInTheDocument();
    expect(screen.getAllByText('Nuvem').length).toBeGreaterThan(1);
    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('Configurar modelos')).toBeInTheDocument();
    expect(screen.queryByText('Ambiente')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'OpenAI' } });
    expect(screen.getByText('GPT-5.5')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'modelo-inexistente-xyz' } });
    expect(screen.getByText('Nenhum modelo encontrado')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Configurar modelos'));
    expect(screen.queryByRole('tab', { name: 'Prontos' })).not.toBeInTheDocument();
  });

  it('seleciona modelo local disponível e mantém modelo cloud indisponível em configuração', async () => {
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([baseSession()]));
    vi.mocked(api.getLocalRuntimeState).mockResolvedValue({
      state: 'ready',
      message: 'Runtime pronto',
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
      at: new Date().toISOString()
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('mock-development-model')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle(/mock-development-model/));
    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'GPT-5.5' } });
    fireEvent.mouseEnter(screen.getByTestId('model-row-gpt-5.5'));
    fireEvent.click(screen.getByLabelText('Configurar GPT-5.5'));

    expect(screen.getByRole('dialog', { name: 'GPT-5.5' })).toBeInTheDocument();
    expect(vi.mocked(api.updateSettings)).not.toHaveBeenCalledWith(expect.objectContaining({ selectedModelId: 'gpt-5.5' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'GPT-5.5' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle(/mock-development-model/));
    fireEvent.click(screen.getAllByRole('tab', { name: 'Local' })[0]);
    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'Qwen2.5 Coder 1.5B' } });
    fireEvent.click(screen.getByText('Qwen2.5 Coder 1.5B'));

    await waitFor(() => {
      expect(api.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        executionMode: 'local',
        selectedProviderId: 'local-ollama',
        selectedModelId: 'qwen2.5-coder:1.5b',
      }));
    });
  });

  it('abre configuração específica de modelo cloud e local pelo botão de três pontos', async () => {
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([baseSession()]));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('mock-development-model')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle(/mock-development-model/));
    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'GPT-5.5' } });
    expect(screen.queryByLabelText('Configurar GPT-5.5')).not.toBeInTheDocument();
    const gptRow = screen.getByTestId('model-row-gpt-5.5');
    fireEvent.mouseEnter(gptRow);
    expect(gptRow).toHaveClass('show-config');
    fireEvent.click(screen.getByLabelText('Configurar GPT-5.5'));

    expect(screen.getByRole('dialog', { name: 'GPT-5.5' })).toBeInTheDocument();
    expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    expect(screen.getByText('Salvar API')).toBeInTheDocument();
    expect(screen.getByText('Testar API')).toBeInTheDocument();
    expect(screen.getByText(/Status: não testado/)).toBeInTheDocument();

    vi.mocked(api.testProviderConnection).mockResolvedValueOnce({
      state: 'invalid_api_key',
      message: 'API key inválida.',
      checkedAt: new Date().toISOString(),
    });
    fireEvent.click(screen.getByText('Testar API'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('API key inválida.');
    });

    vi.mocked(api.testProviderConnection).mockResolvedValue({
      state: 'ready',
      message: 'OpenAI respondeu.',
      checkedAt: new Date().toISOString(),
    });
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test-valid-123456789' } });
    fireEvent.click(screen.getByText('Testar API'));
    await waitFor(() => {
      expect(api.saveProviderProfileCredential).toHaveBeenCalledWith('openai-api', undefined, 'Principal', 'sk-test-valid-123456789', true);
      expect(api.testProviderConnection).toHaveBeenCalledWith('openai-api');
      expect(screen.getByText(/Status: funcionando/)).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'GPT-5.5' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle(/mock-development-model/));
    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'GPT-5.5' } });
    fireEvent.click(screen.getByText('GPT-5.5'));
    await waitFor(() => {
      expect(api.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        selectedProviderId: 'openai-api',
        selectedModelId: 'gpt-5.5',
      }));
    });

    fireEvent.click(screen.getByTitle(/GPT-5.5/));
    fireEvent.click(screen.getAllByRole('tab', { name: 'Local' })[0]);
    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'Qwen2.5 Coder 7B' } });
    expect(screen.queryByLabelText('Configurar Qwen2.5 Coder 7B')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId('model-row-qwen2.5-coder:7b'));
    fireEvent.click(screen.getByLabelText('Configurar Qwen2.5 Coder 7B'));

    expect(screen.getByRole('dialog', { name: 'Qwen2.5 Coder 7B' })).toBeInTheDocument();
    expect(screen.getByText('Status: Não instalado')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Testar')).toBeInTheDocument();
  });

  it('não cria projeto Codex-Codex automaticamente a partir do workspace', async () => {
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([baseSession()]));

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('Nova Conversa').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('Projetos'));

    expect(screen.getByText('Novo Projeto')).toBeInTheDocument();
    expect(screen.queryByText('Codex-Codex')).not.toBeInTheDocument();
  });

  it('permite excluir Codex-Codex quando ele veio de projeto salvo pelo app', async () => {
    window.localStorage.setItem('codex-command-center-projects', JSON.stringify(['Codex-Codex']));
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([baseSession()]));

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('Nova Conversa').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('Projetos'));
    expect(screen.getByText('Codex-Codex')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Ações do projeto Codex-Codex'));
    fireEvent.click(screen.getByText('Excluir Projeto'));

    await waitFor(() => {
      expect(screen.queryByText('Codex-Codex')).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem('codex-command-center-projects')).toBe('[]');
  });

  it('ativa Bate-papo Temporário sem salvar conversa no histórico', async () => {
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([baseSession()]));
    vi.mocked(api.exportAllConversations).mockResolvedValue({ path: '/tmp/conversas.json', format: 'json', bytes: 10 });
    vi.mocked(api.sendTemporaryOrderToAgent).mockImplementation(async (messages, content) => {
      const now = new Date().toISOString();
      return {
        id: 'temporary-chat',
        title: 'Bate-papo Temporário',
        createdAt: now,
        updatedAt: now,
        status: 'idle',
        tasks: [],
        messages: [
          ...messages,
          {
            id: 'temporary-user',
            role: 'user',
            content,
            createdAt: now,
          },
          {
            id: 'temporary-assistant',
            role: 'assistant',
            content: 'Resposta temporária real do provider.',
            createdAt: now,
          },
        ],
      };
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('O que gostaria de explorar?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/Iniciar Bate-papo Temporário/));
    expect(screen.getByRole('heading', { name: 'Bate-papo Temporário' })).toBeInTheDocument();
    expect(screen.getByText('Esta conversa não aparecerá no histórico e as suas mensagens não serão guardadas.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Como posso ajudá-lo hoje?'), {
      target: { value: 'mensagem sem histórico' },
    });
    fireEvent.click(screen.getByLabelText('Enviar'));

    expect(vi.mocked(api.createSession)).not.toHaveBeenCalled();
    expect(vi.mocked(api.sendOrderToAgent)).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(vi.mocked(api.sendTemporaryOrderToAgent)).toHaveBeenCalledWith(
        [],
        'mensagem sem histórico',
        'auto',
        [],
      );
    });
    expect(await screen.findByText('mensagem sem histórico')).toBeInTheDocument();
    expect(await screen.findByText('Resposta temporária real do provider.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Menu do usuário'));
    fireEvent.click(screen.getByText('Configurações'));
    fireEvent.click(await screen.findByRole('button', { name: 'Conversas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    await waitFor(() => {
      expect(api.exportAllConversations).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(api.createSession)).not.toHaveBeenCalled();
    expect(vi.mocked(api.sendOrderToAgent)).not.toHaveBeenCalled();
    expect(vi.mocked(api.sendTemporaryOrderToAgent)).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByLabelText('Sair do Bate-papo Temporário'));
    await waitFor(() => {
      expect(screen.getByText('O que gostaria de explorar?')).toBeInTheDocument();
    });
    expect(screen.queryByText('mensagem sem histórico')).not.toBeInTheDocument();
    expect(screen.queryByText('Resposta temporária real do provider.')).not.toBeInTheDocument();
  });

  it('mostra erro inline do provider no Bate-papo Temporário sem criar sessão', async () => {
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([baseSession()]));
    vi.mocked(api.sendTemporaryOrderToAgent).mockRejectedValue(new Error('Provider falhou no teste.'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('O que gostaria de explorar?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/Iniciar Bate-papo Temporário/));
    fireEvent.change(screen.getByPlaceholderText('Como posso ajudá-lo hoje?'), {
      target: { value: 'forçar erro' },
    });
    fireEvent.click(screen.getByLabelText('Enviar'));

    expect(vi.mocked(api.createSession)).not.toHaveBeenCalled();
    expect(vi.mocked(api.sendOrderToAgent)).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('Erro no Bate-papo Temporário')).toBeInTheDocument();
      expect(screen.getByText('Provider falhou no teste.')).toBeInTheDocument();
    });
  });
});
