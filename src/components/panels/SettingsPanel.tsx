import { useMemo, useState } from 'react';
import { modelRegistry, type ModelProfile } from '../../lib/modelRegistry';
import { resolveModelStatus } from '../../lib/providerStatus';
import type {
  AgentProfile,
  AgentSession,
  AiResponseLanguage,
  AppPersonalizationSettings,
  AppSettings,
  LocalRuntimeSnapshot,
  ProviderDescriptor,
  ThemePreference,
} from '../../types/domain';
import { FileManagerModal } from '../file/FileManagerModal';

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
  initialTab?: SettingsTab;
}

export type SettingsTab = 'general' | 'interface' | 'models' | 'conversations' | 'personalization';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: 'Geral' },
  { id: 'interface', label: 'Interface' },
  { id: 'models', label: 'Modelos' },
  { id: 'conversations', label: 'Conversas' },
  { id: 'personalization', label: 'Personalização' },
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
  customizeCodexQwen: false,
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

function modelProviderLabel(model: ModelProfile): string {
  return model.providerLabel.replace(/\s+API$/i, '').replace(/^Google\s+/i, '');
}

function modelTypeLabel(model: ModelProfile): string {
  return model.mode === 'local' ? `Local · ${model.family}` : 'Nuvem';
}

function modelModality(model: ModelProfile): string {
  const supportsCode = model.tags.some((tag) => tag.includes('codigo') || tag.includes('coder') || tag.includes('code'));
  return supportsCode ? 'Texto e código' : 'Texto';
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

function preference(settings: AppSettings): AppPersonalizationSettings {
  return { ...DEFAULT_PERSONALIZATION, ...settings.personalization };
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

  const modelItems = useMemo(() => {
    const featured = new Set(FEATURED_MODEL_IDS);
    return [...modelRegistry.all()].sort((left, right) => {
      const leftFeatured = featured.has(left.id) ? 0 : 1;
      const rightFeatured = featured.has(right.id) ? 0 : 1;
      return leftFeatured - rightFeatured || left.providerLabel.localeCompare(right.providerLabel) || left.displayName.localeCompare(right.displayName);
    });
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
  const selectedAgentLabel = profiles.find((profile) => profile.id === settings.selectedAgentId)?.label ?? 'Padrão';
  const installedLocalModels = new Set(localRuntime?.installedModels.map((model) => model.id) ?? []);

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
              onClick={() => setActiveTab(tab.id)}
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
                    <small>Escolha o tema do app. Sistema acompanha a preferência do PC.</small>
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
                  label="Cópia automática da resposta para área de transferência"
                  description="Mantém desligado por padrão para evitar sobrescrever seu clipboard."
                  checked={settings.autoCopyResponses ?? false}
                  onChange={(value) => void commit({ autoCopyResponses: value })}
                />
                <SwitchRow
                  label="Colar texto grande como arquivo"
                  description="Prefere anexo bruto/metadados quando o conteúdo for grande."
                  checked={settings.pasteLargeTextAsFile ?? true}
                  onChange={(value) => void commit({ pasteLargeTextAsFile: value })}
                />
              </section>
            </div>
          ) : null}

          {activeTab === 'models' ? (
            <div className="settings-page">
              <header className="settings-page-heading">
                <span>Modelos</span>
                <h3>Informações dos modelos</h3>
              </header>

              <section className="settings-model-list" aria-label="Informações dos modelos">
                {modelItems.map((model) => {
                  const expanded = expandedModelId === model.id;
                  const installed = model.mode === 'local' && (installedLocalModels.has(model.id) || installedLocalModels.has(model.modelId));
                  const status = modelStatusLabel(model, providers, localRuntime);
                  return (
                    <article key={model.id} className={`settings-model-accordion ${expanded ? 'open' : ''}`}>
                      <button type="button" className="settings-model-trigger" onClick={() => setExpandedModelId(expanded ? '' : model.id)}>
                        <span>{expanded ? '⌄' : '›'}</span>
                        <strong>{model.displayName}</strong>
                      </button>
                      {expanded ? (
                        <div className="settings-model-details">
                          <p>{model.recommendedUse ? `${model.displayName} é indicado para ${model.recommendedUse.toLowerCase()}.` : `${model.displayName} está no catálogo local do app.`}</p>
                          <div className="settings-model-facts">
                            <span><strong>Comprimento máximo do contexto</strong>{model.estimatedLimits.summary}</span>
                            <span><strong>Comprimento máximo de geração</strong>Não informado no registry local.</span>
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
              </section>
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
              </section>

              <section className="settings-block">
                <SwitchRow
                  label="Personalizar o Codex/Qwen"
                  description={`Mantém preferências de comportamento para o perfil ${selectedAgentLabel}.`}
                  checked={personalization.customizeCodexQwen}
                  onChange={(value) => updatePersonalization('customizeCodexQwen', value)}
                />
                <SwitchRow
                  label="Gerenciar cookies"
                  description="Guarda a preferência para fluxos web que exigirem estado de navegador."
                  checked={personalization.manageCookies}
                  onChange={(value) => updatePersonalization('manageCookies', value)}
                />
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
        </div>
      </div>
    </section>
  );
}
