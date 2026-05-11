import {
  localCompatibility,
  modelRegistry,
  type CloudModelProfile,
  type LocalModelProfile,
} from './modelRegistry';
import {
  canSelectModel,
  normalizeProviderStatus,
  resolveModelStatus,
  type ProviderStatus,
} from './providerStatus';
import type {
  ExecutionMode,
  LocalInstalledModel,
  LocalModelInstallProgress,
  LocalRuntimeSnapshot,
  ModelDescriptor,
  ProviderAccountProfile,
  ProviderDescriptor,
  ProviderRuntimeStatus,
} from '../types/domain';

export interface ModelCatalogOption {
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
  estimatedSize?: string;
  runtimeLabel?: string;
  searchTerms?: string[];
}

export function isLocalModelInstalled(runtime: LocalRuntimeSnapshot | undefined, modelId: string): boolean {
  if (!runtime) return false;
  return runtime.installedModels.some((model) => model.id === modelId);
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
  if (value.includes('mistral') || value.includes('mixtral') || value.includes('codestral')) return 'Mistral';
  if (value.includes('phi')) return 'Phi';
  if (value.includes('gemma')) return 'Gemma';
  if (value.includes('starcoder')) return 'StarCoder';
  if (value.includes('yi')) return 'Yi';
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
        modelId: model.modelId,
        providerId: model.providerId,
        label: model.displayName,
        providerLabel: model.providerLabel,
        status,
        statusLabel: available ? 'Configurado' : statusLabelFromState(status, 'cloud'),
        available,
        searchTerms: cloudSearchTerms(model),
      };
    });
  const catalogKeys = new Set(registryOptions.map((option) => `${option.providerId ?? ''}:${option.modelId ?? option.id}`));
  const discoveredOptions = input.providers.flatMap((provider) => provider.models
    .filter((model) => !catalogKeys.has(`${provider.id}:${model.id}`))
    .map((model) => {
      const status = normalizeProviderStatus(provider.status.state);
      const hasProfiles = providerHasProfiles(provider.id, input.providerProfiles);
      const readyProfile = readyProfileForProvider(provider.id, input.providerProfiles);
      const available = canSelectModel(status) && (!hasProfiles || Boolean(readyProfile));
      return {
        id: model.id,
        modelId: model.id,
        providerId: provider.id,
        label: model.label,
        providerLabel: provider.label,
        status,
        statusLabel: available ? 'Configurado' : statusLabelFromState(status, 'cloud'),
        available,
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
  const installedIds = new Set(input.localRuntime?.installedModels.map((model) => model.id) ?? []);
  const registryOptions = modelRegistry.byMode('local')
    .filter((model): model is LocalModelProfile => model.mode === 'local')
    .map((model) => {
      const progress = input.installationProgress?.[model.id] ?? input.installationProgress?.[model.modelId];
      const installed = installedIds.has(model.modelId) || installedIds.has(model.id);
      const status = resolveModelStatus(model, input.providerStatus, input.localRuntime, progress);
      return {
        id: model.id,
        modelId: model.modelId,
        providerId: model.providerId,
        label: model.displayName,
        providerLabel: model.providerLabel,
        family: localFamilyLabel(model),
        status,
        statusLabel: installed ? 'Instalado' : statusLabelFromState(status, 'local'),
        available: canSelectModel(status),
        installed,
        heavy: localCompatibility(model) === 'heavy' || localCompatibility(model) === 'not_recommended',
        estimatedSize: model.diskRequirement,
        runtimeLabel: model.runtime === 'ollama' ? 'Ollama' : model.runtime,
        searchTerms: [
          model.id,
          model.modelId,
          model.providerId,
          model.runtime,
          model.mode,
          model.family,
          ...model.modalities,
          model.size,
          model.ramRequirement,
          model.vramRequirement,
          model.diskRequirement,
          ...model.tags,
          ...model.bestFor,
          ...model.strengths,
        ],
      };
    });
  const catalogIds = new Set(
    modelRegistry.byMode('local')
      .filter((model): model is LocalModelProfile => model.mode === 'local')
      .flatMap((model) => [model.id, model.modelId]),
  );
  const runtimeStatus = localRuntimeStatus(input.localRuntime);
  const discoveredInstalled = (input.localRuntime?.installedModels ?? [])
    .filter((model) => !catalogIds.has(model.id))
    .map((model) => localInstalledModelOption(model, runtimeStatus));
  return [...registryOptions, ...discoveredInstalled];
}

function localInstalledModelOption(model: LocalInstalledModel, runtimeStatus: ProviderStatus): ModelCatalogOption {
  return {
    id: model.id,
    modelId: model.id,
    providerId: 'local-ollama',
    label: model.id,
    providerLabel: 'Local Ollama',
    family: localFamilyLabelFromText(model.id),
    status: runtimeStatus,
    statusLabel: runtimeStatus === 'ready' ? 'Instalado' : statusLabelFromState(runtimeStatus, 'local'),
    available: canSelectModel(runtimeStatus),
    installed: true,
    estimatedSize: model.size,
    runtimeLabel: 'Ollama',
    searchTerms: [
      model.id,
      model.digest ?? '',
      model.modifiedAt ?? '',
      model.size ?? '',
      'ollama',
      'local',
      localFamilyLabelFromText(model.id),
      'instalado',
    ],
  };
}

export function modelOptionMatches(option: ModelCatalogOption, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
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
}

export function visibleModelOptions(
  mode: ExecutionMode,
  options: ModelCatalogOption[],
  query: string,
): ModelCatalogOption[] {
  const trimmed = query.trim();
  const matched = options.filter((option) => modelOptionMatches(option, trimmed));
  if (trimmed) return matched;
  if (mode === 'cloud') return matched.filter((option) => option.available);
  return matched.filter((option) => option.installed && option.available);
}
