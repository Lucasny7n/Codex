import { useMemo, useState } from 'react';
import { UiIcon } from '../common/AppIcons';
import { CredentialInput, PopupMenu, PremiumModal, StatusDot } from '../common/PremiumUI';
import type {
  ExecutionMode,
  LocalModelInstallProgress,
  ProviderAccountProfile,
  ProviderCredentialStatus,
  ProviderRuntimeStatus,
} from '../../types/domain';
import { normalizeProviderStatus, type ProviderStatus } from '../../lib/providerStatus';

export interface TopBarModelOption {
  id: string;
  label: string;
  modelId?: string;
  providerId?: string;
  providerLabel?: string;
  family?: string;
  statusLabel?: string;
  status?: ProviderStatus;
  available: boolean;
  installed?: boolean;
  heavy?: boolean;
  searchTerms?: string[];
}

interface TopBarProps {
  providerStatus?: ProviderRuntimeStatus;
  executionMode: ExecutionMode;
  activeModelLabel: string;
  selectedModelLabel: string;
  selectedModelId?: string;
  cloudModels: TopBarModelOption[];
  localModels: TopBarModelOption[];
  credentials?: ProviderCredentialStatus[];
  providerProfiles?: ProviderAccountProfile[];
  installationProgress?: Record<string, LocalModelInstallProgress>;
  busyModelId?: string;
  temporaryChatActive?: boolean;
  onSelectModel: (mode: ExecutionMode, modelId: string) => void;
  onConfigureModels: () => void;
  onSaveProviderProfileCredential?: (
    providerId: string,
    profileId: string | undefined,
    name: string,
    key: string,
    makeDefault: boolean,
  ) => Promise<ProviderAccountProfile>;
  onTestProvider?: (providerId: string) => Promise<ProviderRuntimeStatus>;
  onInstallLocalModel?: (modelId: string) => Promise<void>;
  onTestLocalModel?: (modelId: string) => Promise<boolean>;
  onStartTemporaryChat: () => void;
  onExitTemporaryChat: () => void;
}

function ModelOptionRow({
  option,
  active,
  showConfigure,
  onHover,
  onClick,
  onConfigure,
}: {
  option: TopBarModelOption;
  active: boolean;
  showConfigure: boolean;
  onHover: (active: boolean) => void;
  onClick: () => void;
  onConfigure: () => void;
}): JSX.Element {
  const canOpenConfig = !option.available;
  return (
    <div
      className={`model-picker-option-row ${active ? 'active' : ''} ${option.available ? '' : 'disabled'} ${showConfigure ? 'show-config' : ''}`}
      data-testid={`model-row-${option.id}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onHover(false);
      }}
    >
      <button
        type="button"
        className="model-picker-option menu-item"
        aria-current={active ? 'true' : undefined}
        data-status={option.status}
        onClick={option.available ? onClick : canOpenConfig ? onConfigure : undefined}
      >
        <span className="model-picker-option-copy">
          <strong>{option.label}</strong>
          <small className="model-picker-status-label">
            <StatusDot tone={statusTone(option.status)} />
            {option.statusLabel ?? (option.available ? 'Configurado' : 'Configurar ou testar')}
            {option.heavy ? ' · Pesado' : ''}
          </small>
        </span>
      </button>
      {showConfigure ? (
        <button
          type="button"
          className="model-picker-row-config"
          aria-label={`Configurar ${option.label}`}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onConfigure();
          }}
        >
          ⋯
        </button>
      ) : <span className="model-picker-row-config-placeholder" aria-hidden="true" />}
    </div>
  );
}

function providerGroupLabel(option: TopBarModelOption, mode: ExecutionMode): string {
  if (mode === 'local') {
    if (option.family) return option.family;
    if (option.providerLabel?.toLowerCase().includes('ollama')) return 'Ollama';
    if (option.providerLabel?.toLowerCase().includes('lm studio')) return 'LM Studio';
    return option.providerLabel ?? 'Outros locais';
  }
  const label = option.providerLabel?.toLowerCase() ?? '';
  if (label.includes('openai')) return 'OpenAI';
  if (label.includes('gemini') || label.includes('google')) return 'Google / Gemini';
  if (label.includes('anthropic') || label.includes('claude')) return 'Anthropic';
  if (label.includes('openrouter')) return 'OpenRouter';
  if (label.includes('mistral')) return 'Mistral';
  if (label.includes('groq')) return 'Groq';
  if (label.includes('together')) return 'Together AI';
  if (label.includes('fireworks')) return 'Fireworks AI';
  if (label.includes('cerebras')) return 'Cerebras';
  if (label.includes('cohere')) return 'Cohere';
  if (label.includes('deepseek')) return 'DeepSeek';
  if (label.includes('xai') || label.includes('grok')) return 'xAI';
  if (label.includes('perplexity')) return 'Perplexity';
  if (label.includes('opencode')) return 'OpenCode';
  if (label.includes('codex')) return 'Codex CLI';
  return option.providerLabel ?? 'Outros provedores';
}

function groupModelOptions(options: TopBarModelOption[], mode: ExecutionMode): Array<{ label: string; options: TopBarModelOption[] }> {
  const order = mode === 'cloud'
    ? ['OpenAI', 'Google / Gemini', 'Anthropic', 'OpenRouter', 'Mistral', 'Groq', 'Together AI', 'Fireworks AI', 'Cerebras', 'Cohere', 'DeepSeek', 'xAI', 'Perplexity', 'OpenCode', 'Codex CLI', 'Outros provedores']
    : ['Ollama', 'Qwen', 'Llama', 'DeepSeek', 'Mistral', 'Phi', 'Gemma', 'CodeLlama', 'StarCoder', 'Yi', 'Outros locais'];
  const groups = new Map<string, TopBarModelOption[]>();
  for (const option of options) {
    const label = providerGroupLabel(option, mode);
    groups.set(label, [...(groups.get(label) ?? []), option]);
  }
  return [...order, ...Array.from(groups.keys()).filter((label) => !order.includes(label))]
    .filter((label) => groups.has(label))
    .map((label) => ({
      label,
      options: [...(groups.get(label) ?? [])].sort((left, right) => {
        if (left.available !== right.available) return left.available ? -1 : 1;
        return left.label.localeCompare(right.label);
      }),
    }));
}

function modelOptionMatches(option: TopBarModelOption, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    option.label,
    option.providerLabel,
    option.family,
    option.statusLabel,
    ...(option.searchTerms ?? []),
    option.available ? 'configurado instalado pronto ready' : 'configurar testar nao instalado indisponivel',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function credentialFor(providerId: string | undefined, credentials: ProviderCredentialStatus[]): ProviderCredentialStatus | undefined {
  if (!providerId) return undefined;
  return credentials.find((credential) => credential.providerId === providerId);
}

function profileFor(providerId: string | undefined, profiles: ProviderAccountProfile[]): ProviderAccountProfile | undefined {
  if (!providerId) return undefined;
  const matches = profiles.filter((profile) => profile.providerId === providerId);
  return matches.find((profile) => profile.isDefault) ?? matches[0];
}

function statusTone(status: ProviderStatus | undefined): 'ready' | 'warning' | 'error' | 'offline' {
  if (status === 'ready') return 'ready';
  if (status === 'invalid_api_key' || status === 'forbidden' || status === 'quota_exceeded' || status === 'provider_unavailable') return 'error';
  if (status === 'testing' || status === 'requires_api_key' || status === 'requires_login' || status === 'rate_limited') return 'warning';
  return 'offline';
}

function providerSpecificError(providerId: string | undefined, message: string): string {
  if (!providerId) return message;
  if (providerId === 'openrouter-api') return `OpenRouter: ${message}`;
  if (providerId === 'gemini-api') return `Gemini: ${message}`;
  if (providerId === 'openai-api') return `OpenAI: ${message}`;
  if (providerId === 'anthropic-api') return `Anthropic: ${message}`;
  if (providerId === 'cerebras-api') return `Cerebras: ${message}`;
  return message;
}

export function TopBar({
  providerStatus,
  executionMode,
  activeModelLabel,
  selectedModelLabel,
  selectedModelId,
  cloudModels,
  localModels,
  credentials = [],
  providerProfiles = [],
  installationProgress = {},
  busyModelId,
  temporaryChatActive,
  onSelectModel,
  onConfigureModels,
  onSaveProviderProfileCredential,
  onTestProvider,
  onInstallLocalModel,
  onTestLocalModel,
  onStartTemporaryChat,
  onExitTemporaryChat,
}: TopBarProps): JSX.Element {
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<ExecutionMode>(executionMode);
  const [query, setQuery] = useState('');
  const [configTarget, setConfigTarget] = useState<{ mode: ExecutionMode; option: TopBarModelOption }>();
  const [apiKey, setApiKey] = useState('');
  const [configStatus, setConfigStatus] = useState<'idle' | 'testing' | 'ready' | 'error'>('idle');
  const [configError, setConfigError] = useState<string>();
  const [hoveredOptionId, setHoveredOptionId] = useState<string>();
  const providerStatusLabel = providerStatus?.state.replace('_', ' ') ?? 'offline';
  const environmentLabel = executionMode === 'local' ? 'Local' : 'Nuvem';
  const modelLabel = selectedModelLabel.trim() || 'Selecionar modelo';
  const pickerOptions = useMemo(
    () => (pickerMode === 'cloud' ? cloudModels : localModels).filter((option) => modelOptionMatches(option, query)),
    [cloudModels, localModels, pickerMode, query],
  );
  const pickerGroups = groupModelOptions(pickerOptions, pickerMode);
  const currentPickerOption = (pickerMode === 'cloud' ? cloudModels : localModels).find((option) => selectedModelId === option.id || selectedModelId === option.modelId || selectedModelLabel === option.label);
  const configCredential = credentialFor(configTarget?.option.providerId, credentials);
  const configProfile = profileFor(configTarget?.option.providerId, providerProfiles);
  const localProgress = configTarget ? installationProgress[configTarget.option.id] ?? installationProgress[configTarget.option.modelId ?? ''] : undefined;

  function openConfig(mode: ExecutionMode, option: TopBarModelOption): void {
    setModelMenuOpen(false);
    setConfigTarget({ mode, option });
    setApiKey('');
    setConfigStatus(option.status === 'ready' ? 'ready' : option.status === 'invalid_api_key' || option.status === 'forbidden' ? 'error' : 'idle');
    setConfigError(option.status === 'invalid_api_key' || option.status === 'forbidden' ? option.statusLabel : undefined);
  }

  async function saveApiKey(): Promise<void> {
    const providerId = configTarget?.option.providerId;
    if (!providerId || !onSaveProviderProfileCredential) return;
    if (apiKey.trim().length < 12) {
      setConfigStatus('error');
      setConfigError('API key curta ou vazia.');
      return;
    }
    setConfigError(undefined);
    try {
      await onSaveProviderProfileCredential(providerId, configProfile?.id, configProfile?.name ?? 'Principal', apiKey, true);
      setApiKey('');
      setConfigStatus('idle');
      setConfigTarget((current) => current ? {
        ...current,
        option: {
          ...current.option,
          available: false,
          status: 'testing',
          statusLabel: 'Testar conexão',
        },
      } : current);
    } catch (cause) {
      setConfigStatus('error');
      setConfigError(providerSpecificError(providerId, cause instanceof Error ? cause.message : 'Falha ao salvar API key.'));
    }
  }

  async function testApiKey(): Promise<void> {
    const providerId = configTarget?.option.providerId;
    if (!providerId || !onTestProvider) return;
    setConfigStatus('testing');
    setConfigError(undefined);
    try {
      if (apiKey.trim()) {
        if (!onSaveProviderProfileCredential || apiKey.trim().length < 12) {
          setConfigStatus('error');
          setConfigError(providerSpecificError(providerId, 'API key curta ou vazia.'));
          return;
        }
        await onSaveProviderProfileCredential(providerId, configProfile?.id, configProfile?.name ?? 'Principal', apiKey, true);
        setApiKey('');
      }
      const status = await onTestProvider(providerId);
      if (status.state === 'ready') {
        setConfigStatus('ready');
        setConfigTarget((current) => current ? {
          ...current,
          option: {
            ...current.option,
            available: true,
            status: 'ready',
            statusLabel: 'Configurado',
          },
        } : current);
      } else {
        setConfigStatus('error');
        setConfigError(providerSpecificError(providerId, status.message));
        const normalizedStatus = normalizeProviderStatus(status.state);
        setConfigTarget((current) => current ? {
          ...current,
          option: {
            ...current.option,
            available: false,
            status: normalizedStatus,
            statusLabel: status.state === 'invalid_api_key' ? 'API key inválida' : 'Corrigir provider',
          },
        } : current);
      }
    } catch (cause) {
      setConfigStatus('error');
      setConfigError(providerSpecificError(providerId, cause instanceof Error ? cause.message : 'Falha ao testar API.'));
    }
  }

  async function testLocalModel(): Promise<void> {
    const modelId = configTarget?.option.modelId ?? configTarget?.option.id;
    if (!modelId || !onTestLocalModel) return;
    setConfigStatus('testing');
    setConfigError(undefined);
    try {
      const ok = await onTestLocalModel(modelId);
      setConfigStatus(ok ? 'ready' : 'error');
      if (!ok) setConfigError('Runtime local não confirmou este modelo.');
    } catch (cause) {
      setConfigStatus('error');
      setConfigError(cause instanceof Error ? cause.message : 'Falha ao testar modelo local.');
    }
  }

  async function installLocalModelFromModal(): Promise<void> {
    const target = configTarget;
    const modelId = target?.option.modelId ?? target?.option.id;
    if (!target || !modelId || !onInstallLocalModel) return;
    setConfigStatus('testing');
    setConfigError(undefined);
    try {
      await onInstallLocalModel(modelId);
      setConfigTarget({
        ...target,
        option: {
          ...target.option,
          installed: true,
          available: true,
          statusLabel: 'Instalado',
        },
      });
      setConfigStatus('ready');
    } catch (cause) {
      setConfigStatus('error');
      setConfigError(cause instanceof Error ? cause.message : 'Falha ao baixar modelo local.');
    }
  }

  return (
    <>
    <header className="topbar-clean">
      <div className="popup-anchor">
        <button type="button" className="model-top-selector" onClick={() => { setPickerMode(executionMode); setModelMenuOpen((current) => !current); }} title={`${environmentLabel} ${modelLabel} • ${activeModelLabel}`}>
          <span className="model-top-mode">{environmentLabel}</span>
          <span className="model-top-name">{modelLabel}</span>
          <UiIcon name="chevronDown" className="model-top-chevron" />
        </button>
        <PopupMenu open={modelMenuOpen} onClose={() => setModelMenuOpen(false)} align="left" className="model-picker-menu">
          <header className="model-picker-header">
            <div className="model-picker-title-row">
              <span className="model-picker-title">Modelos</span>
              <label className="model-picker-search">
                <UiIcon name="search" className="model-picker-search-icon" />
                <input
                  value={query}
                  placeholder="Buscar modelo ou provedor..."
                  aria-label="Buscar modelo ou provedor"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="model-picker-tabs" role="tablist" aria-label="Origem dos modelos">
              <button type="button" className={pickerMode === 'cloud' ? 'active' : ''} role="tab" aria-selected={pickerMode === 'cloud'} onClick={() => setPickerMode('cloud')}>
                Nuvem
              </button>
              <button type="button" className={pickerMode === 'local' ? 'active' : ''} role="tab" aria-selected={pickerMode === 'local'} onClick={() => setPickerMode('local')}>
                Local
              </button>
            </div>
          </header>
          <span className="model-picker-section">Provedores</span>
          <div className="model-picker-scroll">
            {pickerGroups.length > 0 ? pickerGroups.map((group) => (
              <section key={group.label} className="model-picker-group">
                <span className="model-picker-group-title">{group.label}</span>
                {group.options.map((option) => (
                  <ModelOptionRow
                    key={option.id}
                    option={option}
                    active={executionMode === pickerMode && (selectedModelId === option.id || selectedModelId === option.modelId || selectedModelLabel === option.label)}
                    showConfigure={hoveredOptionId === option.id}
                    onHover={(visible) => setHoveredOptionId(visible ? option.id : undefined)}
                    onClick={() => {
                      setModelMenuOpen(false);
                      onSelectModel(pickerMode, option.id);
                    }}
                    onConfigure={() => openConfig(pickerMode, option)}
                  />
                ))}
              </section>
            )) : (
              <div className="model-picker-empty" role="status">
                <strong>Nenhum modelo encontrado</strong>
                <span>Ajuste a busca ou troque entre Nuvem e Local.</span>
              </div>
            )}
          </div>
          <span className="popup-menu-separator" aria-hidden="true" />
          <button
            type="button"
            className="menu-item model-picker-configure"
            onClick={() => {
              setModelMenuOpen(false);
              if (currentPickerOption) openConfig(pickerMode, currentPickerOption);
              else onConfigureModels();
            }}
          >
            <UiIcon name="settings" className="menu-icon menu-item-icon" />
            Configurar modelos
          </button>
        </PopupMenu>
      </div>

      <div className="topbar-clean-spacer" />

      <div className="topbar-clean-actions" aria-label="Controle">
        {temporaryChatActive ? (
          <div className="temporary-chat-pill" aria-label="Bate-papo temporário ativo">
            <span>Bate-papo Temporário</span>
            <button type="button" onClick={onExitTemporaryChat} aria-label="Sair do Bate-papo Temporário">
              <UiIcon name="x" />
            </button>
          </div>
        ) : (
          <button className="topbar-bot-button" type="button" onClick={onStartTemporaryChat} aria-label={`Iniciar Bate-papo Temporário, provider ${providerStatusLabel}`}>
            <UiIcon name="more" className="topbar-more-icon" />
          </button>
        )}
      </div>
    </header>
    <PremiumModal
      open={Boolean(configTarget)}
      title={configTarget?.option.label ?? 'Modelo'}
      onClose={() => setConfigTarget(undefined)}
      className="compact-modal model-config-modal"
    >
      {configTarget?.mode === 'cloud' ? (
        <div className="model-config-form">
          <div className="model-config-summary">
            <strong>{configTarget.option.label}</strong>
            <span>{configTarget.option.providerLabel ?? configTarget.option.providerId ?? 'Provider cloud'}</span>
            <small>Esta chave será usada pelos modelos deste provedor.</small>
          </div>
          <div className="model-config-meta">
            <span>
              <strong>Fornecedor</strong>
              {configTarget.option.providerLabel ?? configTarget.option.providerId ?? 'Não informado'}
            </span>
            <span>
              <strong>Modelo</strong>
              {configTarget.option.modelId ?? configTarget.option.id}
            </span>
          </div>
          <label>
            API Key
            <CredentialInput
              value={apiKey}
              placeholder={configCredential?.maskedKey ?? configProfile?.maskedCredential ?? 'Cole a API key'}
              invalid={apiKey.trim().length > 0 && apiKey.trim().length < 12}
              onChange={setApiKey}
            />
          </label>
          <div className="model-config-status">
            <StatusDot tone={configStatus === 'ready' ? 'ready' : configStatus === 'error' ? 'error' : 'offline'} />
            <span>Status: {configStatus === 'ready' ? 'funcionando' : configStatus === 'error' ? 'falhou' : configStatus === 'testing' ? 'testando' : 'não testado'}</span>
          </div>
          {configError ? <div className="input-error-tip" role="alert">{configError}</div> : null}
          <div className="dialog-actions">
            <button type="button" className="btn-modern" disabled={!onSaveProviderProfileCredential || apiKey.trim().length < 12} onClick={() => void saveApiKey()}>
              Salvar API
            </button>
            <button type="button" className="btn-modern btn-modern-primary" disabled={!onTestProvider || configStatus === 'testing'} onClick={() => void testApiKey()}>
              Testar API
            </button>
          </div>
        </div>
      ) : null}
      {configTarget?.mode === 'local' ? (
        <div className="model-config-form">
          <div className="model-config-summary">
            <strong>{configTarget.option.label}</strong>
            <span>{configTarget.option.providerLabel ?? 'Ollama'}</span>
          </div>
          <div className="model-config-meta">
            <span>
              <strong>Runtime</strong>
              {configTarget.option.providerLabel ?? 'Ollama'}
            </span>
            <span>
              <strong>Modelo</strong>
              {configTarget.option.modelId ?? configTarget.option.id}
            </span>
          </div>
          <div className="model-config-status">
            <StatusDot tone={configTarget.option.installed ? 'ready' : configStatus === 'error' ? 'error' : 'offline'} />
            <span>Status: {configTarget.option.installed ? 'Instalado' : 'Não instalado'}</span>
          </div>
          {configTarget.option.heavy ? <span className="model-config-hint">Pesado · pode demorar</span> : null}
          {localProgress ? <span className="model-config-hint">{localProgress.message}{typeof localProgress.progressPercent === 'number' ? ` · ${localProgress.progressPercent}%` : ''}</span> : null}
          {configError ? <div className="input-error-tip" role="alert">{configError}</div> : null}
          <div className="dialog-actions">
            {!configTarget.option.installed ? (
              <button
                type="button"
                className="btn-modern btn-modern-primary"
                disabled={!onInstallLocalModel || busyModelId === configTarget.option.id}
                onClick={() => void installLocalModelFromModal()}
              >
                Download{typeof localProgress?.progressPercent === 'number' ? ` ${localProgress.progressPercent}%` : ''}
              </button>
            ) : null}
            <button type="button" className="btn-modern" disabled={!onTestLocalModel || configStatus === 'testing'} onClick={() => void testLocalModel()}>
              Testar
            </button>
          </div>
        </div>
      ) : null}
    </PremiumModal>
    </>
  );
}
