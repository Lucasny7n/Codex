import type { ActionableError, ProviderStatusState } from '../types/domain';

const ERROR_MAP: Record<string, Omit<ActionableError, 'technicalDetails'>> = {
  testing: {
    code: 'provider_connection_untested',
    severity: 'warning',
    message: 'Provider tem credencial, mas ainda precisa teste real nesta sessão.',
    actionLabel: 'Testar conexão',
    actionTarget: 'settings:providers',
  },
  unavailable: {
    code: 'provider_unavailable',
    severity: 'error',
    message: 'Provider indisponível para execução.',
    actionLabel: 'Ver diagnóstico',
    actionTarget: 'settings:diagnostics',
  },
  misconfigured: {
    code: 'provider_misconfigured',
    severity: 'warning',
    message: 'Provider mal configurado.',
    actionLabel: 'Configurar',
    actionTarget: 'settings:providers',
  },
  missing_api_key: {
    code: 'missing_api_key',
    severity: 'warning',
    message: 'API key ausente.',
    actionLabel: 'Adicionar API key',
    actionTarget: 'settings:providers',
  },
  provider_login_required: {
    code: 'provider_login_required',
    severity: 'warning',
    message: 'Provider precisa de login.',
    actionLabel: 'Fazer login',
    actionTarget: 'settings:providers',
  },
  provider_cli_auth_required: {
    code: 'provider_cli_auth_required',
    severity: 'warning',
    message: 'CLI precisa de autenticação válida para execução headless.',
    actionLabel: 'Validar CLI',
    actionTarget: 'settings:providers',
  },
  provider_experimental: {
    code: 'provider_experimental',
    severity: 'warning',
    message: 'Provider experimental precisa configuração antes de uso.',
    actionLabel: 'Configurar',
    actionTarget: 'settings:providers',
  },
  quota_exceeded: {
    code: 'quota_exceeded',
    severity: 'warning',
    message: 'Limite ou cota do provider acabou.',
    actionLabel: 'Trocar modelo',
    actionTarget: 'model-selector',
  },
  rate_limited: {
    code: 'rate_limited',
    severity: 'warning',
    message: 'Provider limitou a taxa de chamadas.',
    actionLabel: 'Aguardar',
    actionTarget: 'settings:diagnostics',
  },
  ollama_missing: {
    code: 'ollama_missing',
    severity: 'warning',
    message: 'Ollama não está instalado.',
    actionLabel: 'Instalar runtime',
    actionTarget: 'settings:local',
  },
  ollama_service_offline: {
    code: 'ollama_service_offline',
    severity: 'warning',
    message: 'Serviço Ollama está offline.',
    actionLabel: 'Iniciar serviço',
    actionTarget: 'settings:local',
  },
  ollama_api_unreachable: {
    code: 'ollama_api_unreachable',
    severity: 'error',
    message: 'API local do Ollama não respondeu.',
    actionLabel: 'Reparar',
    actionTarget: 'settings:local',
  },
  model_missing: {
    code: 'model_missing',
    severity: 'warning',
    message: 'Modelo local não instalado.',
    actionLabel: 'Instalar modelo',
    actionTarget: 'model-selector',
  },
  network_failed: {
    code: 'network_failed',
    severity: 'error',
    message: 'Falha de rede ao chamar provider ou baixar modelo.',
    actionLabel: 'Tentar novamente',
  },
  permission_denied: {
    code: 'permission_denied',
    severity: 'error',
    message: 'Permissão negada para executar a ação.',
    actionLabel: 'Ver permissões',
    actionTarget: 'settings:permissions',
  },
  disk_low: {
    code: 'disk_low',
    severity: 'warning',
    message: 'Espaço em disco pode ser insuficiente para modelos locais.',
    actionLabel: 'Ver diagnóstico',
    actionTarget: 'settings:diagnostics',
  },
  timeout: {
    code: 'timeout',
    severity: 'error',
    message: 'Operação excedeu o tempo limite.',
    actionLabel: 'Tentar novamente',
  },
};

export function errorForStatus(status: ProviderStatusState, details?: string): ActionableError {
  if (status === 'testing' || status === 'running') return translateError('testing', details);
  if (status === 'requires_api_key') return translateError('missing_api_key', details);
  if (status === 'requires_login' || status === 'requires_oauth') return translateError('provider_login_required', details);
  if (status === 'requires_cli_auth') {
    return {
      code: 'provider_cli_auth_required',
      severity: 'warning',
      message: 'CLI precisa de autenticação válida para execução.',
      actionLabel: 'Validar CLI',
      actionTarget: 'settings:providers',
      technicalDetails: details,
    };
  }
  if (status === 'quota_exceeded') return translateError('quota_exceeded', details);
  if (status === 'rate_limited') {
    return {
      code: 'rate_limited',
      severity: 'warning',
      message: 'Provider limitou a taxa de chamadas.',
      actionLabel: 'Aguardar',
      technicalDetails: details,
    };
  }
  if (status === 'not_installed') return translateError('ollama_missing', details);
  if (status === 'service_offline') return translateError('ollama_service_offline', details);
  if (status === 'api_unreachable') return translateError('ollama_api_unreachable', details);
  if (status === 'model_missing') return translateError('model_missing', details);
  if (status === 'experimental' || status === 'misconfigured') return translateError('provider_experimental', details);
  if (status === 'unavailable' || status === 'error' || status === 'not_configured') {
    return translateError(status, details);
  }
  return {
    code: status,
    severity: status === 'ready' ? 'info' : 'warning',
    message: status === 'ready' ? 'Pronto para executar.' : 'Provider indisponível para execução.',
    actionLabel: status === 'ready' ? undefined : 'Ver detalhes',
    actionTarget: status === 'ready' ? undefined : 'settings:diagnostics',
    technicalDetails: details,
  };
}

export function translateError(codeOrMessage: string, technicalDetails?: string): ActionableError {
  const normalized = normalizeCode(codeOrMessage);
  const mapped = ERROR_MAP[normalized];
  if (mapped) {
    return { ...mapped, technicalDetails };
  }

  return {
    code: normalized,
    severity: 'error',
    message: readableMessage(codeOrMessage),
    actionLabel: 'Ver detalhes',
    actionTarget: 'settings:diagnostics',
    technicalDetails,
  };
}

function normalizeCode(value: string): string {
  const lower = value.toLowerCase();
  if (lower === 'requires_api_key') return 'missing_api_key';
  if (lower === 'requires_login' || lower === 'requires_oauth') return 'provider_login_required';
  if (lower === 'requires_cli_auth') return 'provider_cli_auth_required';
  if (lower === 'not_installed') return 'ollama_missing';
  if (lower === 'service_offline') return 'ollama_service_offline';
  if (lower === 'api_unreachable') return 'ollama_api_unreachable';
  if (lower === 'model_missing') return 'model_missing';
  if (lower === 'quota_exceeded') return 'quota_exceeded';
  if (lower === 'rate_limited') return 'rate_limited';
  if (lower === 'misconfigured') return 'misconfigured';
  if (lower === 'testing' || lower === 'running') return 'testing';
  if (lower === 'experimental' || lower === 'mock') return 'provider_experimental';
  if (lower === 'unavailable' || lower === 'error' || lower === 'not_configured') return 'unavailable';
  if (lower.includes('api key') || lower.includes('401') || lower.includes('403')) return 'missing_api_key';
  if (lower.includes('quota') || lower.includes('insufficient_quota')) return 'quota_exceeded';
  if (lower.includes('rate') || lower.includes('429')) return 'rate_limited';
  if (lower.includes('ollama') && lower.includes('not found')) return 'ollama_missing';
  if (lower.includes('could not connect') || lower.includes('connection refused')) return 'ollama_api_unreachable';
  if (lower.includes('permission') || lower.includes('denied')) return 'permission_denied';
  if (lower.includes('timeout') || lower.includes('tempo limite')) return 'timeout';
  return lower.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown_error';
}

function readableMessage(value: string): string {
  if (value.length <= 140) return value;
  return `${value.slice(0, 137)}...`;
}
