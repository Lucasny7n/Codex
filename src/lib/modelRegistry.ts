import type { ExecutionMode, ProviderStatusState } from '../types/domain';

export type PricingType = 'free' | 'freemium' | 'paid' | 'open-source';
export type LimitType = 'unknown' | 'daily' | 'monthly' | 'plan' | 'unlimited';
export type LatencyLevel = 'low' | 'medium' | 'high';
export type RuntimeHealth = ProviderStatusState;
export type HardwareRecommendation = 'cpu' | 'gpu' | 'either';
export type LocalCompatibility = 'recommended' | 'compatible' | 'heavy' | 'not_recommended' | 'unknown';

export interface CapabilityScores {
  speed: 1 | 2 | 3 | 4 | 5;
  reasoning: 1 | 2 | 3 | 4 | 5;
  coding: 1 | 2 | 3 | 4 | 5;
  text: 1 | 2 | 3 | 4 | 5;
  longContext: 1 | 2 | 3 | 4 | 5;
}

export interface ModelLimitDescriptor {
  type: LimitType;
  summary: string;
  estimatedValue?: string;
}

interface BaseModelProfile {
  id: string;
  name: string;
  displayName: string;
  mode: ExecutionMode;
  provider: string;
  providerId: string;
  providerLabel: string;
  modelId: string;
  pricingType: PricingType;
  freeTierAvailable: boolean;
  estimatedLimits: ModelLimitDescriptor;
  limits: string;
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
  recommendedUse: string;
  latency: LatencyLevel;
  capabilities: CapabilityScores;
  codeQuality: 1 | 2 | 3 | 4 | 5;
  reasoningQuality: 1 | 2 | 3 | 4 | 5;
  speed: 1 | 2 | 3 | 4 | 5;
  privacyNotes: string;
  privacy: string;
  caveats: string[];
  tags: string[];
  status: RuntimeHealth;
  baseStatus: ProviderStatusState;
  setupRequirement: string;
  actionLabel: string;
  unavailableReason?: string;
  installable: boolean;
  requiresApiKey: boolean;
  recommended: boolean;
  costHint: string;
}

export interface CloudModelProfile extends BaseModelProfile {
  mode: 'cloud';
  costEstimate?: string;
  dataHandling: string;
}

export interface LocalModelProfile extends BaseModelProfile {
  mode: 'local';
  runtime: 'ollama';
  family: string;
  size: string;
  quantization: string;
  ramRequirement: string;
  vramRequirement: string;
  diskRequirement: string;
  expectedPerformance: string;
  recommendedHardware: HardwareRecommendation;
  installable: true;
  requiresApiKey: false;
}

export type ModelProfile = CloudModelProfile | LocalModelProfile;

export interface ProviderProfile {
  id: string;
  label: string;
  mode: ExecutionMode;
  description: string;
  requiresApiKey: boolean;
}

export const providerRegistry: ProviderProfile[] = [
  {
    id: 'gemini-cli',
    label: 'Google Gemini CLI',
    mode: 'cloud',
    description: 'Runner via CLI local; requer auth headless para uso real.',
    requiresApiKey: true,
  },
  {
    id: 'gemini-api',
    label: 'Gemini API',
    mode: 'cloud',
    description: 'API Google Gemini com chave GEMINI_API_KEY ou GOOGLE_API_KEY.',
    requiresApiKey: true,
  },
  {
    id: 'openai-api',
    label: 'OpenAI API',
    mode: 'cloud',
    description: 'Provider OpenAI via API key.',
    requiresApiKey: true,
  },
  {
    id: 'openrouter-api',
    label: 'OpenRouter',
    mode: 'cloud',
    description: 'Gateway OpenAI-compatible para varios modelos.',
    requiresApiKey: true,
  },
  {
    id: 'anthropic-api',
    label: 'Anthropic API',
    mode: 'cloud',
    description: 'Provider Anthropic via API key.',
    requiresApiKey: true,
  },
  {
    id: 'opencode-zen',
    label: 'OpenCode Zen',
    mode: 'cloud',
    description: 'Provider dependente de conexao/login Zen.',
    requiresApiKey: false,
  },
  {
    id: 'local-ollama',
    label: 'Local Ollama',
    mode: 'local',
    description: 'Execucao local por API HTTP do Ollama.',
    requiresApiKey: false,
  },
];

function cloudModel(input: {
  id: string;
  name: string;
  providerId: string;
  providerLabel: string;
  status: ProviderStatusState;
  setupRequirement: string;
  actionLabel: string;
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
  tags: string[];
  capabilities: CapabilityScores;
  recommended?: boolean;
  freeTierAvailable?: boolean;
  costHint?: string;
  caveats?: string[];
  privacy?: string;
  limits?: string;
  latency?: LatencyLevel;
}): CloudModelProfile {
  return {
    id: input.id,
    modelId: input.id,
    name: input.name,
    displayName: input.name,
    mode: 'cloud',
    provider: input.providerId,
    providerId: input.providerId,
    providerLabel: input.providerLabel,
    pricingType: input.freeTierAvailable ? 'freemium' : 'paid',
    freeTierAvailable: input.freeTierAvailable ?? false,
    estimatedLimits: {
      type: 'plan',
      summary: input.limits ?? 'Cota variavel conforme plano e provider.',
      estimatedValue: 'depende do plano',
    },
    limits: input.limits ?? 'Cota variavel conforme plano e provider.',
    strengths: input.strengths,
    weaknesses: input.weaknesses,
    bestFor: input.bestFor,
    recommendedUse: input.bestFor[0] ?? 'Uso geral',
    latency: input.latency ?? 'medium',
    capabilities: input.capabilities,
    codeQuality: input.capabilities.coding,
    reasoningQuality: input.capabilities.reasoning,
    speed: input.capabilities.speed,
    privacyNotes: input.privacy ?? 'Dados enviados ao provider cloud.',
    privacy: input.privacy ?? 'Cloud: prompts saem da maquina.',
    caveats: input.caveats ?? ['Disponibilidade e limites dependem do plano do provider.'],
    tags: input.tags,
    status: input.status,
    baseStatus: input.status,
    setupRequirement: input.setupRequirement,
    actionLabel: input.actionLabel,
    unavailableReason: input.status === 'ready' ? undefined : input.setupRequirement,
    installable: false,
    requiresApiKey: ['openai-api', 'openrouter-api', 'anthropic-api', 'gemini-api', 'gemini-cli'].includes(input.providerId),
    recommended: input.recommended ?? false,
    costHint: input.costHint ?? 'Custo depende de tokens/plano.',
    costEstimate: input.costHint ?? 'Custo depende de tokens/plano.',
    dataHandling: input.privacy ?? 'Envio para API cloud.',
  };
}

function localModel(input: {
  id: string;
  name: string;
  family: string;
  size: string;
  ram: string;
  vram: string;
  disk: string;
  expectedPerformance: string;
  recommendedHardware: HardwareRecommendation;
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
  tags: string[];
  capabilities: CapabilityScores;
  recommended?: boolean;
  heavy?: boolean;
}): LocalModelProfile {
  return {
    id: input.id,
    modelId: input.id,
    name: input.name,
    displayName: input.name,
    mode: 'local',
    provider: 'local-ollama',
    providerId: 'local-ollama',
    providerLabel: 'Local Ollama',
    pricingType: 'open-source',
    freeTierAvailable: true,
    estimatedLimits: {
      type: 'unlimited',
      summary: 'Sem cota de API; limitado por hardware local.',
    },
    limits: 'Sem cota de API; depende de RAM/VRAM, disco e energia.',
    strengths: input.strengths,
    weaknesses: input.weaknesses,
    bestFor: input.bestFor,
    recommendedUse: input.bestFor[0] ?? 'Uso local',
    latency: input.capabilities.speed >= 4 ? 'low' : input.capabilities.speed >= 3 ? 'medium' : 'high',
    capabilities: input.capabilities,
    codeQuality: input.capabilities.coding,
    reasoningQuality: input.capabilities.reasoning,
    speed: input.capabilities.speed,
    privacyNotes: 'Execucao local via Ollama; prompts nao saem da maquina por padrao.',
    privacy: 'Local: prompts ficam na maquina por padrao.',
    caveats: [
      'Exige Ollama instalado e API local ativa.',
      input.heavy ? 'Modelo pesado; pode ser lento ou inviavel em hardware modesto.' : 'Desempenho varia por CPU/GPU e memoria disponivel.',
    ],
    tags: input.tags,
    status: 'model_missing',
    baseStatus: 'model_missing',
    setupRequirement: 'Instalar Ollama e baixar o modelo local.',
    actionLabel: 'Instalar modelo',
    unavailableReason: 'Modelo local ainda precisa existir em `ollama list`.',
    installable: true,
    requiresApiKey: false,
    recommended: input.recommended ?? false,
    costHint: 'Sem custo de API; custo local de hardware/energia.',
    runtime: 'ollama',
    family: input.family,
    size: input.size,
    quantization: 'Ollama default',
    ramRequirement: input.ram,
    vramRequirement: input.vram,
    diskRequirement: input.disk,
    expectedPerformance: input.expectedPerformance,
    recommendedHardware: input.recommendedHardware,
  };
}

export const cloudModelRegistry: CloudModelProfile[] = [
  cloudModel({
    id: 'gemini-cli-default',
    name: 'Gemini CLI Padrao',
    providerId: 'gemini-cli',
    providerLabel: 'Google Gemini CLI',
    status: 'requires_cli_auth',
    setupRequirement: 'Requer Gemini CLI instalado e GEMINI_API_KEY/GOOGLE_API_KEY ou ADC para runner headless.',
    actionLabel: 'Validar CLI',
    strengths: ['Rapido para fluxo de terminal', 'Bom para revisao externa', 'Integra bem com CLI'],
    weaknesses: ['OAuth interativo nao basta para runner headless', 'Depende do binario gemini no PATH'],
    bestFor: ['Revisao via CLI', 'Planejamento rapido', 'Auditoria externa'],
    tags: ['recomendado', 'rapido', 'requer-config', 'cloud'],
    capabilities: { speed: 5, reasoning: 4, coding: 4, text: 4, longContext: 4 },
    recommended: true,
    freeTierAvailable: true,
  }),
  cloudModel({
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    providerId: 'gemini-api',
    providerLabel: 'Gemini API',
    status: 'requires_api_key',
    setupRequirement: 'Requer API key Google salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Rapido', 'Custo geralmente menor', 'Bom para iteracao'],
    weaknesses: ['Qualidade pode variar em tarefas muito profundas'],
    bestFor: ['Respostas rapidas', 'Triagem', 'Automacao cotidiana'],
    tags: ['rapido', 'baixo-custo', 'cloud', 'requer-config'],
    capabilities: { speed: 5, reasoning: 3, coding: 3, text: 4, longContext: 4 },
    freeTierAvailable: true,
    costHint: 'Baixo a medio; depende da cota Google.',
  }),
  cloudModel({
    id: 'gpt-5.5',
    name: 'GPT-5.5',
    providerId: 'openai-api',
    providerLabel: 'OpenAI API',
    status: 'requires_api_key',
    setupRequirement: 'Requer OPENAI_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Codigo forte', 'Raciocinio robusto', 'Boa consistencia'],
    weaknesses: ['Custo e limite dependem da conta', 'Nao roda sem credencial real'],
    bestFor: ['Refatoracao complexa', 'Debug profundo', 'Arquitetura'],
    tags: ['recomendado', 'codigo', 'raciocinio', 'premium', 'requer-config'],
    capabilities: { speed: 3, reasoning: 5, coding: 5, text: 5, longContext: 5 },
    recommended: true,
    costHint: 'Medio a alto por uso; depende de tokens.',
  }),
  cloudModel({
    id: 'openai/gpt-5.4-mini',
    name: 'GPT-5.4 Mini via OpenRouter',
    providerId: 'openrouter-api',
    providerLabel: 'OpenRouter',
    status: 'requires_api_key',
    setupRequirement: 'Requer OPENROUTER_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Gateway flexivel', 'Bom custo/beneficio', 'Troca facil de modelos'],
    weaknesses: ['Limites variam por provedor roteado', 'Pode ter latencia extra'],
    bestFor: ['Baixo custo', 'Fallback cloud', 'Tarefas rapidas'],
    tags: ['baixo-custo', 'gratis', 'rapido', 'cloud', 'requer-config'],
    capabilities: { speed: 4, reasoning: 3, coding: 4, text: 4, longContext: 4 },
    freeTierAvailable: true,
  }),
  cloudModel({
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    providerId: 'anthropic-api',
    providerLabel: 'Anthropic API',
    status: 'requires_api_key',
    setupRequirement: 'Requer ANTHROPIC_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Contexto longo', 'Escrita tecnica', 'Revisao de docs'],
    weaknesses: ['Custo e limites dependem do plano', 'Pode ter maior latencia'],
    bestFor: ['Analise longa', 'Documentacao', 'Revisao de PR grande'],
    tags: ['contexto-longo', 'texto', 'raciocinio', 'premium', 'requer-config'],
    capabilities: { speed: 3, reasoning: 4, coding: 4, text: 5, longContext: 5 },
    costHint: 'Medio a alto; depende do plano Anthropic.',
  }),
  cloudModel({
    id: 'zen-default',
    name: 'OpenCode Zen',
    providerId: 'opencode-zen',
    providerLabel: 'OpenCode Zen',
    status: 'requires_login',
    setupRequirement: 'Requer conexao/login Zen antes de executar.',
    actionLabel: 'Conectar provider',
    strengths: ['Pode integrar revisao externa', 'Bom para fluxo de auditoria quando conectado'],
    weaknesses: ['Sem adapter operacional validado neste build'],
    bestFor: ['Revisao posterior quando configurado'],
    tags: ['experimental', 'requer-login', 'cloud'],
    capabilities: { speed: 2, reasoning: 3, coding: 3, text: 3, longContext: 3 },
    caveats: ['Bloqueado ate conexao real. Nao simula resposta.'],
  }),
];

export const localModelRegistry: LocalModelProfile[] = [
  localModel({
    id: 'qwen2.5-coder:1.5b',
    name: 'Qwen2.5 Coder 1.5B',
    family: 'Qwen Coder',
    size: '1.5B',
    ram: '4 GB',
    vram: '2 GB',
    disk: '1.2 GB aprox.',
    expectedPerformance: 'Rapido em CPU; qualidade limitada para refactors grandes.',
    recommendedHardware: 'cpu',
    strengths: ['Muito leve', 'Bom para completar codigo simples'],
    weaknesses: ['Raciocinio limitado', 'Pode errar arquitetura'],
    bestFor: ['Hardware modesto', 'Autocomplete local', 'Tarefas simples'],
    tags: ['local', 'leve', 'rapido', 'codigo', 'hardware-modesto'],
    capabilities: { speed: 5, reasoning: 2, coding: 3, text: 2, longContext: 2 },
  }),
  localModel({
    id: 'qwen2.5-coder:3b',
    name: 'Qwen2.5 Coder 3B',
    family: 'Qwen Coder',
    size: '3B',
    ram: '6 GB',
    vram: '3 GB',
    disk: '2.0 GB aprox.',
    expectedPerformance: 'Boa velocidade; util para scripts e patches pequenos.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Bom equilibrio para codigo simples'],
    weaknesses: ['Contexto e raciocinio modestos'],
    bestFor: ['Correcoes pequenas', 'Terminal local', 'Privacidade'],
    tags: ['local', 'leve', 'codigo', 'recomendado'],
    capabilities: { speed: 4, reasoning: 3, coding: 4, text: 3, longContext: 2 },
    recommended: true,
  }),
  localModel({
    id: 'llama3.2:3b',
    name: 'Llama 3.2 3B',
    family: 'Llama',
    size: '3B',
    ram: '6 GB',
    vram: '3 GB',
    disk: '2.0 GB aprox.',
    expectedPerformance: 'Rapido para texto geral; codigo apenas moderado.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Bom texto geral'],
    weaknesses: ['Nao e focado em codigo pesado'],
    bestFor: ['Resumo local', 'Q&A simples', 'Texto offline'],
    tags: ['local', 'leve', 'rapido', 'gratis'],
    capabilities: { speed: 4, reasoning: 3, coding: 3, text: 4, longContext: 3 },
  }),
  localModel({
    id: 'qwen2.5-coder:7b',
    name: 'Qwen2.5 Coder 7B',
    family: 'Qwen Coder',
    size: '7B',
    ram: '8-12 GB',
    vram: '6-8 GB',
    disk: '4.7 GB aprox.',
    expectedPerformance: 'Bom equilibrio local para codigo; melhor com GPU.',
    recommendedHardware: 'either',
    strengths: ['Forte em codigo', 'Bom custo local', 'Privado'],
    weaknesses: ['Mais lento em CPU fraca'],
    bestFor: ['Refatoracao local', 'Scripts', 'Analise de arquivos'],
    tags: ['local', 'codigo', 'medio', 'recomendado'],
    capabilities: { speed: 4, reasoning: 3, coding: 5, text: 3, longContext: 3 },
    recommended: true,
  }),
  localModel({
    id: 'deepseek-coder:6.7b',
    name: 'DeepSeek Coder 6.7B',
    family: 'DeepSeek Coder',
    size: '6.7B',
    ram: '8-12 GB',
    vram: '6-8 GB',
    disk: '4 GB aprox.',
    expectedPerformance: 'Bom para codigo; desempenho depende de quantizacao local.',
    recommendedHardware: 'either',
    strengths: ['Bom em codigo', 'Alternativa local ao Qwen'],
    weaknesses: ['Pode variar por tag/quantizacao no Ollama'],
    bestFor: ['Codigo local', 'Revisoes pequenas'],
    tags: ['local', 'codigo', 'medio'],
    capabilities: { speed: 3, reasoning: 3, coding: 4, text: 3, longContext: 3 },
  }),
  localModel({
    id: 'mistral:7b',
    name: 'Mistral 7B',
    family: 'Mistral',
    size: '7B',
    ram: '8-12 GB',
    vram: '6-8 GB',
    disk: '4.1 GB aprox.',
    expectedPerformance: 'Equilibrado para texto e tarefas gerais.',
    recommendedHardware: 'either',
    strengths: ['Geralista', 'Bom texto', 'Local'],
    weaknesses: ['Nao e o melhor para codigo complexo'],
    bestFor: ['Texto local', 'Resumo', 'Q&A'],
    tags: ['local', 'medio', 'texto'],
    capabilities: { speed: 3, reasoning: 3, coding: 3, text: 4, longContext: 3 },
  }),
  localModel({
    id: 'qwen2.5-coder:14b',
    name: 'Qwen2.5 Coder 14B',
    family: 'Qwen Coder',
    size: '14B',
    ram: '16-24 GB',
    vram: '10-16 GB',
    disk: '9 GB aprox.',
    expectedPerformance: 'Mais qualidade em codigo; pesado para hardware modesto.',
    recommendedHardware: 'gpu',
    strengths: ['Codigo forte', 'Melhor coerencia que 7B'],
    weaknesses: ['Pesado', 'Pode ser lento em CPU'],
    bestFor: ['Refactors maiores', 'Analise mais profunda'],
    tags: ['local', 'forte', 'codigo', 'pesado'],
    capabilities: { speed: 2, reasoning: 4, coding: 5, text: 4, longContext: 4 },
    heavy: true,
  }),
  localModel({
    id: 'qwen2.5-coder:32b',
    name: 'Qwen2.5 Coder 32B',
    family: 'Qwen Coder',
    size: '32B',
    ram: '32-48 GB',
    vram: '20-32 GB',
    disk: '20 GB aprox.',
    expectedPerformance: 'Alta qualidade local, mas exige hardware forte.',
    recommendedHardware: 'gpu',
    strengths: ['Codigo local forte', 'Melhor raciocinio'],
    weaknesses: ['Muito pesado', 'Nao recomendado para hardware modesto'],
    bestFor: ['Analise pesada local', 'Codigo privado complexo'],
    tags: ['local', 'forte', 'codigo', 'pesado'],
    capabilities: { speed: 1, reasoning: 5, coding: 5, text: 4, longContext: 4 },
    heavy: true,
  }),
  localModel({
    id: 'codellama:13b',
    name: 'CodeLlama 13B',
    family: 'CodeLlama',
    size: '13B',
    ram: '16-24 GB',
    vram: '10-16 GB',
    disk: '7.5 GB aprox.',
    expectedPerformance: 'Util para codigo, mas menos recente que Qwen Coder.',
    recommendedHardware: 'gpu',
    strengths: ['Focado em codigo', 'Conhecido no ecossistema local'],
    weaknesses: ['Mais antigo', 'Pode perder para modelos coder novos'],
    bestFor: ['Fallback local de codigo'],
    tags: ['local', 'codigo', 'forte'],
    capabilities: { speed: 2, reasoning: 3, coding: 4, text: 3, longContext: 3 },
    heavy: true,
  }),
  localModel({
    id: 'codellama:34b',
    name: 'CodeLlama 34B',
    family: 'CodeLlama',
    size: '34B',
    ram: '40-64 GB',
    vram: '24-40 GB',
    disk: '19 GB aprox.',
    expectedPerformance: 'Muito pesado; use apenas com hardware adequado.',
    recommendedHardware: 'gpu',
    strengths: ['Codigo local grande', 'Privacidade'],
    weaknesses: ['Muito pesado', 'Pode ser inviavel em hardware modesto'],
    bestFor: ['Codigo local pesado com GPU forte'],
    tags: ['local', 'forte', 'codigo', 'pesado'],
    capabilities: { speed: 1, reasoning: 4, coding: 4, text: 3, longContext: 3 },
    heavy: true,
  }),
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function scoreByTag(profile: ModelProfile, tag: string): boolean {
  if (tag === 'codigo') return profile.capabilities.coding >= 4;
  if (tag === 'raciocinio') return profile.capabilities.reasoning >= 4;
  if (tag === 'rapido') return profile.capabilities.speed >= 4;
  if (tag === 'gratis') return profile.pricingType === 'free' || profile.freeTierAvailable || profile.pricingType === 'open-source';
  if (tag === 'recomendado') return profile.recommended;
  if (tag === 'requer-config') return profile.baseStatus !== 'ready' && profile.mode === 'cloud';
  if (tag === 'compatível') return profile.mode === 'local' && ['recommended', 'compatible'].includes(localCompatibility(profile));
  return profile.tags.some((item) => normalizeText(item).includes(normalizeText(tag)));
}

export function localCompatibility(model: ModelProfile): LocalCompatibility {
  if (model.mode !== 'local') return 'unknown';
  if (['qwen2.5-coder:32b', 'codellama:34b'].includes(model.modelId)) return 'not_recommended';
  if (['qwen2.5-coder:14b', 'codellama:13b'].includes(model.modelId)) return 'heavy';
  if (['qwen2.5-coder:3b', 'qwen2.5-coder:7b'].includes(model.modelId)) return 'recommended';
  if (['qwen2.5-coder:1.5b', 'llama3.2:3b', 'mistral:7b', 'deepseek-coder:6.7b'].includes(model.modelId)) {
    return 'compatible';
  }
  return 'unknown';
}

export function localCompatibilityLabel(value: LocalCompatibility): string {
  if (value === 'recommended') return 'recomendado neste PC';
  if (value === 'compatible') return 'compatível com caveat leve';
  if (value === 'heavy') return 'pesado para 16 GB';
  if (value === 'not_recommended') return 'não recomendado neste PC';
  return 'compatibilidade desconhecida';
}

export const modelRegistry = {
  all(): ModelProfile[] {
    return [...cloudModelRegistry, ...localModelRegistry];
  },

  byMode(mode: ExecutionMode): ModelProfile[] {
    return mode === 'cloud' ? [...cloudModelRegistry] : [...localModelRegistry];
  },

  byId(id: string): ModelProfile | undefined {
    return this.all().find((model) => model.id === id || model.modelId === id);
  },

  search(mode: ExecutionMode, query: string, tags: string[] = []): ModelProfile[] {
    const items = this.byMode(mode);
    const normalizedQuery = normalizeText(query.trim());

    return items.filter((model) => {
      if (tags.length > 0 && !tags.every((tag) => scoreByTag(model, tag))) {
        return false;
      }

      if (!normalizedQuery) return true;
      const haystack = normalizeText(
        [
          model.displayName,
          model.providerLabel,
          model.setupRequirement,
          model.recommendedUse,
          ...model.strengths,
          ...model.weaknesses,
          ...model.bestFor,
          ...model.tags,
          ...model.caveats,
        ].join(' '),
      );

      return haystack.includes(normalizedQuery);
    });
  },
};

export function capabilityLabel(score: 1 | 2 | 3 | 4 | 5): string {
  if (score <= 2) return 'baixo';
  if (score === 3) return 'bom';
  if (score === 4) return 'alto';
  return 'excelente';
}

export function latencyLabel(latency: LatencyLevel): string {
  if (latency === 'low') return 'rapida';
  if (latency === 'medium') return 'media';
  return 'alta';
}
