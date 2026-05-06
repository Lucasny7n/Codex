import { useMemo } from 'react';
import type { AgentProfile, AppSettings, ProviderDescriptor } from '../../types/domain';

interface SettingsPanelProps {
  settings?: AppSettings;
  providers: ProviderDescriptor[];
  profiles: AgentProfile[];
  onChange: (next: AppSettings) => Promise<void>;
}

export function SettingsPanel({ settings, providers, profiles, onChange }: SettingsPanelProps): JSX.Element {
  const models = useMemo(() => {
    const provider = providers.find((item) => item.id === settings?.selectedProviderId);
    return provider?.models ?? [];
  }, [providers, settings?.selectedProviderId]);

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
        <h2>Modelos e Agentes</h2>
      </header>
      <div className="panel-body form-stack">
        <label>
          Provider
          <select
            value={settings.selectedProviderId}
            onChange={async (event) => {
              const provider = providers.find((item) => item.id === event.target.value);
              const firstModel = provider?.models[0]?.id ?? settings.selectedModelId;
              await onChange({ ...settings, selectedProviderId: event.target.value, selectedModelId: firstModel });
            }}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label} {provider.enabled ? '' : '(não configurado)'}
              </option>
            ))}
          </select>
        </label>

        <label>
          Modelo
          <select
            value={settings.selectedModelId}
            onChange={async (event) => onChange({ ...settings, selectedModelId: event.target.value })}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Perfil do Agente
          <select
            value={settings.selectedAgentId}
            onChange={async (event) => onChange({ ...settings, selectedAgentId: event.target.value })}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Shell padrão
          <input
            value={settings.preferredShell}
            onChange={async (event) => onChange({ ...settings, preferredShell: event.target.value })}
          />
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.autoApproveSafeRead}
            onChange={async (event) => onChange({ ...settings, autoApproveSafeRead: event.target.checked })}
          />
          auto-aprovar leitura segura
        </label>
      </div>
    </section>
  );
}
