import { useMemo, useState } from 'react';
import type {
  ExecutionMode,
  LocalModelInstallProgress,
  LocalRuntimeSnapshot,
  ProviderAccountProfile,
  ProviderCredentialStatus,
  ProviderDescriptor,
} from '../../types/domain';
import {
  capabilityLabel,
  localCompatibility,
  localCompatibilityLabel,
  modelRegistry,
  type CloudModelProfile,
  type LocalModelProfile,
  type ModelProfile,
} from '../../lib/modelRegistry';
import {
  canSelectModel,
  getSetupRequirement,
  getUnavailableReason,
  resolveModelStatus,
  resolvePrimaryAction,
  statusTone,
} from '../../lib/providerStatus';

interface ModelSelectorProps {
  open: boolean;
  mode: ExecutionMode;
  activeModelId?: string;
  providers: ProviderDescriptor[];
  credentials: ProviderCredentialStatus[];
  providerProfiles: ProviderAccountProfile[];
  localRuntime?: LocalRuntimeSnapshot;
  installationProgress: Record<string, LocalModelInstallProgress>;
  busyModelId?: string;
  onClose: () => void;
  onModeChange: (mode: ExecutionMode) => void;
  onActivateCloud: (model: CloudModelProfile) => Promise<void>;
  onActivateLocal: (model: LocalModelProfile) => Promise<void>;
  onInstallLocalModel: (model: LocalModelProfile) => Promise<void>;
  onRemoveLocalModel: (model: LocalModelProfile) => Promise<void>;
  onInstallRuntime: () => Promise<void>;
  onStartRuntime: () => Promise<void>;
  onConfigureProvider: (providerId: string) => void;
}

const FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'recomendado', label: 'Recomendados' },
  { id: 'codigo', label: 'Código' },
  { id: 'gratis', label: 'Grátis/baixo custo' },
  { id: 'instalado', label: 'Instalados' },
  { id: 'compatível', label: 'Compatíveis com meu PC' },
  { id: 'requer-config', label: 'Requer config' },
  { id: 'rapido', label: 'Rápidos' },
];

function statusClass(status: string): string {
  return status.replace(/_/g, '-');
}

function isInstalledLocal(model: LocalModelProfile, runtime?: LocalRuntimeSnapshot): boolean {
  if (!runtime) return false;
  return runtime.installedModels.some((installed) => installed.id === model.id || installed.id === model.modelId);
}

function tagsForRow(model: ModelProfile): string[] {
  const tags = [];
  if (model.recommended) tags.push('recomendado');
  if (model.capabilities.coding >= 4) tags.push('código');
  if (model.capabilities.speed >= 4) tags.push('rápido');
  if (model.mode === 'local') tags.push(localCompatibilityLabel(localCompatibility(model)));
  if (model.mode === 'cloud' && model.freeTierAvailable) tags.push('baixo custo');
  return tags.slice(0, 3);
}

function profileStatusLabel(status: ProviderAccountProfile['status']): string {
  return status.replace(/_/g, ' ');
}

function profileLabel(
  providerId: string,
  credentials: ProviderCredentialStatus[],
  providerProfiles: ProviderAccountProfile[],
): string {
  const providerAccounts = providerProfiles.filter((profile) => profile.providerId === providerId);
  const defaultProfile = providerAccounts.find((profile) => profile.isDefault) ?? providerAccounts[0];
  const credential = credentials.find((item) => item.providerId === providerId);
  if (providerId === 'local-ollama') return 'Local';
  if (defaultProfile) return `${defaultProfile.name} (${profileStatusLabel(defaultProfile.status)})`;
  if (credential?.hasCredential) return `Padrão (${credential.source ?? 'local'})`;
  return 'Sem profile pronto';
}

export function ModelSelector({
  open,
  mode,
  activeModelId,
  providers,
  credentials,
  providerProfiles,
  localRuntime,
  installationProgress,
  busyModelId,
  onClose,
  onModeChange,
  onActivateCloud,
  onActivateLocal,
  onInstallLocalModel,
  onRemoveLocalModel,
  onInstallRuntime,
  onStartRuntime,
  onConfigureProvider,
}: ModelSelectorProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);

  const providersById = useMemo(() => {
    const map = new Map<string, ProviderDescriptor>();
    for (const provider of providers) map.set(provider.id, provider);
    return map;
  }, [providers]);

  const filteredItems = useMemo(() => {
    const withoutInstalledFilter = filters.filter((tag) => tag !== 'instalado' && tag !== 'compatível');
    const items = modelRegistry.search(mode, query, withoutInstalledFilter);
    if (mode === 'local') {
      return items.filter((item) => {
        if (item.mode !== 'local') return false;
        if (filters.includes('instalado') && !isInstalledLocal(item, localRuntime)) return false;
        if (filters.includes('compatível') && !['recommended', 'compatible'].includes(localCompatibility(item))) return false;
        return true;
      });
    }
    return items;
  }, [mode, query, filters, localRuntime]);

  if (!open) return null;

  return (
    <div className="model-selector-overlay" role="dialog" aria-modal="true" aria-label="Seletor de IA">
      <section className="model-selector-panel">
        <header className="model-selector-header">
          <div>
            <h2>IA Ativa</h2>
            <p>Estado real, ação correta e detalhes somente sob demanda.</p>
          </div>
          <button type="button" className="btn-modern" onClick={onClose}>
            Fechar
          </button>
        </header>

        <div className="model-selector-controls compact">
          <div className="execution-toggle" role="tablist" aria-label="Modo de execução">
            <button
              type="button"
              className={`execution-toggle-btn ${mode === 'cloud' ? 'active' : ''}`}
              onClick={() => onModeChange('cloud')}
            >
              Nuvem
            </button>
            <button
              type="button"
              className={`execution-toggle-btn ${mode === 'local' ? 'active' : ''}`}
              onClick={() => onModeChange('local')}
            >
              Local
            </button>
          </div>

          <input
            className="input-modern"
            placeholder="Buscar modelo, provider ou uso"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="filter-chip-row">
            {FILTER_OPTIONS.map((filter) => {
              const active = filters.includes(filter.id);
              return (
                <button
                  key={filter.id}
                  type="button"
                  className={`filter-chip ${active ? 'active' : ''}`}
                  onClick={() => {
                    setFilters((current) =>
                      current.includes(filter.id)
                        ? current.filter((value) => value !== filter.id)
                        : [...current, filter.id],
                    );
                  }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {mode === 'local' && localRuntime ? (
          <div className={`runtime-status runtime-status-${statusClass(localRuntime.state)}`}>
            <strong>Ollama: {localRuntime.state.replace('_', ' ')}</strong>
            <span>{localRuntime.message}</span>
            <span>API: {localRuntime.apiReachable ? 'online' : 'offline'} em {localRuntime.apiUrl}</span>
            {localRuntime.installCommand ? <code>{localRuntime.installCommand}</code> : null}
          </div>
        ) : null}

        <div className="model-list scroll-y">
          {filteredItems.length === 0 ? (
            <div className="empty-state model-selector-empty">
              <strong>Nenhum modelo encontrado</strong>
              <span>Altere filtros ou busca para listar modelos.</span>
            </div>
          ) : null}

          {filteredItems.map((model) => {
            const provider = providersById.get(model.providerId);
            const progress = installationProgress[model.id] ?? installationProgress[model.modelId];
            const status = resolveModelStatus(model, provider?.status, localRuntime, progress);
            const actionLabel = progress?.state === 'running'
              ? progress.progressPercent != null
                ? `${progress.progressPercent}%`
                : 'Baixando'
              : resolvePrimaryAction(status);
            const active = activeModelId === model.id || activeModelId === model.modelId;
            const selectable = canSelectModel(status);
            const compatibility = model.mode === 'local' ? localCompatibility(model) : undefined;
            const blocksInstall = compatibility === 'not_recommended' && status === 'model_missing';
            const displayedAction = blocksInstall ? 'Não recomendado' : actionLabel;

            return (
              <article key={model.id} className={`model-row ${active ? 'active' : ''}`}>
                <div className="model-row-main">
                  <div>
                    <h3>{model.displayName}</h3>
                    <p>{model.providerLabel} · {profileLabel(model.providerId, credentials, providerProfiles)}</p>
                  </div>
                  <span className={`model-status status-${statusClass(status)} tone-${statusTone(status)}`}>
                    {status.replace('_', ' ')}
                  </span>
                  <div className="tag-row compact-tags">
                    {tagsForRow(model).map((tag) => (
                      <span key={tag} className="model-tag">{tag}</span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className={`btn-modern ${selectable ? 'btn-modern-primary' : ''}`}
                  disabled={busyModelId === model.id || status === 'pulling' || status === 'unavailable' || blocksInstall}
                  onClick={() => {
                    if (model.mode === 'cloud') {
                      if (selectable) void onActivateCloud(model);
                      else onConfigureProvider(model.providerId);
                      return;
                    }
                    if (status === 'not_installed') void onInstallRuntime();
                    else if (status === 'service_offline' || status === 'api_unreachable') void onStartRuntime();
                    else if (status === 'model_missing') void onInstallLocalModel(model);
                    else if (selectable) void onActivateLocal(model);
                  }}
                >
                  {busyModelId === model.id ? 'Processando' : displayedAction}
                </button>

                <details className="model-details model-row-details">
                  <summary>Detalhes</summary>
                  <div className="model-detail-grid">
                    <span>Código: <strong>{capabilityLabel(model.capabilities.coding)}</strong></span>
                    <span>Raciocínio: <strong>{capabilityLabel(model.capabilities.reasoning)}</strong></span>
                    <span>Velocidade: <strong>{capabilityLabel(model.capabilities.speed)}</strong></span>
                    <span>Limites: <strong>{model.limits}</strong></span>
                  </div>
                  <p><strong>Uso:</strong> {model.recommendedUse}</p>
                  <p><strong>Requisito:</strong> {getSetupRequirement(status) ?? model.setupRequirement}</p>
                  <p><strong>Privacidade:</strong> {model.privacy}</p>
                  <p><strong>Caveats:</strong> {model.caveats.join(' • ')}</p>
                  {getUnavailableReason(status) ? <p><strong>Motivo:</strong> {getUnavailableReason(status)}</p> : null}
                  {model.mode === 'local' ? (
                    <>
                      <p><strong>Hardware:</strong> RAM {model.ramRequirement}, VRAM {model.vramRequirement}, disco {model.diskRequirement}</p>
                      <p><strong>Compatibilidade:</strong> {localCompatibilityLabel(localCompatibility(model))}. Base: Ryzen 5 5500, RX 7600, 16 GB RAM.</p>
                      <p><strong>Velocidade esperada:</strong> {model.expectedPerformance}</p>
                    </>
                  ) : null}
                  {model.mode === 'local' && isInstalledLocal(model, localRuntime) ? (
                    <button
                      type="button"
                      className="btn-modern"
                      disabled={busyModelId === model.id}
                      onClick={() => void onRemoveLocalModel(model)}
                    >
                      Remover modelo
                    </button>
                  ) : null}
                </details>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
