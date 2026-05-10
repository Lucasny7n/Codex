import type { ExecutionMode, ProviderStatusState } from '../types/domain';

export type PricingType = 'free' | 'freemium' | 'paid' | 'open-source';
export type LimitType = 'unknown' | 'daily' | 'monthly' | 'plan' | 'unlimited';
export type LatencyLevel = 'low' | 'medium' | 'high';
export type RuntimeHealth = ProviderStatusState;
export type HardwareRecommendation = 'cpu' | 'gpu' | 'either';
export type LocalCompatibility = 'recommended' | 'compatible' | 'heavy' | 'not_recommended' | 'unknown';
export type ModelModality =
  | 'text'
  | 'code'
  | 'vision'
  | 'image_generation'
  | 'audio_transcription';

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
  modalities: ModelModality[];
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
    id: 'codex-cli',
    label: 'Codex CLI',
    mode: 'cloud',
    description: 'Runner Codex via CLI local; requer auth e adapter validado antes de uso real.',
    requiresApiKey: false,
  },
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
    id: 'mistral-api',
    label: 'Mistral API',
    mode: 'cloud',
    description: 'Provider Mistral via API key.',
    requiresApiKey: true,
  },
  {
    id: 'groq-api',
    label: 'Groq',
    mode: 'cloud',
    description: 'Provider Groq OpenAI-compatible via API key.',
    requiresApiKey: true,
  },
  {
    id: 'together-api',
    label: 'Together AI',
    mode: 'cloud',
    description: 'Provider Together AI via API key.',
    requiresApiKey: true,
  },
  {
    id: 'fireworks-api',
    label: 'Fireworks AI',
    mode: 'cloud',
    description: 'Provider Fireworks AI via API key.',
    requiresApiKey: true,
  },
  {
    id: 'cerebras-api',
    label: 'Cerebras',
    mode: 'cloud',
    description: 'Provider Cerebras OpenAI-compatible via API key.',
    requiresApiKey: true,
  },
  {
    id: 'cohere-api',
    label: 'Cohere',
    mode: 'cloud',
    description: 'Provider Cohere via API key; adapter pode exigir integração dedicada.',
    requiresApiKey: true,
  },
  {
    id: 'deepseek-api',
    label: 'DeepSeek',
    mode: 'cloud',
    description: 'Provider DeepSeek OpenAI-compatible via API key.',
    requiresApiKey: true,
  },
  {
    id: 'xai-api',
    label: 'xAI',
    mode: 'cloud',
    description: 'Provider xAI via API key.',
    requiresApiKey: true,
  },
  {
    id: 'perplexity-api',
    label: 'Perplexity',
    mode: 'cloud',
    description: 'Provider Perplexity via API key.',
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
    description: 'Execucao local pela API do Ollama.',
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
  modalities?: ModelModality[];
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
    modalities: input.modalities ?? (input.tags.some((tag) => tag.includes('codigo') || tag.includes('code')) ? ['text', 'code'] : ['text']),
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
    requiresApiKey: ['openai-api', 'openrouter-api', 'anthropic-api', 'gemini-api', 'gemini-cli', 'mistral-api', 'groq-api', 'together-api', 'fireworks-api', 'cerebras-api', 'cohere-api', 'deepseek-api', 'xai-api', 'perplexity-api'].includes(input.providerId),
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
  modalities?: ModelModality[];
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
    modalities: input.modalities ?? (input.tags.some((tag) => tag.includes('codigo') || tag.includes('code')) ? ['text', 'code'] : ['text']),
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
    id: 'codex-cli-default',
    name: 'Codex CLI Padrao',
    providerId: 'codex-cli',
    providerLabel: 'Codex CLI',
    status: 'requires_cli_auth',
    setupRequirement: 'Requer Codex CLI no PATH, autenticacao validada e adapter operacional antes de executar.',
    actionLabel: 'Validar CLI',
    strengths: ['Fluxo natural para coding agent', 'Pode usar terminal real quando integrado', 'Bom para continuidade operacional'],
    weaknesses: ['Adapter ainda exige validacao explicita neste build', 'Nao pode ser marcado pronto sem teste real'],
    bestFor: ['Uso futuro como provider agentico validado', 'Terminal controlado', 'Fluxos de codigo'],
    tags: ['codigo', 'requer-config', 'cli', 'cloud'],
    capabilities: { speed: 4, reasoning: 4, coding: 5, text: 4, longContext: 4 },
    caveats: ['Nao simula resposta; se auth/adapter faltar, direciona para Configurações > Modelos.'],
  }),
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
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    providerId: 'gemini-api',
    providerLabel: 'Gemini API',
    status: 'requires_api_key',
    setupRequirement: 'Requer API key Google salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Raciocinio forte', 'Contexto longo', 'Bom para análise ampla'],
    weaknesses: ['Latencia e limites dependem da conta'],
    bestFor: ['Planejamento profundo', 'Analise de codigo', 'Documentos longos'],
    tags: ['raciocinio', 'contexto-longo', 'cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 5, coding: 4, text: 5, longContext: 5 },
  }),
  cloudModel({
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    providerId: 'gemini-api',
    providerLabel: 'Gemini API',
    status: 'requires_api_key',
    setupRequirement: 'Requer API key Google salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Rapido', 'Contexto amplo', 'Bom para rotinas'],
    weaknesses: ['Modelo anterior ao 2.5 em qualidade geral'],
    bestFor: ['Triagem', 'Resumo', 'Automacao leve'],
    tags: ['rapido', 'cloud', 'requer-config'],
    capabilities: { speed: 5, reasoning: 3, coding: 3, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    providerId: 'gemini-api',
    providerLabel: 'Gemini API',
    status: 'requires_api_key',
    setupRequirement: 'Requer API key Google salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Contexto longo', 'Boa análise multimodal/textual'],
    weaknesses: ['Modelo anterior ao 2.5 em algumas tarefas'],
    bestFor: ['Documentos longos', 'Raciocinio geral', 'Analise'],
    tags: ['contexto-longo', 'cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 4, coding: 4, text: 5, longContext: 5 },
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
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    providerId: 'openai-api',
    providerLabel: 'OpenAI API',
    status: 'requires_api_key',
    setupRequirement: 'Requer OPENAI_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Codigo forte', 'Uso geral robusto', 'Boa aderencia a instrucoes'],
    weaknesses: ['Custo e cota dependem da conta'],
    bestFor: ['Codigo', 'Analise', 'Automacao'],
    tags: ['codigo', 'raciocinio', 'cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 4, coding: 5, text: 5, longContext: 4 },
  }),
  cloudModel({
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    providerId: 'openai-api',
    providerLabel: 'OpenAI API',
    status: 'requires_api_key',
    setupRequirement: 'Requer OPENAI_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Rapido', 'Bom custo/latencia', 'Adequado para tarefas curtas'],
    weaknesses: ['Menos indicado para refatoracao muito profunda'],
    bestFor: ['Tarefas rapidas', 'Classificacao', 'Auxilio cotidiano'],
    tags: ['rapido', 'cloud', 'requer-config'],
    capabilities: { speed: 5, reasoning: 3, coding: 4, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'gpt-4o',
    name: 'GPT-4o',
    providerId: 'openai-api',
    providerLabel: 'OpenAI API',
    status: 'requires_api_key',
    setupRequirement: 'Requer OPENAI_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Geralista', 'Rapido', 'Bom para multimodal quando adapter suportar'],
    weaknesses: ['Recursos dependem do adapter ativo'],
    bestFor: ['Uso geral', 'Texto', 'Assistencia rapida'],
    tags: ['rapido', 'cloud', 'requer-config'],
    capabilities: { speed: 4, reasoning: 4, coding: 4, text: 5, longContext: 4 },
  }),
  cloudModel({
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    providerId: 'openai-api',
    providerLabel: 'OpenAI API',
    status: 'requires_api_key',
    setupRequirement: 'Requer OPENAI_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Muito rapido', 'Bom para triagem', 'Custo geralmente menor'],
    weaknesses: ['Menos indicado para raciocinio longo'],
    bestFor: ['Resumo', 'Classificacao', 'Interacao rapida'],
    tags: ['rapido', 'cloud', 'requer-config'],
    capabilities: { speed: 5, reasoning: 3, coding: 3, text: 4, longContext: 3 },
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
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek via OpenRouter',
    providerId: 'openrouter-api',
    providerLabel: 'OpenRouter',
    status: 'requires_api_key',
    setupRequirement: 'Requer OPENROUTER_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Gateway flexivel', 'Bom para codigo', 'Fallback por roteamento'],
    weaknesses: ['Limites e disponibilidade variam no roteamento'],
    bestFor: ['Codigo', 'Fallback cloud', 'Custo controlado'],
    tags: ['codigo', 'cloud', 'requer-config'],
    capabilities: { speed: 4, reasoning: 4, coding: 4, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'qwen/qwen3',
    name: 'Qwen via OpenRouter',
    providerId: 'openrouter-api',
    providerLabel: 'OpenRouter',
    status: 'requires_api_key',
    setupRequirement: 'Requer OPENROUTER_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Bom para codigo', 'Alternativa aberta via gateway'],
    weaknesses: ['Modelo efetivo depende da rota escolhida'],
    bestFor: ['Codigo', 'Tarefas gerais', 'Fallback'],
    tags: ['codigo', 'cloud', 'requer-config'],
    capabilities: { speed: 4, reasoning: 4, coding: 4, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama via OpenRouter',
    providerId: 'openrouter-api',
    providerLabel: 'OpenRouter',
    status: 'requires_api_key',
    setupRequirement: 'Requer OPENROUTER_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Modelo aberto via gateway', 'Uso geral robusto'],
    weaknesses: ['Qualidade e limite variam por rota'],
    bestFor: ['Texto', 'Q&A', 'Fallback'],
    tags: ['cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 4, coding: 4, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude via OpenRouter',
    providerId: 'openrouter-api',
    providerLabel: 'OpenRouter',
    status: 'requires_api_key',
    setupRequirement: 'Requer OPENROUTER_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Contexto longo', 'Boa revisao textual', 'Gateway flexivel'],
    weaknesses: ['Disponibilidade e preço variam pelo OpenRouter'],
    bestFor: ['Revisao', 'Docs', 'Analise longa'],
    tags: ['contexto-longo', 'cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 4, coding: 4, text: 5, longContext: 5 },
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
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    providerId: 'anthropic-api',
    providerLabel: 'Anthropic API',
    status: 'requires_api_key',
    setupRequirement: 'Requer ANTHROPIC_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Raciocinio profundo', 'Texto tecnico', 'Contexto longo'],
    weaknesses: ['Custo e latencia dependem do plano'],
    bestFor: ['Arquitetura', 'Analise longa', 'Revisao complexa'],
    tags: ['raciocinio', 'contexto-longo', 'premium', 'requer-config'],
    capabilities: { speed: 2, reasoning: 5, coding: 4, text: 5, longContext: 5 },
  }),
  cloudModel({
    id: 'claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    providerId: 'anthropic-api',
    providerLabel: 'Anthropic API',
    status: 'requires_api_key',
    setupRequirement: 'Requer ANTHROPIC_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Raciocinio', 'Revisao', 'Escrita tecnica'],
    weaknesses: ['Modelo anterior aos 4.x'],
    bestFor: ['Revisao', 'Docs', 'Analise'],
    tags: ['raciocinio', 'cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 4, coding: 4, text: 5, longContext: 4 },
  }),
  cloudModel({
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    providerId: 'anthropic-api',
    providerLabel: 'Anthropic API',
    status: 'requires_api_key',
    setupRequirement: 'Requer ANTHROPIC_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Revisao de texto', 'Codigo', 'Contexto'],
    weaknesses: ['Modelo anterior aos 4.x'],
    bestFor: ['Docs', 'Codigo', 'Analise geral'],
    tags: ['texto', 'codigo', 'cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 4, coding: 4, text: 5, longContext: 4 },
  }),
  cloudModel({
    id: 'claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    providerId: 'anthropic-api',
    providerLabel: 'Anthropic API',
    status: 'requires_api_key',
    setupRequirement: 'Requer ANTHROPIC_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Rapido', 'Bom para tarefas curtas'],
    weaknesses: ['Menos indicado para raciocinio profundo'],
    bestFor: ['Triagem', 'Resumo', 'Resposta rapida'],
    tags: ['rapido', 'cloud', 'requer-config'],
    capabilities: { speed: 5, reasoning: 3, coding: 3, text: 4, longContext: 3 },
  }),
  cloudModel({
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    providerId: 'deepseek-api',
    providerLabel: 'DeepSeek',
    status: 'requires_api_key',
    setupRequirement: 'Requer DEEPSEEK_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Codigo e chat geral', 'API OpenAI-compatible'],
    weaknesses: ['Limites dependem da conta DeepSeek'],
    bestFor: ['Codigo', 'Chat tecnico', 'Fallback cloud'],
    tags: ['codigo', 'cloud', 'requer-config'],
    capabilities: { speed: 4, reasoning: 4, coding: 4, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    providerId: 'deepseek-api',
    providerLabel: 'DeepSeek',
    status: 'requires_api_key',
    setupRequirement: 'Requer DEEPSEEK_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Foco em codigo', 'Bom para implementacao'],
    weaknesses: ['Disponibilidade depende do provider'],
    bestFor: ['Codigo', 'Revisao', 'Scripts'],
    tags: ['codigo', 'cloud', 'requer-config'],
    capabilities: { speed: 4, reasoning: 4, coding: 5, text: 3, longContext: 4 },
  }),
  cloudModel({
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    providerId: 'deepseek-api',
    providerLabel: 'DeepSeek',
    status: 'requires_api_key',
    setupRequirement: 'Requer DEEPSEEK_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Raciocinio', 'Analise', 'Codigo com planejamento'],
    weaknesses: ['Pode ter maior latencia'],
    bestFor: ['Analise profunda', 'Debug', 'Planejamento'],
    tags: ['raciocinio', 'codigo', 'cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 5, coding: 4, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'mistral-large-latest',
    name: 'Mistral Large',
    providerId: 'mistral-api',
    providerLabel: 'Mistral',
    status: 'requires_api_key',
    setupRequirement: 'Requer MISTRAL_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Geralista forte', 'API dedicada', 'Bom texto'],
    weaknesses: ['Cotas dependem do plano'],
    bestFor: ['Texto', 'Analise', 'Codigo geral'],
    tags: ['cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 4, coding: 4, text: 5, longContext: 4 },
  }),
  cloudModel({
    id: 'codestral-latest',
    name: 'Codestral',
    providerId: 'mistral-api',
    providerLabel: 'Mistral',
    status: 'requires_api_key',
    setupRequirement: 'Requer MISTRAL_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Foco em codigo', 'Autocomplete e geracao'],
    weaknesses: ['Uso depende dos termos/plano do provider'],
    bestFor: ['Codigo', 'Refactor pequeno', 'Snippets'],
    tags: ['codigo', 'cloud', 'requer-config'],
    capabilities: { speed: 4, reasoning: 3, coding: 5, text: 3, longContext: 4 },
  }),
  cloudModel({
    id: 'mixtral-8x7b',
    name: 'Mixtral',
    providerId: 'mistral-api',
    providerLabel: 'Mistral',
    status: 'requires_api_key',
    setupRequirement: 'Requer MISTRAL_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Modelo aberto via API', 'Bom custo/latencia'],
    weaknesses: ['Modelo anterior aos maiores atuais'],
    bestFor: ['Texto geral', 'Fallback', 'Tarefas rapidas'],
    tags: ['rapido', 'cloud', 'requer-config'],
    capabilities: { speed: 4, reasoning: 3, coding: 3, text: 4, longContext: 3 },
  }),
  cloudModel({
    id: 'llama-3.1-70b-versatile',
    name: 'Llama via Groq',
    providerId: 'groq-api',
    providerLabel: 'Groq',
    status: 'requires_api_key',
    setupRequirement: 'Requer GROQ_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Baixa latencia', 'Bom para respostas rapidas'],
    weaknesses: ['Catalogo depende do provider'],
    bestFor: ['Chat rapido', 'Triagem', 'Fallback'],
    tags: ['rapido', 'cloud', 'requer-config'],
    capabilities: { speed: 5, reasoning: 4, coding: 4, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'qwen-qwq-32b',
    name: 'Qwen via Groq',
    providerId: 'groq-api',
    providerLabel: 'Groq',
    status: 'requires_api_key',
    setupRequirement: 'Requer GROQ_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Rapido', 'Bom raciocinio para tarefas curtas'],
    weaknesses: ['Catalogo depende do provider'],
    bestFor: ['Codigo curto', 'Analise rapida', 'Fallback'],
    tags: ['rapido', 'codigo', 'cloud', 'requer-config'],
    capabilities: { speed: 5, reasoning: 4, coding: 4, text: 4, longContext: 3 },
  }),
  cloudModel({
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral via Groq',
    providerId: 'groq-api',
    providerLabel: 'Groq',
    status: 'requires_api_key',
    setupRequirement: 'Requer GROQ_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Latencia baixa', 'Modelo leve via API'],
    weaknesses: ['Menos indicado para tarefas profundas'],
    bestFor: ['Resposta rapida', 'Resumo', 'Chat'],
    tags: ['rapido', 'cloud', 'requer-config'],
    capabilities: { speed: 5, reasoning: 3, coding: 3, text: 4, longContext: 3 },
  }),
  cloudModel({
    id: 'meta-llama/Llama-3.1-70B-Instruct-Turbo',
    name: 'Llama via Together AI',
    providerId: 'together-api',
    providerLabel: 'Together AI',
    status: 'requires_api_key',
    setupRequirement: 'Requer TOGETHER_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Catalogo aberto amplo', 'API OpenAI-compatible'],
    weaknesses: ['Limites dependem da conta'],
    bestFor: ['Texto', 'Codigo geral', 'Fallback'],
    tags: ['cloud', 'requer-config'],
    capabilities: { speed: 4, reasoning: 4, coding: 4, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    name: 'Llama via Fireworks AI',
    providerId: 'fireworks-api',
    providerLabel: 'Fireworks AI',
    status: 'requires_api_key',
    setupRequirement: 'Requer FIREWORKS_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Inferencia hospedada', 'Catalogo aberto'],
    weaknesses: ['Limites dependem da conta'],
    bestFor: ['Fallback', 'Texto', 'Codigo geral'],
    tags: ['cloud', 'requer-config'],
    capabilities: { speed: 4, reasoning: 4, coding: 4, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'llama3.1-8b',
    name: 'Llama via Cerebras',
    providerId: 'cerebras-api',
    providerLabel: 'Cerebras',
    status: 'requires_api_key',
    setupRequirement: 'Requer CEREBRAS_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Inferência muito rápida', 'API OpenAI-compatible', 'Boa para iteração curta'],
    weaknesses: ['Catálogo e limites dependem da conta Cerebras'],
    bestFor: ['Resposta rápida', 'Triagem', 'Fallback cloud'],
    tags: ['rapido', 'cloud', 'requer-config'],
    capabilities: { speed: 5, reasoning: 3, coding: 3, text: 4, longContext: 3 },
  }),
  cloudModel({
    id: 'command-r',
    name: 'Command R',
    providerId: 'cohere-api',
    providerLabel: 'Cohere',
    status: 'experimental',
    setupRequirement: 'Requer COHERE_API_KEY e adapter dedicado antes de executar.',
    actionLabel: 'Adicionar API key',
    strengths: ['RAG e texto corporativo', 'Bom para recuperação'],
    weaknesses: ['Adapter dedicado ainda precisa validação nesta build'],
    bestFor: ['RAG', 'Busca semantica', 'Texto'],
    tags: ['experimental', 'cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 3, coding: 3, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'command-r-plus',
    name: 'Command R+',
    providerId: 'cohere-api',
    providerLabel: 'Cohere',
    status: 'experimental',
    setupRequirement: 'Requer COHERE_API_KEY e adapter dedicado antes de executar.',
    actionLabel: 'Adicionar API key',
    strengths: ['RAG avançado', 'Texto longo'],
    weaknesses: ['Adapter dedicado ainda precisa validação nesta build'],
    bestFor: ['RAG', 'Analise corporativa', 'Texto'],
    tags: ['experimental', 'cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 4, coding: 3, text: 5, longContext: 4 },
  }),
  cloudModel({
    id: 'grok',
    name: 'Grok',
    providerId: 'xai-api',
    providerLabel: 'xAI',
    status: 'requires_api_key',
    setupRequirement: 'Requer XAI_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Chat geral', 'API cloud'],
    weaknesses: ['Acesso e limites dependem da conta xAI'],
    bestFor: ['Chat', 'Analise geral', 'Fallback'],
    tags: ['cloud', 'requer-config'],
    capabilities: { speed: 3, reasoning: 4, coding: 4, text: 4, longContext: 4 },
  }),
  cloudModel({
    id: 'sonar',
    name: 'Sonar',
    providerId: 'perplexity-api',
    providerLabel: 'Perplexity',
    status: 'requires_api_key',
    setupRequirement: 'Requer PERPLEXITY_API_KEY ou key salva.',
    actionLabel: 'Adicionar API key',
    strengths: ['Busca/resposta com provider especializado', 'Bom para consulta factual'],
    weaknesses: ['Resultados dependem do provider e plano'],
    bestFor: ['Pesquisa', 'Perguntas factuais', 'Resumo com fontes quando suportado'],
    tags: ['pesquisa', 'cloud', 'requer-config'],
    capabilities: { speed: 4, reasoning: 3, coding: 2, text: 4, longContext: 3 },
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
  localModel({
    id: 'qwen2.5-coder:0.5b',
    name: 'Qwen2.5 Coder 0.5B',
    family: 'Qwen Coder',
    size: '0.5B',
    ram: '3 GB',
    vram: '1 GB',
    disk: '0.5 GB aprox.',
    expectedPerformance: 'Muito leve; util para testes e prompts curtos.',
    recommendedHardware: 'cpu',
    strengths: ['Muito leve', 'Instala rapido'],
    weaknesses: ['Qualidade limitada'],
    bestFor: ['Teste local', 'Hardware modesto'],
    tags: ['local', 'leve', 'codigo', 'rapido'],
    capabilities: { speed: 5, reasoning: 1, coding: 2, text: 2, longContext: 1 },
  }),
  localModel({
    id: 'qwen3:0.6b',
    name: 'Qwen3 0.6B',
    family: 'Qwen',
    size: '0.6B',
    ram: '3 GB',
    vram: '1 GB',
    disk: '0.6 GB aprox.',
    expectedPerformance: 'Muito rapido; qualidade limitada para tarefas complexas.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Rapido'],
    weaknesses: ['Raciocinio limitado'],
    bestFor: ['Teste local', 'Texto curto'],
    tags: ['local', 'leve', 'rapido'],
    capabilities: { speed: 5, reasoning: 2, coding: 2, text: 3, longContext: 2 },
  }),
  localModel({
    id: 'qwen3:1.7b',
    name: 'Qwen3 1.7B',
    family: 'Qwen',
    size: '1.7B',
    ram: '4 GB',
    vram: '2 GB',
    disk: '1.3 GB aprox.',
    expectedPerformance: 'Rapido em CPU para texto e tarefas leves.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Bom para chat local simples'],
    weaknesses: ['Menos forte em codigo complexo'],
    bestFor: ['Chat local', 'Resumo curto'],
    tags: ['local', 'leve', 'rapido'],
    capabilities: { speed: 5, reasoning: 2, coding: 3, text: 3, longContext: 2 },
  }),
  localModel({
    id: 'qwen3:4b',
    name: 'Qwen3 4B',
    family: 'Qwen',
    size: '4B',
    ram: '6-8 GB',
    vram: '4 GB',
    disk: '2.6 GB aprox.',
    expectedPerformance: 'Bom equilibrio leve para chat e analise curta.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Melhor coerencia que 1.7B'],
    weaknesses: ['Ainda limitado para grandes refactors'],
    bestFor: ['Chat local', 'Analise curta'],
    tags: ['local', 'leve', 'texto'],
    capabilities: { speed: 4, reasoning: 3, coding: 3, text: 4, longContext: 3 },
  }),
  localModel({
    id: 'qwen3:8b',
    name: 'Qwen3 8B',
    family: 'Qwen',
    size: '8B',
    ram: '10-14 GB',
    vram: '6-8 GB',
    disk: '5 GB aprox.',
    expectedPerformance: 'Boa qualidade local; melhor com GPU.',
    recommendedHardware: 'either',
    strengths: ['Bom raciocinio local', 'Uso geral'],
    weaknesses: ['Pode ficar lento em CPU'],
    bestFor: ['Analise local', 'Chat tecnico'],
    tags: ['local', 'medio', 'recomendado'],
    capabilities: { speed: 3, reasoning: 4, coding: 4, text: 4, longContext: 4 },
    recommended: true,
  }),
  localModel({
    id: 'qwen3:14b',
    name: 'Qwen3 14B',
    family: 'Qwen',
    size: '14B',
    ram: '16-24 GB',
    vram: '10-16 GB',
    disk: '9 GB aprox.',
    expectedPerformance: 'Mais qualidade, mas pesado para 16 GB.',
    recommendedHardware: 'gpu',
    strengths: ['Raciocinio melhor', 'Texto e codigo'],
    weaknesses: ['Pesado', 'Pode demorar'],
    bestFor: ['Analise mais profunda', 'Codigo local'],
    tags: ['local', 'pesado', 'codigo'],
    capabilities: { speed: 2, reasoning: 4, coding: 4, text: 4, longContext: 4 },
    heavy: true,
  }),
  localModel({
    id: 'qwen3:32b',
    name: 'Qwen3 32B',
    family: 'Qwen',
    size: '32B',
    ram: '32-48 GB',
    vram: '20-32 GB',
    disk: '20 GB aprox.',
    expectedPerformance: 'Alta qualidade local; exige hardware forte.',
    recommendedHardware: 'gpu',
    strengths: ['Raciocinio forte', 'Qualidade alta'],
    weaknesses: ['Muito pesado', 'Pode ser inviavel neste PC'],
    bestFor: ['Analise pesada local'],
    tags: ['local', 'pesado', 'forte'],
    capabilities: { speed: 1, reasoning: 5, coding: 5, text: 5, longContext: 5 },
    heavy: true,
  }),
  localModel({
    id: 'llama3.2:1b',
    name: 'Llama 3.2 1B',
    family: 'Llama',
    size: '1B',
    ram: '3-4 GB',
    vram: '1-2 GB',
    disk: '0.8 GB aprox.',
    expectedPerformance: 'Muito leve para texto simples.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Rapido'],
    weaknesses: ['Pouco raciocinio'],
    bestFor: ['Resumo curto', 'Teste local'],
    tags: ['local', 'leve', 'rapido'],
    capabilities: { speed: 5, reasoning: 2, coding: 2, text: 3, longContext: 2 },
  }),
  localModel({
    id: 'llama3.1:8b',
    name: 'Llama 3.1 8B',
    family: 'Llama',
    size: '8B',
    ram: '10-14 GB',
    vram: '6-8 GB',
    disk: '5 GB aprox.',
    expectedPerformance: 'Bom geralista local.',
    recommendedHardware: 'either',
    strengths: ['Geralista', 'Bom texto'],
    weaknesses: ['Codigo abaixo de modelos coder'],
    bestFor: ['Chat local', 'Resumo', 'Q&A'],
    tags: ['local', 'medio', 'texto'],
    capabilities: { speed: 3, reasoning: 4, coding: 3, text: 4, longContext: 4 },
  }),
  localModel({
    id: 'llama3.1:70b',
    name: 'Llama 3.1 70B',
    family: 'Llama',
    size: '70B',
    ram: '64-96 GB',
    vram: '40+ GB',
    disk: '40 GB aprox.',
    expectedPerformance: 'Muito pesado; listar não significa recomendado neste hardware.',
    recommendedHardware: 'gpu',
    strengths: ['Qualidade alta', 'Geralista forte'],
    weaknesses: ['Muito pesado', 'Pode demorar muito'],
    bestFor: ['Hardware forte', 'Analise local pesada'],
    tags: ['local', 'pesado', 'forte'],
    capabilities: { speed: 1, reasoning: 5, coding: 4, text: 5, longContext: 5 },
    heavy: true,
  }),
  localModel({
    id: 'codellama:7b',
    name: 'CodeLlama 7B',
    family: 'CodeLlama',
    size: '7B',
    ram: '8-12 GB',
    vram: '6-8 GB',
    disk: '4 GB aprox.',
    expectedPerformance: 'Focado em codigo, mas menos recente.',
    recommendedHardware: 'either',
    strengths: ['Codigo local', 'Modelo conhecido'],
    weaknesses: ['Pode perder para Qwen Coder novo'],
    bestFor: ['Fallback de codigo'],
    tags: ['local', 'codigo', 'medio'],
    capabilities: { speed: 3, reasoning: 3, coding: 4, text: 3, longContext: 3 },
  }),
  localModel({
    id: 'deepseek-coder:1.3b',
    name: 'DeepSeek Coder 1.3B',
    family: 'DeepSeek Coder',
    size: '1.3B',
    ram: '4 GB',
    vram: '2 GB',
    disk: '1 GB aprox.',
    expectedPerformance: 'Leve para snippets e testes.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Foco em codigo'],
    weaknesses: ['Limitado para projetos grandes'],
    bestFor: ['Snippets', 'Teste local'],
    tags: ['local', 'leve', 'codigo'],
    capabilities: { speed: 5, reasoning: 2, coding: 3, text: 2, longContext: 2 },
  }),
  localModel({
    id: 'deepseek-coder:33b',
    name: 'DeepSeek Coder 33B',
    family: 'DeepSeek Coder',
    size: '33B',
    ram: '40-64 GB',
    vram: '24-40 GB',
    disk: '19 GB aprox.',
    expectedPerformance: 'Muito pesado; exige hardware forte.',
    recommendedHardware: 'gpu',
    strengths: ['Codigo forte', 'Modelo grande local'],
    weaknesses: ['Muito pesado'],
    bestFor: ['Codigo local pesado'],
    tags: ['local', 'pesado', 'codigo'],
    capabilities: { speed: 1, reasoning: 4, coding: 5, text: 3, longContext: 4 },
    heavy: true,
  }),
  localModel({
    id: 'deepseek-r1:1.5b',
    name: 'DeepSeek R1 Distill Qwen 1.5B',
    family: 'DeepSeek R1',
    size: '1.5B',
    ram: '4 GB',
    vram: '2 GB',
    disk: '1.2 GB aprox.',
    expectedPerformance: 'Leve para raciocinio curto.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Raciocinio em hardware modesto'],
    weaknesses: ['Limitado em tarefas complexas'],
    bestFor: ['Teste local', 'Analise curta'],
    tags: ['local', 'leve', 'raciocinio'],
    capabilities: { speed: 4, reasoning: 3, coding: 3, text: 3, longContext: 2 },
  }),
  localModel({
    id: 'deepseek-r1:7b',
    name: 'DeepSeek R1 Distill Qwen 7B',
    family: 'DeepSeek R1',
    size: '7B',
    ram: '8-12 GB',
    vram: '6-8 GB',
    disk: '4.7 GB aprox.',
    expectedPerformance: 'Bom raciocinio local com custo moderado.',
    recommendedHardware: 'either',
    strengths: ['Raciocinio', 'Local'],
    weaknesses: ['Pode ser lento em CPU'],
    bestFor: ['Analise', 'Debug', 'Planejamento curto'],
    tags: ['local', 'raciocinio', 'medio'],
    capabilities: { speed: 3, reasoning: 4, coding: 4, text: 3, longContext: 3 },
  }),
  localModel({
    id: 'deepseek-r1:14b',
    name: 'DeepSeek R1 Distill Qwen 14B',
    family: 'DeepSeek R1',
    size: '14B',
    ram: '16-24 GB',
    vram: '10-16 GB',
    disk: '9 GB aprox.',
    expectedPerformance: 'Pesado; pode demorar em hardware modesto.',
    recommendedHardware: 'gpu',
    strengths: ['Raciocinio melhor', 'Codigo com planejamento'],
    weaknesses: ['Pesado'],
    bestFor: ['Debug profundo', 'Analise local'],
    tags: ['local', 'pesado', 'raciocinio'],
    capabilities: { speed: 2, reasoning: 5, coding: 4, text: 4, longContext: 4 },
    heavy: true,
  }),
  localModel({
    id: 'deepseek-r1:8b',
    name: 'DeepSeek R1 Distill Llama 8B',
    family: 'DeepSeek R1',
    size: '8B',
    ram: '10-14 GB',
    vram: '6-8 GB',
    disk: '5 GB aprox.',
    expectedPerformance: 'Equilibrado para raciocinio local.',
    recommendedHardware: 'either',
    strengths: ['Raciocinio', 'Uso geral'],
    weaknesses: ['Pode ser lento em CPU'],
    bestFor: ['Analise local', 'Planejamento'],
    tags: ['local', 'raciocinio', 'medio'],
    capabilities: { speed: 3, reasoning: 4, coding: 4, text: 4, longContext: 4 },
  }),
  localModel({
    id: 'mixtral:8x7b',
    name: 'Mixtral 8x7B',
    family: 'Mistral',
    size: '8x7B',
    ram: '32-48 GB',
    vram: '20-32 GB',
    disk: '26 GB aprox.',
    expectedPerformance: 'Pesado; depende muito de RAM/VRAM.',
    recommendedHardware: 'gpu',
    strengths: ['Geralista forte', 'Modelo MoE'],
    weaknesses: ['Pesado', 'Pode demorar'],
    bestFor: ['Texto local com hardware forte'],
    tags: ['local', 'pesado', 'texto'],
    capabilities: { speed: 1, reasoning: 4, coding: 4, text: 5, longContext: 4 },
    heavy: true,
  }),
  localModel({
    id: 'codestral:latest',
    name: 'Codestral',
    family: 'Mistral',
    size: '22B',
    ram: '24-32 GB',
    vram: '16-24 GB',
    disk: '13 GB aprox.',
    expectedPerformance: 'Focado em codigo, pesado para hardware modesto.',
    recommendedHardware: 'gpu',
    strengths: ['Codigo', 'Completar trechos'],
    weaknesses: ['Pesado'],
    bestFor: ['Codigo local com GPU'],
    tags: ['local', 'pesado', 'codigo'],
    capabilities: { speed: 2, reasoning: 4, coding: 5, text: 3, longContext: 4 },
    heavy: true,
  }),
  localModel({
    id: 'phi3:mini',
    name: 'Phi-3 Mini',
    family: 'Phi',
    size: 'Mini',
    ram: '4-6 GB',
    vram: '2-4 GB',
    disk: '2.3 GB aprox.',
    expectedPerformance: 'Leve para texto curto e raciocinio simples.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Rapido'],
    weaknesses: ['Menos forte em codigo'],
    bestFor: ['Chat local leve', 'Resumo'],
    tags: ['local', 'leve', 'rapido'],
    capabilities: { speed: 5, reasoning: 3, coding: 3, text: 4, longContext: 3 },
  }),
  localModel({
    id: 'phi3.5:latest',
    name: 'Phi-3.5 Mini',
    family: 'Phi',
    size: 'Mini',
    ram: '4-6 GB',
    vram: '2-4 GB',
    disk: '2.3 GB aprox.',
    expectedPerformance: 'Leve e bom para rotinas locais.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Texto curto'],
    weaknesses: ['Nao substitui modelos coder maiores'],
    bestFor: ['Resumo', 'Q&A local'],
    tags: ['local', 'leve', 'rapido'],
    capabilities: { speed: 5, reasoning: 3, coding: 3, text: 4, longContext: 3 },
  }),
  localModel({
    id: 'phi4-mini:latest',
    name: 'Phi-4 Mini',
    family: 'Phi',
    size: 'Mini',
    ram: '6-8 GB',
    vram: '4 GB',
    disk: '3 GB aprox.',
    expectedPerformance: 'Leve com melhor raciocinio que Phi menores.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Raciocinio curto'],
    weaknesses: ['Catalogo/tag pode variar no Ollama'],
    bestFor: ['Chat local', 'Analise curta'],
    tags: ['local', 'leve'],
    capabilities: { speed: 4, reasoning: 4, coding: 3, text: 4, longContext: 3 },
  }),
  localModel({
    id: 'gemma:2b',
    name: 'Gemma 2B',
    family: 'Gemma',
    size: '2B',
    ram: '4 GB',
    vram: '2 GB',
    disk: '1.7 GB aprox.',
    expectedPerformance: 'Leve para texto geral.',
    recommendedHardware: 'cpu',
    strengths: ['Leve', 'Texto'],
    weaknesses: ['Codigo limitado'],
    bestFor: ['Resumo local', 'Chat curto'],
    tags: ['local', 'leve', 'texto'],
    capabilities: { speed: 5, reasoning: 2, coding: 2, text: 3, longContext: 2 },
  }),
  localModel({
    id: 'gemma:7b',
    name: 'Gemma 7B',
    family: 'Gemma',
    size: '7B',
    ram: '8-12 GB',
    vram: '6-8 GB',
    disk: '5 GB aprox.',
    expectedPerformance: 'Geralista local moderado.',
    recommendedHardware: 'either',
    strengths: ['Texto', 'Uso geral'],
    weaknesses: ['Nao e focado em codigo pesado'],
    bestFor: ['Texto local', 'Q&A'],
    tags: ['local', 'medio', 'texto'],
    capabilities: { speed: 3, reasoning: 3, coding: 3, text: 4, longContext: 3 },
  }),
  localModel({
    id: 'gemma2:9b',
    name: 'Gemma 2 9B',
    family: 'Gemma',
    size: '9B',
    ram: '12-16 GB',
    vram: '8-10 GB',
    disk: '6 GB aprox.',
    expectedPerformance: 'Bom texto local; pode ficar lento em CPU.',
    recommendedHardware: 'either',
    strengths: ['Texto', 'Qualidade geral'],
    weaknesses: ['Pode ser pesado para 16 GB com multitarefa'],
    bestFor: ['Texto local', 'Resumo'],
    tags: ['local', 'medio', 'texto'],
    capabilities: { speed: 3, reasoning: 4, coding: 3, text: 5, longContext: 4 },
  }),
  localModel({
    id: 'gemma2:27b',
    name: 'Gemma 2 27B',
    family: 'Gemma',
    size: '27B',
    ram: '32-48 GB',
    vram: '20-32 GB',
    disk: '16 GB aprox.',
    expectedPerformance: 'Pesado; listar como opcao, nao recomendado neste PC.',
    recommendedHardware: 'gpu',
    strengths: ['Texto forte', 'Qualidade alta'],
    weaknesses: ['Pesado', 'Pode demorar'],
    bestFor: ['Texto local pesado'],
    tags: ['local', 'pesado', 'texto'],
    capabilities: { speed: 1, reasoning: 4, coding: 3, text: 5, longContext: 4 },
    heavy: true,
  }),
  localModel({
    id: 'starcoder2:3b',
    name: 'StarCoder2 3B',
    family: 'StarCoder',
    size: '3B',
    ram: '6 GB',
    vram: '3 GB',
    disk: '2 GB aprox.',
    expectedPerformance: 'Leve para codigo simples.',
    recommendedHardware: 'cpu',
    strengths: ['Codigo', 'Leve'],
    weaknesses: ['Raciocinio limitado'],
    bestFor: ['Snippets', 'Autocomplete local'],
    tags: ['local', 'leve', 'codigo'],
    capabilities: { speed: 4, reasoning: 2, coding: 4, text: 2, longContext: 2 },
  }),
  localModel({
    id: 'starcoder2:7b',
    name: 'StarCoder2 7B',
    family: 'StarCoder',
    size: '7B',
    ram: '8-12 GB',
    vram: '6-8 GB',
    disk: '4.5 GB aprox.',
    expectedPerformance: 'Focado em codigo com custo moderado.',
    recommendedHardware: 'either',
    strengths: ['Codigo', 'Modelo coder'],
    weaknesses: ['Texto geral limitado'],
    bestFor: ['Codigo local', 'Snippets'],
    tags: ['local', 'codigo', 'medio'],
    capabilities: { speed: 3, reasoning: 3, coding: 4, text: 2, longContext: 3 },
  }),
  localModel({
    id: 'starcoder2:15b',
    name: 'StarCoder2 15B',
    family: 'StarCoder',
    size: '15B',
    ram: '18-24 GB',
    vram: '12-16 GB',
    disk: '9 GB aprox.',
    expectedPerformance: 'Pesado para 16 GB; melhor com GPU.',
    recommendedHardware: 'gpu',
    strengths: ['Codigo mais forte', 'Modelo coder'],
    weaknesses: ['Pesado'],
    bestFor: ['Codigo local com GPU'],
    tags: ['local', 'pesado', 'codigo'],
    capabilities: { speed: 2, reasoning: 3, coding: 5, text: 2, longContext: 4 },
    heavy: true,
  }),
  localModel({
    id: 'yi:9b',
    name: 'Yi 9B',
    family: 'Yi',
    size: '9B',
    ram: '12-16 GB',
    vram: '8-10 GB',
    disk: '6 GB aprox.',
    expectedPerformance: 'Geralista local; disponibilidade da tag pode variar.',
    recommendedHardware: 'either',
    strengths: ['Texto geral', 'Alternativa local'],
    weaknesses: ['Tag/modelo pode variar no Ollama'],
    bestFor: ['Texto local', 'Q&A'],
    tags: ['local', 'medio', 'texto'],
    capabilities: { speed: 3, reasoning: 3, coding: 3, text: 4, longContext: 3 },
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
  if (model.tags.includes('pesado') && /\b(27|32|33|34|70)B\b|8x7B/i.test(`${model.size} ${model.displayName}`)) return 'not_recommended';
  if (model.tags.includes('pesado') || ['qwen2.5-coder:14b', 'codellama:13b', 'qwen3:14b', 'deepseek-r1:14b', 'starcoder2:15b'].includes(model.modelId)) return 'heavy';
  if (['qwen2.5-coder:3b', 'qwen2.5-coder:7b', 'qwen3:8b'].includes(model.modelId)) return 'recommended';
  if (['qwen2.5-coder:0.5b', 'qwen2.5-coder:1.5b', 'qwen3:0.6b', 'qwen3:1.7b', 'qwen3:4b', 'llama3.2:1b', 'llama3.2:3b', 'llama3.1:8b', 'mistral:7b', 'deepseek-coder:1.3b', 'deepseek-coder:6.7b', 'deepseek-r1:1.5b', 'deepseek-r1:7b', 'deepseek-r1:8b', 'codellama:7b', 'phi3:mini', 'phi3.5:latest', 'phi4-mini:latest', 'gemma:2b', 'gemma:7b', 'gemma2:9b', 'starcoder2:3b', 'starcoder2:7b', 'yi:9b'].includes(model.modelId)) {
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
