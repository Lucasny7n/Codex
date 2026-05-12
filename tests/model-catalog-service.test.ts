import { describe, expect, it } from 'vitest';
import {
  buildCloudModelOptions,
  buildLocalModelOptions,
  visibleModelOptions,
} from '../src/lib/modelCatalogService';
import {
  buildPullCandidateFromQuery,
  normalizeOllamaQuery,
} from '../src/lib/ollamaCatalogService';
import type {
  LocalRuntimeSnapshot,
  ProviderAccountProfile,
  ProviderDescriptor,
} from '../src/types/domain';

const now = new Date().toISOString();

function provider(
  id: string,
  label: string,
  state: ProviderDescriptor['status']['state'],
  models: ProviderDescriptor['models'] = [],
): ProviderDescriptor {
  return {
    id,
    label,
    configurable: true,
    enabled: state === 'ready',
    status: {
      state,
      message: `${label}: ${state}`,
      checkedAt: now,
    },
    models,
  };
}

function localRuntime(installedModels: LocalRuntimeSnapshot['installedModels']): LocalRuntimeSnapshot {
  return {
    state: 'ready',
    message: 'Runtime pronto',
    modelsDir: '/tmp/.codex/models',
    installedModels,
    installed: true,
    serviceActive: true,
    apiReachable: true,
    apiUrl: 'http://127.0.0.1:11434',
    canUsePacman: true,
    hasPkexec: true,
    hasSudo: true,
    diskOk: true,
    problems: [],
    repairActions: [],
    at: now,
  };
}

function profile(status: ProviderAccountProfile['status'], isDefault = true): ProviderAccountProfile {
  return {
    id: `openai-api:${status}`,
    providerId: 'openai-api',
    providerLabel: 'OpenAI API',
    name: status,
    authType: 'api_key',
    status,
    maskedCredential: 'sk-****test',
    source: 'config_file',
    isDefault,
    message: status,
  };
}

describe('modelCatalogService', () => {
  it('Nuvem vazia mostra só modelos configurados e busca mostra catálogo cloud', () => {
    const options = buildCloudModelOptions({
      providers: [
        provider('openai-api', 'OpenAI API', 'ready', [
          { id: 'gpt-5.5', label: 'GPT-5.5', providerId: 'openai-api', supportsTools: false },
        ]),
        provider('openrouter-api', 'OpenRouter', 'requires_api_key', [
          { id: 'moonshotai/kimi-k2', label: 'Kimi K2 via OpenRouter', providerId: 'openrouter-api', supportsTools: false },
        ]),
        provider('local-ollama', 'Local Ollama', 'ready', [
          { id: 'qwen2.5-coder:1.5b', label: 'Qwen2.5 Coder 1.5B', providerId: 'local-ollama', supportsTools: false },
        ]),
      ],
      providerProfiles: [],
    });

    const defaultCloud = visibleModelOptions({ mode: 'cloud', options, query: '' });
    expect(defaultCloud.map((option) => option.label)).toContain('GPT-5.5');
    expect(defaultCloud.map((option) => option.label)).not.toContain('GPT-5.4 Mini via OpenRouter');
    expect(defaultCloud.every((option) => option.source === 'cloud' && option.providerType === 'cloud' && option.ready)).toBe(true);

    const openRouterSearch = visibleModelOptions({ mode: 'cloud', options, query: 'openrouter' });
    expect(openRouterSearch.map((option) => option.label)).toContain('GPT-5.4 Mini via OpenRouter');
    expect(openRouterSearch.map((option) => option.label)).toContain('Kimi K2 via OpenRouter');
    expect(openRouterSearch.find((option) => option.providerId === 'openrouter-api')?.statusLabel).toBe('Configurar API');
    expect(visibleModelOptions({ mode: 'cloud', options, query: 'qwen2.5' })).toHaveLength(0);
  });

  it('Nuvem não marca key salva sem teste como pronta', () => {
    const providers = [
      provider('openai-api', 'OpenAI API', 'ready', [
        { id: 'gpt-5.5', label: 'GPT-5.5', providerId: 'openai-api', supportsTools: false },
      ]),
    ];
    const untested = buildCloudModelOptions({
      providers,
      providerProfiles: [profile('testing')],
    });
    expect(visibleModelOptions({ mode: 'cloud', options: untested, query: '' }).map((option) => option.label)).not.toContain('GPT-5.5');

    const ready = buildCloudModelOptions({
      providers,
      providerProfiles: [profile('ready')],
    });
    expect(visibleModelOptions({ mode: 'cloud', options: ready, query: '' }).map((option) => option.label)).toContain('GPT-5.5');
  });

  it('Local vazio mostra só instalados reais e busca cria candidato Ollama sem catálogo fixo', () => {
    const options = buildLocalModelOptions({
      localRuntime: localRuntime([
        { id: 'qwen2.5-coder:1.5b', size: '986 MB', digest: 'sha256:qwen', modifiedAt: now },
        { id: 'custom-lab:latest', size: '4.2 GB', digest: 'sha256:custom', modifiedAt: now },
      ]),
      installationProgress: {
        'deepseek-coder:6.7b': {
          modelId: 'deepseek-coder:6.7b',
          state: 'running',
          progressPercent: 42,
          downloaded: '2.1 GB',
          total: '5.0 GB',
          speed: '8 MB/s',
          message: 'Baixando modelo local',
          at: now,
        },
      },
    });

    const defaultLocalLabels = visibleModelOptions({ mode: 'local', options, query: '' }).map((option) => option.label);
    expect(defaultLocalLabels).toContain('qwen2.5-coder:1.5b');
    expect(defaultLocalLabels).toContain('custom-lab:latest');
    expect(defaultLocalLabels).not.toContain('qwen2.5-coder:7b');
    expect(visibleModelOptions({ mode: 'local', options, query: '' }).every((option) => option.source === 'local' && option.providerType === 'local' && option.installed)).toBe(true);

    const deepSeekDownloads = visibleModelOptions({
      mode: 'local',
      options,
      query: 'DeepSeek Coder',
      installationProgress: {
        'deepseek-coder': {
          modelId: 'deepseek-coder',
          state: 'running',
          progressPercent: 42,
          downloaded: '2.1 GB',
          total: '5.0 GB',
          speed: '8 MB/s',
          message: 'Baixando modelo local',
          at: now,
        },
      },
    });
    expect(deepSeekDownloads).toHaveLength(1);
    expect(deepSeekDownloads[0]).toMatchObject({
      label: 'deepseek-coder',
      modelId: 'deepseek-coder',
      installed: false,
      statusLabel: 'Baixando',
    });
    expect(visibleModelOptions({ mode: 'local', options, query: 'GPT-5.5' })).toHaveLength(0);

    const installedQwen = visibleModelOptions({ mode: 'local', options, query: '' }).find((option) => option.modelId === 'qwen2.5-coder:1.5b');
    expect(installedQwen?.digest).toBe('sha256:qwen');
    expect(installedQwen?.modifiedAt).toBe(now);
  });

  it('normaliza IDs Ollama e cria pull candidate para gpt oss sem marcar instalado', () => {
    const options = buildLocalModelOptions({
      localRuntime: localRuntime([{ id: 'llama3.2:latest', size: '2 GB' }]),
    });

    expect(visibleModelOptions({ mode: 'local', options, query: '' }).map((option) => option.modelId)).toContain('llama3.2:latest');
    expect(normalizeOllamaQuery('gpt oss')).toBe('gpt-oss');
    expect(normalizeOllamaQuery('gpt_oss')).toBe('gpt-oss');
    expect(normalizeOllamaQuery('gptoss')).toBe('gpt-oss');

    const gptOss = visibleModelOptions({ mode: 'local', options, query: 'gpt oss' });
    expect(gptOss).toHaveLength(1);
    expect(gptOss[0]).toMatchObject({
      label: 'gpt-oss',
      modelId: 'gpt-oss',
      providerLabel: 'Ollama',
      statusLabel: 'Disponível para baixar',
      installed: false,
      ready: false,
    });
    expect(visibleModelOptions({ mode: 'local', options, query: 'gpt_oss' })[0]?.modelId).toBe('gpt-oss');
    expect(visibleModelOptions({ mode: 'local', options, query: 'gptoss' })[0]?.modelId).toBe('gpt-oss');
    expect(visibleModelOptions({ mode: 'local', options, query: 'gpt oss' })[0]?.statusLabel).not.toContain('pull');
    expect(visibleModelOptions({ mode: 'local', options, query: 'qwen2.5 coder' })[0]).toMatchObject({
      label: 'qwen2.5-coder',
      modelId: 'qwen2.5-coder',
      installed: false,
    });
    expect(visibleModelOptions({ mode: 'local', options, query: 'qwen2.5-coder:7b' })[0]).toMatchObject({
      label: 'qwen2.5-coder:7b',
      modelId: 'qwen2.5-coder:7b',
    });
    expect(buildPullCandidateFromQuery('llama3.2', localRuntime([{ id: 'llama3.2:latest' }]))).toBeUndefined();
  });

  it('preserva tag Ollama na busca e não trata outra tag instalada como instalada', () => {
    const options = buildLocalModelOptions({
      localRuntime: localRuntime([{ id: 'qwen2.5-coder:1.5b', size: '986 MB' }]),
    });

    const taggedCandidate = visibleModelOptions({
      mode: 'local',
      options,
      query: 'qwen2.5-coder:7b',
      localRuntime: localRuntime([{ id: 'qwen2.5-coder:1.5b', size: '986 MB' }]),
    });

    expect(taggedCandidate).toHaveLength(1);
    expect(taggedCandidate[0]).toMatchObject({
      label: 'qwen2.5-coder:7b',
      modelId: 'qwen2.5-coder:7b',
      installed: false,
      statusLabel: 'Disponível para baixar',
    });
  });

  it('filtra defensivamente opções misturadas pela origem explícita', () => {
    const cloud = buildCloudModelOptions({
      providers: [provider('openai-api', 'OpenAI API', 'ready', [
        { id: 'gpt-5.5', label: 'GPT-5.5', providerId: 'openai-api', supportsTools: false },
      ])],
      providerProfiles: [],
    });
    const local = buildLocalModelOptions({
      localRuntime: localRuntime([{ id: 'qwen2.5-coder:1.5b', size: '986 MB' }]),
    });
    const mixed = [...cloud, ...local];

    expect(visibleModelOptions({ mode: 'cloud', options: mixed, query: 'qwen' }).some((option) => option.providerType === 'local')).toBe(false);
    expect(visibleModelOptions({ mode: 'cloud', options: mixed, query: 'qwen2.5-coder' })).toHaveLength(0);
    expect(visibleModelOptions({ mode: 'local', options: mixed, query: 'gpt' })).toHaveLength(0);
    expect(visibleModelOptions({ mode: 'cloud', options: mixed, query: 'gpt' }).every((option) => option.source === 'cloud')).toBe(true);
    expect(visibleModelOptions({ mode: 'local', options: mixed, query: 'qwen' }).every((option) => option.source === 'local')).toBe(true);
  });
});
