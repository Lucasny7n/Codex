import type {
  LocalInstalledModel,
  LocalModelInstallProgress,
  LocalRuntimeSnapshot,
  OllamaLibrarySearchResult,
} from '../../types/domain';
import {
  listInstalledOllamaModels,
  normalizeOllamaModelId,
  normalizeOllamaQuery,
  ollamaIdentityTerms,
} from './catalogService';

export type OllamaSearchDiscoverySource = 'installed' | 'remote' | 'fallback';

export interface OllamaSearchItem {
  id: string;
  modelId: string;
  label: string;
  family: string;
  installed: boolean;
  availableForDownload: boolean;
  statusLabel: string;
  sizeLabel?: string;
  source: 'local';
  providerId: 'local-ollama';
  providerLabel: 'Ollama';
  runtimeLabel: 'Ollama';
  digest?: string;
  modifiedAt?: string;
  discoverySource: OllamaSearchDiscoverySource;
  searchTerms: string[];
}

export interface SearchOllamaModelsOptions {
  remoteResults?: OllamaLibrarySearchResult[];
  installationProgress?: Record<string, LocalModelInstallProgress>;
  includeFallback?: boolean;
}

const REMOTE_CACHE_TTL_MS = 10 * 60 * 1000;
const remoteCache = new Map<string, { at: number; results: OllamaLibrarySearchResult[] }>();

const FALLBACK_OLLAMA_MODELS: Array<{ modelId: string; family: string; aliases?: string[] }> = [
  { modelId: 'gpt-oss:20b', family: 'GPT-OSS', aliases: ['gpt oss', 'gptoss', 'openai oss'] },
  { modelId: 'gpt-oss:120b', family: 'GPT-OSS', aliases: ['gpt oss', 'gptoss', 'openai oss'] },
  { modelId: 'llama3.2', family: 'Llama', aliases: ['llama 3', 'llama 3.2', 'llama'] },
  { modelId: 'llama3.1', family: 'Llama', aliases: ['llama 3', 'llama 3.1', 'llama'] },
  { modelId: 'llama3', family: 'Llama', aliases: ['llama 3', 'llama'] },
  { modelId: 'qwen2.5', family: 'Qwen', aliases: ['qwen', 'qwen 2.5'] },
  { modelId: 'qwen2.5-coder', family: 'Qwen', aliases: ['qwen coder', 'qwen code', 'qwen2.5 coder'] },
  { modelId: 'qwen3', family: 'Qwen', aliases: ['qwen', 'qwen 3'] },
  { modelId: 'deepseek-r1', family: 'DeepSeek', aliases: ['deepseek r1', 'deepseek reasoning'] },
  { modelId: 'deepseek-coder', family: 'DeepSeek', aliases: ['deepseek coder', 'deepseek code'] },
  { modelId: 'gemma3', family: 'Gemma', aliases: ['gemma', 'gemma 3'] },
  { modelId: 'gemma2', family: 'Gemma', aliases: ['gemma', 'gemma 2'] },
  { modelId: 'mistral', family: 'Mistral', aliases: ['mistral 7b'] },
  { modelId: 'mixtral', family: 'Mistral', aliases: ['mixtral', 'mistral moe'] },
  { modelId: 'codestral', family: 'Mistral', aliases: ['mistral code', 'code stral'] },
  { modelId: 'devstral', family: 'Mistral', aliases: ['mistral dev', 'dev stral'] },
  { modelId: 'phi4', family: 'Phi', aliases: ['phi', 'phi 4'] },
  { modelId: 'phi3', family: 'Phi', aliases: ['phi', 'phi 3'] },
  { modelId: 'nomic-embed-text', family: 'Embedding', aliases: ['nomic embed', 'nomic embedding'] },
  { modelId: 'bge-m3', family: 'Embedding', aliases: ['bge', 'bge m3', 'embedding'] },
  { modelId: 'starcoder2', family: 'StarCoder', aliases: ['starcoder', 'star coder'] },
  { modelId: 'codegemma', family: 'CodeGemma', aliases: ['code gemma', 'gemma code'] },
  { modelId: 'codellama', family: 'CodeLlama', aliases: ['code llama', 'llama code'] },
  { modelId: 'tinyllama', family: 'TinyLlama', aliases: ['tiny llama'] },
  { modelId: 'smollm2', family: 'SmolLM', aliases: ['smol lm', 'small lm'] },
];

export function searchOllamaModels(
  query: string,
  runtime?: LocalRuntimeSnapshot,
  options: SearchOllamaModelsOptions = {},
): OllamaSearchItem[] {
  const trimmed = query.trim();
  const installedModels = listInstalledOllamaModels(runtime);
  const installedItems = installedModels
    .filter((model) => installedModelMatches(model, trimmed))
    .map((model) => installedModelToSearchItem(model));

  if (!trimmed) {
    return installedItems;
  }

  const installedIds = new Set(installedModels.map((model) => normalizeOllamaModelId(model.id)));
  const byModelId = new Map<string, OllamaSearchItem>();
  for (const item of installedItems) {
    byModelId.set(normalizeOllamaModelId(item.modelId), item);
  }

  for (const remote of options.remoteResults ?? []) {
    if (!humanQueryMatches(trimmed, candidateTerms(remote.modelId, remote.family, [remote.label]))) continue;
    const item = downloadableModelToSearchItem({
      modelId: remote.modelId,
      family: remote.family || inferOllamaFamily(remote.modelId),
      sizeLabel: remote.sizeLabel,
      discoverySource: 'remote',
      installed: installedIds.has(normalizeOllamaModelId(remote.modelId)),
      progress: options.installationProgress,
    });
    upsertSearchItem(byModelId, item);
  }

  if (options.includeFallback !== false) {
    for (const fallback of FALLBACK_OLLAMA_MODELS) {
      if (trimmed.includes(':') && normalizeOllamaModelId(fallback.modelId) !== normalizeOllamaModelId(trimmed)) continue;
      if (!humanQueryMatches(trimmed, candidateTerms(fallback.modelId, fallback.family, fallback.aliases))) continue;
      const item = downloadableModelToSearchItem({
        modelId: fallback.modelId,
        family: fallback.family,
        discoverySource: 'fallback',
        installed: installedIds.has(normalizeOllamaModelId(fallback.modelId)),
        progress: options.installationProgress,
      });
      upsertSearchItem(byModelId, item);
    }
  }

  const directCandidate = directTaggedCandidate(trimmed, installedIds, options.installationProgress);
  if (directCandidate) {
    upsertSearchItem(byModelId, directCandidate);
  }

  return Array.from(byModelId.values()).sort(compareOllamaSearchItems);
}

export async function discoverOllamaLibraryModels(query: string): Promise<OllamaLibrarySearchResult[]> {
  const normalized = normalizeOllamaQuery(query);
  if (normalized.length < 2) return [];

  const cached = remoteCache.get(normalized);
  if (cached && Date.now() - cached.at < REMOTE_CACHE_TTL_MS) {
    return cached.results;
  }

  try {
    const { searchOllamaLibrary } = await import('../api');
    const results = await searchOllamaLibrary(query);
    remoteCache.set(normalized, { at: Date.now(), results });
    return results;
  } catch {
    remoteCache.set(normalized, { at: Date.now(), results: [] });
    return [];
  }
}

function installedModelMatches(model: LocalInstalledModel, query: string): boolean {
  if (!query.trim()) return true;
  if (query.includes(':')) {
    return normalizeOllamaModelId(model.id) === normalizeOllamaModelId(query);
  }
  return humanQueryMatches(query, candidateTerms(model.id, inferOllamaFamily(model.id), [model.digest, model.modifiedAt, model.size]));
}

function installedModelToSearchItem(model: LocalInstalledModel): OllamaSearchItem {
  const family = inferOllamaFamily(model.id);
  return {
    id: model.id,
    modelId: model.id,
    label: model.id,
    family,
    installed: true,
    availableForDownload: false,
    statusLabel: 'Instalado',
    sizeLabel: model.size,
    source: 'local',
    providerId: 'local-ollama',
    providerLabel: 'Ollama',
    runtimeLabel: 'Ollama',
    digest: model.digest,
    modifiedAt: model.modifiedAt,
    discoverySource: 'installed',
    searchTerms: candidateTerms(model.id, family, ['ollama', 'local', 'instalado', model.digest, model.modifiedAt, model.size]),
  };
}

function downloadableModelToSearchItem(input: {
  modelId: string;
  family: string;
  sizeLabel?: string;
  discoverySource: OllamaSearchDiscoverySource;
  installed: boolean;
  progress?: Record<string, LocalModelInstallProgress>;
}): OllamaSearchItem {
  const progress = input.progress?.[input.modelId] ?? input.progress?.[normalizeOllamaModelId(input.modelId)];
  const downloading = progress?.state === 'running';
  const installed = input.installed;
  return {
    id: installed ? input.modelId : `ollama-download:${input.modelId}`,
    modelId: input.modelId,
    label: input.modelId,
    family: input.family,
    installed,
    availableForDownload: !installed,
    statusLabel: installed ? 'Instalado' : downloading ? 'Baixando' : 'Download',
    sizeLabel: input.sizeLabel,
    source: 'local',
    providerId: 'local-ollama',
    providerLabel: 'Ollama',
    runtimeLabel: 'Ollama',
    discoverySource: input.discoverySource,
    searchTerms: candidateTerms(input.modelId, input.family, ['ollama', 'download', 'baixar', input.discoverySource]),
  };
}

function directTaggedCandidate(
  query: string,
  installedIds: Set<string>,
  progress?: Record<string, LocalModelInstallProgress>,
): OllamaSearchItem | undefined {
  const modelId = normalizeOllamaQuery(query);
  if (!modelId.includes(':')) return undefined;
  const family = inferOllamaFamily(modelId);
  if (family === 'Ollama') return undefined;
  return downloadableModelToSearchItem({
    modelId,
    family,
    discoverySource: 'fallback',
    installed: installedIds.has(normalizeOllamaModelId(modelId)),
    progress,
  });
}


function upsertSearchItem(items: Map<string, OllamaSearchItem>, item: OllamaSearchItem): void {
  const key = normalizeOllamaModelId(item.modelId);
  const current = items.get(key);
  if (!current || searchSourceRank(item.discoverySource) < searchSourceRank(current.discoverySource)) {
    items.set(key, item);
  }
}

function compareOllamaSearchItems(left: OllamaSearchItem, right: OllamaSearchItem): number {
  if (left.installed !== right.installed) return left.installed ? -1 : 1;
  const sourceDelta = searchSourceRank(left.discoverySource) - searchSourceRank(right.discoverySource);
  if (sourceDelta !== 0) return sourceDelta;
  return left.modelId.localeCompare(right.modelId);
}

function searchSourceRank(source: OllamaSearchDiscoverySource): number {
  if (source === 'installed') return 0;
  if (source === 'remote') return 1;
  return 2;
}

function candidateTerms(modelId: string, family: string, extra: Array<string | undefined> = []): string[] {
  return [
    modelId,
    family,
    ...ollamaIdentityTerms(modelId),
    modelId.replace(/([a-z])(\d)/giu, '$1 $2'),
    modelId.replace(/[-_.:]+/gu, ' '),
    ...extra.filter((item): item is string => Boolean(item)),
  ];
}

function humanQueryMatches(query: string, terms: string[]): boolean {
  const normalizedQuery = normalizeHumanText(query);
  if (!normalizedQuery) return true;
  const compactQuery = compactText(normalizedQuery);
  const tokenizedQuery = tokens(normalizedQuery);
  const normalizedTerms = terms.map(normalizeHumanText).filter(Boolean);
  const compactTerms = normalizedTerms.map(compactText);
  if (compactTerms.some((term) => term.includes(compactQuery))) return true;
  const haystack = normalizedTerms.join(' ');
  return tokenizedQuery.every((token) => haystack.includes(token) || compactTerms.some((term) => term.includes(token)));
}

function normalizeHumanText(value: string): string {
  return normalizeOllamaQuery(value)
    .replace(/([a-z])(\d)/giu, '$1 $2')
    .replace(/(\d)([a-z])/giu, '$1 $2')
    .replace(/[-_.:/]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function compactText(value: string): string {
  return value.replace(/\s+/gu, '');
}

function tokens(value: string): string[] {
  return value.split(/\s+/u).filter(Boolean);
}

function inferOllamaFamily(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes('gpt-oss')) return 'GPT-OSS';
  if (lower.includes('qwen')) return 'Qwen';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('codellama')) return 'CodeLlama';
  if (lower.includes('codegemma')) return 'CodeGemma';
  if (lower.includes('llama')) return 'Llama';
  if (lower.includes('mistral') || lower.includes('mixtral') || lower.includes('codestral') || lower.includes('devstral')) return 'Mistral';
  if (lower.includes('phi')) return 'Phi';
  if (lower.includes('gemma')) return 'Gemma';
  if (lower.includes('starcoder')) return 'StarCoder';
  if (lower.includes('nomic') || lower.includes('bge')) return 'Embedding';
  if (lower.includes('tinyllama')) return 'TinyLlama';
  if (lower.includes('smollm')) return 'SmolLM';
  return 'Ollama';
}
