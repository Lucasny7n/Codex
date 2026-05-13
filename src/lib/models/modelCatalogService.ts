import {
  modelRegistry,
  type CloudModelProfile,
  type LocalModelProfile,
  type ModelModality,
} from './modelRegistry';
import {
  isInstalledOllamaModel,
  normalizeOllamaModelId,
  ollamaIdentityTerms,
} from '../ollama/catalogService';
import {
  searchOllamaModels,
  type OllamaSearchItem,
} from '../ollama/searchService';
import {
  canSelectModel,
  normalizeProviderStatus,
  resolveModelStatus,
  type ProviderStatus,
} from '../providers/status';
import type {
  ExecutionMode,
  LocalInstalledModel,
  LocalModelInstallProgress,
  LocalRuntimeSnapshot,
  ModelDescriptor,
  OllamaLibrarySearchResult,
  ProviderAccountProfile,
  ProviderDescriptor,
  ProviderRuntimeStatus,
} from '../../types/domain';

export type ModelCatalogSource = 'cloud' | 'local';
export type ModelProviderType = 'cloud' | 'local';

export interface ModelCatalogMetadata {
  provider: string;
  type: ModelCatalogSource;
  capabilities: string[];
  contextWindow?: number;
  multimodal: boolean;
  promptPresetIds: string[];
  contextFragmentScopes: string[];
  technicalLogScope: 'provider' | 'runtime';
  ragReady: boolean;
  toolPermissionScopes: string[];
}

export interface ModelCatalogOption {
  id: string;
  label: string;
  source: ModelCatalogSource;
  providerType: ModelProviderType;
  modelId?: string;
  providerId?: string;
  providerLabel?: string;
  family?: string;
  statusLabel?: string;
  status?: ProviderStatus;
  available: boolean;
  installed?: boolean;
  heavy?: boolean;
  estimatedSize?: string;
  digest?: string;
  modifiedAt?: string;
  runtimeLabel?: string;
  searchTerms?: string[];
  configured: boolean;
  ready: boolean;
  metadata: ModelCatalogMetadata;
}

export function isLocalModelInstalled(runtime: LocalRuntimeSnapshot | undefined, modelId: string): boolean {
  return isInstalledOllamaModel(runtime, modelId);
}

export function localFamilyLabel(model: LocalModelProfile): string {
  return localFamilyLabelFromText(`${model.family} ${model.displayName}`);
}

function localFamilyLabelFromText(text: string): string {
  const value = text.toLowerCase();
  if (value.includes('qwen')) return 'Qwen';
  if (value.includes('codellama') || value.includes('codegemma')) return value.includes('codegemma') ? 'CodeGemma' : 'CodeLlama';
  if (value.includes('llama')) return 'Llama';
  if (value.includes('deepseek')) return 'DeepSeek';
  if (value.includes('mistral') || value.includes('mixtral') || value.includes('codestral') || value.includes('devstral')) return 'Mistral';
  if (value.includes('phi')) return 'Phi';
  if (value.includes('gemma')) return 'Gemma';
  if (value.includes('starcoder')) return 'StarCoder';
  if (value.includes('granite')) return 'Granite Code';
  if (value.includes('nous') || value.includes('hermes')) return 'Nous Hermes';
  if (value.includes('dolphin')) return 'Dolphin';
  if (value.includes('yi')) return 'Yi';
  if (value.includes('tinyllama')) return 'TinyLlama';
  if (value.includes('smollm')) return 'SmolLM';
  if (value.includes('openchat')) return 'OpenChat';
  if (value.includes('wizardcoder')) return 'WizardCoder';
  return 'Outros locais';
}

function localRuntimeStatus(runtime: LocalRuntimeSnapshot | undefined): ProviderStatus {
  if (!runtime?.installed) return 'not_installed';
  if (runtime.state === 'service_offline') return 'service_offline';
  if (runtime.state === 'api_unreachable') return 'api_unreachable';
  if (runtime.state === 'installing') return 'installing';
  if (runtime.state === 'error') return 'unavailable';
  return runtime.apiReachable ? 'ready' : 'api_unreachable';
}

export function statusLabelFromState(state: string, mode: ExecutionMode): string {
  if (mode === 'local' && state === 'ready') return 'Instalado';
  if (state === 'ready') return 'Configurado';
  if (state === 'model_missing') return mode === 'local' ? 'Download' : 'Catálogo';
  if (state === 'pulling' || state === 'installing') return mode === 'local' ? 'Baixando' : 'Testando';
  if (state === 'testing') return 'Testar conexão';
  if (state === 'requires_api_key' || state === 'invalid_api_key') return mode === 'cloud' ? 'Configurar API' : 'Configurar';
  if (state === 'requires_login' || state === 'requires_cli_auth' || state === 'requires_oauth') return 'Fazer login';
  if (state === 'not_installed') return mode === 'local' ? 'Instalar runtime' : 'Catálogo';
  if (state === 'service_offline') return 'Iniciar serviço';
  if (state === 'api_unreachable') return 'Reparar local';
  if (['misconfigured', 'experimental', 'unavailable', 'provider_unavailable', 'not_configured'].includes(state)) return 'Catálogo';
  return state.replace(/_/g, ' ');
}

function readyProfileForProvider(
  providerId: string,
  profiles: ProviderAccountProfile[],
): ProviderAccountProfile | undefined {
  const matches = profiles.filter((profile) => profile.providerId === providerId);
  return matches.find((profile) => profile.isDefault && profile.status === 'ready') ?? matches.find((profile) => profile.status === 'ready');
}

function providerHasProfiles(providerId: string, profiles: ProviderAccountProfile[]): boolean {
  return profiles.some((profile) => profile.providerId === providerId);
}

function isLocalProviderId(providerId: string | undefined): boolean {
  return providerId === 'local-ollama' || providerId?.startsWith('local-') === true;
}

function isCloudProvider(provider: ProviderDescriptor): boolean {
  return !isLocalProviderId(provider.id);
}

function multimodal(modalities: ModelModality[]): boolean {
  return modalities.some((item) => item !== 'text' && item !== 'code');
}

function cloudMetadata(model: CloudModelProfile): ModelCatalogMetadata {
  return {
    provider: model.providerId,
    type: 'cloud',
    capabilities: [...new Set([...model.modalities, ...model.tags, ...model.bestFor])],
    multimodal: multimodal(model.modalities),
    promptPresetIds: [`cloud:${model.providerId}:default`],
    contextFragmentScopes: ['session', 'workspace'],
    technicalLogScope: 'provider',
    ragReady: false,
    toolPermissionScopes: model.modalities.includes('code') ? ['workspace-read', 'workspace-write'] : ['workspace-read'],
  };
}

function providerModelMetadata(provider: ProviderDescriptor, model: ModelDescriptor): ModelCatalogMetadata {
  return {
    provider: provider.id,
    type: 'cloud',
    capabilities: model.supportsTools ? ['text', 'tools'] : ['text'],
    contextWindow: model.contextWindow,
    multimodal: false,
    promptPresetIds: [`cloud:${provider.id}:default`],
    contextFragmentScopes: ['session', 'workspace'],
    technicalLogScope: 'provider',
    ragReady: false,
    toolPermissionScopes: model.supportsTools ? ['workspace-read', 'workspace-write', 'tool-call'] : ['workspace-read'],
  };
}

function installedLocalMetadata(model: LocalInstalledModel): ModelCatalogMetadata {
  return {
    provider: 'local-ollama',
    type: 'local',
    capabilities: ['text', localFamilyLabelFromText(model.id)],
    multimodal: false,
    promptPresetIds: ['local:ollama:default'],
    contextFragmentScopes: ['session', 'workspace'],
    technicalLogScope: 'runtime',
    ragReady: false,
    toolPermissionScopes: ['workspace-read'],
  };
}

function cloudSearchTerms(model: CloudModelProfile): string[] {
  const openRouterDiscoveryTerms = model.providerId === 'openrouter-api'
    ? ['openrouter', 'router', 'catalogo openrouter', 'descoberta openrouter', 'gateway']
    : [];
  return [
    model.id,
    model.modelId,
    model.providerId,
    model.provider,
    model.mode,
    ...openRouterDiscoveryTerms,
    ...model.modalities,
    ...model.tags,
    ...model.bestFor,
    ...model.strengths,
  ];
}

function providerModelSearchTerms(provider: ProviderDescriptor, model: ModelDescriptor): string[] {
  const openRouterDiscoveryTerms = provider.id === 'openrouter-api'
    ? ['openrouter', 'router', 'catalogo openrouter', 'descoberta openrouter', 'gateway']
    : [];
  return [
    model.id,
    model.label,
    provider.id,
    provider.label,
    model.supportsTools ? 'tools ferramentas' : '',
    model.contextWindow ? `${model.contextWindow}` : '',
    ...openRouterDiscoveryTerms,
  ];
}

export function buildCloudModelOptions(input: {
  providers: ProviderDescriptor[];
  providerProfiles: ProviderAccountProfile[];
  localRuntime?: LocalRuntimeSnapshot;
}): ModelCatalogOption[] {
  const registryOptions = modelRegistry.byMode('cloud')
    .filter((model): model is CloudModelProfile => model.mode === 'cloud')
    .map((model) => {
      const provider = input.providers.find((item) => item.id === model.providerId);
      const status = provider ? resolveModelStatus(model, provider.status, input.localRuntime) : 'unavailable';
      const hasProfiles = providerHasProfiles(model.providerId, input.providerProfiles);
      const readyProfile = readyProfileForProvider(model.providerId, input.providerProfiles);
      const available = canSelectModel(status) && (!hasProfiles || Boolean(readyProfile));
      return {
        id: model.id,
        source: 'cloud',
        providerType: 'cloud',
        modelId: model.modelId,
        providerId: model.providerId,
        label: model.displayName,
        providerLabel: model.providerLabel,
        status,
        statusLabel: available ? 'Configurado' : statusLabelFromState(status, 'cloud'),
        available,
        configured: Boolean(provider) && (hasProfiles ? Boolean(readyProfile) : canSelectModel(status)),
        installed: false,
        ready: available,
        metadata: cloudMetadata(model),
        searchTerms: cloudSearchTerms(model),
      } satisfies ModelCatalogOption;
    });
  const catalogKeys = new Set(registryOptions.map((option) => `${option.providerId ?? ''}:${option.modelId ?? option.id}`));
  const discoveredOptions = input.providers.filter(isCloudProvider).flatMap((provider) => provider.models
    .filter((model) => !catalogKeys.has(`${provider.id}:${model.id}`))
    .map((model) => {
      const status = normalizeProviderStatus(provider.status.state);
      const hasProfiles = providerHasProfiles(provider.id, input.providerProfiles);
      const readyProfile = readyProfileForProvider(provider.id, input.providerProfiles);
      const available = canSelectModel(status) && (!hasProfiles || Boolean(readyProfile));
      return {
        id: model.id,
        source: 'cloud',
        providerType: 'cloud',
        modelId: model.id,
        providerId: provider.id,
        label: model.label,
        providerLabel: provider.label,
        status,
        statusLabel: available ? 'Configurado' : statusLabelFromState(status, 'cloud'),
        available,
        configured: hasProfiles ? Boolean(readyProfile) : canSelectModel(status),
        installed: false,
        ready: available,
        metadata: providerModelMetadata(provider, model),
        searchTerms: providerModelSearchTerms(provider, model),
      } satisfies ModelCatalogOption;
    }));
  return [...registryOptions, ...discoveredOptions];
}

export function buildLocalModelOptions(input: {
  localRuntime?: LocalRuntimeSnapshot;
  providerStatus?: ProviderRuntimeStatus;
  installationProgress?: Record<string, LocalModelInstallProgress>;
}): ModelCatalogOption[] {
  return searchOllamaModels('', input.localRuntime, {
    installationProgress: input.installationProgress,
    includeFallback: false,
  }).map((item) => localSearchItemOption(item, localRuntimeStatus(input.localRuntime)));
}

function localSearchItemOption(item: OllamaSearchItem, runtimeStatus: ProviderStatus): ModelCatalogOption {
  const runtimeReady = canSelectModel(runtimeStatus);
  const ready = item.installed && runtimeReady;
  const status: ProviderStatus = item.installed ? runtimeStatus : item.statusLabel === 'Baixando' ? 'pulling' : 'model_missing';
  return {
    id: item.id,
    source: 'local',
    providerType: 'local',
    modelId: item.modelId,
    providerId: 'local-ollama',
    label: item.label,
    providerLabel: 'Ollama',
    family: item.family,
    status,
    statusLabel: item.installed && runtimeStatus !== 'ready' ? statusLabelFromState(runtimeStatus, 'local') : item.statusLabel,
    available: ready,
    installed: item.installed,
    configured: item.installed,
    ready,
    estimatedSize: item.sizeLabel,
    digest: item.digest,
    modifiedAt: item.modifiedAt,
    runtimeLabel: 'Ollama',
    metadata: item.installed
      ? installedLocalMetadata({
        id: item.modelId,
        size: item.sizeLabel,
        modifiedAt: item.modifiedAt,
        digest: item.digest,
      })
      : {
        provider: 'local-ollama',
        type: 'local',
        capabilities: ['text', item.family],
        multimodal: false,
        promptPresetIds: ['local:ollama:default'],
        contextFragmentScopes: ['session', 'workspace'],
        technicalLogScope: 'runtime',
        ragReady: true,
        toolPermissionScopes: ['workspace-read'],
      },
    searchTerms: [
      item.modelId,
      item.label,
      item.family,
      ...ollamaIdentityTerms(item.modelId),
      item.digest ?? '',
      item.modifiedAt ?? '',
      item.sizeLabel ?? '',
      ...item.searchTerms,
      'ollama',
      'local',
      item.installed ? 'instalado' : 'download baixar não instalado',
    ],
  };
}

function localRuntimeFromOptions(options: ModelCatalogOption[]): LocalRuntimeSnapshot {
  const installedModels = options
    .filter((option) => option.installed)
    .map((option) => ({
      id: option.modelId ?? option.id,
      size: option.estimatedSize,
      modifiedAt: option.modifiedAt,
      digest: option.digest,
    }));

  return {
    state: installedModels.length > 0 ? 'ready' : 'not_configured',
    message: installedModels.length > 0 ? 'Runtime inferred from installed Ollama options.' : 'No installed Ollama models inferred.',
    modelsDir: '',
    installedModels,
    installed: installedModels.length > 0,
    serviceActive: installedModels.length > 0,
    apiReachable: installedModels.length > 0,
    apiUrl: 'http://127.0.0.1:11434',
    canUsePacman: false,
    hasPkexec: false,
    hasSudo: false,
    diskOk: undefined,
    problems: [],
    repairActions: [],
    at: new Date(0).toISOString(),
  };
}

export function modelOptionMatches(option: ModelCatalogOption, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const textMatches = [
    option.label,
    option.modelId,
    option.providerLabel,
    option.family,
    option.statusLabel,
    option.runtimeLabel,
    option.estimatedSize,
    ...(option.searchTerms ?? []),
    option.available ? 'configurado instalado pronto ready' : 'configurar api download baixar testar nao instalado indisponivel catalogo',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalized);
  if (textMatches) return true;
  if (option.source === 'local') {
    const normalizedLocalQuery = query.trim().toLowerCase().includes(':') ? normalizeOllamaModelId(query) : undefined;
    if (normalizedLocalQuery) {
      return normalizeOllamaModelId(option.modelId ?? option.id) === normalizedLocalQuery;
    }
    const queryTerms = ollamaIdentityTerms(query);
    const optionTerms = [
      ...ollamaIdentityTerms(option.modelId ?? option.id),
      ...ollamaIdentityTerms(option.label),
    ];
    return queryTerms.some((queryTerm) => optionTerms.some((term) => term.includes(queryTerm) || queryTerm.includes(term)));
  }
  return false;
}

export interface VisibleModelOptionsInput {
  mode: ExecutionMode;
  options: ModelCatalogOption[];
  query: string;
  localRuntime?: LocalRuntimeSnapshot;
  installationProgress?: Record<string, LocalModelInstallProgress>;
  ollamaSearchResults?: OllamaLibrarySearchResult[];
}

export function visibleModelOptions({
  mode,
  options,
  query,
  localRuntime,
  installationProgress,
  ollamaSearchResults,
}: VisibleModelOptionsInput): ModelCatalogOption[] {
  const trimmed = query.trim();
  const sourceOptions = options.filter((option) => {
    if (mode === 'cloud') {
      return option.source === 'cloud' && option.providerType === 'cloud' && option.providerId !== 'local-ollama';
    }
    return option.source === 'local' && option.providerType === 'local' && option.providerId === 'local-ollama';
  });
  const matched = sourceOptions.filter((option) => modelOptionMatches(option, trimmed));
  if (trimmed) {
    if (mode !== 'local') return matched;
    const runtime = localRuntime ?? localRuntimeFromOptions(sourceOptions);
    return searchOllamaModels(trimmed, runtime, {
      remoteResults: ollamaSearchResults,
      installationProgress,
    }).map((item) => localSearchItemOption(item, localRuntimeStatus(runtime)));
  }
  if (mode === 'cloud') return matched.filter((option) => option.configured && option.ready);
  return matched.filter((option) => option.installed && option.ready);
}

export { normalizeOllamaModelId };
