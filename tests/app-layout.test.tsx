import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import * as api from '../src/lib/api';
import { useAppStore } from '../src/stores/appStore';
import type { AgentSession, BootstrapPayload } from '../src/types/domain';

vi.mock('../src/lib/api', () => ({
  bootstrapState: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  decidePermission: vi.fn(),
  duplicateSession: vi.fn(),
  exportSession: vi.fn(),
  getBasePrompt: vi.fn(),
  getAppHealthCheck: vi.fn(),
  getLocalRuntimeState: vi.fn(),
  installLocalModel: vi.fn(),
  installLocalRuntime: vi.fn(),
  listProviderProfiles: vi.fn(),
  listProviderCredentials: vi.fn(),
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
  saveProviderProfileCredential: vi.fn(),
  saveProviderCredential: vi.fn(),
  setDefaultProviderProfile: vi.fn(),
  sendOrderToAgent: vi.fn(),
  startLocalRuntime: vi.fn(),
  testProviderConnection: vi.fn(),
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

describe('App layout visibility', () => {
  beforeEach(() => {
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
    mockedApi.listPrivilegedActions.mockResolvedValue([]);
    mockedApi.listProviderCredentials.mockResolvedValue([]);
    mockedApi.listProviderProfiles.mockResolvedValue([]);
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
      expect(screen.getByText('Pronto para criar algo?')).toBeInTheDocument();
    });

    expect(screen.getByText('Selecionar modelo')).toBeInTheDocument();
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
});
