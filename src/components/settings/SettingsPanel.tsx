import { useEffect, useMemo, useState } from 'react';
import {
  compareModels,
  getAppHealthCheck,
  getLocalRuntimeState,
  installLocalModel,
  onLocalModelProgress,
  removeLocalModel,
  showLocalModel,
  testLocalModel,
} from '../../lib/api';
import { parseComparisonTargets } from '../../lib/models/modelComparisonService';
import { fuzzyMatch } from '../../lib/models/fuzzyMatch';
import {
  buildPullCandidateFromQuery,
  normalizeOllamaModelId,
  normalizeOllamaQuery,
} from '../../lib/ollama/catalogService';
import {
  readCustomPromptPresets,
  removeCustomPromptPreset,
  saveCustomPromptPreset,
  type PromptPreset,
} from '../../lib/models/promptPresetService';
import { modelRegistry, type ModelProfile } from '../../lib/models/modelRegistry';
import { resolveModelStatus } from '../../lib/providers/status';
import type {
  AgentProfile,
  AgentSession,
  AiResponseLanguage,
  AiFallbackPolicy,
  AiRoutingSettings,
  AppPersonalizationSettings,
  AppSettings,
  AppHealthCheck,
  LocalModelInstallProgress,
  LocalRuntimeSnapshot,
  ModelComparisonResponse,
  OllamaModelDetails,
  ProviderDescriptor,
  ProviderRuntimeStatus,
  ThemePreference,
} from '../../types/domain';
import { FileManagerModal } from '../file/FileManagerModal';
import { LocalEnginePage } from '../../features/local-engine/LocalEnginePage';

interface SettingsPanelProps {
  settings?: AppSettings;
  providers: ProviderDescriptor[];
  profiles: AgentProfile[];
  sessions: AgentSession[];
  localRuntime?: LocalRuntimeSnapshot;
  onChange: (next: AppSettings) => Promise<void>;
  onExportConversations: () => Promise<string>;
  onImportConversations: (path: string) => Promise<string>;
  onArchiveAllConversations: () => Promise<void>;
  onDeleteAllConversations: () => Promise<void>;
  onOpenMemoryManager?: () => void;
  initialTab?: SettingsTab;
}

export type SettingsTab = 'general' | 'interface' | 'models' | 'conversations' | 'personalization' | 'health' | 'maquina-local';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: 'Geral' },
  { id: 'interface', label: 'Interface' },
  { id: 'models', label: 'Modelos' },
  { id: 'conversations', label: 'Conversas' },
  { id: 'personalization', label: 'Personalização' },
  { id: 'health', label: 'Saúde' },
  { id: 'maquina-local', label: 'Máquina Local' },
];

const LANGUAGE_OPTIONS: Array<{ value: AiResponseLanguage; label: string }> = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

const FEATURED_MODEL_IDS = [
  'gpt-5.5',
  'openai/gpt-5.4-mini',
  'qwen2.5-coder:1.5b',
  'gemini-2.5-flash',
  'claude-sonnet-4',
  'qwen2.5-coder:7b',
];

const DEFAULT_PERSONALIZATION: AppPersonalizationSettings = {
  memoriesStored: true,
  referenceChatHistory: true,
  customizeAilu: false,
  manageCookies: false,
  webPageExtraction: false,
  imageSearch: false,
  webSearch: true,
  imageGeneration: false,
  codeInterpreter: true,
  recoverHistoricalMemories: true,
  imageEditing: false,
  memoryUpdate: true,
  localImageUpscaling: false,
};

const ADVANCED_PERSONALIZATION: Array<{
  key: keyof AppPersonalizationSettings;
  label: string;
  description: string;
}> = [
  { key: 'webPageExtraction', label: 'Extração da página web', description: 'Guarda a preferência para leitura de páginas quando o backend for conectado.' },
  { key: 'imageSearch', label: 'Pesquisa por imagens', description: 'Preferência visual para busca por imagem, sem executar rede sozinha.' },
  { key: 'webSearch', label: 'Pesquisa na web', description: 'Permite que fluxos futuros solicitem busca web com confirmação clara.' },
  { key: 'imageGeneration', label: 'Geração de imagens', description: 'Preferência para recursos de imagem quando houver provider compatível.' },
  { key: 'codeInterpreter', label: 'Interpretador de código', description: 'Mantém ferramentas locais habilitáveis quando a sessão permitir.' },
  { key: 'recoverHistoricalMemories', label: 'Recuperar memórias históricas', description: 'Usa memórias antigas como contexto quando elas forem relevantes.' },
  { key: 'imageEditing', label: 'Edição de imagens', description: 'Preferência para edição visual futura.' },
  { key: 'memoryUpdate', label: 'Atualizar memória', description: 'Permite preparar atualizações de memória com revisão explícita.' },
  { key: 'localImageUpscaling', label: 'Ampliação local da imagem', description: 'Preferência para processamento local quando houver runtime.' },
];

const ROUTING_POLICY_OPTIONS: Array<{ value: AiFallbackPolicy; label: string }> = [
  { value: 'automatic', label: 'Automático' },
  { value: 'fast_first', label: 'Rápido primeiro' },
  { value: 'cloud_first', label: 'Cloud primeiro' },
  { value: 'local_first', label: 'Local primeiro' },
  { value: 'code', label: 'Código' },
  { value: 'cost_low', label: 'Custo baixo' },
];

const UNKNOWN_MODEL_VALUE = 'Não informado';

function modelProviderLabel(model: ModelProfile): string {
  return model.providerLabel.replace(/\s+API$/i, '').replace(/^Google\s+/i, '');
}

function modelTypeLabel(model: ModelProfile): string {
  return model.mode === 'local' ? `Local · ${model.family}` : 'Nuvem';
}

function modelModality(model: ModelProfile): string {
  const labels: Record<string, string> = {
    text: 'Texto',
    code: 'Código',
    vision: 'Visão',
    image_generation: 'Imagem',
    audio_transcription: 'Transcrição',
  };
  return model.modalities.map((item) => labels[item] ?? item).join(' · ');
}

function modelStatusLabel(model: ModelProfile, providers: ProviderDescriptor[], localRuntime?: LocalRuntimeSnapshot): string {
  if (model.mode === 'cloud') {
    const provider = providers.find((item) => item.id === model.providerId);
    const status = resolveModelStatus(model, provider?.status, localRuntime);
    if (status === 'ready') return 'Configurado';
    if (status === 'requires_api_key' || status === 'invalid_api_key') return 'Adicionar API key';
    if (status === 'requires_login' || status === 'requires_cli_auth' || status === 'requires_oauth') return 'Requer login';
    if (status === 'testing') return 'Testar conexão';
    return 'Catálogo';
  }

  const status = resolveModelStatus(model, undefined, localRuntime);
  if (status === 'ready') return 'Instalado';
  if (status === 'pulling' || status === 'installing') return 'Baixando';
  if (status === 'model_missing') return 'Não instalado';
  if (status === 'not_installed') return 'Runtime ausente';
  return status.replaceAll('_', ' ');
}

function normalizeSettingsTab(tab?: SettingsTab): SettingsTab {
  return tab && SETTINGS_TABS.some((item) => item.id === tab) ? tab : 'general';
}

function cleanSettingsErrorMessage(message: string | undefined, fallback: string): string {
  const firstUsefulLine = (message ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !/^(stack trace|payload|traceback|at\s)/iu.test(line));
  if (!firstUsefulLine) return fallback;
  if (/^[{[]/u.test(firstUsefulLine) || /"stack"|"trace"|panic|backtrace/iu.test(firstUsefulLine)) {
    return fallback;
  }
  return firstUsefulLine.length > 180 ? `${firstUsefulLine.slice(0, 177)}...` : firstUsefulLine;
}

function HealthRow({ status, label, detail, command, action }: {
  status: 'ok' | 'warning' | 'error';
  label: string;
  detail: string;
  command?: string;
  action?: string;
}): JSX.Element {
  const icon = status === 'ok' ? '✓' : status === 'warning' ? '⚠' : '✗';
  return (
    <div className={`health-row health-row-${status}`}>
      <span className="health-row-icon" aria-hidden="true">{icon}</span>
      <div className="health-row-body">
        <strong className="health-row-label">{label}</strong>
        <span className="health-row-detail">{detail}</span>
        {action ? <span className="health-row-action">{action}</span> : null}
        {command ? (
          <div className="health-row-command">
            <code>{command}</code>
            <button
              type="button"
              className="health-row-copy"
              onClick={() => void navigator.clipboard.writeText(command)}
              title="Copiar comando"
            >
              Copiar
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function preference(settings: AppSettings): AppPersonalizationSettings {
  return { ...DEFAULT_PERSONALIZATION, ...settings.personalization };
}

function buildHealthReport(health: AppHealthCheck): string {
  const yn = (ok: boolean) => (ok ? 'ok' : 'faltando');
  const lines = [
    'Relatório de diagnóstico — Ailu Studio',
    `Status geral: ${health.overallStatus}`,
    `IA local (Ollama): ${health.ollama.apiReachable ? 'acessível' : 'inacessível'} · ${health.ollama.installedModels.length} modelo(s)`,
    `Node: ${yn(health.nodeOk)} · npm: ${yn(health.npmOk)} · cargo: ${yn(health.cargoOk)} · Tauri: ${yn(health.tauriOk)}`,
    `Diretório base: ${health.baseDir}${health.correctBaseDir ? '' : ` (esperado ${health.expectedBaseDir})`}`,
    health.storageRoot ? `Armazenamento: ${health.storageRoot}` : undefined,
    health.branch ? `Branch: ${health.branch}` : undefined,
    `Providers: ${health.providers.map((p) => `${p.id}=${p.status.state}`).join(', ') || 'nenhum'}`,
  ].filter(Boolean);
  if (health.recentErrors.length > 0) {
    lines.push('Problemas recentes:');
    for (const err of health.recentErrors.slice(0, 8)) lines.push(`- [${err.severity}] ${err.code}: ${err.message}`);
  }
  return lines.join('\n');
}

function AdvancedHealthDiagnostics({ health }: { health: AppHealthCheck }): JSX.Element {
  const [copied, setCopied] = useState(false);
  async function copyReport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildHealthReport(health));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard optional
    }
  }
  return (
    <details className="settings-details health-advanced">
      <summary>Diagnóstico avançado</summary>
      <div className="health-group" style={{ marginTop: '0.5rem' }}>
        <HealthRow status={health.nodeOk ? 'ok' : 'error'} label="Node.js" detail={health.nodeOk ? 'Disponível' : 'node não encontrado. Instale via nvm ou pacote do sistema.'} command={health.nodeOk ? undefined : 'nvm install --lts'} />
        <HealthRow status={health.npmOk ? 'ok' : 'error'} label="npm" detail={health.npmOk ? 'Disponível' : 'npm não encontrado. Geralmente vem junto com Node.js.'} />
        <HealthRow status={health.cargoOk ? 'ok' : 'error'} label="Rust / cargo" detail={health.cargoOk ? 'Disponível' : 'cargo não encontrado. Instale via rustup.rs.'} command={health.cargoOk ? undefined : 'curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh'} />
        <HealthRow status={health.tauriOk ? 'ok' : 'warning'} label="Tauri CLI" detail={health.tauriOk ? 'Disponível' : 'tauri-cli não encontrado (necessário só para desenvolvimento).'} />
        <HealthRow status={health.correctBaseDir ? 'ok' : 'warning'} label="Diretório base" detail={health.baseDir} />
        {health.storageRoot ? <HealthRow status="ok" label="Armazenamento" detail={health.storageRoot} /> : null}
        {health.branch ? <HealthRow status="ok" label="Branch" detail={health.branch} /> : null}
      </div>
      <div className="dialog-actions" style={{ marginTop: '0.5rem' }}>
        <button type="button" className="settings-pill-button" onClick={() => void copyReport()}>
          {copied ? 'Copiado' : 'Copiar relatório'}
        </button>
      </div>
    </details>
  );
}

function fallbackText(settings: AppSettings): string {
  return (settings.aiRouting?.fallbackModels ?? [])
    .map((item) => `${item.enabled === false ? '# ' : ''}${item.providerId}/${item.modelId}${item.accountProfileId ? ` @ ${item.accountProfileId}` : ''}`)
    .join('\n');
}

function parseFallbackText(value: string): AiRoutingSettings {
  return {
    fallbackEnabled: true,
    fallbackPolicy: 'automatic',
    fallbackModels: value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const enabled = !line.startsWith('#');
        const clean = line.replace(/^#\s*/u, '');
        const [identity, profile] = clean.split('@').map((part) => part.trim());
        const slashIndex = identity.indexOf('/');
        const providerId = slashIndex > 0 ? identity.slice(0, slashIndex) : identity;
        const modelId = slashIndex > 0 ? identity.slice(slashIndex + 1) : '';
        return {
          providerId,
          modelId,
          accountProfileId: profile || undefined,
          enabled,
          timeoutMs: 45_000,
          label: undefined,
        };
      })
      .filter((item) => item.providerId && item.modelId),
  };
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label className="settings-line settings-toggle-row">
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function ActionRow({
  label,
  description,
  action,
  danger,
  disabled,
  onClick,
}: {
  label: string;
  description: string;
  action: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <div className="settings-line settings-action-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <button type="button" className={`settings-pill-button ${danger ? 'danger' : ''}`} disabled={disabled} onClick={onClick}>
        {action}
      </button>
    </div>
  );
}

export function SettingsPanel({
  settings,
  providers,
  profiles,
  sessions,
  localRuntime,
  onChange,
  onExportConversations,
  onImportConversations,
  onArchiveAllConversations,
  onDeleteAllConversations,
  onOpenMemoryManager,
  initialTab,
}: SettingsPanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>(normalizeSettingsTab(initialTab));
  const [expandedModelId, setExpandedModelId] = useState<string>(FEATURED_MODEL_IDS[0]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [conversationConfirm, setConversationConfirm] = useState<'archive' | 'delete'>();
  const [conversationBusy, setConversationBusy] = useState(false);
  const [importPickerOpen, setImportPickerOpen] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<string>();
  const [inlineError, setInlineError] = useState<string>();
  const [fallbackDraft, setFallbackDraft] = useState(() => settings ? fallbackText(settings) : '');
  const [managerRuntimeOverride, setManagerRuntimeOverride] = useState<LocalRuntimeSnapshot>();
  const [managerQuery, setManagerQuery] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [managerBusyId, setManagerBusyId] = useState<string>();
  const [managerProgress, setManagerProgress] = useState<Record<string, LocalModelInstallProgress>>({});
  const [managerMessage, setManagerMessage] = useState<string>();
  const [managerError, setManagerError] = useState<string>();
  const [managerRemoveConfirm, setManagerRemoveConfirm] = useState<string>();
  const [managerDetails, setManagerDetails] = useState<OllamaModelDetails>();
  const [managerTestStatus, setManagerTestStatus] = useState<Record<string, ProviderRuntimeStatus>>({});
  const [customPresets, setCustomPresets] = useState<PromptPreset[]>(readCustomPromptPresets);
  const [customPresetId, setCustomPresetId] = useState<string>();
  const [customPresetLabel, setCustomPresetLabel] = useState('');
  const [customPresetPrompt, setCustomPresetPrompt] = useState('');
  const [modelsSubTab, setModelsSubTab] = useState<'local' | 'cloud'>('local');
  const [comparisonTargets, setComparisonTargets] = useState('local-ollama/qwen2.5-coder:1.5b\nopenai-api/gpt-5.4-mini');
  const [comparisonPrompt, setComparisonPrompt] = useState('');
  const [comparisonBusy, setComparisonBusy] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ModelComparisonResponse>();
  const [health, setHealth] = useState<AppHealthCheck>();
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string>();

  const modelItems = useMemo(() => {
    const featured = new Set(FEATURED_MODEL_IDS);
    return [...modelRegistry.all()].sort((left, right) => {
      const leftFeatured = featured.has(left.id) ? 0 : 1;
      const rightFeatured = featured.has(right.id) ? 0 : 1;
      return leftFeatured - rightFeatured || left.providerLabel.localeCompare(right.providerLabel) || left.displayName.localeCompare(right.displayName);
    });
  }, []);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void onLocalModelProgress((progress) => {
      if (!active) return;
      setManagerProgress((current) => ({
        ...current,
        [progress.modelId]: progress,
      }));
    }).then((dispose) => {
      unlisten = dispose;
    }).catch(() => undefined);
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  if (!settings) {
    return (
      <section className="panel settings-panel settings-premium settings-qwen">
        <header className="panel-header settings-panel-header">
          <h2>Configurações</h2>
        </header>
        <div className="panel-body empty-state empty-state-inline">
          <strong>Carregando</strong>
          <span>Configurações ainda indisponíveis.</span>
        </div>
      </section>
    );
  }

  const personalization = preference(settings);
  const routing = {
    fallbackEnabled: settings.aiRouting?.fallbackEnabled ?? false,
    fallbackPolicy: settings.aiRouting?.fallbackPolicy ?? 'automatic',
    fallbackModels: settings.aiRouting?.fallbackModels ?? [],
  };
  const selectedAgentLabel = profiles.find((profile) => profile.id === settings.selectedAgentId)?.label ?? 'Padrão';
  const installedLocalModels = new Set(localRuntime?.installedModels.map((model) => model.id) ?? []);
  const managerRuntime = managerRuntimeOverride ?? localRuntime;
  const managerInstalled = managerRuntime?.installedModels ?? [];
  const managerNormalizedQuery = normalizeOllamaQuery(managerQuery);
  const managerInstalledMatches = managerQuery.trim()
    ? managerInstalled.filter((model) => {
      const normalizedId = normalizeOllamaModelId(model.id);
      return normalizedId.includes(normalizeOllamaModelId(managerNormalizedQuery)) || model.id.toLowerCase().includes(managerNormalizedQuery);
    })
    : managerInstalled;
  const managerPullCandidate = buildPullCandidateFromQuery(managerQuery, managerRuntime);
  const normalizedCatalogQuery = catalogQuery.trim();
  // Typo-tolerant fuzzy search over the combined model fields. Tolerates
  // partial names, family/size/quant, provider and a single typo on longer
  // words (see fuzzyMatch).
  const visibleModelItems = modelItems.filter((model) => {
    const modeMatch = modelsSubTab === 'local' ? model.mode === 'local' : model.mode === 'cloud';
    if (!modeMatch) return false;
    if (!normalizedCatalogQuery) return FEATURED_MODEL_IDS.includes(model.id);
    const haystack = [
      model.id,
      model.modelId,
      model.displayName,
      model.providerLabel,
      model.mode === 'local' ? (model.family ?? '') : '',
      model.recommendedUse ?? '',
      ...model.tags,
      ...model.bestFor,
    ].join(' ');
    return fuzzyMatch(normalizedCatalogQuery, haystack);
  });

  async function commit(patch: Partial<AppSettings>): Promise<void> {
    setInlineError(undefined);
    setInlineMessage(undefined);
    try {
      await onChange({ ...settings!, ...patch });
    } catch (cause) {
      setInlineError(cause instanceof Error ? cause.message : 'Não foi possível salvar a preferência.');
    }
  }

  function updatePersonalization(key: keyof AppPersonalizationSettings, value: boolean): void {
    void commit({
      personalization: {
        ...personalization,
        [key]: value,
      },
    });
  }

  async function runConversationAction(action: () => Promise<void>, showMessage?: string): Promise<void> {
    setInlineError(undefined);
    setInlineMessage(undefined);
    setConversationBusy(true);
    try {
      await action();
      if (showMessage) setInlineMessage(showMessage);
    } catch (cause) {
      setInlineError(cause instanceof Error ? cause.message : 'Ação de conversa falhou.');
    } finally {
      setConversationBusy(false);
    }
  }

  async function refreshManager(): Promise<void> {
    setManagerError(undefined);
    setManagerMessage(undefined);
    setManagerBusyId('refresh');
    try {
      const snapshot = await getLocalRuntimeState();
      setManagerRuntimeOverride(snapshot);
      setManagerMessage(`Ollama atualizado: ${snapshot.installedModels.length} modelo(s) instalado(s).`);
    } catch (cause) {
      setManagerError(cleanSettingsErrorMessage(cause instanceof Error ? cause.message : undefined, 'Falha ao atualizar Ollama.'));
    } finally {
      setManagerBusyId(undefined);
    }
  }

  async function pullManagerModel(modelId: string): Promise<void> {
    const target = normalizeOllamaQuery(modelId);
    if (!target) return;
    setManagerBusyId(target);
    setManagerError(undefined);
    setManagerMessage(undefined);
    try {
      const snapshot = await installLocalModel(target);
      setManagerRuntimeOverride(snapshot);
      if (!snapshot.installedModels.some((model) => normalizeOllamaModelId(model.id) === normalizeOllamaModelId(target))) {
        throw new Error(`Ollama concluiu o download, mas ${target} não apareceu em /api/tags.`);
      }
      setManagerMessage(`${target} instalado e confirmado por /api/tags.`);
    } catch (cause) {
      setManagerError(cleanSettingsErrorMessage(cause instanceof Error ? cause.message : undefined, `Falha ao baixar ${target}.`));
    } finally {
      setManagerBusyId(undefined);
    }
  }

  async function removeManagerModel(modelId: string): Promise<void> {
    setManagerBusyId(modelId);
    setManagerError(undefined);
    setManagerMessage(undefined);
    try {
      const snapshot = await removeLocalModel(modelId);
      setManagerRuntimeOverride(snapshot);
      setManagerRemoveConfirm(undefined);
      setManagerMessage(`${modelId} removido do Ollama.`);
    } catch (cause) {
      setManagerError(cleanSettingsErrorMessage(cause instanceof Error ? cause.message : undefined, `Falha ao remover ${modelId}.`));
    } finally {
      setManagerBusyId(undefined);
    }
  }

  async function testManagerModel(modelId: string): Promise<void> {
    setManagerBusyId(modelId);
    setManagerError(undefined);
    try {
      const status = await testLocalModel(modelId);
      setManagerTestStatus((current) => ({ ...current, [modelId]: status }));
      if (status.state !== 'ready') setManagerError(status.message);
    } catch (cause) {
      setManagerError(cleanSettingsErrorMessage(cause instanceof Error ? cause.message : undefined, `Falha ao testar ${modelId}.`));
    } finally {
      setManagerBusyId(undefined);
    }
  }

  async function showManagerModel(modelId: string): Promise<void> {
    setManagerBusyId(modelId);
    setManagerError(undefined);
    try {
      setManagerDetails(await showLocalModel(modelId));
    } catch (cause) {
      setManagerError(cleanSettingsErrorMessage(cause instanceof Error ? cause.message : undefined, `Falha ao carregar detalhes de ${modelId}.`));
    } finally {
      setManagerBusyId(undefined);
    }
  }

  function savePromptPresetDraft(): void {
    const next = saveCustomPromptPreset({
      id: customPresetId,
      label: customPresetLabel,
      systemPrompt: customPresetPrompt,
    });
    setCustomPresets(next);
    setCustomPresetId(undefined);
    setCustomPresetLabel('');
    setCustomPresetPrompt('');
    setInlineMessage('Preset customizado salvo.');
  }

  function editPromptPreset(preset: PromptPreset): void {
    setCustomPresetId(preset.id);
    setCustomPresetLabel(preset.label);
    setCustomPresetPrompt(preset.systemPrompt);
  }

  function deletePromptPreset(id: string): void {
    setCustomPresets(removeCustomPromptPreset(id));
    if (customPresetId === id) {
      setCustomPresetId(undefined);
      setCustomPresetLabel('');
      setCustomPresetPrompt('');
    }
    setInlineMessage('Preset customizado removido.');
  }

  async function runModelComparison(): Promise<void> {
    const targets = parseComparisonTargets(comparisonTargets);
    if (targets.length < 2 || !comparisonPrompt.trim()) return;
    setComparisonBusy(true);
    setManagerError(undefined);
    try {
      setComparisonResult(await compareModels({ prompt: comparisonPrompt, targets }));
    } catch (cause) {
      setManagerError(cleanSettingsErrorMessage(cause instanceof Error ? cause.message : undefined, 'Comparação entre modelos falhou.'));
    } finally {
      setComparisonBusy(false);
    }
  }

  async function refreshHealth(): Promise<void> {
    setHealthLoading(true);
    setHealthError(undefined);
    try {
      setHealth(await getAppHealthCheck());
    } catch (cause) {
      setHealthError(cleanSettingsErrorMessage(cause instanceof Error ? cause.message : undefined, 'Falha ao carregar saúde do sistema.'));
    } finally {
      setHealthLoading(false);
    }
  }

  return (
    <section className="panel settings-panel settings-premium settings-qwen">
      <header className="panel-header settings-panel-header">
        <div>
          <h2>Configurações</h2>
          <p>Preferências essenciais, sem diagnóstico técnico na frente.</p>
        </div>
      </header>

      <div className="settings-shell settings-qwen-shell">
        <nav className="settings-nav settings-qwen-nav" aria-label="Configurações">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'health' && !health && !healthLoading) void refreshHealth();
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="settings-content settings-qwen-content">
          {inlineError ? <div className="input-error-tip" role="alert">{inlineError}</div> : null}
          {inlineMessage ? <div className="settings-inline-note" role="status">{inlineMessage}</div> : null}

          {activeTab === 'general' ? (
            <div className="settings-page">
              <header className="settings-page-heading">
                <span>Geral</span>
                <h3>Preferências básicas</h3>
              </header>

              <section className="settings-block">
                <div className="settings-line">
                  <span>
                    <strong>Tema</strong>
                    <small>Sistema acompanha a preferência do PC.</small>
                  </span>
                  <div className="settings-segmented" role="radiogroup" aria-label="Tema">
                    {[
                      ['system', 'Sistema'],
                      ['light', 'Claro'],
                      ['dark', 'Escuro'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={(settings.themePreference ?? 'dark') === value}
                        className={(settings.themePreference ?? 'dark') === value ? 'active' : ''}
                        onClick={() => void commit({ themePreference: value as ThemePreference })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="settings-line settings-select-row">
                  <span>
                    <strong>Idioma das respostas da IA</strong>
                    <small>Preferência enviada como contexto para o modelo, sem traduzir a UI.</small>
                  </span>
                  <select
                    aria-label="Idioma das respostas da IA"
                    value={settings.aiResponseLanguage ?? 'pt-BR'}
                    onChange={(event) => void commit({ aiResponseLanguage: event.target.value as AiResponseLanguage })}
                  >
                    {LANGUAGE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
              </section>
            </div>
          ) : null}

          {activeTab === 'interface' ? (
            <div className="settings-page">
              <header className="settings-page-heading">
                <span>Interface</span>
                <h3>Comportamento visual</h3>
              </header>

              <section className="settings-block">
                <SwitchRow
                  label="Geração automática de título"
                  description="Cria um título curto depois da primeira mensagem útil."
                  checked={settings.autoGenerateTitles ?? true}
                  onChange={(value) => void commit({ autoGenerateTitles: value })}
                />
                <SwitchRow
                  label="Cópia automática da resposta"
                  description="Evita sobrescrever seu clipboard quando desligado."
                  checked={settings.autoCopyResponses ?? false}
                  onChange={(value) => void commit({ autoCopyResponses: value })}
                />
                <SwitchRow
                  label="Colar texto grande como arquivo"
                  description="Prefere anexo bruto/metadados quando o conteúdo for grande."
                  checked={settings.pasteLargeTextAsFile ?? true}
                  onChange={(value) => void commit({ pasteLargeTextAsFile: value })}
                />
                <SwitchRow
                  label="Modo Desenvolvedor"
                  description="Mostra roteamento avançado e fallback. Desligado não gasta API extra."
                  checked={settings.developerMode ?? false}
                  onChange={(value) => void commit({ developerMode: value })}
                />
              </section>
              {settings.developerMode ? (
                <section className="settings-block settings-routing-block">
                  <div className="settings-section-label">Roteamento avançado</div>
                  <SwitchRow
                    label="Fallback entre IAs"
                    description="Tenta o próximo modelo apenas quando o principal falhar por rede, cota, API, provider offline ou timeout."
                    checked={routing.fallbackEnabled}
                    onChange={(value) => void commit({ aiRouting: { ...routing, fallbackEnabled: value } })}
                  />
                  <label className="settings-line settings-select-row">
                    <span>
                      <strong>Política</strong>
                      <small>Define a ordem dos modelos de fallback habilitados.</small>
                    </span>
                    <select
                      aria-label="Política de fallback"
                      value={routing.fallbackPolicy}
                      onChange={(event) => void commit({ aiRouting: { ...routing, fallbackPolicy: event.target.value as AiFallbackPolicy } })}
                    >
                      {ROUTING_POLICY_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-line settings-routing-list">
                    <span>
                      <strong>Modelos habilitados</strong>
                      <small>Um por linha: provider/modelo. Prefixe com # para manter salvo e desativado.</small>
                    </span>
                    <textarea
                      className="input-modern"
                      rows={4}
                      value={fallbackDraft}
                      placeholder={'openai-api/gpt-5.4-mini @ openai-api:principal\nlocal-ollama/qwen2.5-coder:7b'}
                      onChange={(event) => setFallbackDraft(event.target.value)}
                      onBlur={() => {
                        const parsed = parseFallbackText(fallbackDraft);
                        void commit({
                          aiRouting: {
                            ...routing,
                            fallbackModels: parsed.fallbackModels,
                          },
                        });
                      }}
                    />
                  </label>
                </section>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'models' ? (
            <div className="settings-page">
              <header className="settings-page-heading">
                <span>Modelos</span>
                <h3>{modelsSubTab === 'local' ? 'Modelos Locais — Ollama e llama.cpp' : 'Modelos Nuvem — Providers e API'}</h3>
              </header>

              <div className="models-sub-tabs" role="tablist" aria-label="Tipo de modelos">
                <button
                  type="button"
                  role="tab"
                  aria-selected={modelsSubTab === 'local'}
                  className={`models-sub-tab${modelsSubTab === 'local' ? ' active' : ''}`}
                  onClick={() => { setModelsSubTab('local'); setCatalogQuery(''); }}
                >
                  Locais
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={modelsSubTab === 'cloud'}
                  className={`models-sub-tab${modelsSubTab === 'cloud' ? ' active' : ''}`}
                  onClick={() => { setModelsSubTab('cloud'); setCatalogQuery(''); }}
                >
                  Nuvem
                </button>
              </div>

              {modelsSubTab === 'local' ? (
              <section className="ollama-manager" aria-label="Model Manager Ollama">
                <div className="ollama-manager-header">
                  <div>
                    <strong>Model Manager local</strong>
                    <small>{managerRuntime?.message ?? 'Ollama ainda não foi consultado.'}</small>
                  </div>
                  <button type="button" className="settings-pill-button" disabled={managerBusyId === 'refresh'} onClick={() => void refreshManager()}>
                    Atualizar
                  </button>
                </div>

                <label className="ollama-manager-search">
                  Buscar ou baixar modelo Ollama
                  <div>
                    <input
                      className="input-modern"
                      value={managerQuery}
                      placeholder="gpt-oss, llama3.2, qwen2.5-coder:7b"
                      onChange={(event) => setManagerQuery(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-modern btn-modern-primary"
                      disabled={!managerPullCandidate || managerBusyId === managerPullCandidate?.modelId}
                      onClick={() => managerPullCandidate ? void pullManagerModel(managerPullCandidate.modelId) : undefined}
                    >
                      {managerPullCandidate ? `Baixar ${managerPullCandidate.modelId}` : 'Baixar modelo'}
                    </button>
                  </div>
                </label>

                {managerError ? <div className="input-error-tip" role="alert">{managerError}</div> : null}
                {managerMessage ? <div className="settings-inline-note" role="status">{managerMessage}</div> : null}

                <div className="ollama-model-grid">
                  {managerInstalledMatches.map((model) => {
                    const progress = managerProgress[model.id] ?? managerProgress[normalizeOllamaQuery(model.id)];
                    const testStatus = managerTestStatus[model.id];
                    return (
                      <article key={model.id} className="ollama-model-card">
                        <header>
                          <strong>{model.id}</strong>
                          <small>{[model.size, model.modifiedAt].filter(Boolean).join(' · ') || 'Instalado pelo Ollama'}</small>
                        </header>
                        <div className="ollama-model-meta">
                          {testStatus ? <span><b>Teste</b>{testStatus.state === 'ready' ? 'respondeu' : testStatus.message}</span> : null}
                        </div>
                        {progress ? (
                          <div className="model-config-progress" role="status">
                            <span>{progress.message}{typeof progress.progressPercent === 'number' ? ` · ${progress.progressPercent}%` : ''}</span>
                            {typeof progress.progressPercent === 'number' ? (
                              <div className="model-config-progress-track" aria-hidden="true">
                                <span style={{ width: `${Math.max(0, Math.min(100, progress.progressPercent))}%` }} />
                              </div>
                            ) : null}
                            {[progress.downloaded && progress.total ? `${progress.downloaded} / ${progress.total}` : undefined, progress.speed, progress.digest, progress.layer].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                        {managerRemoveConfirm === model.id ? (
                          <div className="settings-confirm-inline" role="alert">
                            <span>Remover {model.id} do Ollama?</span>
                            <button type="button" className="settings-pill-button" onClick={() => setManagerRemoveConfirm(undefined)}>Cancelar</button>
                            <button type="button" className="settings-pill-button danger" onClick={() => void removeManagerModel(model.id)}>Confirmar</button>
                          </div>
                        ) : (
                          <div className="dialog-actions">
                            <button type="button" className="btn-modern" disabled={managerBusyId === model.id} onClick={() => void testManagerModel(model.id)}>Testar</button>
                            <button type="button" className="btn-modern" disabled={managerBusyId === model.id} onClick={() => void showManagerModel(model.id)}>Detalhes</button>
                            <button type="button" className="btn-modern danger" disabled={managerBusyId === model.id} onClick={() => setManagerRemoveConfirm(model.id)}>Remover</button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {managerInstalledMatches.length === 0 ? (
                    <div className="model-picker-empty" role="status">
                      <strong>Nenhum instalado encontrado</strong>
                      <span>{managerPullCandidate ? `Use Baixar ${managerPullCandidate.modelId} para testar o download real pelo Ollama.` : 'Aba Local sem busca mostra apenas modelos instalados do Ollama.'}</span>
                    </div>
                  ) : null}
                </div>

                {managerDetails ? (
                  <details className="ollama-details" open>
                    <summary>Detalhes de {managerDetails.id}</summary>
                    <div className="settings-model-facts">
                      <span><strong>Família</strong>{managerDetails.family ?? 'Não informado'}</span>
                      <span><strong>Parâmetros</strong>{managerDetails.parameterSize ?? 'Não informado'}</span>
                      <span><strong>Quantização</strong>{managerDetails.quantization ?? 'Não informado'}</span>
                      <span><strong>Formato</strong>{managerDetails.format ?? 'Não informado'}</span>
                      <span><strong>Tamanho</strong>{managerDetails.size ?? 'Não informado'}</span>
                      <span><strong>Digest</strong>{managerDetails.digest ?? 'Não informado'}</span>
                    </div>
                    <pre>{managerDetails.raw}</pre>
                  </details>
                ) : null}
              </section>
              ) : null}

              {modelsSubTab === 'cloud' ? (
              <section className="settings-block" aria-label="Modelos de nuvem">
                <div className="ollama-manager-header">
                  <div>
                    <strong>Providers configurados</strong>
                    <small>Configure chaves de API em Contas e depois selecione o modelo desejado.</small>
                  </div>
                  <button type="button" className="settings-pill-button" onClick={() => {
                    // Scroll to providers section or show info
                  }}>
                    Gerenciar contas
                  </button>
                </div>
                {providers.map((provider) => (
                  <div key={provider.id} className="health-row health-row-provider">
                    <span className={`health-row-icon`} aria-hidden="true">
                      {provider.status.state === 'ready' ? '✓' : provider.status.state === 'error' ? '✗' : '⊙'}
                    </span>
                    <div className="health-row-body">
                      <strong className="health-row-label">{provider.label}</strong>
                      <span className="health-row-detail">
                        {provider.status.state === 'ready' ? `Pronto · ${provider.models.length} modelo(s)` : provider.status.message ?? 'Não testado'}
                      </span>
                    </div>
                  </div>
                ))}
              </section>
              ) : null}

              <section className="settings-model-list" aria-label={`Catálogo de modelos ${modelsSubTab === 'local' ? 'locais' : 'nuvem'}`}>
                <div className="settings-model-catalog-toolbar">
                  <span>
                    <strong>Catálogo {modelsSubTab === 'local' ? 'local' : 'nuvem'}</strong>
                    <small>{catalogQuery.trim() ? `${visibleModelItems.length} resultado(s)` : 'Modelos em destaque. Busque por nome, família, tamanho ou provider.'}</small>
                  </span>
                  <input
                    className="input-modern"
                    value={catalogQuery}
                    placeholder={modelsSubTab === 'local' ? 'qwen coder 7, llama 3, mistral…' : 'gpt, claude, gemini, deepseek…'}
                    aria-label="Buscar no catálogo de modelos"
                    onChange={(event) => setCatalogQuery(event.target.value)}
                  />
                </div>
                {visibleModelItems.map((model) => {
                  const expanded = expandedModelId === model.id;
                  const installed = model.mode === 'local' && (installedLocalModels.has(model.id) || installedLocalModels.has(model.modelId));
                  const status = modelStatusLabel(model, providers, localRuntime);
                  const isHeavy = model.mode === 'local' && model.caveats.some((c) => c.includes('pesado'));
                  return (
                    <article key={model.id} className={`settings-model-accordion ${expanded ? 'open' : ''}`}>
                      <button
                        type="button"
                        className="settings-model-trigger"
                        aria-expanded={expanded}
                        onClick={() => setExpandedModelId(expanded ? '' : model.id)}
                      >
                        <span className="settings-model-chevron" aria-hidden="true">{expanded ? '⌄' : '›'}</span>
                        <strong>{model.displayName}</strong>
                        {isHeavy ? <span className="model-heavy-badge" title="Pode não caber na sua RAM">⚠ pesado</span> : null}
                        <small>{modelStatusLabel(model, providers, localRuntime)}</small>
                      </button>
                      {expanded ? (
                        <div className="settings-model-details">
                          {isHeavy ? (
                            <div className="model-heavy-warning">
                              Modelo pesado: requer memória significativa. Pode usar swap ou travar em hardware com menos de 16 GB.
                              Use apenas se souber o que está fazendo.
                            </div>
                          ) : null}
                          <p>{model.recommendedUse ? `${model.displayName} é indicado para ${model.recommendedUse.toLowerCase()}.` : `${model.displayName} está no catálogo local do app.`}</p>
                          <div className="settings-model-facts">
                            <span><strong>Comprimento máximo do contexto</strong>{model.estimatedLimits.summary}</span>
                            <span><strong>Comprimento máximo de geração</strong>{UNKNOWN_MODEL_VALUE}</span>
                            <span><strong>Modalidade</strong>{modelModality(model)}</span>
                            <span><strong>Fornecedor</strong>{modelProviderLabel(model)}</span>
                            <span><strong>Tipo</strong>{modelTypeLabel(model)}</span>
                            {model.mode === 'local' ? <span><strong>Status local</strong>{installed ? 'Instalado' : status}</span> : null}
                            {model.mode === 'cloud' ? <span><strong>Status</strong>{status}</span> : null}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {visibleModelItems.length === 0 ? (
                  <div className="model-picker-empty" role="status">
                    <strong>Nenhum modelo encontrado</strong>
                    <span>Tente termos diferentes. Ex.: "qwen coder 7" para modelos de código da família qwen 7B.</span>
                  </div>
                ) : null}
              </section>

              {modelsSubTab === 'cloud' ? (
              <section className="model-comparison-panel" aria-label="Comparação de modelos">
                <header className="ollama-manager-header">
                  <div>
                    <strong>Comparação de modelos</strong>
                    <small>Desligada por padrão. Só envia o prompt quando você inicia.</small>
                  </div>
                </header>
                <label className="settings-line settings-routing-list">
                  <span>
                    <strong>Modelos</strong>
                    <small>Um por linha: provider/modelo. Use @ profile opcional.</small>
                  </span>
                  <textarea className="input-modern" rows={3} value={comparisonTargets} onChange={(event) => setComparisonTargets(event.target.value)} />
                </label>
                <label className="settings-line settings-routing-list">
                  <span>
                    <strong>Prompt</strong>
                    <small>Será enviado a cada modelo escolhido.</small>
                  </span>
                  <textarea className="input-modern" rows={3} value={comparisonPrompt} onChange={(event) => setComparisonPrompt(event.target.value)} placeholder="Pergunta para comparar respostas..." />
                </label>
                <button type="button" className="btn-modern btn-modern-primary" disabled={comparisonBusy || parseComparisonTargets(comparisonTargets).length < 2 || !comparisonPrompt.trim()} onClick={() => void runModelComparison()}>
                  {comparisonBusy ? 'Comparando...' : 'Comparar'}
                </button>
                {comparisonResult ? (
                  <div className="comparison-result-grid">
                    {comparisonResult.results.map((result) => (
                      <article key={`${result.providerId}/${result.modelId}`} className={`comparison-card ${result.ok ? 'ok' : 'error'}`}>
                        <strong>{result.label ?? `${result.providerId}/${result.modelId}`}</strong>
                        <small>{result.ok ? 'respondeu' : 'falhou'}</small>
                        <p>{result.ok ? result.content : result.error}</p>
                        <button type="button" className="settings-pill-button" onClick={() => void navigator.clipboard?.writeText(result.ok ? result.content ?? '' : result.error ?? '')}>
                          Copiar
                        </button>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'conversations' ? (
            <div className="settings-page">
              <header className="settings-page-heading">
                <span>Conversas</span>
                <h3>Gerenciamento</h3>
              </header>

              <section className="settings-block">
                <ActionRow
                  label="Importar Conversas"
                  description="Escolha um JSON exportado por este app. IDs duplicados serão recriados com segurança."
                  action="Importar"
                  disabled={conversationBusy}
                  onClick={() => setImportPickerOpen(true)}
                />
                <ActionRow
                  label="Exportar Conversas"
                  description={`${sessions.length} conversa(s) visível(eis); conversas arquivadas também entram no backup global.`}
                  action="Exportar"
                  disabled={conversationBusy}
                  onClick={() => {
                    void runConversationAction(async () => {
                      const path = await onExportConversations();
                      setInlineMessage(`Exportado em ${path}`);
                    });
                  }}
                />
                <ActionRow
                  label="Arquivar todos os chats"
                  description="Move as conversas salvas para a área arquivada e remove da lista principal."
                  action="Arquivar"
                  disabled={conversationBusy || sessions.length === 0}
                  onClick={() => setConversationConfirm('archive')}
                />
                <ActionRow
                  label="Excluir todas as conversas"
                  description="Remove as conversas persistidas. Bate-papo temporário não é persistido nem tocado."
                  action="Excluir"
                  danger
                  disabled={conversationBusy}
                  onClick={() => setConversationConfirm('delete')}
                />
                {conversationConfirm ? (
                  <div className="settings-confirm-inline" role="alert">
                    <span>
                      {conversationConfirm === 'delete'
                        ? 'Confirmar exclusão de todas as conversas persistidas?'
                        : 'Confirmar arquivamento de todos os chats?'}
                    </span>
                    <button type="button" className="settings-pill-button" onClick={() => setConversationConfirm(undefined)}>Cancelar</button>
                    <button
                      type="button"
                      className={`settings-pill-button ${conversationConfirm === 'delete' ? 'danger' : ''}`}
                      onClick={() => {
                        const action = conversationConfirm;
                        setConversationConfirm(undefined);
                        void runConversationAction(
                          action === 'delete' ? onDeleteAllConversations : onArchiveAllConversations,
                        );
                      }}
                    >
                      Confirmar
                    </button>
                  </div>
                ) : null}
              </section>
              {importPickerOpen ? (
                <FileManagerModal
                  open={importPickerOpen}
                  initialPathMode={false}
                  onClose={() => setImportPickerOpen(false)}
                  onSelect={(attachment) => {
                    setImportPickerOpen(false);
                    void runConversationAction(async () => {
                      const message = await onImportConversations(attachment.path);
                      setInlineMessage(message);
                    });
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {activeTab === 'personalization' ? (
            <div className="settings-page">
              <header className="settings-page-heading">
                <span>Personalização</span>
                <h3>Contexto e capacidades</h3>
              </header>

              <section className="settings-block">
                <div className="settings-section-label">Memória</div>
                <SwitchRow label="Memórias guardadas" description="Usar memórias persistidas quando forem relevantes." checked={personalization.memoriesStored} onChange={(value) => updatePersonalization('memoriesStored', value)} />
                <SwitchRow label="Histórico de chat de referência" description="Permitir referência ao histórico local de conversas." checked={personalization.referenceChatHistory} onChange={(value) => updatePersonalization('referenceChatHistory', value)} />
                {onOpenMemoryManager ? (
                  <button type="button" className="btn-modern" onClick={onOpenMemoryManager}>
                    Gerenciar memórias
                  </button>
                ) : null}
              </section>

              <section className="settings-block">
                <SwitchRow
                  label="Personalização avançada do Ailu"
                  description={`Mantém preferências de comportamento para o perfil ${selectedAgentLabel}.`}
                  checked={personalization.customizeAilu}
                  onChange={(value) => updatePersonalization('customizeAilu', value)}
                />
                <SwitchRow
                  label="Gerenciar cookies"
                  description="Guarda a preferência para fluxos web que exigirem estado de navegador."
                  checked={personalization.manageCookies}
                  onChange={(value) => updatePersonalization('manageCookies', value)}
                />
              </section>

              <section className="settings-block prompt-preset-settings">
                <div className="settings-section-label">Presets customizados</div>
                <label className="settings-line settings-routing-list">
                  <span>
                    <strong>Nome</strong>
                    <small>O preset aparece no composer sem poluir a home.</small>
                  </span>
                  <input className="input-modern" value={customPresetLabel} onChange={(event) => setCustomPresetLabel(event.target.value)} placeholder="Meu preset" />
                </label>
                <label className="settings-line settings-routing-list">
                  <span>
                    <strong>Contexto</strong>
                    <small>Injetado como contexto oculto no provider.</small>
                  </span>
                  <textarea className="input-modern" rows={4} value={customPresetPrompt} onChange={(event) => setCustomPresetPrompt(event.target.value)} placeholder="Instruções do preset..." />
                </label>
                <div className="dialog-actions">
                  <button type="button" className="btn-modern btn-modern-primary" disabled={!customPresetLabel.trim() || !customPresetPrompt.trim()} onClick={savePromptPresetDraft}>
                    {customPresetId ? 'Salvar alterações' : 'Salvar preset'}
                  </button>
                  {customPresetId ? (
                    <button type="button" className="btn-modern" onClick={() => { setCustomPresetId(undefined); setCustomPresetLabel(''); setCustomPresetPrompt(''); }}>
                      Cancelar edição
                    </button>
                  ) : null}
                </div>
                {customPresets.length > 0 ? (
                  <div className="custom-preset-list">
                    {customPresets.map((preset) => (
                      <div key={preset.id} className="custom-preset-row">
                        <span>
                          <strong>{preset.label}</strong>
                          <small>{preset.description}</small>
                        </span>
                        <button type="button" className="settings-pill-button" onClick={() => editPromptPreset(preset)}>Editar</button>
                        <button type="button" className="settings-pill-button danger" onClick={() => deletePromptPreset(preset.id)}>Remover</button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="settings-block">
                <button type="button" className="settings-advanced-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((current) => !current)}>
                  <span>Avançado</span>
                  <span aria-hidden="true">{advancedOpen ? '⌄' : '›'}</span>
                </button>
                {advancedOpen ? (
                  <div className="settings-advanced-list">
                    {ADVANCED_PERSONALIZATION.map((item) => (
                      <SwitchRow
                        key={item.key}
                        label={item.label}
                        description={item.description}
                        checked={personalization[item.key]}
                        onChange={(value) => updatePersonalization(item.key, value)}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {activeTab === 'maquina-local' ? (
            <LocalEnginePage />
          ) : null}

          {activeTab === 'health' ? (
            <div className="settings-page">
              <header className="settings-page-heading">
                <span>Saúde</span>
                <h3>Estado real do sistema</h3>
              </header>
              <section className="settings-block health-panel">
                <div className="ollama-manager-header">
                  <div>
                    <strong className={`health-overall health-overall-${health?.overallStatus ?? 'unknown'}`}>
                      {!health ? 'Aguardando diagnóstico' : health.overallStatus === 'ok' ? 'Tudo funcionando' : health.overallStatus === 'warning' ? 'Atenção necessária' : 'Problemas encontrados'}
                    </strong>
                    <small>{health ? 'Diagnóstico executado.' : 'Clique em Verificar para carregar o diagnóstico.'}</small>
                  </div>
                  <button type="button" className="settings-pill-button" disabled={healthLoading} onClick={() => void refreshHealth()}>
                    {healthLoading ? 'Verificando…' : 'Verificar agora'}
                  </button>
                </div>
                {healthError ? <div className="input-error-tip" role="alert">{healthError}</div> : null}

                {health ? (
                  <div className="health-groups">
                    {/* IA Local */}
                    <div className="health-group">
                      <h4 className="health-group-title">IA Local</h4>
                      <HealthRow
                        status={health.ollama.apiReachable ? 'ok' : 'error'}
                        label="Ollama"
                        detail={health.ollama.apiReachable
                          ? `Acessível · ${health.ollama.installedModels.length} modelo(s) instalado(s)`
                          : 'Serviço Ollama inacessível. Inicie com: ollama serve'}
                        command={health.ollama.apiReachable ? undefined : 'ollama serve'}
                      />
                      {health.ollama.problems.slice(0, 3).map((problem, index) => (
                        <HealthRow key={index} status="warning" label="Aviso Ollama" detail={problem} />
                      ))}
                    </div>

                    {/* Modelos instalados */}
                    <div className="health-group">
                      <h4 className="health-group-title">Modelos instalados</h4>
                      <HealthRow
                        status={health.ollama.installedModels.length > 0 ? 'ok' : 'warning'}
                        label={health.ollama.installedModels.length > 0 ? `${health.ollama.installedModels.length} modelo(s) local(is)` : 'Nenhum modelo local instalado'}
                        detail={health.ollama.installedModels.length > 0
                          ? health.ollama.installedModels.slice(0, 4).map((m) => m.id).join(', ')
                          : 'Baixe um modelo em Configurações → Modelos → Locais.'}
                      />
                    </div>

                    {/* Providers */}
                    {health.providers.length > 0 ? (
                      <div className="health-group">
                        <h4 className="health-group-title">Providers de nuvem</h4>
                        {health.providers.map((p) => (
                          <HealthRow
                            key={p.id}
                            status={p.status.state === 'ready' ? 'ok' : p.hasKey ? 'warning' : 'error'}
                            label={p.id}
                            detail={
                              p.status.state === 'ready'
                                ? `Conectado · ${p.profileCount ?? 0} perfil(is)`
                                : p.hasKey
                                  ? `Chave configurada mas não testada: ${p.status.message ?? ''}`
                                  : 'Sem chave de API. Configure em Configurações → Modelos.'
                            }
                          />
                        ))}
                      </div>
                    ) : null}

                    {/* App e armazenamento */}
                    <div className="health-group">
                      <h4 className="health-group-title">App e armazenamento</h4>
                      <HealthRow
                        status={health.correctBaseDir ? 'ok' : 'warning'}
                        label="Diretório do app"
                        detail={health.correctBaseDir ? 'Configurado corretamente' : 'Diretório base fora do esperado — pode causar problemas ao salvar dados.'}
                      />
                      {health.sessionsCount !== undefined ? (
                        <HealthRow status="ok" label="Conversas salvas" detail={`${health.sessionsCount} conversa(s) armazenada(s)`} />
                      ) : null}
                    </div>

                    {/* Outros itens do diagnóstico */}
                    {(health.items ?? []).length > 0 ? (
                      <div className="health-group">
                        <h4 className="health-group-title">Outros</h4>
                        {(health.items ?? []).map((item) => (
                          <HealthRow key={item.id} status={item.status} label={item.label} detail={item.detail} command={item.command} action={item.action} />
                        ))}
                      </div>
                    ) : null}

                    {/* Erros recentes */}
                    {health.recentErrors.length > 0 ? (
                      <div className="health-group">
                        <h4 className="health-group-title">Problemas recentes</h4>
                        {health.recentErrors.slice(0, 5).map((err, index) => (
                          <HealthRow
                            key={index}
                            status={err.severity === 'error' ? 'error' : 'warning'}
                            label={err.message || err.code}
                            detail=""
                          />
                        ))}
                      </div>
                    ) : null}

                    {/* Diagnóstico avançado (dev) — recolhido por padrão */}
                    <AdvancedHealthDiagnostics health={health} />
                  </div>
                ) : (
                  <div className="model-picker-empty" role="status">
                    <strong>Diagnóstico não executado</strong>
                    <span>Clique em "Verificar agora" para checar Ollama, ferramentas do sistema, providers e armazenamento.</span>
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
