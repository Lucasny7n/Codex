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
import { errorForStatus, translateError } from '../../lib/errorTranslator';

interface SettingsPanelProps {
  settings?: AppSettings;
  providers: ProviderDescriptor[];
  profiles: AgentProfile[];
  credentials: ProviderCredentialStatus[];
  sessions: AgentSession[];
  localRuntime?: LocalRuntimeSnapshot;
  healthCheck?: AppHealthCheck;
  healthLoading: boolean;
  onChange: (next: AppSettings) => Promise<void>;
  onTestProvider: (providerId: string) => Promise<ProviderRuntimeStatus>;
  onSaveProviderCredential: (providerId: string, key: string) => Promise<ProviderCredentialStatus>;
  onRemoveProviderCredential: (providerId: string) => Promise<ProviderCredentialStatus>;
  onInstallRuntime: () => Promise<void>;
  onStartRuntime: () => Promise<void>;
  onRunHealthCheck: () => Promise<AppHealthCheck>;
  initialTab?: SettingsTab;
}

export type SettingsTab =
  | 'general'
  | 'providers'
  | 'accounts'
  | 'local'
  | 'sessions'
  | 'execution'
  | 'permissions'
  | 'appearance'
  | 'diagnostics'
  | 'advanced';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: 'Geral' },
  { id: 'providers', label: 'IA / Providers' },
  { id: 'accounts', label: 'Contas / Profiles' },
  { id: 'local', label: 'Modelos locais' },
  { id: 'sessions', label: 'Sessões' },
  { id: 'execution', label: 'Execução' },
  { id: 'permissions', label: 'Permissões' },
  { id: 'appearance', label: 'Aparência' },
  { id: 'diagnostics', label: 'Diagnóstico' },
  { id: 'advanced', label: 'Avançado' },
];

const STATUS_LABELS: Record<ProviderStatusState, string> = {
  mock: 'mock',
  unavailable: 'indisponível',
  not_configured: 'não configurado',
  ready: 'pronto',
  running: 'testando',
  error: 'erro',
  requires_api_key: 'requer API key',
  requires_login: 'requer login',
  requires_oauth: 'requer OAuth',
  requires_cli_auth: 'validar CLI',
  not_installed: 'não instalado',
  service_offline: 'serviço offline',
  api_unreachable: 'API offline',
  model_missing: 'modelo ausente',
  installing: 'instalando',
  pulling: 'baixando',
  testing: 'testando',
  quota_exceeded: 'cota excedida',
  rate_limited: 'rate limited',
  misconfigured: 'mal configurado',
  experimental: 'experimental',
};

function statusTone(state: ProviderStatusState): 'neutral' | 'info' | 'warn' | 'danger' | 'ok' {
  if (state === 'ready') return 'ok';
  if (state === 'running' || state === 'testing' || state === 'installing' || state === 'pulling') return 'info';
  if (state === 'error' || state === 'api_unreachable' || state === 'quota_exceeded') return 'danger';
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
  if (state === 'requires_login') return 'requires_login';
  if (state === 'requires_oauth') return 'requires_oauth';
  if (state === 'requires_cli_auth') return 'requires_cli_auth';
  if (state === 'testing' || state === 'running') return 'testing';
  if (state === 'quota_exceeded') return 'quota_exceeded';
  if (state === 'rate_limited') return 'rate_limited';
  if (state === 'experimental' || state === 'mock') return 'experimental';
  if (state === 'misconfigured' || state === 'not_configured') return 'misconfigured';
  return 'unavailable';
}

function actionLabelForStatus(state: ProviderStatusState): string {
  if (state === 'ready') return 'Selecionável';
  if (state === 'requires_api_key') return 'Adicionar API key';
  if (state === 'requires_login') return 'Fazer login';
  if (state === 'requires_oauth') return 'Conectar OAuth';
  if (state === 'requires_cli_auth') return 'Validar CLI';
  if (state === 'testing' || state === 'running') return 'Testar conexão';
  if (state === 'quota_exceeded') return 'Trocar modelo/conta';
  if (state === 'rate_limited') return 'Aguardar ou trocar';
  if (state === 'misconfigured' || state === 'not_configured') return 'Corrigir configuração';
  if (state === 'experimental' || state === 'mock') return 'Configurar';
  return 'Indisponível';
}

export function SettingsPanel({
  settings,
  providers,
  profiles,
  credentials,
  sessions,
  localRuntime,
  healthCheck,
  healthLoading,
  onChange,
  onTestProvider,
  onSaveProviderCredential,
  onRemoveProviderCredential,
  onInstallRuntime,
  onStartRuntime,
  onRunHealthCheck,
  initialTab,
}: SettingsPanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab ?? 'general');
  const [testingProviderId, setTestingProviderId] = useState<string>();
  const [savingProviderId, setSavingProviderId] = useState<string>();
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [credentialInputs, setCredentialInputs] = useState<Record<string, string>>({});
  const [inlineError, setInlineError] = useState<string>();

  const selectedProvider = useMemo(() => {
    return providers.find((item) => item.id === settings?.selectedProviderId);
  }, [providers, settings?.selectedProviderId]);

  const accountProfiles = useMemo<ProviderAccountProfile[]>(() => {
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
        lastValidatedAt: provider.status.checkedAt,
        defaultModelId: provider.models[0]?.id,
        isDefault: settings?.selectedProviderProfileId === id || (!settings?.selectedProviderProfileId && provider.id === settings?.selectedProviderId),
        message: credential?.hasCredential ? provider.status.message : errorForStatus(provider.status.state, provider.status.message).message,
      };
    });
  }, [credentials, providers, settings?.selectedProviderId, settings?.selectedProviderProfileId]);

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

  async function testProvider(providerId: string): Promise<void> {
    setInlineError(undefined);
    setTestingProviderId(providerId);
    try {
      const status = await onTestProvider(providerId);
      if (status.state !== 'ready') {
        setInlineError(errorForStatus(status.state, status.message).message);
      }
    } catch (cause) {
      setInlineError(translateError(cause instanceof Error ? cause.message : 'provider_test_failed').message);
    } finally {
      setTestingProviderId(undefined);
    }
  }

  async function saveCredential(providerId: string): Promise<void> {
    setInlineError(undefined);
    setSavingProviderId(providerId);
    try {
      await onSaveProviderCredential(providerId, credentialInputs[providerId] ?? '');
      setCredentialInputs((current) => ({ ...current, [providerId]: '' }));
    } catch (cause) {
      setInlineError(translateError(cause instanceof Error ? cause.message : 'missing_api_key').message);
    } finally {
      setSavingProviderId(undefined);
    }
  }

  return (
    <section className="panel settings-panel settings-premium">
      <header className="panel-header">
        <h2>Settings</h2>
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
            <div className="settings-grid">
              <section className="settings-card">
                <strong>Workspace</strong>
                <span>{settings.workspaceRoot}</span>
                <span>Codex root: {settings.codexRoot}</span>
              </section>
              <section className="settings-card">
                <strong>Padrão IA</strong>
                <label>
                  Modo padrão
                  <select value={settings.executionMode} onChange={(event) => void onChange({ ...settings, executionMode: event.target.value as AppSettings['executionMode'] })}>
                    <option value="cloud">Nuvem</option>
                    <option value="local">Local</option>
                  </select>
                </label>
                <span>Modelo atual: {settings.selectedModelId}</span>
                <span>Conta/profile: {settings.selectedProviderProfileId ?? 'padrão do provider'}</span>
              </section>
              <section className="settings-card">
                <strong>Sessão</strong>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={settings.autoApproveSafeRead}
                    onChange={(event) => void onChange({ ...settings, autoApproveSafeRead: event.target.checked })}
                  />
                  Auto-aprovar leitura segura
                </label>
                <span>Histórico de modelos: {settings.modelSelectionHistory.length}</span>
              </section>
            </div>
          ) : null}

          {activeTab === 'providers' ? (
            <div className="provider-settings-list">
              {providers.map((provider) => {
                const credential = credentialFor(provider.id, credentials);
                const action = errorForStatus(provider.status.state, provider.status.message);
                const input = credentialInputs[provider.id] ?? '';
                const authType = authTypeForProvider(provider);
                const primaryAction = actionLabelForStatus(provider.status.state);
                return (
                  <section key={provider.id} className={`settings-card provider-settings-card provider-status-${statusTone(provider.status.state)}`}>
                    <div className="row-between">
                      <div>
                        <strong>{provider.label}</strong>
                        <span>{STATUS_LABELS[provider.status.state]}</span>
                        <span>Auth: {authType.replace('_', ' ')}</span>
                        {provider.status.version ? <span>{provider.status.version}</span> : null}
                      </div>
                      <div className="settings-actions-inline">
                        <button
                          type="button"
                          className="btn-modern"
                          disabled={testingProviderId === provider.id}
                          onClick={() => void testProvider(provider.id)}
                        >
                          {testingProviderId === provider.id ? 'Testando' : 'Testar conexão'}
                        </button>
                        <button
                          type="button"
                          className="btn-modern btn-modern-primary"
                          disabled={provider.status.state === 'ready' || provider.status.state === 'unavailable'}
                          onClick={() => {
                            if (provider.status.state === 'requires_api_key') {
                              setInlineError(`Adicione uma API key para ${provider.label}. O segredo será mascarado na UI.`);
                              return;
                            }
                            if (provider.status.state === 'requires_cli_auth' || provider.status.state === 'testing' || provider.status.state === 'running') {
                              void testProvider(provider.id);
                              return;
                            }
                            setInlineError(`${provider.label}: ${action.message}`);
                          }}
                        >
                          {primaryAction}
                        </button>
                      </div>
                    </div>
                    <p>{provider.status.message}</p>
                    {provider.status.command ? <code>{provider.status.command}</code> : null}

                    {provider.configurable && provider.id !== 'local-ollama' ? (
                      <div className="credential-row">
                        <label>
                          Credencial
                          <input
                            type={visibleKeys[provider.id] ? 'text' : 'password'}
                            value={input}
                            placeholder={credential?.maskedKey ?? 'API key'}
                            onChange={(event) => setCredentialInputs((current) => ({ ...current, [provider.id]: event.target.value }))}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn-modern"
                          onClick={() => setVisibleKeys((current) => ({ ...current, [provider.id]: !current[provider.id] }))}
                        >
                          {visibleKeys[provider.id] ? 'Ocultar' : 'Mostrar'}
                        </button>
                        <button
                          type="button"
                          className="btn-modern btn-modern-primary"
                          disabled={savingProviderId === provider.id || input.trim().length === 0}
                          onClick={() => void saveCredential(provider.id)}
                        >
                          {savingProviderId === provider.id ? 'Salvando' : 'Adicionar API key'}
                        </button>
                        <button
                          type="button"
                          className="btn-modern"
                          disabled={!credential?.hasCredential}
                          onClick={() => void onRemoveProviderCredential(provider.id)}
                        >
                          Remover
                        </button>
                      </div>
                    ) : null}

                    <div className="inline-alert">
                      {credential?.hasCredential ? `Credencial: ${credential.maskedKey} (${credential.source ?? 'local'})` : action.message}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}

          {activeTab === 'accounts' ? (
            <div className="provider-settings-list">
              {accountProfiles.map((profile) => (
                <section key={profile.id} className={`settings-card provider-settings-card provider-status-${statusTone(profile.status)}`}>
                  <div className="row-between">
                    <div>
                      <strong>{profile.providerLabel} · {profile.name}</strong>
                      <span>{profile.status.replace('_', ' ')}</span>
                      <span>Tipo: {profile.authType.replace('_', ' ')}</span>
                      <span>Última validação: {profile.lastValidatedAt ? new Date(profile.lastValidatedAt).toLocaleString('pt-BR') : 'nunca'}</span>
                    </div>
                    <div className="settings-actions-inline">
                      <button type="button" className="btn-modern" onClick={() => void testProvider(profile.providerId)}>
                        Testar
                      </button>
                      <button
                        type="button"
                        className="btn-modern btn-modern-primary"
                        onClick={() =>
                          void onChange({
                            ...settings,
                            selectedProviderId: profile.providerId,
                            selectedProviderProfileId: profile.id,
                            selectedModelId: profile.defaultModelId ?? settings.selectedModelId,
                            executionMode: profile.providerId === 'local-ollama' ? 'local' : 'cloud',
                          })
                        }
                      >
                        {profile.isDefault ? 'Padrão' : 'Tornar padrão'}
                      </button>
                      <button
                        type="button"
                        className="btn-modern"
                        disabled={!profile.maskedCredential}
                        onClick={() => void onRemoveProviderCredential(profile.providerId)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                  <p>{profile.message}</p>
                  <div className="inline-alert">
                    {profile.maskedCredential
                      ? `Credencial mascarada: ${profile.maskedCredential} (${profile.source ?? 'local'})`
                      : 'Nenhum segredo salvo para este profile.'}
                  </div>
                  <span>Multi-conta real por provider está preparado na UI, mas o backend atual ainda mantém uma credencial ativa por provider até troca para keyring/profile store.</span>
                </section>
              ))}
            </div>
          ) : null}

          {activeTab === 'local' ? (
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
                <span>Exportação disponível em `.md` e `.json` no menu da sessão.</span>
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

          {activeTab === 'execution' ? (
            <div className="settings-grid">
              <section className="settings-card">
                <strong>Execução</strong>
                <label>
                  Shell preferido
                  <input value={settings.preferredShell} onChange={(event) => void onChange({ ...settings, preferredShell: event.target.value })} />
                </label>
                <span>Aprovação: controlada por política do backend.</span>
                <span>Dry-run: padrão em ações privilegiadas.</span>
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

          {activeTab === 'permissions' ? (
            <div className="settings-grid">
              <section className="settings-card">
                <strong>Política</strong>
                <span>sudo -S bloqueado; pkexec/helper para ações privilegiadas.</span>
                <span>Confirmação exigida para comandos destrutivos e escrita crítica.</span>
                <span>Auto-aprovar leitura segura: {settings.autoApproveSafeRead ? 'sim' : 'não'}</span>
              </section>
            </div>
          ) : null}

          {activeTab === 'appearance' ? (
            <div className="settings-grid">
              <section className="settings-card">
                <strong>Aparência</strong>
                <span>Tema: preto + azul End-4.</span>
                <span>Densidade: compacta funcional.</span>
                <span>Layout: sidebar, centro e inspector.</span>
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
                </div>
                <span>Status: {healthCheck?.overallStatus ?? 'não executado'}</span>
                <span>Base: {healthCheck?.baseDir ?? settings.workspaceRoot}</span>
                <span>Projeto correto: {healthCheck?.correctBaseDir ? 'sim' : 'pendente de checagem'}</span>
                <span>Node/npm/cargo/tauri: {healthCheck ? `${healthCheck.nodeOk}/${healthCheck.npmOk}/${healthCheck.cargoOk}/${healthCheck.tauriOk}` : 'pendente'}</span>
                <span>Providers/profiles: {healthCheck ? `${healthCheck.providers.length}/${accountProfiles.length}` : 'pendente'}</span>
                <span>Sessões/storage: {healthCheck?.sessionsCount ?? sessions.length} · {healthCheck?.storageRoot ?? `${settings.codexRoot}/sessions`}</span>
                <span>Credenciais: {healthCheck?.credentialsEncrypted ? 'keyring/criptografado' : 'arquivo local mascarado na UI; keyring pendente'}</span>
                <span>Ollama: {healthCheck?.ollama.state ?? localRuntime?.state ?? 'pendente'} · API {healthCheck?.ollama.apiReachable ?? localRuntime?.apiReachable ? 'online' : 'offline'}</span>
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
    </section>
  );
}
