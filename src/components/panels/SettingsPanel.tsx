import { useMemo, useState } from 'react';
import type {
  AgentProfile,
  AppSettings,
  ProviderDescriptor,
  ProviderRuntimeStatus,
  ProviderStatusState
} from '../../types/domain';

interface SettingsPanelProps {
  settings?: AppSettings;
  providers: ProviderDescriptor[];
  profiles: AgentProfile[];
  onChange: (next: AppSettings) => Promise<void>;
  onTestProvider: (providerId: string) => Promise<ProviderRuntimeStatus>;
}

const STATUS_LABELS: Record<ProviderStatusState, string> = {
  mock: 'mock',
  unavailable: 'indisponível',
  not_configured: 'não configurado',
  ready: 'pronto',
  running: 'testando',
  error: 'erro'
};

function statusTone(state: ProviderStatusState): 'neutral' | 'info' | 'warn' | 'danger' | 'ok' {
  if (state === 'ready') return 'ok';
  if (state === 'mock') return 'warn';
  if (state === 'running') return 'info';
  if (state === 'unavailable' || state === 'not_configured') return 'warn';
  if (state === 'error') return 'danger';
  return 'neutral';
}

function fallbackStatus(providerId: string): ProviderRuntimeStatus {
  return {
    state: 'unavailable',
    message: `Provider salvo \`${providerId}\` não está registrado neste build.`,
    checkedAt: new Date().toISOString()
  };
}

export function SettingsPanel({
  settings,
  providers,
  profiles,
  onChange,
  onTestProvider
}: SettingsPanelProps): JSX.Element {
  const [testingProviderId, setTestingProviderId] = useState<string>();
  const [testStatuses, setTestStatuses] = useState<Record<string, ProviderRuntimeStatus>>({});
  const [inlineError, setInlineError] = useState<string>();

  const selectedProvider = useMemo(() => {
    return providers.find((item) => item.id === settings?.selectedProviderId);
  }, [providers, settings?.selectedProviderId]);

  const selectedStatus = settings
    ? testStatuses[settings.selectedProviderId] ?? selectedProvider?.status ?? fallbackStatus(settings.selectedProviderId)
    : undefined;

  const models = selectedProvider?.models ?? [];

  async function testSelectedProvider(): Promise<void> {
    if (!settings) return;
    setInlineError(undefined);
    setTestingProviderId(settings.selectedProviderId);
    try {
      const status = await onTestProvider(settings.selectedProviderId);
      setTestStatuses((current) => ({ ...current, [settings.selectedProviderId]: status }));
      if (status.state === 'error' || status.state === 'unavailable' || status.state === 'not_configured') {
        setInlineError(status.message);
      }
    } catch (cause) {
      setInlineError(cause instanceof Error ? cause.message : 'Falha controlada ao testar provider.');
    } finally {
      setTestingProviderId(undefined);
    }
  }

  if (!settings) {
    return (
      <section className="panel settings-panel">
        <header className="panel-header">
          <h2>Configurações</h2>
        </header>
        <div className="panel-body empty-state empty-state-inline">
          <strong>Carregando</strong>
          <span>Configurações ainda indisponíveis.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="panel settings-panel">
      <header className="panel-header">
        <h2>Settings</h2>
      </header>
      <div className="panel-body form-stack">
        <section className="settings-section">
          <div className="settings-section-header">
            <strong>Provider</strong>
            <span>Runner real ou mock explicitamente marcado.</span>
          </div>

          <label>
            Provider selecionado
            <select
              value={settings.selectedProviderId}
              onChange={async (event) => {
                const provider = providers.find((item) => item.id === event.target.value);
                const firstModel = provider?.models[0]?.id ?? settings.selectedModelId;
                await onChange({ ...settings, selectedProviderId: event.target.value, selectedModelId: firstModel });
                setInlineError(undefined);
              }}
            >
              {selectedProvider ? null : (
                <option value={settings.selectedProviderId}>{settings.selectedProviderId} (não registrado)</option>
              )}
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label} - {STATUS_LABELS[provider.status.state]}
                </option>
              ))}
            </select>
          </label>

          {selectedStatus ? (
            <div className={`provider-status-card provider-status-${statusTone(selectedStatus.state)}`}>
              <div className="row-between">
                <strong>{STATUS_LABELS[selectedStatus.state]}</strong>
                {selectedStatus.version ? <span>{selectedStatus.version}</span> : null}
              </div>
              <p>{selectedStatus.message}</p>
              {selectedStatus.command ? <code>{selectedStatus.command}</code> : null}
              {selectedStatus.state === 'mock' ? (
                <div className="inline-alert inline-alert-warn">Mock não usa IA real. Toda resposta virá marcada com [MOCK].</div>
              ) : null}
              {selectedStatus.state !== 'ready' && selectedStatus.state !== 'mock' ? (
                <div className="inline-alert">Envio de ordem bloqueado até escolher provider pronto ou mock.</div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className="btn-modern"
            disabled={testingProviderId === settings.selectedProviderId}
            onClick={() => void testSelectedProvider()}
          >
            {testingProviderId === settings.selectedProviderId ? 'Testando provider...' : 'Testar provider'}
          </button>

          {inlineError ? (
            <div className="input-error-tip" role="alert">
              {inlineError}
            </div>
          ) : null}
        </section>

        <section className="settings-section">
          <div className="settings-section-header">
            <strong>Modelo</strong>
            <span>Modelo do provider selecionado.</span>
          </div>

          <label>
            Modelo
            <select
              value={settings.selectedModelId}
              onChange={async (event) => onChange({ ...settings, selectedModelId: event.target.value })}
              disabled={models.length === 0}
            >
              {models.length === 0 ? <option value={settings.selectedModelId}>Nenhum modelo disponível</option> : null}
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="settings-section">
          <div className="settings-section-header">
            <strong>Agente</strong>
            <span>Perfil de execução do agente.</span>
          </div>

          <label>
            Perfil do agente
            <select
              value={settings.selectedAgentId}
              onChange={async (event) => onChange({ ...settings, selectedAgentId: event.target.value })}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label} - {profile.description}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="settings-section">
          <div className="settings-section-header">
            <strong>Permissões</strong>
            <span>Comportamento de aprovação automática segura.</span>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.autoApproveSafeRead}
              onChange={async (event) => onChange({ ...settings, autoApproveSafeRead: event.target.checked })}
            />
            auto-aprovar leitura segura
          </label>
        </section>

        <section className="settings-section">
          <div className="settings-section-header">
            <strong>Aparência</strong>
            <span>Tema End-4 escuro com acento azul.</span>
          </div>

          <div className="provider-status-card">
            <div className="row-between">
              <strong>Tema ativo</strong>
              <span>Escuro</span>
            </div>
            <p>Visual minimalista com foco em conversa e inspector.</p>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-header">
            <strong>Avançado</strong>
            <span>Execução local e shell padrão.</span>
          </div>

          <label>
            Shell padrão
            <input
              value={settings.preferredShell}
              onChange={async (event) => onChange({ ...settings, preferredShell: event.target.value })}
            />
          </label>
        </section>
      </div>
    </section>
  );
}
