import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../src/lib/api';
import { SettingsPanel } from '../src/components/settings/SettingsPanel';
import type {
  AgentProfile,
  AppSettings,
  LocalRuntimeSnapshot,
  ProviderDescriptor,
  ProviderRuntimeStatus,
} from '../src/types/domain';

vi.mock('../src/lib/api', () => ({
  compareModels: vi.fn(),
  getAppHealthCheck: vi.fn(),
  getFileAttachment: vi.fn(),
  getLocalRuntimeState: vi.fn(),
  installLocalModel: vi.fn(),
  listFileDirectory: vi.fn(),
  onLocalModelProgress: vi.fn(),
  removeLocalModel: vi.fn(),
  showLocalModel: vi.fn(),
  testLocalModel: vi.fn(),
}));

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
    codexRoot: '/tmp/.codex',
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
    personalization: {
      memoriesStored: true,
      referenceChatHistory: true,
      customizeAilu: false,
      manageCookies: false,
      webPageExtraction: false,
      imageSearch: false,
      webSearch: true,
      imageGeneration: false,
      codeInterpreter: true,
      recoverHistoricalMemories: true,
      imageEditing: false,
      memoryUpdate: true,
      localImageUpscaling: false,
    },
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

function renderSettings(overrides: Partial<ComponentProps<typeof SettingsPanel>> = {}) {
  vi.mocked(api.onLocalModelProgress).mockResolvedValue(() => undefined);
  vi.mocked(api.getLocalRuntimeState).mockResolvedValue(localRuntime());
  vi.mocked(api.getAppHealthCheck).mockResolvedValue({
    baseDir: '/tmp/workspace',
    expectedBaseDir: '/tmp/workspace',
    correctBaseDir: true,
    branch: 'main',
    nodeOk: true,
    npmOk: true,
    cargoOk: true,
    tauriOk: true,
    providers: [],
    ollama: localRuntime(),
    credentialsEncrypted: false,
    items: [
      { id: 'ollama-api', label: 'Ollama API ativa', status: 'ok', detail: 'http://127.0.0.1:11434' },
      { id: 'stt-backend', label: 'Backend STT', status: 'ok', detail: 'Transcrição local pronta. Modelo: /home/lucas/.codex/models/ggml-base.bin' },
      { id: 'microphone-webview', label: 'Captura WebView', status: 'warning', detail: 'Captura ainda não testada.' },
      { id: 'microphone-native', label: 'Captura nativa', status: 'ok', detail: 'Fallback nativo disponível via pw-record.' },
    ],
    recentErrors: [],
    overallStatus: 'ok',
    actions: [],
  });
  return render(
    <SettingsPanel
      settings={settings()}
      providers={providers()}
      profiles={profiles()}
      sessions={[]}
      localRuntime={localRuntime()}
      onChange={vi.fn().mockResolvedValue(undefined)}
      onExportConversations={vi.fn().mockResolvedValue('/tmp/conversas.json')}
      onImportConversations={vi.fn().mockResolvedValue('Importadas: 1')}
      onArchiveAllConversations={vi.fn().mockResolvedValue(undefined)}
      onDeleteAllConversations={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  );
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza somente as abas principais e remove telas antigas', () => {
    renderSettings();

    for (const label of ['Geral', 'Interface', 'Modelos', 'Conversas', 'Personalização', 'Saúde']) {
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
    expect(screen.getByText('Cópia automática da resposta')).toBeInTheDocument();
    expect(screen.getByText('Colar texto grande como arquivo')).toBeInTheDocument();
    expect(screen.getByText('Modo Desenvolvedor')).toBeInTheDocument();
    expect(screen.getAllByRole('switch').length).toBe(4);
  });

  it('Modo Desenvolvedor libera roteamento e fallback configurável', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    renderSettings({
      onChange,
      settings: {
        ...settings(),
        developerMode: true,
        aiRouting: {
          fallbackEnabled: false,
          fallbackPolicy: 'automatic',
          fallbackModels: [],
        },
      },
      initialTab: 'interface',
    });

    expect(screen.getByText('Roteamento avançado')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Fallback entre IAs'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      aiRouting: expect.objectContaining({ fallbackEnabled: true }),
    }));

    fireEvent.change(screen.getByLabelText('Política de fallback'), { target: { value: 'local_first' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      aiRouting: expect.objectContaining({ fallbackPolicy: 'local_first' }),
    }));

    fireEvent.change(screen.getByPlaceholderText(/openai-api/), {
      target: { value: 'local-ollama/qwen2.5-coder:7b' },
    });
    fireEvent.blur(screen.getByPlaceholderText(/openai-api/));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        aiRouting: expect.objectContaining({
          fallbackModels: [expect.objectContaining({ providerId: 'local-ollama', modelId: 'qwen2.5-coder:7b' })],
        }),
      }));
    });
  });

  it('Modelos mostra accordions informativos sem configuração de credencial', () => {
    renderSettings({ initialTab: 'models' });

    expect(screen.getByText('Model Manager local')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('gpt-oss, llama3.2, qwen2.5-coder:7b')).toBeInTheDocument();
    expect(screen.getByText('qwen2.5-coder:1.5b')).toBeInTheDocument();
    expect(screen.getByText('GPT-5.5')).toBeInTheDocument();
    expect(screen.getByText('GPT-5.4 Mini via OpenRouter')).toBeInTheDocument();
    expect(screen.getByText('Qwen2.5 Coder 1.5B')).toBeInTheDocument();
    expect(screen.getByText('Gemini 2.5 Flash')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar no catálogo de modelos')).toBeInTheDocument();
    expect(screen.getByText('Mostrando apenas modelos em destaque. Use busca para ver mais.')).toBeInTheDocument();
    expect(screen.getByText('Comprimento máximo do contexto')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor')).toBeInTheDocument();
    expect(screen.queryByText('API Key')).not.toBeInTheDocument();
    expect(screen.queryByText('Salvar API')).not.toBeInTheDocument();
  });

  it('Model Manager cria pull candidate gpt-oss e mostra erro inline de pull', async () => {
    vi.mocked(api.installLocalModel).mockRejectedValueOnce(new Error('Falha ao baixar `gpt-oss`: modelo não encontrado no Ollama.'));
    renderSettings({ initialTab: 'models' });

    fireEvent.change(screen.getByPlaceholderText('gpt-oss, llama3.2, qwen2.5-coder:7b'), {
      target: { value: 'gpt oss' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Baixar gpt-oss' }));

    await waitFor(() => {
      expect(api.installLocalModel).toHaveBeenCalledWith('gpt-oss');
      expect(screen.getByRole('alert')).toHaveTextContent('modelo não encontrado');
    });
  });

  it('Model Manager remove modelo Ollama com confirmação inline', async () => {
    vi.mocked(api.removeLocalModel).mockResolvedValueOnce({
      ...localRuntime(),
      installedModels: [],
    });
    renderSettings({ initialTab: 'models' });

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Remover qwen2.5-coder:1.5b');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(api.removeLocalModel).toHaveBeenCalledWith('qwen2.5-coder:1.5b');
    });
  });

  it('Conversas chama backend real para exportar, arquivar e excluir', async () => {
    const onExportConversations = vi.fn().mockResolvedValue('/tmp/conversas.json');
    const onArchiveAllConversations = vi.fn().mockResolvedValue(undefined);
    const onDeleteAllConversations = vi.fn().mockResolvedValue(undefined);
    renderSettings({
      initialTab: 'conversations',
      sessions: [
        {
          id: 's1',
          title: 'Sessão',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'idle',
          messages: [],
          tasks: [],
        },
      ],
      onExportConversations,
      onArchiveAllConversations,
      onDeleteAllConversations,
    });

    expect(screen.getByText('Importar Conversas')).toBeInTheDocument();
    expect(screen.getByText('Exportar Conversas')).toBeInTheDocument();
    expect(screen.getByText('Arquivar todos os chats')).toBeInTheDocument();
    expect(screen.getByText('Excluir todas as conversas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    await waitFor(() => {
      expect(onExportConversations).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status')).toHaveTextContent('/tmp/conversas.json');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Arquivar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => {
      expect(onArchiveAllConversations).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Confirmar exclusão');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => {
      expect(onDeleteAllConversations).toHaveBeenCalledTimes(1);
    });
  });

  it('Conversas mostra erro inline em importação inválida', async () => {
    vi.mocked(api.listFileDirectory).mockResolvedValue({
      path: '/tmp',
      parentPath: '/',
      shortcuts: [],
      entries: [
        {
          name: 'quebrado.json',
          path: '/tmp/quebrado.json',
          kind: 'json',
          extension: 'json',
          isDirectory: false,
          size: 50,
          modifiedAt: new Date().toISOString(),
        },
      ],
      truncated: false,
    });
    vi.mocked(api.getFileAttachment).mockResolvedValue({
      name: 'quebrado.json',
      path: '/tmp/quebrado.json',
      kind: 'json',
      extension: 'json',
      isDirectory: false,
      size: 50,
      modifiedAt: new Date().toISOString(),
      previewTruncated: false,
    });
    const onImportConversations = vi.fn().mockRejectedValue(new Error('Importação inválida.'));

    renderSettings({
      initialTab: 'conversations',
      onImportConversations,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
    fireEvent.click(await screen.findByText('quebrado.json'));
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));

    await waitFor(() => {
      expect(onImportConversations).toHaveBeenCalledWith('/tmp/quebrado.json');
      expect(screen.getByRole('alert')).toHaveTextContent('Importação inválida.');
    });
  });

  it('Personalização mostra memória e funções avançadas persistíveis', () => {
    renderSettings({ initialTab: 'personalization' });

    expect(screen.getByText('Memórias guardadas')).toBeInTheDocument();
    expect(screen.getByText('Histórico de chat de referência')).toBeInTheDocument();
    expect(screen.getByText('Personalização avançada do Ailu')).toBeInTheDocument();
    expect(screen.getByText('Gerenciar cookies')).toBeInTheDocument();

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

  it('Saúde mostra estados reais e ações sugeridas sem log cru', async () => {
    renderSettings({ initialTab: 'health' });

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => {
      expect(api.getAppHealthCheck).toHaveBeenCalled();
      expect(screen.getByText('Ollama API ativa')).toBeInTheDocument();
      expect(screen.getByText('Backend STT')).toBeInTheDocument();
      expect(screen.getByText('Captura WebView')).toBeInTheDocument();
      expect(screen.getByText('Captura nativa')).toBeInTheDocument();
      expect(screen.getAllByText('OK').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('http://127.0.0.1:11434')).toBeInTheDocument();
      expect(screen.queryByText(/CODEX_CONTEXT_BOOTSTRAP/)).not.toBeInTheDocument();
    });
  });
});
