import { describe, expect, it } from 'vitest';
import {
  buildCloudModelOptions,
  buildLocalModelOptions,
  visibleModelOptions,
} from '../src/lib/modelCatalogService';
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

    const defaultCloud = visibleModelOptions('cloud', options, '');
    expect(defaultCloud.map((option) => option.label)).toContain('GPT-5.5');
    expect(defaultCloud.map((option) => option.label)).not.toContain('GPT-5.4 Mini via OpenRouter');
    expect(defaultCloud.every((option) => option.source === 'cloud' && option.providerType === 'cloud' && option.ready)).toBe(true);

    const openRouterSearch = visibleModelOptions('cloud', options, 'openrouter');
    expect(openRouterSearch.map((option) => option.label)).toContain('GPT-5.4 Mini via OpenRouter');
    expect(openRouterSearch.map((option) => option.label)).toContain('Kimi K2 via OpenRouter');
    expect(openRouterSearch.find((option) => option.providerId === 'openrouter-api')?.statusLabel).toBe('Configurar API');
    expect(visibleModelOptions('cloud', options, 'qwen2.5')).toHaveLength(0);
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
    expect(visibleModelOptions('cloud', untested, '').map((option) => option.label)).not.toContain('GPT-5.5');

    const ready = buildCloudModelOptions({
      providers,
      providerProfiles: [profile('ready')],
    });
    expect(visibleModelOptions('cloud', ready, '').map((option) => option.label)).toContain('GPT-5.5');
  });

  it('Local vazio mostra só instalados reais e busca mostra downloads do catálogo', () => {
    const options = buildLocalModelOptions({
      localRuntime: localRuntime([
        { id: 'qwen2.5-coder:1.5b', size: '986 MB' },
        { id: 'custom-lab:latest', size: '4.2 GB' },
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

    const defaultLocalLabels = visibleModelOptions('local', options, '').map((option) => option.label);
    expect(defaultLocalLabels).toContain('Qwen2.5 Coder 1.5B');
    expect(defaultLocalLabels).toContain('custom-lab:latest');
    expect(defaultLocalLabels).not.toContain('Qwen2.5 Coder 7B');
    expect(visibleModelOptions('local', options, '').every((option) => option.source === 'local' && option.providerType === 'local' && option.installed)).toBe(true);

    const deepSeekDownloads = visibleModelOptions('local', options, 'DeepSeek');
    expect(deepSeekDownloads.some((option) => option.label === 'DeepSeek Coder 6.7B' && option.statusLabel === 'Baixando')).toBe(true);
    expect(deepSeekDownloads.some((option) => option.label.includes('DeepSeek') && option.statusLabel === 'Download')).toBe(true);
    expect(visibleModelOptions('local', options, 'GPT-5.5')).toHaveLength(0);
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

    expect(visibleModelOptions('cloud', mixed, 'qwen').some((option) => option.providerType === 'local')).toBe(false);
    expect(visibleModelOptions('cloud', mixed, 'qwen2.5-coder')).toHaveLength(0);
    expect(visibleModelOptions('local', mixed, 'gpt')).toHaveLength(0);
    expect(visibleModelOptions('cloud', mixed, 'gpt').every((option) => option.source === 'cloud')).toBe(true);
    expect(visibleModelOptions('local', mixed, 'qwen').every((option) => option.source === 'local')).toBe(true);
  });
});
