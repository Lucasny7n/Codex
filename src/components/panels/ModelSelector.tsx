import { useMemo, useState } from 'react';
import type {
  AgentSession,
  AppHealthCheck,
  AppSettings,
  ExecutionMode,
  LocalModelInstallProgress,
  LocalRuntimeSnapshot,
  ProviderAccountProfile,
  ProviderCredentialStatus,
  ProviderDescriptor,
  ProviderRuntimeStatus,
  ProviderStatusState,
} from '../../types/domain';
import {
  capabilityLabel,
  localCompatibility,
  localCompatibilityLabel,
  modelRegistry,
  type CloudModelProfile,
  type LocalModelProfile,
  type ModelProfile,
} from '../../lib/modelRegistry';
import { errorForStatus, translateError } from '../../lib/errorTranslator';
import { openExternalUrl } from '../../lib/api';
import {
  getSetupRequirement,
  getUnavailableReason,
  normalizeProviderStatus,
  resolveModelStatus,
  statusTone,
  type ProviderStatus,
} from '../../lib/providerStatus';
import { CredentialInput, PopupMenu, PremiumModal, StatusDot } from '../common/PremiumUI';

interface ModelSelectorProps {
  open: boolean;
  mode: ExecutionMode;
  activeModelId?: string;
  settings?: AppSettings;
  selectedSession?: AgentSession;
  sessions?: AgentSession[];
  providers: ProviderDescriptor[];
  credentials: ProviderCredentialStatus[];
  providerProfiles: ProviderAccountProfile[];
  localRuntime?: LocalRuntimeSnapshot;
  healthCheck?: AppHealthCheck;
  installationProgress: Record<string, LocalModelInstallProgress>;
  busyModelId?: string;
  initialTab?: EnvironmentTab;
  onClose: () => void;
  onModeChange: (mode: ExecutionMode) => void;
  onActivateCloud: (model: CloudModelProfile) => Promise<void>;
  onActivateLocal: (model: LocalModelProfile) => Promise<void>;
  onUseCloudInChat?: (model: CloudModelProfile) => Promise<void>;
  onUseLocalInChat?: (model: LocalModelProfile) => Promise<void>;
  onSetGlobalCloud?: (model: CloudModelProfile) => Promise<void>;
  onSetGlobalLocal?: (model: LocalModelProfile) => Promise<void>;
  onApplyCloudToAll?: (model: CloudModelProfile) => Promise<void>;
  onApplyLocalToAll?: (model: LocalModelProfile) => Promise<void>;
  onInstallLocalModel: (model: LocalModelProfile) => Promise<void>;
  onRemoveLocalModel: (model: LocalModelProfile) => Promise<void>;
  onInstallRuntime: () => Promise<void>;
  onStartRuntime: () => Promise<void>;
  onConfigureProvider: (providerId: string) => void;
  onTestProvider?: (providerId: string) => Promise<ProviderRuntimeStatus>;
  onSaveProviderProfileCredential?: (
    providerId: string,
    profileId: string | undefined,
    name: string,
    key: string,
    makeDefault: boolean,
  ) => Promise<ProviderAccountProfile>;
  onRemoveProviderCredential?: (providerId: string) => Promise<ProviderCredentialStatus>;
  onRemoveProviderProfile?: (profileId: string) => Promise<void>;
  onSetDefaultProviderProfile?: (providerId: string, profileId: string) => Promise<void>;
}

export type EnvironmentTab = 'ready' | 'configure' | 'accounts' | 'local' | 'diagnostics';

const ENVIRONMENT_TABS: Array<{ id: EnvironmentTab; label: string }> = [
  { id: 'ready', label: 'Prontos' },
  { id: 'configure', label: 'Configurar' },
  { id: 'accounts', label: 'Contas' },
  { id: 'local', label: 'Locais' },
  { id: 'diagnostics', label: 'Diagnóstico' },
];

const SETUP_URLS: Record<string, { url?: string; instruction: string; docsLabel: string }> = {
  'openai-api': {
    url: 'https://platform.openai.com/api-keys',
    instruction: 'Adicione uma API key da OpenAI e rode teste real antes de usar.',
    docsLabel: 'Abrir OpenAI',
  },
  'openrouter-api': {
    url: 'https://openrouter.ai/keys',
    instruction: 'Gere uma key do OpenRouter e teste a conexão antes de selecionar modelos.',
    docsLabel: 'Abrir OpenRouter',
  },
  'anthropic-api': {
    url: 'https://console.anthropic.com/settings/keys',
    instruction: 'Crie uma API key Anthropic e teste a conexão antes de usar.',
    docsLabel: 'Abrir Anthropic',
  },
  'gemini-api': {
    url: 'https://aistudio.google.com/apikey',
    instruction: 'Crie uma Gemini API key no AI Studio e teste a conexão.',
    docsLabel: 'Abrir Gemini',
  },
  'gemini-cli': {
    url: 'https://aistudio.google.com/apikey',
    instruction: 'Configure GEMINI_API_KEY, GOOGLE_API_KEY ou ADC e verifique o CLI.',
    docsLabel: 'Abrir API keys',
  },
  'opencode-zen': {
    url: 'https://opencode.ai/zen',
    instruction: 'Faça login no OpenCode Zen e volte para verificar.',
    docsLabel: 'Abrir OpenCode Zen',
  },
  'codex-cli': {
    instruction: 'Autentique o Codex CLI fora do app e use Verificar login.',
    docsLabel: 'Verificar CLI',
  },
};

function statusClass(status: string): string {
  return status.replace(/_/g, '-');
}

function statusDotTone(status: ProviderStatus | ProviderStatusState | ProviderAccountProfile['status']): 'ready' | 'warning' | 'error' | 'offline' | 'info' {
  if (status === 'ready') return 'ready';
  if (status === 'testing' || status === 'running' || status === 'installing' || status === 'pulling') return 'info';
  if (status === 'unavailable') return 'offline';
  if (status === 'error' || status === 'api_unreachable' || status === 'misconfigured' || status === 'quota_exceeded' || status === 'rate_limited' || status === 'invalid_api_key' || status === 'forbidden' || status === 'provider_unavailable') return 'error';
  return 'warning';
}

function isInstalledLocal(model: LocalModelProfile, runtime?: LocalRuntimeSnapshot): boolean {
  if (!runtime) return false;
  return runtime.installedModels.some((installed) => installed.id === model.id || installed.id === model.modelId);
}

function profileStatusLabel(status: ProviderAccountProfile['status']): string {
  return status.replace(/_/g, ' ');
}

function profilesForProvider(providerId: string, profiles: ProviderAccountProfile[]): ProviderAccountProfile[] {
  return profiles.filter((profile) => profile.providerId === providerId);
}

function readyProfileFor(providerId: string, profiles: ProviderAccountProfile[]): ProviderAccountProfile | undefined {
  const accounts = profilesForProvider(providerId, profiles);
  return accounts.find((profile) => profile.isDefault && profile.status === 'ready') ?? accounts.find((profile) => profile.status === 'ready');
}

function credentialFor(providerId: string, credentials: ProviderCredentialStatus[]): ProviderCredentialStatus | undefined {
  return credentials.find((credential) => credential.providerId === providerId);
}

function tagsForRow(model: ModelProfile): string[] {
  const tags = [];
  if (model.recommended) tags.push('recomendado');
  if (model.capabilities.coding >= 4) tags.push('código');
  if (model.capabilities.speed >= 4) tags.push('rápido');
  if (model.mode === 'local') tags.push(localCompatibilityLabel(localCompatibility(model)));
  if (model.mode === 'cloud' && model.freeTierAvailable) tags.push('baixo custo');
  return tags.slice(0, 3);
}

function environmentLabel(mode: ExecutionMode): string {
  return mode === 'local' ? 'Local' : 'Nuvem';
}

function cloudStatus(
  model: CloudModelProfile,
  provider: ProviderDescriptor | undefined,
  providerProfiles: ProviderAccountProfile[],
): ProviderStatus {
  const status = resolveModelStatus(model, provider?.status);
  if (status !== 'ready') return status;
  const accounts = profilesForProvider(model.providerId, providerProfiles);
  if (accounts.length > 0 && !accounts.some((profile) => profile.status === 'ready')) return 'testing';
  return 'ready';
}

function setupActionLabel(status: ProviderStatusState): string {
  if (status === 'requires_api_key') return 'Adicionar API key';
  if (status === 'invalid_api_key') return 'Trocar API key';
  if (status === 'forbidden') return 'Trocar conta';
  if (status === 'requires_login') return 'Fazer login';
  if (status === 'requires_oauth') return 'Conectar conta';
  if (status === 'requires_cli_auth') return 'Fazer login via CLI';
  if (status === 'testing' || status === 'running' || status === 'ready') return 'Testar conexão';
  if (status === 'quota_exceeded') return 'Trocar conta/modelo';
  if (status === 'rate_limited') return 'Aguardar ou trocar';
  if (status === 'provider_unavailable') return 'Tentar novamente';
  if (status === 'misconfigured' || status === 'not_configured') return 'Corrigir';
  if (status === 'not_installed') return 'Instalar runtime';
  if (status === 'service_offline') return 'Iniciar serviço';
  return 'Indisponível';
}

export function ModelSelector({
  open,
  mode,
  activeModelId,
  settings,
  selectedSession,
  sessions = [],
  providers,
  credentials,
  providerProfiles,
  localRuntime,
  healthCheck,
  installationProgress,
  busyModelId,
  initialTab,
  onClose,
  onModeChange,
  onActivateCloud,
  onActivateLocal,
  onUseCloudInChat,
  onUseLocalInChat,
  onSetGlobalCloud,
  onSetGlobalLocal,
  onApplyCloudToAll,
  onApplyLocalToAll,
  onInstallLocalModel,
  onRemoveLocalModel,
  onInstallRuntime,
  onStartRuntime,
  onTestProvider,
  onSaveProviderProfileCredential,
  onRemoveProviderCredential,
  onRemoveProviderProfile,
  onSetDefaultProviderProfile,
}: ModelSelectorProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<EnvironmentTab>(initialTab ?? 'ready');
  const [query, setQuery] = useState('');
  const [credentialProviderId, setCredentialProviderId] = useState<string>();
  const [credentialProfileId, setCredentialProfileId] = useState<string>();
  const [credentialInputs, setCredentialInputs] = useState<Record<string, string>>({});
  const [profileNameInputs, setProfileNameInputs] = useState<Record<string, string>>({});
  const [defaultCredential, setDefaultCredential] = useState(true);
  const [testingProviderId, setTestingProviderId] = useState<string>();
  const [savingProviderId, setSavingProviderId] = useState<string>();
  const [loginCheckProviderId, setLoginCheckProviderId] = useState<string>();
  const [inlineError, setInlineError] = useState<string>();
  const [profileMenuId, setProfileMenuId] = useState<string>();
  const [pendingApplyAll, setPendingApplyAll] = useState<ModelProfile>();

  const providersById = useMemo(() => {
    const map = new Map<string, ProviderDescriptor>();
    for (const provider of providers) map.set(provider.id, provider);
    return map;
  }, [providers]);

  const cloudModels = useMemo(() => modelRegistry.search('cloud', query, []).filter((item): item is CloudModelProfile => item.mode === 'cloud'), [query]);
  const localModels = useMemo(() => modelRegistry.search('local', query, []).filter((item): item is LocalModelProfile => item.mode === 'local'), [query]);

  const readyCloudModels = useMemo(
    () => cloudModels.filter((model) => cloudStatus(model, providersById.get(model.providerId), providerProfiles) === 'ready'),
    [cloudModels, providerProfiles, providersById],
  );

  const readyLocalModels = useMemo(
    () =>
      localModels.filter((model) => {
        const status = resolveModelStatus(model, providersById.get(model.providerId)?.status, localRuntime, installationProgress[model.id] ?? installationProgress[model.modelId]);
        return status === 'ready';
      }),
    [installationProgress, localModels, localRuntime, providersById],
  );

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
      [providerId]: profile?.name ?? current[providerId] ?? 'Principal',
    }));
    setCredentialInputs((current) => ({
      ...current,
      [providerId]: '',
    }));
  }

  async function testProvider(providerId: string): Promise<void> {
    if (!onTestProvider) return;
    setInlineError(undefined);
    setTestingProviderId(providerId);
    try {
      const status = await onTestProvider(providerId);
      if (status.state !== 'ready') setInlineError(errorForStatus(status.state, status.message).message);
    } catch (cause) {
      setInlineError(translateError(cause instanceof Error ? cause.message : 'provider_test_failed').message);
    } finally {
      setTestingProviderId(undefined);
    }
  }

  async function saveCredential(providerId: string, closeAfterSave = true, testAfterSave = true): Promise<void> {
    if (!onSaveProviderProfileCredential) return;
    const input = credentialInputs[providerId] ?? '';
    const name = profileNameInputs[providerId] ?? 'Principal';
    if (input.trim().length < 12) {
      setInlineError('API key curta ou vazia. Verifique a chave do provider e tente de novo.');
      return;
    }
    setInlineError(undefined);
    setSavingProviderId(providerId);
    try {
      await onSaveProviderProfileCredential(providerId, credentialProfileId, name, input, defaultCredential);
      setCredentialInputs((current) => ({ ...current, [providerId]: '' }));
      if (closeAfterSave) {
        setCredentialProviderId(undefined);
        setCredentialProfileId(undefined);
      }
      if (testAfterSave) await testProvider(providerId);
    } catch (cause) {
      setInlineError(translateError(cause instanceof Error ? cause.message : 'missing_api_key').message);
    } finally {
      setSavingProviderId(undefined);
    }
  }

  async function openProviderLogin(provider: ProviderDescriptor): Promise<void> {
    const setup = SETUP_URLS[provider.id];
    setInlineError(undefined);
    if (!setup?.url) {
      setInlineError(setup?.instruction ?? 'Finalize o login externo e verifique novamente.');
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

  async function applyCloudInChat(model: CloudModelProfile): Promise<void> {
    await (onUseCloudInChat ?? onActivateCloud)(model);
  }

  async function applyLocalInChat(model: LocalModelProfile): Promise<void> {
    await (onUseLocalInChat ?? onActivateLocal)(model);
  }

  async function setGlobal(model: ModelProfile): Promise<void> {
    if (model.mode === 'cloud') await (onSetGlobalCloud ?? onActivateCloud)(model);
    else await (onSetGlobalLocal ?? onActivateLocal)(model);
  }

  async function applyToAll(model: ModelProfile): Promise<void> {
    if (model.mode === 'cloud') await (onApplyCloudToAll ?? onActivateCloud)(model);
    else await (onApplyLocalToAll ?? onActivateLocal)(model);
    setPendingApplyAll(undefined);
  }

  async function applyAsDefaultOnly(model: ModelProfile): Promise<void> {
    await setGlobal(model);
    setPendingApplyAll(undefined);
  }

  function renderReadyCard(model: ModelProfile): JSX.Element {
    const active = activeModelId === model.id || activeModelId === model.modelId;
    const provider = providersById.get(model.providerId);
    const readyProfile = model.mode === 'cloud' ? readyProfileFor(model.providerId, providerProfiles) : undefined;

    return (
      <article key={model.id} className={`environment-card ${active ? 'active' : ''}`}>
        <div className="environment-card-heading">
          <div>
            <h3>{model.displayName}</h3>
            <p>{model.mode === 'cloud' ? model.providerLabel : 'Ollama local'}{readyProfile ? ` · Conta: ${readyProfile.name}` : ''}</p>
          </div>
          <span className="environment-provider-pill">{provider?.label ?? model.providerLabel}</span>
        </div>
        <div className="environment-status-row">
          <StatusDot tone="ready" />
          <span>pronto</span>
          <span>{environmentLabel(model.mode)}</span>
          <span>{model.mode === 'local' ? localCompatibilityLabel(localCompatibility(model)) : model.limits}</span>
        </div>
        <div className="environment-actions">
          <button
            type="button"
            className="btn-modern btn-modern-primary"
            disabled={busyModelId === model.id}
            onClick={() => {
              if (model.mode === 'cloud') void applyCloudInChat(model);
              else void applyLocalInChat(model);
            }}
          >
            Usar neste chat
          </button>
          <button type="button" className="btn-modern" onClick={() => setPendingApplyAll(model)}>
            Aplicar para todos
          </button>
          <button type="button" className="btn-modern" onClick={() => void setGlobal(model)}>
            Definir padrão
          </button>
        </div>
        <details className="model-details">
          <summary>Detalhes</summary>
          <p><strong>Privacidade:</strong> {model.privacy}</p>
          <p><strong>Uso recomendado:</strong> {model.recommendedUse}</p>
          <div className="model-detail-grid">
            <span>Código: <strong>{capabilityLabel(model.capabilities.coding)}</strong></span>
            <span>Raciocínio: <strong>{capabilityLabel(model.capabilities.reasoning)}</strong></span>
            <span>Velocidade: <strong>{capabilityLabel(model.capabilities.speed)}</strong></span>
          </div>
        </details>
      </article>
    );
  }

  function renderProviderCard(provider: ProviderDescriptor): JSX.Element {
    const action = setupActionLabel(provider.status.state);
    const setup = SETUP_URLS[provider.id];
    const credential = credentialFor(provider.id, credentials);
    const loginWaiting = loginCheckProviderId === provider.id;
    const disabled = provider.status.state === 'unavailable' || provider.status.state === 'provider_unavailable' || provider.status.state === 'mock';
    const normalizedStatus = normalizeProviderStatus(provider.status.state);

    return (
      <article key={provider.id} className="environment-card">
        <div className="environment-card-heading">
          <div>
            <h3>{provider.label}</h3>
            <p>{errorForStatus(provider.status.state, provider.status.message).message}</p>
          </div>
          <span className={`model-status status-${statusClass(provider.status.state)} tone-${statusTone(normalizedStatus)}`}>
            {provider.status.state.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="environment-actions">
          {provider.status.state === 'requires_api_key' || provider.status.state === 'invalid_api_key' || provider.configurable ? (
            <button type="button" className="btn-modern btn-modern-primary" onClick={() => openCredentialModal(provider.id)}>
              Adicionar API key
            </button>
          ) : null}
          {provider.status.state === 'requires_login' || provider.status.state === 'requires_oauth' || provider.status.state === 'requires_cli_auth' ? (
            <button type="button" className="btn-modern btn-modern-primary" disabled={disabled} onClick={() => void openProviderLogin(provider)}>
              {action}
            </button>
          ) : null}
          {provider.status.state === 'testing' || provider.status.state === 'running' || credential?.hasCredential ? (
            <button type="button" className="btn-modern" disabled={!onTestProvider || testingProviderId === provider.id} onClick={() => void testProvider(provider.id)}>
              {testingProviderId === provider.id ? 'Testando...' : 'Testar conexão'}
            </button>
          ) : null}
          {credential?.hasCredential && onRemoveProviderCredential ? (
            <button type="button" className="btn-modern" onClick={() => void onRemoveProviderCredential(provider.id)}>
              Remover
            </button>
          ) : null}
        </div>
        {loginWaiting ? (
          <div className="inline-alert inline-alert-action">
            <span>{setup?.instruction ?? 'Finalize o login e verifique novamente.'}</span>
            <button type="button" className="btn-modern btn-modern-primary" disabled={!onTestProvider} onClick={() => void testProvider(provider.id)}>
              Verificar login
            </button>
          </div>
        ) : null}
        <details className="model-details">
          <summary>Detalhes técnicos</summary>
          <p>{provider.status.message}</p>
          {provider.status.command ? <code>{provider.status.command}</code> : null}
          {setup?.url ? <p>Documentação: {setup.url}</p> : null}
        </details>
      </article>
    );
  }

  function renderLocalCard(model: LocalModelProfile): JSX.Element {
    const progress = installationProgress[model.id] ?? installationProgress[model.modelId];
    const status = resolveModelStatus(model, providersById.get(model.providerId)?.status, localRuntime, progress);
    const compatibility = localCompatibility(model);
    const notRecommended = compatibility === 'not_recommended';

    return (
      <article key={model.id} className={`environment-card ${notRecommended ? 'environment-card-muted' : ''}`}>
        <div className="environment-card-heading">
          <div>
            <h3>{model.displayName}</h3>
            <p>{localCompatibilityLabel(compatibility)} · RAM {model.ramRequirement} · VRAM {model.vramRequirement}</p>
          </div>
          <span className={`model-status status-${statusClass(status)} tone-${statusTone(status)}`}>
            {status.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="environment-actions">
          {status === 'not_installed' ? (
            <button type="button" className="btn-modern btn-modern-primary" onClick={() => void onInstallRuntime()}>
              Instalar runtime
            </button>
          ) : null}
          {status === 'service_offline' || status === 'api_unreachable' ? (
            <button type="button" className="btn-modern btn-modern-primary" onClick={() => void onStartRuntime()}>
              Iniciar serviço
            </button>
          ) : null}
          {status === 'model_missing' && !notRecommended ? (
            <button type="button" className="btn-modern btn-modern-primary" disabled={busyModelId === model.id} onClick={() => void onInstallLocalModel(model)}>
              Baixar modelo local
            </button>
          ) : null}
          {status === 'ready' ? (
            <button type="button" className="btn-modern btn-modern-primary" onClick={() => void applyLocalInChat(model)}>
              Usar
            </button>
          ) : null}
          {isInstalledLocal(model, localRuntime) ? (
            <button type="button" className="btn-modern" disabled={busyModelId === model.id} onClick={() => void onRemoveLocalModel(model)}>
              Remover
            </button>
          ) : null}
        </div>
        <details className="model-details">
          <summary>Detalhes</summary>
          <p>{model.recommendedUse}</p>
          <p>{notRecommended ? 'Não recomendado para 16 GB RAM; fica escondido dos filtros compatíveis.' : model.expectedPerformance}</p>
          <p>{model.caveats.join(' • ')}</p>
        </details>
      </article>
    );
  }

  if (!open) return null;

  const readyModels = [
    ...readyCloudModels,
    ...readyLocalModels.filter((model) => localCompatibility(model) !== 'not_recommended'),
  ];
  const nonReadyProviders = providers.filter((provider) => provider.id !== 'local-ollama' && provider.status.state !== 'ready');
  const recommendedLocalModels = localModels.filter((model) => localCompatibility(model) !== 'not_recommended');

  return (
    <>
      <PremiumModal
        open={open}
        title="Ambiente"
        description="Modelos, API keys, login, contas e runtime local em um único fluxo."
        onClose={onClose}
        className="environment-modal"
      >
        <div className="environment-shell">
          <nav className="environment-tabs" aria-label="Ambiente">
            {ENVIRONMENT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`environment-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="environment-content">
            {inlineError ? (
              <div className="input-error-tip" role="alert">
                {inlineError}
              </div>
            ) : null}

            <div className="environment-toolbar">
              <div>
                <strong>{environmentLabel(mode)}</strong>
                <span>{settings?.selectedModelId ?? activeModelId ?? 'modelo não selecionado'}</span>
                {selectedSession ? <span>Chat: {selectedSession.title}</span> : <span>Novo chat usa padrão global.</span>}
              </div>
              <div className="execution-toggle" role="tablist" aria-label="Modo do Ambiente">
                <button type="button" className={`execution-toggle-btn ${mode === 'cloud' ? 'active' : ''}`} onClick={() => onModeChange('cloud')}>
                  Nuvem
                </button>
                <button type="button" className={`execution-toggle-btn ${mode === 'local' ? 'active' : ''}`} onClick={() => onModeChange('local')}>
                  Local
                </button>
              </div>
              <input
                className="input-modern"
                placeholder="Buscar modelo, provider ou conta"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            {activeTab === 'ready' ? (
              <div className="environment-list scroll-y">
                {readyModels.length === 0 ? (
                  <div className="empty-state model-selector-empty">
                    <strong>Nenhum modelo pronto ainda</strong>
                    <span>Adicione uma API key, faça login ou instale um modelo local.</span>
                    <button type="button" className="btn-modern btn-modern-primary" onClick={() => setActiveTab('configure')}>
                      Configurar modelos
                    </button>
                  </div>
                ) : null}
                {readyModels.map((model) => renderReadyCard(model))}
              </div>
            ) : null}

            {activeTab === 'configure' ? (
              <div className="environment-list scroll-y">
                {nonReadyProviders.map((provider) => renderProviderCard(provider))}
                {nonReadyProviders.length === 0 ? (
                  <section className="environment-card">
                    <h3>Providers cloud</h3>
                    <p>Todos os providers registrados estão prontos ou sem adapter acionável nesta build.</p>
                  </section>
                ) : null}
                <section className="environment-card">
                  <div className="environment-card-heading">
                    <div>
                      <h3>Ollama local</h3>
                      <p>{localRuntime?.message ?? 'Runtime local ainda não carregado.'}</p>
                    </div>
                    <span className={`model-status status-${statusClass(localRuntime?.state ?? 'unavailable')}`}>
                      {localRuntime?.state.replace(/_/g, ' ') ?? 'unavailable'}
                    </span>
                  </div>
                  <div className="environment-actions">
                    <button type="button" className="btn-modern" onClick={() => void onInstallRuntime()}>
                      Instalar runtime
                    </button>
                    <button type="button" className="btn-modern btn-modern-primary" onClick={() => void onStartRuntime()}>
                      Iniciar serviço
                    </button>
                  </div>
                </section>
              </div>
            ) : null}

            {activeTab === 'accounts' ? (
              <div className="environment-list scroll-y">
                {providerProfiles.length === 0 ? (
                  <div className="empty-state model-selector-empty">
                    <strong>Nenhuma conta configurada</strong>
                    <span>Adicione uma API key ou faça login em Configurar.</span>
                  </div>
                ) : null}
                {providerProfiles.map((profile) => {
                  const lastProfileTest = profile.lastTestedAt ?? profile.lastValidatedAt;
                  return (
                    <article key={profile.id} className="environment-card">
                      <div className="environment-card-heading">
                        <div>
                          <h3>{profile.name} ({profile.providerLabel})</h3>
                          <p>Tipo: {profile.authType.replace(/_/g, ' ')} · Última validação: {lastProfileTest ? new Date(lastProfileTest).toLocaleString('pt-BR') : 'nunca'}</p>
                        </div>
                        <div className="environment-status-row">
                          <StatusDot tone={statusDotTone(profile.status)} />
                          <span>{profileStatusLabel(profile.status)}</span>
                        </div>
                      </div>
                      <div className="environment-actions">
                        <button type="button" className="btn-modern" disabled={!onTestProvider} onClick={() => void testProvider(profile.providerId)}>
                          Testar
                        </button>
                        <button type="button" className="btn-modern btn-modern-primary" disabled={!onSetDefaultProviderProfile} onClick={() => void onSetDefaultProviderProfile?.(profile.providerId, profile.id)}>
                          Tornar padrão
                        </button>
                        <div className="popup-anchor">
                          <button type="button" className="kebab-button" aria-label={`Ações de ${profile.name}`} onClick={() => setProfileMenuId((current) => current === profile.id ? undefined : profile.id)}>
                            ⋮
                          </button>
                          <PopupMenu open={profileMenuId === profile.id} onClose={() => setProfileMenuId(undefined)}>
                            <button type="button" onClick={() => { setProfileMenuId(undefined); openCredentialModal(profile.providerId, profile); }}>
                              Editar API key
                            </button>
                            <button type="button" disabled={!onRemoveProviderCredential || !profile.maskedCredential} onClick={() => { setProfileMenuId(undefined); void onRemoveProviderCredential?.(profile.providerId); }}>
                              Remover API key
                            </button>
                            <button type="button" disabled={!onRemoveProviderProfile || !profile.maskedCredential || profile.source === 'environment'} onClick={() => { setProfileMenuId(undefined); void onRemoveProviderProfile?.(profile.id); }}>
                              Remover
                            </button>
                          </PopupMenu>
                        </div>
                      </div>
                      <details className="model-details">
                        <summary>Detalhes</summary>
                        <p>{profile.message}</p>
                        <p>{profile.maskedCredential ? `Credencial mascarada: ${profile.maskedCredential}` : 'Sem segredo salvo para este profile.'}</p>
                      </details>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {activeTab === 'local' ? (
              <div className="environment-list scroll-y">
                <section className="environment-card">
                  <div className="environment-card-heading">
                    <div>
                      <h3>Status do Ollama</h3>
                      <p>{localRuntime?.message ?? 'Runtime local ainda não carregado.'}</p>
                    </div>
                    <span className={`model-status status-${statusClass(localRuntime?.state ?? 'unavailable')}`}>
                      {localRuntime?.state.replace(/_/g, ' ') ?? 'unavailable'}
                    </span>
                  </div>
                  <div className="environment-status-grid">
                    <span>Serviço: {localRuntime?.serviceActive ? 'ativo' : 'offline'}</span>
                    <span>API: {localRuntime?.apiReachable ? 'online' : 'offline'}</span>
                    <span>URL: {localRuntime?.apiUrl ?? 'http://127.0.0.1:11434'}</span>
                    <span>Hardware: Ryzen 5 5500, RX 7600, 16 GB RAM</span>
                  </div>
                </section>
                {recommendedLocalModels.map((model) => renderLocalCard(model))}
              </div>
            ) : null}

            {activeTab === 'diagnostics' ? (
              <div className="environment-list scroll-y">
                <section className="environment-card">
                  <h3>Diagnóstico do Ambiente</h3>
                  <div className="environment-status-grid">
                    <span>Padrão: {settings?.selectedProviderId ?? 'provider'} / {settings?.selectedModelId ?? 'modelo'}</span>
                    <span>Profile ativo: {settings?.selectedProviderProfileId ?? 'não definido'}</span>
                    <span>Chats salvos: {sessions.length}</span>
                    <span>Health: {healthCheck?.overallStatus ?? 'não executado'}</span>
                  </div>
                  <details className="model-details">
                    <summary>Providers</summary>
                    {providers.map((provider) => (
                      <p key={provider.id}>{provider.label}: {provider.status.state.replace(/_/g, ' ')} · {provider.status.message}</p>
                    ))}
                  </details>
                  <details className="model-details">
                    <summary>Ações recomendadas</summary>
                    {(healthCheck?.actions ?? []).length === 0 ? <p>Nenhuma ação carregada.</p> : null}
                    {(healthCheck?.actions ?? []).map((action) => (
                      <code key={`${action.label}-${action.command ?? ''}`}>{action.command ?? action.label}</code>
                    ))}
                  </details>
                </section>
                {cloudModels.map((model) => {
                  const status = cloudStatus(model, providersById.get(model.providerId), providerProfiles);
                  return (
                    <section key={model.id} className="environment-card">
                      <div className="environment-card-heading">
                        <div>
                          <h3>{model.displayName}</h3>
                          <p>{model.providerLabel}</p>
                        </div>
                        <span className={`model-status status-${statusClass(status)} tone-${statusTone(status)}`}>
                          {status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <details className="model-details">
                        <summary>Detalhes</summary>
                        <p><strong>Requisito:</strong> {getSetupRequirement(status) ?? model.setupRequirement}</p>
                        <p><strong>Motivo:</strong> {getUnavailableReason(status) ?? 'Pronto para uso.'}</p>
                        <p><strong>Uso:</strong> {model.recommendedUse}</p>
                        <div className="model-detail-grid">
                          <span>Código: <strong>{capabilityLabel(model.capabilities.coding)}</strong></span>
                          <span>Raciocínio: <strong>{capabilityLabel(model.capabilities.reasoning)}</strong></span>
                          <span>Velocidade: <strong>{capabilityLabel(model.capabilities.speed)}</strong></span>
                        </div>
                        <div className="tag-row compact-tags">
                          {tagsForRow(model).map((tag) => <span key={tag} className="model-tag">{tag}</span>)}
                        </div>
                      </details>
                    </section>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </PremiumModal>

      <PremiumModal
        open={Boolean(pendingApplyAll)}
        title="Aplicar ambiente"
        description={pendingApplyAll ? `${pendingApplyAll.displayName} em ${sessions.length} sessão(ões).` : undefined}
        onClose={() => setPendingApplyAll(undefined)}
        className="compact-modal environment-apply-modal"
      >
        {pendingApplyAll ? (
          <div className="credential-modal-form">
            <p className="dialog-copy">Aplicar este ambiente a todos os chats?</p>
            <div className="dialog-actions">
              <button type="button" className="btn-modern" onClick={() => void applyAsDefaultOnly(pendingApplyAll)}>
                Somente novas mensagens
              </button>
              <button type="button" className="btn-modern btn-modern-primary" onClick={() => void applyToAll(pendingApplyAll)}>
                Aplicar a todas sessões
              </button>
              <button type="button" className="btn-modern" onClick={() => setPendingApplyAll(undefined)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </PremiumModal>

      <PremiumModal
        open={Boolean(credentialProvider)}
        title={`Configurar ${credentialProvider?.label ?? 'provider'}`}
        description={credentialProvider ? SETUP_URLS[credentialProvider.id]?.instruction : undefined}
        onClose={() => {
          setCredentialProviderId(undefined);
          setCredentialProfileId(undefined);
        }}
        className="compact-modal environment-api-modal"
      >
        {credentialProvider ? (
          <div className="credential-modal-form">
            <label>
              Nome da conta
              <input
                value={credentialModalName}
                placeholder="Principal"
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
                  if (credentialInvalid) setInlineError('Key inválida ou curta. Verifique a chave no painel do provider.');
                }}
                onChange={(value) => setCredentialInputs((current) => ({ ...current, [credentialProvider.id]: value }))}
              />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={defaultCredential} onChange={(event) => setDefaultCredential(event.target.checked)} />
              Tornar padrão para este provider
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn-modern"
                disabled={!onTestProvider || testingProviderId === credentialProvider.id || (credentialModalInput.trim().length > 0 && credentialInvalid)}
                onClick={() => {
                  if (credentialModalInput.trim()) void saveCredential(credentialProvider.id, false, true);
                  else void testProvider(credentialProvider.id);
                }}
              >
                {testingProviderId === credentialProvider.id ? 'Testando' : 'Testar conexão'}
              </button>
              <button
                type="button"
                className="btn-modern"
                disabled={!onSaveProviderProfileCredential || savingProviderId === credentialProvider.id || credentialInvalid || credentialModalInput.trim().length === 0}
                onClick={() => void saveCredential(credentialProvider.id, true, false)}
              >
                {savingProviderId === credentialProvider.id ? 'Salvando' : 'Salvar'}
              </button>
              <button
                type="button"
                className="btn-modern btn-modern-primary"
                disabled={!onSaveProviderProfileCredential || savingProviderId === credentialProvider.id || credentialInvalid || credentialModalInput.trim().length === 0}
                onClick={() => void saveCredential(credentialProvider.id, true, true)}
              >
                Salvar e testar
              </button>
              <button type="button" className="btn-modern" onClick={() => setCredentialProviderId(undefined)}>
                Cancelar
              </button>
            </div>
            {inlineError ? (
              <div className="inline-alert inline-alert-action">
                <span>{inlineError}</span>
                {SETUP_URLS[credentialProvider.id]?.url ? (
                  <button type="button" className="btn-modern" onClick={() => void openProviderLogin(credentialProvider)}>
                    {SETUP_URLS[credentialProvider.id]?.docsLabel ?? 'Ver documentação'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </PremiumModal>
    </>
  );
}
