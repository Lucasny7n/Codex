import { useEffect, useMemo, useState } from 'react';
import { UiIcon } from '../common/AppIcons';
import { CredentialInput, PopupMenu, PremiumModal, StatusDot } from '../common/PremiumUI';
import type {
  ExecutionMode,
  LocalModelInstallProgress,
  LocalRuntimeSnapshot,
  ProviderAccountProfile,
  ProviderCredentialStatus,
  ProviderRuntimeStatus,
  OllamaLibrarySearchResult,
} from '../../types/domain';
import { normalizeProviderStatus, type ProviderStatus } from '../../lib/providers/status';
import {
  visibleModelOptions,
  type ModelCatalogOption,
} from '../../lib/models/modelCatalogService';
import { discoverOllamaLibraryModels } from '../../lib/ollama/searchService';

export type TopBarModelOption = ModelCatalogOption;

interface TopBarProps {
  providerStatus?: ProviderRuntimeStatus;
  executionMode: ExecutionMode;
  activeModelLabel: string;
  selectedModelLabel: string;
  selectedModelId?: string;
  cloudModels: TopBarModelOption[];
  localModels: TopBarModelOption[];
  localRuntime?: LocalRuntimeSnapshot;
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
  onSetDefaultProviderProfile?: (providerId: string, profileId: string) => Promise<void>;
  onRenameProviderProfile?: (profileId: string, name: string) => Promise<void>;
  onRemoveProviderProfile?: (profileId: string) => Promise<void>;
  onTestProvider?: (providerId: string) => Promise<ProviderRuntimeStatus>;
  onInstallLocalModel?: (modelId: string) => Promise<void>;
  onRemoveLocalModel?: (modelId: string) => Promise<void>;
  onTestLocalModel?: (modelId: string) => Promise<boolean>;
  onStartTemporaryChat: () => void;
  onExitTemporaryChat: () => void;
}

function ModelOptionRow({
  option,
  active,
  onClick,
  onConfigure,
}: {
  option: TopBarModelOption;
  active: boolean;
  onClick: () => void;
  onConfigure: () => void;
}): JSX.Element {
  const canOpenConfig = !option.available;
  return (
    <div
      className={`model-picker-option-row ${active ? 'active' : ''} ${option.available ? '' : 'disabled'}`}
      data-testid={`model-row-${option.id}`}
      data-source={option.source}
      data-provider-type={option.providerType}
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
      <button
        type="button"
        className="model-picker-row-config"
        aria-label={`Configurar ${option.label}`}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          onConfigure();
        }}
      >
        ⋯
      </button>
    </div>
  );
}

function providerGroupLabel(option: TopBarModelOption, mode: ExecutionMode): string {
  if (mode === 'local') {
    if (option.providerLabel?.toLowerCase().includes('ollama')) return 'Ollama';
    if (option.providerId === 'local-ollama') return 'Ollama';
    if (option.family) return option.family;
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
    ? ['OpenRouter', 'OpenAI', 'Google / Gemini', 'Anthropic', 'Mistral', 'Groq', 'Together AI', 'Fireworks AI', 'Cerebras', 'Cohere', 'DeepSeek', 'xAI', 'Perplexity', 'OpenCode', 'Codex CLI', 'Outros provedores']
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

function localProgressDetails(progress: LocalModelInstallProgress | undefined): string {
  if (!progress) return '';
  return [progress.downloaded && progress.total ? `${progress.downloaded} / ${progress.total}` : undefined, progress.speed]
    .filter(Boolean)
    .join(' · ');
}

export function TopBar({
  providerStatus,
  executionMode,
  activeModelLabel,
  selectedModelLabel,
  selectedModelId,
  cloudModels,
  localModels,
  localRuntime,
  credentials = [],
  providerProfiles = [],
  installationProgress = {},
  busyModelId,
  temporaryChatActive,
  onSelectModel,
  onConfigureModels,
  onSaveProviderProfileCredential,
  onSetDefaultProviderProfile,
  onRenameProviderProfile,
  onRemoveProviderProfile,
  onTestProvider,
  onInstallLocalModel,
  onRemoveLocalModel,
  onTestLocalModel,
  onStartTemporaryChat,
  onExitTemporaryChat,
}: TopBarProps): JSX.Element {
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<ExecutionMode>(executionMode);
  const [query, setQuery] = useState('');
  const [configTarget, setConfigTarget] = useState<{ mode: ExecutionMode; option: TopBarModelOption }>();
  const [apiKey, setApiKey] = useState('');
  const [apiKeyName, setApiKeyName] = useState('Principal');
  const [selectedConfigProfileId, setSelectedConfigProfileId] = useState<string>();
  const [profileActionBusyId, setProfileActionBusyId] = useState<string>();
  const [profileMenuId, setProfileMenuId] = useState<string>();
  const [configStatus, setConfigStatus] = useState<'idle' | 'testing' | 'ready' | 'error'>('idle');
  const [configError, setConfigError] = useState<string>();
  const [ollamaSearchResults, setOllamaSearchResults] = useState<OllamaLibrarySearchResult[]>([]);
  const [ollamaSearchLoading, setOllamaSearchLoading] = useState(false);
  const providerStatusLabel = providerStatus?.state.replace('_', ' ') ?? 'offline';
  const environmentLabel = executionMode === 'local' ? 'Local' : 'Nuvem';
  const modelLabel = selectedModelLabel.trim() || 'Selecionar modelo';
  const safeCloudModels = useMemo(
    () => cloudModels.filter((item) => item.source === 'cloud' && item.providerType === 'cloud' && item.providerId !== 'local-ollama'),
    [cloudModels],
  );
  const safeLocalModels = useMemo(
    () => localModels.filter((item) => item.source === 'local' && item.providerType === 'local' && item.providerId === 'local-ollama'),
    [localModels],
  );
  const pickerOptions = useMemo(
    () => visibleModelOptions({
      mode: pickerMode,
      options: pickerMode === 'cloud' ? safeCloudModels : safeLocalModels,
      query,
      localRuntime,
      installationProgress,
      ollamaSearchResults,
    }),
    [installationProgress, localRuntime, ollamaSearchResults, pickerMode, query, safeCloudModels, safeLocalModels],
  );
  const pickerGroups = groupModelOptions(pickerOptions, pickerMode);
  const currentPickerOption = (pickerMode === 'cloud' ? safeCloudModels : safeLocalModels).find((option) => selectedModelId === option.id || selectedModelId === option.modelId || selectedModelLabel === option.label);
  const configCredential = credentialFor(configTarget?.option.providerId, credentials);
  const configProfiles = configTarget?.option.providerId
    ? providerProfiles.filter((profile) => profile.providerId === configTarget.option.providerId)
    : [];
  const creatingNewProfile = selectedConfigProfileId === '__new__';
  const selectedConfigProfile = creatingNewProfile ? undefined :
    configProfiles.find((profile) => profile.id === selectedConfigProfileId) ??
    configProfiles.find((profile) => profile.isDefault) ??
    configProfiles[0];
  const configProfile = creatingNewProfile ? undefined : selectedConfigProfile ?? profileFor(configTarget?.option.providerId, providerProfiles);
  const localProgress = configTarget ? installationProgress[configTarget.option.id] ?? installationProgress[configTarget.option.modelId ?? ''] : undefined;

  useEffect(() => {
    const trimmed = query.trim();
    if (pickerMode !== 'local' || trimmed.length < 2) {
      const clearTimer = window.setTimeout(() => {
        setOllamaSearchResults([]);
        setOllamaSearchLoading(false);
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setOllamaSearchLoading(true);
      void discoverOllamaLibraryModels(trimmed)
        .then((results) => {
          if (!cancelled) setOllamaSearchResults(results);
        })
        .finally(() => {
          if (!cancelled) setOllamaSearchLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pickerMode, query]);

  function openConfig(mode: ExecutionMode, option: TopBarModelOption): void {
    setModelMenuOpen(false);
    setConfigTarget({ mode, option });
    const profile = profileFor(option.providerId, providerProfiles);
    setSelectedConfigProfileId(profile?.source === 'environment' ? undefined : profile?.id);
    setApiKeyName(profile?.name ?? 'Principal');
    setApiKey('');
    setProfileMenuId(undefined);
    setConfigStatus(option.status === 'ready' ? 'ready' : option.status === 'invalid_api_key' || option.status === 'forbidden' ? 'error' : 'idle');
    setConfigError(option.status === 'invalid_api_key' || option.status === 'forbidden' ? option.statusLabel : undefined);
  }

  function applyProviderTestStatus(providerId: string, status: ProviderRuntimeStatus): void {
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
      return;
    }

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
      const editableProfileId = configProfile?.source === 'config_file' ? configProfile.id : undefined;
      const saved = await onSaveProviderProfileCredential(providerId, editableProfileId, apiKeyName.trim() || 'Principal', apiKey, true);
      setSelectedConfigProfileId(saved.id);
      setApiKeyName(saved.name);
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
        const editableProfileId = configProfile?.source === 'config_file' ? configProfile.id : undefined;
        const saved = await onSaveProviderProfileCredential(providerId, editableProfileId, apiKeyName.trim() || 'Principal', apiKey, true);
        setSelectedConfigProfileId(saved.id);
        setApiKeyName(saved.name);
        setApiKey('');
      }
      if (selectedConfigProfileId && configProfile?.source === 'config_file' && !configProfile.isDefault && onSetDefaultProviderProfile) {
        await onSetDefaultProviderProfile(providerId, selectedConfigProfileId);
      }
      applyProviderTestStatus(providerId, await onTestProvider(providerId));
    } catch (cause) {
      setConfigStatus('error');
      setConfigError(providerSpecificError(providerId, cause instanceof Error ? cause.message : 'Falha ao testar API.'));
    }
  }

  async function activateProfile(profile: ProviderAccountProfile): Promise<void> {
    const providerId = configTarget?.option.providerId;
    if (!providerId || !onSetDefaultProviderProfile || profile.source !== 'config_file') {
      setSelectedConfigProfileId(profile.id);
      setApiKeyName(profile.name);
      return;
    }
    setProfileActionBusyId(profile.id);
    setConfigError(undefined);
    try {
      await onSetDefaultProviderProfile(providerId, profile.id);
      setSelectedConfigProfileId(profile.id);
      setApiKeyName(profile.name);
    } catch (cause) {
      setConfigError(cause instanceof Error ? cause.message : 'Falha ao selecionar API key ativa.');
    } finally {
      setProfileActionBusyId(undefined);
    }
  }

  async function testProfile(profile: ProviderAccountProfile): Promise<void> {
    const providerId = configTarget?.option.providerId;
    if (!providerId || !onTestProvider) return;
    setProfileActionBusyId(profile.id);
    setProfileMenuId(undefined);
    setConfigStatus('testing');
    setConfigError(undefined);
    try {
      if (profile.source === 'config_file' && !profile.isDefault && onSetDefaultProviderProfile) {
        await onSetDefaultProviderProfile(providerId, profile.id);
      }
      setSelectedConfigProfileId(profile.id);
      setApiKeyName(profile.name);
      applyProviderTestStatus(providerId, await onTestProvider(providerId));
    } catch (cause) {
      setConfigStatus('error');
      setConfigError(providerSpecificError(providerId, cause instanceof Error ? cause.message : 'Falha ao testar API key.'));
    } finally {
      setProfileActionBusyId(undefined);
    }
  }

  async function removeProfile(profile: ProviderAccountProfile): Promise<void> {
    if (!onRemoveProviderProfile || profile.source !== 'config_file') return;
    setProfileActionBusyId(profile.id);
    setProfileMenuId(undefined);
    setConfigError(undefined);
    try {
      await onRemoveProviderProfile(profile.id);
      if (selectedConfigProfileId === profile.id) {
        setSelectedConfigProfileId(undefined);
        setApiKeyName('Principal');
      }
    } catch (cause) {
      setConfigError(cause instanceof Error ? cause.message : 'Falha ao excluir API key.');
    } finally {
      setProfileActionBusyId(undefined);
    }
  }

  async function renameProfile(): Promise<void> {
    const profile = configProfile;
    const nextName = apiKeyName.trim();
    if (!profile || !onRenameProviderProfile || profile.source !== 'config_file' || !nextName || nextName === profile.name) return;
    setProfileActionBusyId(profile.id);
    setConfigError(undefined);
    try {
      await onRenameProviderProfile(profile.id, nextName);
      setConfigStatus('idle');
    } catch (cause) {
      setConfigStatus('error');
      setConfigError(cause instanceof Error ? cause.message : 'Falha ao renomear API key.');
    } finally {
      setProfileActionBusyId(undefined);
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
          status: 'ready',
          statusLabel: 'Instalado',
        },
      });
      setConfigStatus('ready');
    } catch (cause) {
      setConfigStatus('error');
      setConfigError(cause instanceof Error ? cause.message : 'Falha ao baixar modelo local.');
    }
  }

  async function removeLocalModelFromModal(): Promise<void> {
    const target = configTarget;
    const modelId = target?.option.modelId ?? target?.option.id;
    if (!target || !modelId || !onRemoveLocalModel) return;
    setConfigStatus('testing');
    setConfigError(undefined);
    try {
      await onRemoveLocalModel(modelId);
      setConfigTarget({
        ...target,
        option: {
          ...target.option,
          installed: false,
          available: false,
          statusLabel: 'Download',
        },
      });
      setConfigStatus('idle');
    } catch (cause) {
      setConfigStatus('error');
      setConfigError(cause instanceof Error ? cause.message : 'Falha ao remover modelo local.');
    }
  }

  function setPickerTab(mode: ExecutionMode): void {
    setPickerMode(mode);
    setQuery('');
  }

  function pickerEmptyTitle(): string {
    if (pickerMode === 'cloud') return 'Nenhum modelo cloud configurado encontrado.';
    if (query.trim()) return 'Nenhum modelo Ollama encontrado para esta busca.';
    return 'Nenhum modelo Ollama instalado.';
  }

  function pickerEmptyDetail(): string {
    if (pickerMode === 'cloud') return 'Ajuste a busca ou configure um provider em Modelos.';
    if (query.trim()) return ollamaSearchLoading ? 'Buscando na biblioteca Ollama...' : 'Ajuste a busca ou tente outro nome aceito pelo Ollama.';
    return 'Abra o Model Manager local ou baixe um modelo pelo Ollama.';
  }

  function pickerSectionLabel(): string {
    return pickerMode === 'local' ? 'Ollama' : 'Provedores';
  }

  return (
    <>
    <header className="topbar-clean">
      <div className="popup-anchor">
        <button type="button" className="model-top-selector" onClick={() => { setPickerTab(executionMode); setModelMenuOpen((current) => !current); }} title={`${environmentLabel} ${modelLabel} • ${activeModelLabel}`}>
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
                  placeholder={pickerMode === 'local' ? 'Buscar modelos Ollama...' : 'Buscar modelo ou provedor...'}
                  aria-label={pickerMode === 'local' ? 'Buscar modelos Ollama' : 'Buscar modelo ou provedor'}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    const firstUsable = pickerOptions.find((option) => option.available);
                    if (!firstUsable) return;
                    event.preventDefault();
                    setModelMenuOpen(false);
                    onSelectModel(pickerMode, firstUsable.id);
                  }}
                />
              </label>
            </div>
            <div className="model-picker-tabs" role="tablist" aria-label="Origem dos modelos">
              <button type="button" className={pickerMode === 'cloud' ? 'active' : ''} role="tab" aria-selected={pickerMode === 'cloud'} onClick={() => setPickerTab('cloud')}>
                Nuvem
              </button>
              <button type="button" className={pickerMode === 'local' ? 'active' : ''} role="tab" aria-selected={pickerMode === 'local'} onClick={() => setPickerTab('local')}>
                Local
              </button>
            </div>
          </header>
          <span className="model-picker-section">{pickerSectionLabel()}</span>
          <div className="model-picker-scroll">
            {pickerGroups.length > 0 ? pickerGroups.map((group) => (
              <section key={group.label} className="model-picker-group">
                <span className="model-picker-group-title">{group.label}</span>
                {group.options.map((option) => (
                  <ModelOptionRow
                    key={option.id}
                    option={option}
                    active={executionMode === pickerMode && (selectedModelId === option.id || selectedModelId === option.modelId || selectedModelLabel === option.label)}
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
                <strong>{pickerEmptyTitle()}</strong>
                <span>{pickerEmptyDetail()}</span>
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
            <span>
              <strong>Status da API</strong>
              {configStatus === 'ready' ? 'funcionando' : configStatus === 'error' ? 'falhou' : configStatus === 'testing' ? 'testando' : 'não testado'}
            </span>
          </div>
          <div className="model-config-key-list" aria-label="API keys salvas">
            <div className="model-config-key-header">
              <span>API keys</span>
              <button
                type="button"
                className="settings-pill-button"
                onClick={() => {
                  setSelectedConfigProfileId('__new__');
                  setApiKeyName(`Key ${configProfiles.filter((profile) => profile.source === 'config_file').length + 1}`);
                  setApiKey('');
                }}
              >
                Adicionar key
              </button>
            </div>
            {configProfiles.length > 0 ? configProfiles.map((profile) => (
              <div key={profile.id} className={`model-config-key-row ${profile.id === selectedConfigProfileId || (!selectedConfigProfileId && profile.isDefault) ? 'active' : ''}`}>
                <button
                  type="button"
                  className="model-config-key-main"
                  onClick={() => void activateProfile(profile)}
                  disabled={profileActionBusyId === profile.id}
                >
                  <StatusDot tone={statusTone(profile.status as ProviderStatus)} />
                  <span>
                    <strong>{profile.name}{profile.isDefault ? ' · ativa' : ''}</strong>
                    <small>{profile.maskedCredential ?? 'sem key salva'} · {profile.status.replace(/_/g, ' ')}</small>
                  </span>
                </button>
                <div className="popup-anchor model-config-key-actions">
                  <button
                    type="button"
                    className="model-config-key-menu-button"
                    aria-label={`Ações da key ${profile.name}`}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setProfileMenuId((current) => current === profile.id ? undefined : profile.id);
                    }}
                  >
                    ⋯
                  </button>
                  <PopupMenu open={profileMenuId === profile.id} onClose={() => setProfileMenuId(undefined)} placement="auto" align="right">
                    <button
                      type="button"
                      disabled={profile.source !== 'config_file' || profile.isDefault || profileActionBusyId === profile.id}
                      onClick={() => {
                        setProfileMenuId(undefined);
                        void activateProfile(profile);
                      }}
                    >
                      Usar como padrão
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuId(undefined);
                        setSelectedConfigProfileId(profile.id);
                        setApiKeyName(profile.name);
                        setApiKey('');
                      }}
                    >
                      Editar/Substituir key
                    </button>
                    <button
                      type="button"
                      disabled={profileActionBusyId === profile.id}
                      onClick={() => void testProfile(profile)}
                    >
                      Testar key
                    </button>
                    <button
                      type="button"
                      disabled={profile.source !== 'config_file'}
                      onClick={() => {
                        setProfileMenuId(undefined);
                        setSelectedConfigProfileId(profile.id);
                        setApiKeyName(profile.name);
                        setApiKey('');
                      }}
                    >
                      Renomear key
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={profile.source !== 'config_file' || profileActionBusyId === profile.id}
                      onClick={() => void removeProfile(profile)}
                    >
                      Remover key
                    </button>
                  </PopupMenu>
                </div>
              </div>
            )) : (
              <span className="model-config-empty-key">Nenhuma API key salva para este provedor.</span>
            )}
          </div>
          <label>
            Nome da key
            <input
              className="input-modern"
              value={apiKeyName}
              placeholder="Principal"
              onChange={(event) => setApiKeyName(event.target.value)}
            />
          </label>
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
              {configProfile?.source === 'config_file' ? 'Substituir key' : 'Adicionar key'}
            </button>
            <button
              type="button"
              className="btn-modern"
              disabled={!onRenameProviderProfile || !configProfile || configProfile.source !== 'config_file' || !apiKeyName.trim() || apiKeyName.trim() === configProfile.name || profileActionBusyId === configProfile.id}
              onClick={() => void renameProfile()}
            >
              Salvar nome
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
              {configTarget.option.runtimeLabel ?? configTarget.option.providerLabel ?? 'Ollama'}
            </span>
            <span>
              <strong>Modelo</strong>
              {configTarget.option.modelId ?? configTarget.option.id}
            </span>
            <span>
              <strong>Tamanho estimado</strong>
              {configTarget.option.estimatedSize ?? 'Não informado'}
            </span>
            {configTarget.option.digest ? (
              <span>
                <strong>Digest</strong>
                {configTarget.option.digest}
              </span>
            ) : null}
            {configTarget.option.modifiedAt ? (
              <span>
                <strong>Atualizado</strong>
                {configTarget.option.modifiedAt}
              </span>
            ) : null}
          </div>
          <div className="model-config-status">
            <StatusDot tone={configTarget.option.installed ? 'ready' : configStatus === 'error' ? 'error' : 'offline'} />
            <span>Status: {configTarget.option.installed ? 'Instalado' : 'Não instalado'}</span>
          </div>
          {configTarget.option.heavy ? <span className="model-config-hint">Pesado · pode demorar</span> : null}
          {localProgress ? (
            <div className="model-config-progress" role="status">
              <span>
                {localProgress.message}
                {typeof localProgress.progressPercent === 'number' ? ` · ${localProgress.progressPercent}%` : ''}
              </span>
              {typeof localProgress.progressPercent === 'number' ? (
                <div className="model-config-progress-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(0, Math.min(100, localProgress.progressPercent))}%` }} />
                </div>
              ) : null}
              {localProgressDetails(localProgress) ? <small>{localProgressDetails(localProgress)}</small> : null}
            </div>
          ) : null}
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
            {configTarget.option.installed ? (
              <button
                type="button"
                className="btn-modern danger"
                disabled={!onRemoveLocalModel || busyModelId === configTarget.option.id || configStatus === 'testing'}
                onClick={() => void removeLocalModelFromModal()}
              >
                Remover modelo
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
