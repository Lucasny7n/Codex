import type { ExecutionMode, ProviderRuntimeStatus } from '../../types/domain';

interface TopBarProps {
  providerStatus?: ProviderRuntimeStatus;
  executionMode: ExecutionMode;
  activeModelLabel: string;
  onOpenInspector: () => void;
  onOpenModelSelector: () => void;
}

export function TopBar({
  providerStatus,
  executionMode,
  activeModelLabel,
  onOpenInspector,
  onOpenModelSelector,
}: TopBarProps): JSX.Element {
  const providerStatusLabel = providerStatus?.state.replace('_', ' ') ?? 'offline';
  const modelLabel = activeModelLabel.startsWith('Configurar') || activeModelLabel.includes('não selecionado')
    ? 'Selecionar modelo'
    : activeModelLabel;

  return (
    <header className="topbar-clean">
      <button type="button" className="model-top-selector" onClick={onOpenModelSelector} title={activeModelLabel}>
        <span>{modelLabel}</span>
        <span aria-hidden="true">⌄</span>
        <small>{executionMode === 'local' ? 'Local' : 'Nuvem'}</small>
      </button>

      <div className="topbar-clean-spacer" />

      <div className="topbar-clean-actions" aria-label="Controle">
        <button className="topbar-bot-button" type="button" onClick={onOpenInspector} aria-label={`Controle, provider ${providerStatusLabel}`}>
          ◌
        </button>
      </div>
    </header>
  );
}
