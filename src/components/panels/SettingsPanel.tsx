import { useMemo, useState } from 'react';
import type {
  AgentSession,
  AgentProfile,
  AppHealthCheck,
  AppSettings,
  LocalRuntimeSnapshot,
  ProviderAccountProfile,
  ProviderAuthType,
  ProviderCredentialStatus,
  ProviderDescriptor,
  ProviderRuntimeStatus,
  ProviderStatusState,
} from '../../types/domain';
import type { EnvironmentTab } from './ModelSelector';
import { errorForStatus, translateError } from '../../lib/errorTranslator';
import { openExternalUrl } from '../../lib/api';
import {
  CredentialInput,
  PopupMenu,
  PremiumModal,
  StatusDot,
} from '../common/PremiumUI';

interface SettingsPanelProps {
  settings?: AppSettings;
  providers: ProviderDescriptor[];
  providerProfiles: ProviderAccountProfile[];
  profiles: AgentProfile[];
  credentials: ProviderCredentialStatus[];
  sessions: AgentSession[];
  localRuntime?: LocalRuntimeSnapshot;
  healthCheck?: AppHealthCheck;
  healthLoading: boolean;
  onChange: (next: AppSettings) => Promise<void>;
  onTestProvider: (providerId: string) => Promise<ProviderRuntimeStatus>;
  onSaveProviderProfileCredential: (
    providerId: string,
    profileId: string | undefined,
    name: string,
    key: string,
    makeDefault: boolean,
  ) => Promise<ProviderAccountProfile>;
  onRemoveProviderCredential: (providerId: string) => Promise<ProviderCredentialStatus>;
  onRemoveProviderProfile: (profileId: string) => Promise<void>;
  onSetDefaultProviderProfile: (providerId: string, profileId: string) => Promise<void>;
  onRenameProviderProfile: (profileId: string, name: string) => Promise<void>;
  onInstallRuntime: () => Promise<void>;
  onStartRuntime: () => Promise<void>;
  onRunHealthCheck: () => Promise<AppHealthCheck>;
  onOpenEnvironment?: (tab: EnvironmentTab) => void;
  initialTab?: SettingsTab;
}

export type SettingsTab =
  | 'general'
  | 'ai'
  | 'providers'
  | 'accounts'
  | 'local'
  | 'terminal'
  | 'sessions'
  | 'approvals'
  | 'files'
  | 'status'
  | 'prompt'
  | 'tasks'
  | 'memory'
  | 'diagnostics'
  | 'advanced';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: 'Configurações' },
  { id: 'ai', label: 'IA' },
  { id: 'accounts', label: 'Contas' },
  { id: 'local', label: 'Modelos locais' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'sessions', label: 'Sessões' },
  { id: 'approvals', label: 'Aprovações' },
  { id: 'files', label: 'Arquivos' },
  { id: 'status', label: 'Status' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'tasks', label: 'Tarefas' },
  { id: 'memory', label: 'Memória' },
  { id: 'diagnostics', label: 'Diagnóstico' },
  { id: 'advanced', label: 'Avançado' },
];

const PROVIDER_SETUP: Record<string, { url?: string; instruction: string; docsLabel: string }> = {
  'openai-api': {
    url: 'https://platform.openai.com/api-keys',
    instruction: 'Crie ou copie uma API key da plataforma OpenAI e salve no modal.',
    docsLabel: 'Ver documentação',
  },
  'openrouter-api': {
    url: 'https://openrouter.ai/keys',
    instruction: 'Abra as chaves do OpenRouter e gere uma key para este app.',
    docsLabel: 'Ver documentação',
  },
  'anthropic-api': {
    url: 'https://console.anthropic.com/settings/keys',
    instruction: 'Abra o console Anthropic e crie uma API key.',
    docsLabel: 'Ver documentação',
  },
  'gemini-api': {
    url: 'https://aistudio.google.com/apikey',
    instruction: 'Abra o Google AI Studio e gere uma Gemini API key.',
    docsLabel: 'Ver documentação',
  },
  'gemini-cli': {
    url: 'https://aistudio.google.com/apikey',
    instruction: 'Configure GEMINI_API_KEY, GOOGLE_API_KEY ou Application Default Credentials e verifique o CLI.',
    docsLabel: 'Abrir API keys',
  },
  'opencode-zen': {
    url: 'https://opencode.ai/zen',
    instruction: 'Faça login no OpenCode Zen e volte para verificar a conexão.',
    docsLabel: 'Abrir login',
  },
  'codex-cli': {
    instruction: 'Autentique o Codex CLI fora do app e use Verificar login para validar o adapter.',
    docsLabel: 'Verificar CLI',
  },
};

const STATUS_LABELS: Record<ProviderStatusState, string> = {
  mock: 'mock',
  unavailable: 'indisponível',
  not_configured: 'não configurado',
  ready: 'pronto',
  running: 'testando',
  error: 'erro',
  requires_api_key: 'requer API key',
  invalid_api_key: 'API key inválida',
  forbidden: 'sem permissão',
  requires_login: 'requer login',
  requires_oauth: 'requer OAuth',
  requires_cli_auth: 'fazer login via CLI',
  not_installed: 'não instalado',
  service_offline: 'serviço offline',
  api_unreachable: 'API offline',
  model_missing: 'modelo ausente',
  installing: 'instalando',
  pulling: 'baixando',
  testing: 'testando',
  quota_exceeded: 'cota excedida',
  rate_limited: 'rate limited',
  provider_unavailable: 'provider instável',
  misconfigured: 'mal configurado',
  experimental: 'experimental',
};

function statusTone(state: ProviderStatusState): 'neutral' | 'info' | 'warn' | 'danger' | 'ok' {
  if (state === 'ready') return 'ok';
  if (state === 'running' || state === 'testing' || state === 'installing' || state === 'pulling') return 'info';
  if (state === 'error' || state === 'api_unreachable' || state === 'quota_exceeded' || state === 'invalid_api_key' || state === 'forbidden' || state === 'provider_unavailable') return 'danger';
  if (state === 'mock' || state === 'unavailable' || state === 'not_configured') return 'warn';
  return 'warn';
}

function credentialFor(providerId: string, credentials: ProviderCredentialStatus[]): ProviderCredentialStatus | undefined {
  return credentials.find((credential) => credential.providerId === providerId);
}

function authTypeForProvider(provider: ProviderDescriptor): ProviderAuthType {
  if (provider.id === 'local-ollama') return 'local';
  if (provider.status.state === 'requires_cli_auth') return 'cli_auth';
  if (provider.status.state === 'requires_oauth') return 'oauth';
  if (provider.status.state === 'requires_login') return 'login';
  if (provider.configurable) return 'api_key';
  return 'none';
}

function accountStatusFromProvider(state: ProviderStatusState): ProviderAccountProfile['status'] {
  if (state === 'ready') return 'ready';
  if (state === 'requires_api_key') return 'requires_api_key';
  if (state === 'invalid_api_key') return 'invalid_api_key';
  if (state === 'forbidden') return 'forbidden';
  if (state === 'requires_login') return 'requires_login';
  if (state === 'requires_oauth') return 'requires_oauth';
  if (state === 'requires_cli_auth') return 'requires_cli_auth';
  if (state === 'testing' || state === 'running') return 'testing';
  if (state === 'quota_exceeded') return 'quota_exceeded';
  if (state === 'rate_limited') return 'rate_limited';
  if (state === 'provider_unavailable') return 'provider_unavailable';
  if (state === 'experimental' || state === 'mock') return 'experimental';
  if (state === 'misconfigured' || state === 'not_configured') return 'misconfigured';
  return 'unavailable';
}

function actionLabelForStatus(state: ProviderStatusState): string {
  if (state === 'ready') return 'Testar conexão';
  if (state === 'requires_api_key') return 'Adicionar API key';
  if (state === 'invalid_api_key') return 'Trocar API key';
  if (state === 'forbidden') return 'Trocar conta';
  if (state === 'requires_login') return 'Fazer login';
  if (state === 'requires_oauth') return 'Fazer login';
  if (state === 'requires_cli_auth') return 'Fazer login via CLI';
  if (state === 'testing' || state === 'running') return 'Testar conexão';
  if (state === 'quota_exceeded') return 'Trocar modelo/conta';
  if (state === 'rate_limited') return 'Aguardar ou trocar';
  if (state === 'provider_unavailable') return 'Tentar novamente';
  if (state === 'misconfigured' || state === 'not_configured') return 'Corrigir configuração';
  if (state === 'experimental' || state === 'mock') return 'Configurar';
  return 'Indisponível';
}

export function SettingsPanel({
  settings,
  providers,
  providerProfiles,
  profiles,
  credentials,
  sessions,
  localRuntime,
  healthCheck,
  healthLoading,
  onChange,
  onTestProvider,
  onSaveProviderProfileCredential,
  onRemoveProviderCredential,
  onRemoveProviderProfile,
  onSetDefaultProviderProfile,
  onRenameProviderProfile,
  onInstallRuntime,
  onStartRuntime,
  onRunHealthCheck,
  onOpenEnvironment,
  initialTab,
}: SettingsPanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab === 'providers' ? 'ai' : initialTab ?? 'general');
  const [testingProviderId, setTestingProviderId] = useState<string>();
  const [savingProviderId, setSavingProviderId] = useState<string>();
  const [credentialInputs, setCredentialInputs] = useState<Record<string, string>>({});
  const [profileNameInputs, setProfileNameInputs] = useState<Record<string, string>>({});
  const [inlineError, setInlineError] = useState<string>();
  const [credentialProviderId, setCredentialProviderId] = useState<string>();
  const [credentialProfileId, setCredentialProfileId] = useState<string>();
  const [defaultCredential, setDefaultCredential] = useState(true);
  const [loginCheckProviderId, setLoginCheckProviderId] = useState<string>();
  const [providerMenuId, setProviderMenuId] = useState<string>();
  const [profileMenuId, setProfileMenuId] = useState<string>();
  const [renameProfile, setRenameProfile] = useState<ProviderAccountProfile>();

  const selectedProvider = useMemo(() => {
    return providers.find((item) => item.id === settings?.selectedProviderId);
  }, [providers, settings?.selectedProviderId]);

  const accountProfiles = useMemo<ProviderAccountProfile[]>(() => {
    if (providerProfiles.length > 0) return providerProfiles;
    return providers.map((provider) => {
      const credential = credentialFor(provider.id, credentials);
      const id = `${provider.id}:default`;
      return {
        id,
        providerId: provider.id,
        providerLabel: provider.label,
        name: credential?.source === 'environment' ? 'Ambiente' : 'Padrão',
        authType: authTypeForProvider(provider),
        status: accountStatusFromProvider(provider.status.state),
        maskedCredential: credential?.maskedKey,
        source: credential?.source,
        lastTestedAt: provider.status.checkedAt,
        lastValidatedAt: provider.status.checkedAt,
        defaultModelId: provider.models[0]?.id,
        isDefault: settings?.selectedProviderProfileId === id || (!settings?.selectedProviderProfileId && provider.id === settings?.selectedProviderId),
        message: credential?.hasCredential ? provider.status.message : errorForStatus(provider.status.state, provider.status.message).message,
      };
    });
  }, [credentials, providerProfiles, providers, settings?.selectedProviderId, settings?.selectedProviderProfileId]);

  if (!settings) {
    return (
      <section className="panel settings-panel">
        <header className="panel-header">
          <h2>Configurações</h2>
        </header>
        <div className="panel-body empty-state empty-state-inline">
          <strong>Carregando</strong>
          <span>Configurações ainda indisponíveis.</span>
        </div>
      </section>
    );
  }

  const resolvedSettings = settings;

  const credentialProvider = providers.find((provider) => provider.id === credentialProviderId);
  const credentialModalInput = credentialProviderId ? credentialInputs[credentialProviderId] ?? '' : '';
  const credentialModalName = credentialProviderId ? profileNameInputs[credentialProviderId] ?? '' : '';
  const credentialInvalid = credentialModalInput.trim().length > 0 && credentialModalInput.trim().length < 12;

  function openCredentialModal(providerId: string, profile?: ProviderAccountProfile): void {
    setInlineError(undefined);
    setCredentialProviderId(providerId);
    setCredentialProfileId(profile?.id);
    setDefaultCredential(profile?.isDefault ?? true);
    setProfileNameInputs((current) => ({
      ...current,
      [providerId]: profile?.name ?? current[providerId] ?? 'Conta Principal',
    }));
    setCredentialInputs((current) => ({
      ...current,
      [providerId]: '',
    }));
  }

  async function testProviderWithTimeout(providerId: string): Promise<ProviderRuntimeStatus> {
    let timeoutId: number | undefined;
    try {
      return await Promise.race([
        onTestProvider(providerId),
        new Promise<ProviderRuntimeStatus>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('provider_test_timeout')), 5000);
        }),
      ]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }

  async function testProvider(providerId: string): Promise<void> {
    setInlineError(undefined);
    setTestingProviderId(providerId);
    try {
      const status = await testProviderWithTimeout(providerId);
      if (status.state !== 'ready') {
        setInlineError(errorForStatus(status.state, status.message).message);
      }
    } catch (cause) {
      setInlineError(translateError(cause instanceof Error ? cause.message : 'provider_test_failed').message);
    } finally {
      setTestingProviderId(undefined);
    }
  }

  async function saveProfileCredential(providerId: string): Promise<void> {
    setInlineError(undefined);
    setSavingProviderId(providerId);
    const input = credentialInputs[providerId] ?? '';
    const name = profileNameInputs[providerId] ?? 'Conta';
    if (input.trim().length < 12) {
      setInlineError('API key curta ou vazia. Cole a chave completa e tente de novo.');
      setSavingProviderId(undefined);
      return;
    }
    try {
      await onSaveProviderProfileCredential(providerId, credentialProfileId, name, input, defaultCredential);
      setCredentialInputs((current) => ({ ...current, [providerId]: '' }));
      setProfileNameInputs((current) => ({ ...current, [providerId]: '' }));
      setCredentialProviderId(undefined);
      setCredentialProfileId(undefined);
    } catch (cause) {
      setInlineError(translateError(cause instanceof Error ? cause.message : 'missing_api_key').message);
    } finally {
      setSavingProviderId(undefined);
    }
  }

  async function openProviderLogin(provider: ProviderDescriptor): Promise<void> {
    setInlineError(undefined);
    const setup = PROVIDER_SETUP[provider.id];
    if (!setup?.url) {
      setInlineError(setup?.instruction ?? 'Provider exige autenticação externa antes de verificar.');
      setLoginCheckProviderId(provider.id);
      return;
    }
    try {
      await openExternalUrl(setup.url);
      setLoginCheckProviderId(provider.id);
    } catch (cause) {
      setInlineError(translateError(cause instanceof Error ? cause.message : 'external_url_failed').message);
    }
  }

  function statusDotTone(state: ProviderStatusState | ProviderAccountProfile['status']): 'ready' | 'warning' | 'error' | 'offline' | 'info' {
    if (state === 'ready') return 'ready';
    if (state === 'running' || state === 'testing' || state === 'installing' || state === 'pulling') return 'info';
    if (state === 'error' || state === 'quota_exceeded' || state === 'rate_limited' || state === 'misconfigured' || state === 'invalid_api_key' || state === 'forbidden' || state === 'provider_unavailable') return 'error';
    if (state === 'unavailable') return 'offline';
    return 'warning';
  }

  async function copyDiagnostics(): Promise<void> {
    const payload = {
      baseDir: healthCheck?.baseDir ?? resolvedSettings.workspaceRoot,
      expectedBaseDir: healthCheck?.expectedBaseDir,
      correctBaseDir: healthCheck?.correctBaseDir,
      providers: (healthCheck?.providers ?? []).map((provider) => ({
        id: provider.id,
        status: provider.status.state,
        hasKey: provider.hasKey,
        profileCount: provider.profileCount,
        selectedProfileId: provider.selectedProfileId,
      })),
      profiles: accountProfiles.map((profile) => ({
        id: profile.id,
        providerId: profile.providerId,
        name: profile.name,
        authType: profile.authType,
        status: profile.status,
        source: profile.source,
        hasCredential: Boolean(profile.maskedCredential),
        isDefault: profile.isDefault,
        defaultModelId: profile.defaultModelId,
      })),
      ollama: healthCheck?.ollama ?? localRuntime,
      terminal: {
        preferredShell: resolvedSettings.preferredShell,
        autoApproveSafeRead: resolvedSettings.autoApproveSafeRead,
        sudoPolicy: 'sudo -S bloqueado; confirmação explícita para privilegiados',
        pkexecAvailable: healthCheck?.ollama.hasPkexec ?? localRuntime?.hasPkexec,
        sudoAvailable: healthCheck?.ollama.hasSudo ?? localRuntime?.hasSudo,
      },
      sessions: {
        count: healthCheck?.sessionsCount ?? sessions.length,
        storageRoot: healthCheck?.storageRoot ?? `${resolvedSettings.codexRoot}/sessions`,
      },
      recentErrors: healthCheck?.recentErrors ?? [],
      actions: healthCheck?.actions ?? [],
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setInlineError(undefined);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'clipboard indisponível';
      setInlineError(`Não foi possível copiar diagnóstico. Detalhe: ${detail}`);
    }
  }

  return (
    <section className="panel settings-panel settings-premium">
      <header className="panel-header">
        <h2>Configurações</h2>
      </header>

      <div className="settings-shell">
        <nav className="settings-nav" aria-label="Configurações">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {inlineError ? (
            <div className="input-error-tip" role="alert">
              {inlineError}
            </div>
          ) : null}

          {activeTab === 'general' ? (
            <div className="settings-card-grid">
              {[
                ['ai', 'IA e modelos', `${settings.executionMode === 'local' ? 'Local' : 'Nuvem'} · ${settings.selectedModelId}`],
                ['accounts', 'Contas e autenticação', `${accountProfiles.filter((profile) => profile.status === 'ready').length} profile(s) pronto(s)`],
                ['terminal', 'Terminal e permissões', `${settings.preferredShell} · sudo controlado`],
                ['sessions', 'Sessões', `${sessions.length} conversa(s) salva(s)`],
                ['advanced', 'Aparência', 'Preto sólido + azul End-4'],
                ['diagnostics', 'Diagnóstico', healthCheck?.overallStatus ?? 'pendente'],
                ['advanced', 'Avançado', settings.workspaceRoot],
              ].map(([tab, title, status]) => (
                <button
                  key={`${tab}-${title}`}
                  type="button"
                  className="settings-card settings-card-button"
                  onClick={() => setActiveTab(tab as SettingsTab)}
                >
                  <span className="settings-card-icon">&gt;</span>
                  <strong>{title}</strong>
                  <span>{status}</span>
                </button>
              ))}
            </div>
          ) : null}

          {activeTab === 'ai' && onOpenEnvironment ? (
            <div className="settings-grid">
              <section className="settings-card settings-card-button">
                <strong>Ambiente</strong>
                <span>Modelos, API key, login e padrão global ficam em um único fluxo.</span>
                <button type="button" className="btn-modern btn-modern-primary" onClick={() => onOpenEnvironment('configure')}>
                  Abrir Ambiente
                </button>
              </section>
            </div>
          ) : null}

          {activeTab === 'ai' && !onOpenEnvironment ? (
            <div className="provider-settings-list">
              {providers.map((provider) => {
                const credential = credentialFor(provider.id, credentials);
                const action = errorForStatus(provider.status.state, provider.status.message);
                const authType = authTypeForProvider(provider);
                const primaryAction = actionLabelForStatus(provider.status.state);
                const loginVisible = loginCheckProviderId === provider.id;
                const providerActionDisabled =
                  testingProviderId === provider.id ||
                  provider.status.state === 'unavailable' ||
                  provider.status.state === 'experimental' ||
                  provider.status.state === 'mock';
                const handlePrimaryAction = (): void => {
                  if (provider.status.state === 'ready') {
                    void testProvider(provider.id);
                    return;
                  }
                  if (provider.status.state === 'requires_api_key') {
                    openCredentialModal(provider.id);
                    return;
                  }
                  if (provider.status.state === 'requires_login' || provider.status.state === 'requires_oauth') {
                    void openProviderLogin(provider);
                    return;
                  }
                  if (provider.status.state === 'requires_cli_auth' || provider.status.state === 'testing' || provider.status.state === 'running') {
                    void testProvider(provider.id);
                    return;
                  }
                  setInlineError(`${provider.label}: ${action.message}`);
                };
                return (
                  <section key={provider.id} className={`settings-card provider-settings-card provider-status-${statusTone(provider.status.state)}`}>
                    <div className="row-between">
                      <div className="provider-card-heading">
                        <StatusDot tone={statusDotTone(provider.status.state)} />
                        <strong>{provider.label}</strong>
                        <span>{STATUS_LABELS[provider.status.state]}</span>
                        <span>Auth: {authType.replace('_', ' ')}</span>
                        {provider.status.version ? <span>{provider.status.version}</span> : null}
                      </div>
                      <div className="settings-actions-inline settings-actions-menu">
                        <button
                          type="button"
                          className={`btn-modern ${provider.status.state === 'ready' ? '' : 'btn-modern-primary'}`}
                          disabled={providerActionDisabled}
                          onClick={handlePrimaryAction}
                        >
                          {testingProviderId === provider.id ? 'Testando' : primaryAction}
                        </button>
                        <div className="popup-anchor">
                          <button
                            type="button"
                            className="kebab-button"
                            aria-label={`Ações de ${provider.label}`}
                            onClick={() => setProviderMenuId((current) => current === provider.id ? undefined : provider.id)}
                          >
                            ⋮
                          </button>
                          <PopupMenu open={providerMenuId === provider.id} onClose={() => setProviderMenuId(undefined)}>
                            <button type="button" onClick={() => { setProviderMenuId(undefined); void testProvider(provider.id); }}>
                              Testar conexão
                            </button>
                            {provider.configurable && provider.id !== 'local-ollama' ? (
                              <button type="button" onClick={() => { setProviderMenuId(undefined); openCredentialModal(provider.id); }}>
                                Adicionar API key
                              </button>
                            ) : null}
                            {provider.status.state === 'requires_login' || provider.status.state === 'requires_oauth' ? (
                              <button type="button" onClick={() => { setProviderMenuId(undefined); void openProviderLogin(provider); }}>
                                Fazer login
                              </button>
                            ) : null}
                            {credential?.hasCredential ? (
                              <button type="button" className="danger" onClick={() => { setProviderMenuId(undefined); void onRemoveProviderCredential(provider.id); }}>
                                Remover credencial
                              </button>
                            ) : null}
                          </PopupMenu>
                        </div>
                      </div>
                    </div>
                    {loginVisible ? (
                      <div className="inline-alert inline-alert-action">
                        <span>{PROVIDER_SETUP[provider.id]?.instruction ?? 'Finalize o login e volte para verificar.'}</span>
                        <button type="button" className="btn-modern btn-modern-primary" onClick={() => void testProvider(provider.id)}>
                          Verificar login
                        </button>
                      </div>
                    ) : null}

                    <details className="settings-details">
                      <summary>Detalhes</summary>
                      <p>{provider.status.message}</p>
                      {provider.status.command ? <code>{provider.status.command}</code> : null}
                      <div className="inline-alert">
                        {credential?.hasCredential ? `Credencial: ${credential.maskedKey} (${credential.source ?? 'local'})` : action.message}
                      </div>
                    </details>
                  </section>
                );
              })}
            </div>
          ) : null}

          {activeTab === 'accounts' && onOpenEnvironment ? (
            <div className="settings-grid">
              <section className="settings-card settings-card-button">
                <strong>Contas no Ambiente</strong>
                <span>Profiles, padrão por provider e teste real ficam na aba Contas do Ambiente.</span>
                <button type="button" className="btn-modern btn-modern-primary" onClick={() => onOpenEnvironment('accounts')}>
                  Abrir Contas
                </button>
              </section>
            </div>
          ) : null}

          {activeTab === 'accounts' && !onOpenEnvironment ? (
            <div className="provider-settings-list">
              {accountProfiles.map((profile) => {
                const lastProfileTest = profile.lastTestedAt ?? profile.lastValidatedAt;
                return (
                <section key={profile.id} className={`settings-card provider-settings-card provider-status-${statusTone(profile.status)}`}>
                  <div className="row-between">
                    <div className="provider-card-heading">
                      <StatusDot tone={statusDotTone(profile.status)} />
                      <strong>{profile.providerLabel} · {profile.name}</strong>
                      <span>{profile.status.replace('_', ' ')}</span>
                      <span>Tipo: {profile.authType.replace('_', ' ')}</span>
                      <span>Última validação: {lastProfileTest ? new Date(lastProfileTest).toLocaleString('pt-BR') : 'nunca'}</span>
                      <span>Modelo padrão: {profile.defaultModelId ?? 'não definido'}</span>
                    </div>
                    <div className="popup-anchor">
                      <button
                        type="button"
                        className="kebab-button"
                        aria-label={`Ações de ${profile.name}`}
                        onClick={() => setProfileMenuId((current) => current === profile.id ? undefined : profile.id)}
                      >
                        ⋮
                      </button>
                      <PopupMenu open={profileMenuId === profile.id} onClose={() => setProfileMenuId(undefined)}>
                        <button type="button" onClick={() => { setProfileMenuId(undefined); openCredentialModal(profile.providerId, profile); }}>
                          Editar
                        </button>
                        <button type="button" onClick={() => { setProfileMenuId(undefined); void onSetDefaultProviderProfile(profile.providerId, profile.id); }}>
                          Tornar padrão
                        </button>
                        <button type="button" onClick={() => { setProfileMenuId(undefined); void testProvider(profile.providerId); }}>
                          Testar
                        </button>
                        <button type="button" onClick={() => { setProfileMenuId(undefined); setRenameProfile(profile); }}>
                          Renomear
                        </button>
                        <button
                          type="button"
                          disabled={!profile.maskedCredential || profile.source === 'environment'}
                          onClick={() => { setProfileMenuId(undefined); void onRemoveProviderProfile(profile.id); }}
                        >
                          Remover
                        </button>
                      </PopupMenu>
                    </div>
                  </div>
                  <p>{profile.message}</p>
                  <div className="inline-alert">
                    {profile.maskedCredential
                      ? `Credencial mascarada: ${profile.maskedCredential} (${profile.source ?? 'local'})`
                      : 'Nenhum segredo salvo para este profile.'}
                  </div>
                  <span>Credencial isolada por profile no store local; keyring/plataforma segura ainda é pendência explícita.</span>
                </section>
                );
              })}
            </div>
          ) : null}

          {activeTab === 'local' && onOpenEnvironment ? (
            <div className="settings-grid">
              <section className="settings-card settings-card-button">
                <strong>Modelos locais no Ambiente</strong>
                <span>Ollama, modelos instalados e compatibilidade do hardware ficam na aba Locais.</span>
                <button type="button" className="btn-modern btn-modern-primary" onClick={() => onOpenEnvironment('local')}>
                  Abrir Locais
                </button>
              </section>
            </div>
          ) : null}

          {activeTab === 'local' && !onOpenEnvironment ? (
            <div className="settings-grid">
              <section className="settings-card">
                <strong>Runtime Ollama</strong>
                <span>{localRuntime?.message ?? 'Runtime ainda não consultado.'}</span>
                <span>API: {localRuntime?.apiUrl ?? 'http://127.0.0.1:11434'}</span>
                <span>Serviço: {localRuntime?.serviceActive ? 'ativo' : 'offline'}</span>
                <span>API local: {localRuntime?.apiReachable ? 'online' : 'offline'}</span>
                <div className="settings-actions-row">
                  <button type="button" className="btn-modern" onClick={() => void onInstallRuntime()}>
                    Instalar runtime
                  </button>
                  <button type="button" className="btn-modern btn-modern-primary" onClick={() => void onStartRuntime()}>
                    Iniciar serviço
                  </button>
                </div>
              </section>
              <section className="settings-card">
                <strong>Modelos instalados</strong>
                {localRuntime?.installedModels.length ? (
                  localRuntime.installedModels.map((model) => <span key={model.id}>{model.id} {model.size ? `• ${model.size}` : ''}</span>)
                ) : (
                  <span>Nenhum modelo local instalado.</span>
                )}
              </section>
              <section className="settings-card">
                <strong>Compatibilidade deste PC</strong>
                <span>Base: Ryzen 5 5500, RX 7600, 16 GB RAM.</span>
                <span>Recomendado: 1.5B, 3B e 7B. 14B exige caveat. 32B+ fica pesado/não recomendado.</span>
                <span>Filtro “Compatíveis com meu PC” no seletor esconde modelos não recomendados.</span>
              </section>
              <section className="settings-card">
                <strong>Reparo</strong>
                {(localRuntime?.repairActions ?? ['sudo pacman -S --needed ollama']).map((action) => <code key={action}>{action}</code>)}
              </section>
            </div>
          ) : null}

          {activeTab === 'sessions' ? (
            <div className="settings-grid">
              <section className="settings-card">
                <strong>Sessões</strong>
                <span>Total salvo: {sessions.length}</span>
                <span>Uma conversa nova só vira arquivo após a primeira mensagem.</span>
                <span>Exportação disponível em `.md`, `.json` e `.txt` no menu da sessão.</span>
              </section>
              {sessions.slice(0, 8).map((session) => (
                <section key={session.id} className="settings-card">
                  <strong>{session.title}</strong>
                  <span>{session.messages.length} mensagens · {session.status.replace('_', ' ')}</span>
                  <span>Atualizada: {new Date(session.updatedAt).toLocaleString('pt-BR')}</span>
                  <span>Modelo/provider: {session.providerId ?? 'não definido'} / {session.modelId ?? 'não definido'}</span>
                </section>
              ))}
            </div>
          ) : null}

          {activeTab === 'terminal' ? (
            <div className="settings-grid">
              <section className="settings-card">
                <strong>Terminal real</strong>
                <label>
                  Shell preferido
                  <input value={settings.preferredShell} onChange={(event) => void onChange({ ...settings, preferredShell: event.target.value })} />
                </label>
                <span>stdout/stderr são capturados em `command-log` e exibidos no drawer.</span>
                <span>Comando fora da política vira aprovação pendente, não execução silenciosa.</span>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={settings.autoApproveSafeRead}
                    onChange={(event) => void onChange({ ...settings, autoApproveSafeRead: event.target.checked })}
                  />
                  Auto-aprovar leitura segura
                </label>
              </section>
              <section className="settings-card">
                <strong>sudo / pkexec</strong>
                <span>sudo -S bloqueado; pkexec/helper para ações privilegiadas.</span>
                <span>Confirmação exigida para comandos destrutivos, escrita fora do workspace e alteração crítica.</span>
                <span>sudo disponível: {localRuntime?.hasSudo ? 'sim' : 'não detectado'}</span>
                <span>pkexec disponível: {localRuntime?.hasPkexec ? 'sim' : 'não detectado'}</span>
              </section>
              <section className="settings-card">
                <strong>Agente</strong>
                <label>
                  Perfil
                  <select value={settings.selectedAgentId} onChange={(event) => void onChange({ ...settings, selectedAgentId: event.target.value })}>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            </div>
          ) : null}

          {activeTab === 'approvals' || activeTab === 'files' || activeTab === 'status' || activeTab === 'prompt' || activeTab === 'tasks' || activeTab === 'memory' ? (
            <div className="settings-grid">
              <section className="settings-card">
                <strong>{SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label}</strong>
                <span>Esta aba fica no modal central para consulta ampla, sem esmagar o inspector lateral.</span>
                <span>Use o painel correspondente na tela principal para operar itens em tempo real.</span>
              </section>
            </div>
          ) : null}

          {activeTab === 'diagnostics' ? (
            <div className="settings-grid">
              <section className="settings-card health-card">
                <div className="row-between">
                  <strong>Health Check</strong>
                  <button
                    type="button"
                    className="btn-modern btn-modern-primary"
                    disabled={healthLoading}
                    onClick={() => void onRunHealthCheck()}
                  >
                    {healthLoading ? 'Rodando' : 'Rodar health check'}
                  </button>
                  <button type="button" className="btn-modern" onClick={() => void copyDiagnostics()}>
                    Copiar diagnóstico
                  </button>
                </div>
                <span>Status: {healthCheck?.overallStatus ?? 'não executado'}</span>
                <span>Base: {healthCheck?.baseDir ?? settings.workspaceRoot}</span>
                <span>Projeto correto: {healthCheck?.correctBaseDir ? 'sim' : 'pendente de checagem'}</span>
                <span>Node/npm/cargo/tauri: {healthCheck ? `${healthCheck.nodeOk}/${healthCheck.npmOk}/${healthCheck.cargoOk}/${healthCheck.tauriOk}` : 'pendente'}</span>
                <span>Providers/profiles: {healthCheck ? `${healthCheck.providers.length}/${accountProfiles.length}` : 'pendente'}</span>
                <span>Sessões/storage: {healthCheck?.sessionsCount ?? sessions.length} · {healthCheck?.storageRoot ?? `${settings.codexRoot}/sessions`}</span>
                <span>Credenciais: {healthCheck?.credentialsEncrypted ? 'keyring/criptografado' : 'arquivo local mascarado na UI; keyring pendente'}</span>
                <span>Ollama: {healthCheck?.ollama.state ?? localRuntime?.state ?? 'pendente'} · API {healthCheck?.ollama.apiReachable ?? localRuntime?.apiReachable ? 'online' : 'offline'}</span>
                <span>Terminal: {settings.preferredShell} · sudo {healthCheck?.ollama.hasSudo ?? localRuntime?.hasSudo ? 'detectado' : 'não detectado'} · pkexec {healthCheck?.ollama.hasPkexec ?? localRuntime?.hasPkexec ? 'detectado' : 'não detectado'}</span>
                <details>
                  <summary>Providers</summary>
                  {(healthCheck?.providers ?? []).map((provider) => (
                    <span key={provider.id}>
                      {provider.id}: {provider.status.state.replace('_', ' ')} · key {provider.hasKey ? 'presente' : 'ausente'}
                    </span>
                  ))}
                </details>
                <details>
                  <summary>Ações recomendadas</summary>
                  {(healthCheck?.actions ?? []).length === 0 ? <p>Nenhuma ação carregada.</p> : null}
                  {(healthCheck?.actions ?? []).map((action) => (
                    <code key={`${action.label}-${action.command ?? ''}`}>{action.command ?? action.label}</code>
                  ))}
                </details>
              </section>
            </div>
          ) : null}

          {activeTab === 'advanced' ? (
            <div className="settings-grid">
              <section className="settings-card">
                <strong>Paths</strong>
                <span>Config/cache: {settings.codexRoot}/codex-ui</span>
                <span>Modelos: {settings.localModelsRoot}</span>
                <span>Provider selecionado: {selectedProvider?.label ?? settings.selectedProviderId}</span>
              </section>
              <section className="settings-card">
                <strong>Reset seguro</strong>
                <span>Reset de credenciais/providers exige ação explícita por provider.</span>
                <span>Estado local pode ser limpo sem tocar na base antiga.</span>
              </section>
            </div>
          ) : null}
        </div>
      </div>

      <PremiumModal
        open={Boolean(credentialProvider)}
        title={`Configurar ${credentialProvider?.label ?? 'provider'}`}
        description={credentialProvider ? PROVIDER_SETUP[credentialProvider.id]?.instruction : undefined}
        onClose={() => {
          setCredentialProviderId(undefined);
          setCredentialProfileId(undefined);
        }}
        className="compact-modal"
      >
        {credentialProvider ? (
          <div className="credential-modal-form">
            <label>
              Nome da conta
              <input
                value={credentialModalName}
                placeholder="Conta Principal"
                onChange={(event) => setProfileNameInputs((current) => ({ ...current, [credentialProvider.id]: event.target.value }))}
              />
            </label>
            <label>
              API Key
              <CredentialInput
                value={credentialModalInput}
                placeholder={credentialFor(credentialProvider.id, credentials)?.maskedKey ?? 'Cole a API key'}
                invalid={credentialInvalid}
                onBlur={() => {
                  if (credentialInvalid) setInlineError('API key curta. Confira se a chave foi colada inteira.');
                }}
                onChange={(value) => setCredentialInputs((current) => ({ ...current, [credentialProvider.id]: value }))}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={defaultCredential}
                onChange={(event) => setDefaultCredential(event.target.checked)}
              />
              Tornar padrão para este provider
            </label>
            <div className="dialog-actions">
              <button type="button" className="btn-modern" onClick={() => void testProvider(credentialProvider.id)} disabled={testingProviderId === credentialProvider.id}>
                {testingProviderId === credentialProvider.id ? 'Testando' : 'Testar conexão'}
              </button>
              <button
                type="button"
                className="btn-modern btn-modern-primary"
                disabled={savingProviderId === credentialProvider.id || credentialInvalid || credentialModalInput.trim().length === 0}
                onClick={() => void saveProfileCredential(credentialProvider.id)}
              >
                {savingProviderId === credentialProvider.id ? 'Salvando' : 'Salvar'}
              </button>
              <button type="button" className="btn-modern" onClick={() => setCredentialProviderId(undefined)}>
                Cancelar
              </button>
            </div>
            {inlineError ? (
              <div className="inline-alert inline-alert-action">
                <span>{inlineError}</span>
                {PROVIDER_SETUP[credentialProvider.id]?.url ? (
                  <button type="button" className="btn-modern" onClick={() => void openProviderLogin(credentialProvider)}>
                    {PROVIDER_SETUP[credentialProvider.id]?.docsLabel ?? 'Ver documentação'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </PremiumModal>

      <PremiumModal
        open={Boolean(renameProfile)}
        title="Renomear conta"
        onClose={() => setRenameProfile(undefined)}
        className="compact-modal"
      >
        {renameProfile ? (
          <div className="credential-modal-form">
            <label>
              Nome da conta
              <input
                value={profileNameInputs[renameProfile.providerId] ?? renameProfile.name}
                onChange={(event) => setProfileNameInputs((current) => ({ ...current, [renameProfile.providerId]: event.target.value }))}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="btn-modern" onClick={() => setRenameProfile(undefined)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-modern btn-modern-primary"
                onClick={() => {
                  const name = profileNameInputs[renameProfile.providerId] ?? renameProfile.name;
                  void onRenameProviderProfile(renameProfile.id, name);
                  setRenameProfile(undefined);
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        ) : null}
      </PremiumModal>
    </section>
  );
}
