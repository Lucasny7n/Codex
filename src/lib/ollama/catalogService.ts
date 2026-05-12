import type {
  LocalInstalledModel,
  LocalModelInstallProgress,
  LocalRuntimeSnapshot,
  OllamaModelDetails,
} from '../../types/domain';
import type { ModelCatalogOption } from '../models/modelCatalogService';

export interface OllamaPullCandidate {
  id: string;
  modelId: string;
  label: string;
  normalizedQuery: string;
}

export function normalizeOllamaQuery(query: string): string {
  const raw = query.trim().toLowerCase();
  if (!raw) return '';

  const compact = raw
    .replace(/[_\s]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');

  if (/^gpt[-_ ]?oss$/u.test(raw) || compact === 'gptoss') return 'gpt-oss';
  return compact;
}

export function normalizeOllamaModelId(modelId: string): string {
  const normalized = normalizeOllamaQuery(modelId);
  if (!normalized) return normalized;
  return normalized.includes(':') ? normalized : `${normalized}:latest`;
}

export function ollamaIdentityTerms(value: string): string[] {
  const base = value.trim().toLowerCase();
  const withoutTag = base.split(':')[0] ?? base;
  const dashed = normalizeOllamaQuery(withoutTag);
  const compact = dashed.replace(/[-_\s.]+/gu, '');
  return Array.from(new Set([
    base,
    withoutTag,
    dashed,
    compact,
    dashed.replace(/-/gu, ' '),
    dashed.replace(/-/gu, '_'),
  ].filter(Boolean)));
}

export function listInstalledOllamaModels(runtime?: LocalRuntimeSnapshot): LocalInstalledModel[] {
  return runtime?.installedModels ?? [];
}

export function searchInstalledOllamaModels(
  runtime: LocalRuntimeSnapshot | undefined,
  query: string,
): LocalInstalledModel[] {
  const normalized = normalizeOllamaQuery(query);
  if (!normalized) return listInstalledOllamaModels(runtime);
  if (normalized.includes(':')) {
    const exact = normalizeOllamaModelId(normalized);
    return listInstalledOllamaModels(runtime).filter((model) => normalizeOllamaModelId(model.id) === exact);
  }
  const queryTerms = ollamaIdentityTerms(normalized);
  return listInstalledOllamaModels(runtime).filter((model) => {
    const terms = ollamaIdentityTerms(model.id);
    return queryTerms.some((queryTerm) => terms.some((term) => term.includes(queryTerm) || queryTerm.includes(term)));
  });
}

export function isInstalledOllamaModel(runtime: LocalRuntimeSnapshot | undefined, modelId: string): boolean {
  const normalized = normalizeOllamaModelId(modelId);
  return listInstalledOllamaModels(runtime).some((model) => normalizeOllamaModelId(model.id) === normalized);
}

export function buildPullCandidateFromQuery(
  query: string,
  runtime?: LocalRuntimeSnapshot,
): OllamaPullCandidate | undefined {
  const modelId = normalizeOllamaQuery(query);
  if (!modelId || modelId.length < 2) return undefined;
  if (looksCloudOnlyQuery(modelId)) return undefined;
  if (isInstalledOllamaModel(runtime, modelId)) return undefined;
  return {
    id: `ollama-pull:${modelId}`,
    modelId,
    label: modelId,
    normalizedQuery: modelId,
  };
}

function looksCloudOnlyQuery(modelId: string): boolean {
  if (modelId === 'gpt-oss' || modelId.startsWith('deepseek')) return false;
  return [
    /^gpt$/u,
    /^gpt-[45](?:[.-]\d+)?(?:-|$)/u,
    /^openai(?:-|$)/u,
    /^openrouter(?:-|$)/u,
    /^gemini(?:-|$)/u,
    /^claude(?:-|$)/u,
    /^anthropic(?:-|$)/u,
    /^mistral-(?:large|medium|small)(?:-|$)/u,
    /^sonar(?:-|$)/u,
    /^grok(?:-|$)/u,
  ].some((pattern) => pattern.test(modelId));
}

export function buildPullCandidateOption(
  query: string,
  runtime: LocalRuntimeSnapshot | undefined,
  progress?: Record<string, LocalModelInstallProgress>,
): ModelCatalogOption | undefined {
  const candidate = buildPullCandidateFromQuery(query, runtime);
  if (!candidate) return undefined;
  const currentProgress = progress?.[candidate.modelId] ?? progress?.[normalizeOllamaModelId(candidate.modelId)];
  const pulling = currentProgress?.state === 'running';
  return {
    id: candidate.id,
    label: candidate.label,
    source: 'local',
    providerType: 'local',
    modelId: candidate.modelId,
    providerId: 'local-ollama',
    providerLabel: 'Ollama',
    family: inferOllamaFamily(candidate.modelId),
    status: pulling ? 'pulling' : 'model_missing',
    statusLabel: pulling ? 'Baixando' : 'Disponível para baixar',
    available: false,
    installed: false,
    configured: false,
    ready: false,
    runtimeLabel: 'Ollama',
    metadata: {
      provider: 'local-ollama',
      type: 'local',
      capabilities: ['text', inferOllamaFamily(candidate.modelId)],
      multimodal: false,
      promptPresetIds: ['local:ollama:default'],
      contextFragmentScopes: ['session', 'workspace'],
      technicalLogScope: 'runtime',
      ragReady: true,
      toolPermissionScopes: ['workspace-read'],
    },
    searchTerms: [
      candidate.modelId,
      candidate.normalizedQuery,
      ...ollamaIdentityTerms(candidate.modelId),
      'ollama',
      'download',
      'baixar',
    ],
  };
}

export async function refreshOllamaSnapshot(): Promise<LocalRuntimeSnapshot> {
  const { getLocalRuntimeState } = await import('../api');
  return getLocalRuntimeState();
}

export async function pullOllamaModel(modelId: string): Promise<LocalRuntimeSnapshot> {
  const { installLocalModel } = await import('../api');
  const snapshot = await installLocalModel(normalizeOllamaQuery(modelId));
  if (!isInstalledOllamaModel(snapshot, modelId)) {
    throw new Error(`Ollama concluiu o download, mas ${modelId} ainda não apareceu em /api/tags.`);
  }
  return snapshot;
}

export async function removeOllamaModel(modelId: string): Promise<LocalRuntimeSnapshot> {
  const { removeLocalModel: removeLocalModelApi } = await import('../api');
  return removeLocalModelApi(modelId);
}

export async function showOllamaModel(
  modelId: string,
): Promise<OllamaModelDetails> {
  const { showLocalModel } = await import('../api');
  return showLocalModel(modelId);
}

function inferOllamaFamily(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes('gpt-oss')) return 'GPT-OSS';
  if (lower.includes('qwen')) return 'Qwen';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('llama')) return 'Llama';
  if (lower.includes('mistral') || lower.includes('codestral') || lower.includes('devstral')) return 'Mistral';
  if (lower.includes('phi')) return 'Phi';
  if (lower.includes('gemma')) return 'Gemma';
  if (lower.includes('starcoder')) return 'StarCoder';
  return 'Ollama';
}
