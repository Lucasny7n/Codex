import type {
  LocalModelInstallProgress,
  LocalRuntimeSnapshot,
  ProviderDescriptor,
  ProviderRuntimeStatus,
  ProviderStatusState,
} from '../types/domain';
import type { ModelProfile } from './modelRegistry';

export type ModelAction =
  | 'Selecionar'
  | 'Adicionar API key'
  | 'Fazer login'
  | 'Conectar OAuth'
  | 'Validar CLI'
  | 'Conectar provider'
  | 'Instalar runtime'
  | 'Instalar modelo'
  | 'Iniciar serviço'
  | 'Testar conexão'
  | 'Reparar'
  | 'Configurar'
  | 'Ver detalhes'
  | 'Trocar modelo/conta'
  | 'Aguardar ou trocar'
  | 'Indisponível';

export type ProviderStatus =
  | 'ready'
  | 'requires_api_key'
  | 'requires_login'
  | 'requires_oauth'
  | 'requires_cli_auth'
  | 'not_installed'
  | 'service_offline'
  | 'api_unreachable'
  | 'model_missing'
  | 'installing'
  | 'pulling'
  | 'testing'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'misconfigured'
  | 'experimental'
  | 'unavailable';

const SELECTABLE: ProviderStatus[] = ['ready'];

export function normalizeProviderStatus(status?: ProviderStatusState): ProviderStatus {
  if (!status) return 'unavailable';
  if (status === 'mock') return 'experimental';
  if (status === 'not_configured') return 'misconfigured';
  if (status === 'running') return 'testing';
  if (status === 'error') return 'unavailable';
  return status;
}

export function resolveProviderStatus(provider?: ProviderDescriptor): ProviderStatus {
  return normalizeProviderStatus(provider?.status.state);
}

export function resolveModelStatus(
  model: ModelProfile,
  providerStatus?: ProviderRuntimeStatus,
  localHealth?: LocalRuntimeSnapshot,
  installProgress?: LocalModelInstallProgress,
): ProviderStatus {
  if (installProgress?.state === 'running') return 'pulling';
  if (installProgress?.state === 'error') return 'unavailable';

  if (model.mode === 'cloud') {
    return normalizeProviderStatus(providerStatus?.state ?? model.baseStatus);
  }

  if (!localHealth?.installed) return 'not_installed';
  if (localHealth.state === 'service_offline') return 'service_offline';
  if (localHealth.state === 'api_unreachable') return 'api_unreachable';
  if (localHealth.state === 'installing') return 'installing';
  if (localHealth.state === 'error') return 'unavailable';

  const installed = localHealth.installedModels.some(
    (installedModel) => installedModel.id === model.id || installedModel.id === model.modelId,
  );
  if (!installed) return 'model_missing';
  return localHealth.apiReachable ? 'ready' : 'api_unreachable';
}

export function resolvePrimaryAction(status: ProviderStatus): ModelAction {
  const actions: Record<ProviderStatus, ModelAction> = {
    ready: 'Selecionar',
    requires_api_key: 'Adicionar API key',
    requires_login: 'Fazer login',
    requires_oauth: 'Conectar OAuth',
    requires_cli_auth: 'Validar CLI',
    not_installed: 'Instalar runtime',
    service_offline: 'Iniciar serviço',
    api_unreachable: 'Reparar',
    model_missing: 'Instalar modelo',
    installing: 'Instalar runtime',
    pulling: 'Instalar modelo',
    testing: 'Testar conexão',
    quota_exceeded: 'Trocar modelo/conta',
    rate_limited: 'Aguardar ou trocar',
    misconfigured: 'Configurar',
    experimental: 'Configurar',
    unavailable: 'Indisponível',
  };
  return actions[status];
}

export function canSelectModel(status: ProviderStatus): boolean {
  return SELECTABLE.includes(status);
}

export function getSetupRequirement(status: ProviderStatus): string | null {
  if (status === 'requires_api_key') return 'Requer API key salva e testada.';
  if (status === 'requires_login') return 'Requer login ou conexão do provider.';
  if (status === 'requires_oauth') return 'Requer OAuth válido.';
  if (status === 'requires_cli_auth') return 'Requer autenticação CLI válida para execução headless.';
  if (status === 'not_installed') return 'Requer Ollama instalado.';
  if (status === 'service_offline') return 'Requer serviço Ollama ativo.';
  if (status === 'api_unreachable') return 'Requer API local em 127.0.0.1:11434.';
  if (status === 'model_missing') return 'Requer download do modelo local.';
  if (status === 'misconfigured') return 'Requer ajuste de configuração.';
  if (status === 'experimental') return 'Requer validação manual antes do uso.';
  return null;
}

export function getUnavailableReason(status: ProviderStatus): string | null {
  if (status === 'quota_exceeded') return 'Cota ou limite esgotado no provider.';
  if (status === 'rate_limited') return 'Provider limitou a taxa de chamadas.';
  if (status === 'unavailable') return 'Provider indisponível no estado atual.';
  return getSetupRequirement(status);
}

export function statusTone(status: ProviderStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'ready') return 'ok';
  if (status === 'testing' || status === 'installing' || status === 'pulling') return 'info';
  if (status === 'unavailable' || status === 'api_unreachable' || status === 'quota_exceeded') return 'danger';
  if (status === 'rate_limited') return 'warn';
  return status === 'experimental' ? 'warn' : 'warn';
}
