import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/app/App';
import * as api from '../src/lib/api';
import { useAppStore } from '../src/stores/appStore';
import type { AgentSession, BootstrapPayload } from '../src/types/domain';

vi.mock('../src/lib/api', () => ({
  archiveAllSessions: vi.fn(),
  archiveSession: vi.fn(),
  bootstrapState: vi.fn(),
  compareModels: vi.fn(),
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
  searchOllamaLibrary: vi.fn(),
  setDefaultProviderProfile: vi.fn(),
  showLocalModel: vi.fn(),
  sendOrderToAgent: vi.fn(),
  sendTemporaryOrderToAgent: vi.fn(),
  startLocalRuntime: vi.fn(),
  testProviderConnection: vi.fn(),
  testLocalModel: vi.fn(),
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
      },
      {
        id: 'local-ollama',
        label: 'Local Ollama',
        configurable: true,
        enabled: true,
        status: {
          state: 'ready',
          message: 'Ollama pronto.',
          checkedAt: new Date().toISOString()
        },
        models: [
          {
            id: 'qwen2.5-coder:1.5b',
            label: 'Qwen2.5 Coder 1.5B',
            providerId: 'local-ollama',
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
    vi.resetAllMocks();
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
    mockedApi.createSession.mockImplementation(async (title) => ({
      ...baseSession(),
      id: 'created-session',
      title,
    }));
    mockedApi.getBasePrompt.mockResolvedValue('prompt base');
    mockedApi.updateSettings.mockImplementation(async (next) => next);
    mockedApi.listPrivilegedActions.mockResolvedValue([]);
    mockedApi.listArchivedSessions.mockResolvedValue([]);
    mockedApi.listProviderCredentials.mockResolvedValue([]);
    mockedApi.listProviderProfiles.mockResolvedValue([]);
    mockedApi.searchOllamaLibrary.mockResolvedValue([]);
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
    expect(screen.getByText('Mock de desenvolvimento')).toBeInTheDocument();
    expect(screen.queryByText('GPT-5.5')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'OpenAI' } });
    expect(screen.getByText('GPT-5.5')).toBeInTheDocument();
    expect(screen.getByTestId('model-row-gpt-5.5')).toHaveAttribute('data-source', 'cloud');
    expect(screen.getByTestId('model-row-gpt-5.5')).toHaveAttribute('data-provider-type', 'cloud');

    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'qwen2.5-coder' } });
    expect(screen.getByText('Nenhum modelo cloud configurado encontrado.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'modelo-inexistente-xyz' } });
    expect(screen.getByText('Nenhum modelo cloud configurado encontrado.')).toBeInTheDocument();

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
    fireEvent.change(screen.getByLabelText('Buscar modelos Ollama'), { target: { value: 'qwen2.5 coder 1.5b' } });
    expect(screen.getByTestId('model-row-qwen2.5-coder:1.5b')).toHaveAttribute('data-source', 'local');
    expect(screen.getByTestId('model-row-qwen2.5-coder:1.5b')).toHaveAttribute('data-provider-type', 'local');
    fireEvent.click(screen.getByText('qwen2.5-coder:1.5b'));

    await waitFor(() => {
      expect(api.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        executionMode: 'local',
        selectedProviderId: 'local-ollama',
        selectedModelId: 'qwen2.5-coder:1.5b',
      }));
    });

    fireEvent.click(screen.getByTitle(/Qwen2.5 Coder 1.5B/));
    fireEvent.click(screen.getAllByRole('tab', { name: 'Local' })[0]);
    fireEvent.change(screen.getByLabelText('Buscar modelos Ollama'), { target: { value: 'GPT-5.5' } });
    expect(screen.getByText('Nenhum modelo Ollama encontrado para esta busca.')).toBeInTheDocument();
  });

  it('abre configuração específica de modelo cloud e local pelo botão de três pontos', async () => {
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([baseSession()]));
    let progressHandler: Parameters<typeof api.onLocalModelProgress>[0] = () => undefined;
    vi.mocked(api.onLocalModelProgress).mockImplementation(async (handler) => {
      progressHandler = handler;
      return () => undefined;
    });

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
    expect(api.updateSettings).not.toHaveBeenCalledWith(expect.objectContaining({ selectedModelId: 'gpt-5.5' }));
    expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Adicionar key' }).length).toBeGreaterThan(0);
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
    expect(screen.queryByText('qwen2.5-coder:7b')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar modelos Ollama'), { target: { value: 'qwen2.5-coder:7b' } });
    expect(screen.getByText('qwen2.5-coder:7b')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.queryByText('Disponível para pull')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Configurar qwen2.5-coder:7b')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId('model-row-ollama-download:qwen2.5-coder:7b'));
    fireEvent.click(screen.getByLabelText('Configurar qwen2.5-coder:7b'));

    expect(screen.getByRole('dialog', { name: 'qwen2.5-coder:7b' })).toBeInTheDocument();
    expect(screen.getByText('Status: Não instalado')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Testar')).toBeInTheDocument();

    act(() => {
      progressHandler({
        modelId: 'qwen2.5-coder:7b',
        state: 'running',
        progressPercent: 42,
        downloaded: '2.1 GB',
        total: '5.0 GB',
        speed: '8 MB/s',
        message: 'Baixando modelo local',
        at: new Date().toISOString(),
      });
    });

    expect(screen.getByText(/Baixando modelo local · 42%/)).toBeInTheDocument();
    expect(screen.getByText('2.1 GB / 5.0 GB · 8 MB/s')).toBeInTheDocument();
  });

  it('gerencia múltiplas API keys no modal cloud sem revelar key salva', async () => {
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([baseSession()]));
    vi.mocked(api.listProviderProfiles).mockResolvedValue([
      {
        id: 'openai-api:principal',
        providerId: 'openai-api',
        providerLabel: 'OpenAI API',
        name: 'Principal',
        authType: 'api_key',
        status: 'testing',
        maskedCredential: 'sk-t****1111',
        source: 'config_file',
        isDefault: true,
        message: 'Teste pendente.',
      },
      {
        id: 'openai-api:backup',
        providerId: 'openai-api',
        providerLabel: 'OpenAI API',
        name: 'Backup',
        authType: 'api_key',
        status: 'ready',
        maskedCredential: 'sk-t****2222',
        source: 'config_file',
        isDefault: false,
        message: 'Pronta.',
      },
    ]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('mock-development-model')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle(/mock-development-model/));
    fireEvent.change(screen.getByLabelText('Buscar modelo ou provedor'), { target: { value: 'GPT-5.5' } });
    fireEvent.mouseEnter(screen.getByTestId('model-row-gpt-5.5'));
    fireEvent.click(screen.getByLabelText('Configurar GPT-5.5'));

    expect(screen.getByText('API keys')).toBeInTheDocument();
    expect(screen.getByText(/sk-t\*\*\*\*1111/)).toBeInTheDocument();
    expect(screen.getByText(/sk-t\*\*\*\*2222/)).toBeInTheDocument();
    expect(screen.queryByText('Mostrar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Backup/));
    await waitFor(() => {
      expect(api.setDefaultProviderProfile).toHaveBeenCalledWith('openai-api', 'openai-api:backup');
    });

    fireEvent.mouseEnter(screen.getByText(/Principal/).closest('.model-config-key-row') as HTMLElement);
    fireEvent.click(screen.getByLabelText('Ações da key Principal'));
    expect(screen.getByText('Usar como padrão')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Remover key'));
    await waitFor(() => {
      expect(api.removeProviderProfile).toHaveBeenCalledWith('openai-api:principal');
    });

    fireEvent.click(screen.getByText('Adicionar key'));
    fireEvent.change(screen.getByLabelText('Nome da key'), { target: { value: 'Nova key' } });
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test-valid-abcdef123456' } });
    expect(screen.getByText('Mostrar')).toBeInTheDocument();
    const addKeyButtons = screen.getAllByRole('button', { name: 'Adicionar key' });
    fireEvent.click(addKeyButtons[addKeyButtons.length - 1]);

    await waitFor(() => {
      expect(api.saveProviderProfileCredential).toHaveBeenCalledWith('openai-api', undefined, 'Nova key', 'sk-test-valid-abcdef123456', true);
    });
  });

  it('chat normal limpa o composer, mostra mensagem otimista e loading enquanto o provider responde', async () => {
    vi.mocked(api.bootstrapState).mockResolvedValue(payload([]));
    let resolveOrder: (session: AgentSession) => void = () => undefined;
    vi.mocked(api.sendOrderToAgent).mockImplementation(
      () => new Promise<AgentSession>((resolve) => {
        resolveOrder = resolve;
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('O que gostaria de explorar?')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Como posso ajudá-lo hoje?');
    fireEvent.change(input, { target: { value: 'opa' } });
    fireEvent.click(screen.getByLabelText('Enviar'));

    expect(input).toHaveValue('');
    expect(await screen.findByText('opa')).toBeInTheDocument();
    expect(screen.getByLabelText('Assistente respondendo')).toBeInTheDocument();
    expect(api.createSession).toHaveBeenCalledTimes(1);
    expect(api.sendOrderToAgent).toHaveBeenCalledWith('created-session', 'opa', 'auto', []);

    const now = new Date().toISOString();
    resolveOrder({
      id: 'created-session',
      title: 'opa',
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      tasks: [],
      messages: [
        { id: 'u1', role: 'user', content: 'opa', createdAt: now },
        { id: 'a1', role: 'assistant', content: 'Resposta real do provider mockado.', createdAt: now },
      ],
    });

    expect(await screen.findByText('Resposta real do provider mockado.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText('Assistente respondendo')).not.toBeInTheDocument();
    });
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
