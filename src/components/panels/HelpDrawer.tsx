import { OnboardingPanel } from './OnboardingPanel';

interface HelpDrawerProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onOpenGuide: () => void;
  onOpenQuickstart: () => void;
  onOpenWorkspace: () => void;
  onOpenCodexRoot: () => void;
  onOpenLogs: () => void;
  onRunCheckEnvironment: () => void;
}

export function HelpDrawer({
  open,
  busy,
  onClose,
  onOpenGuide,
  onOpenQuickstart,
  onOpenWorkspace,
  onOpenCodexRoot,
  onOpenLogs,
  onRunCheckEnvironment
}: HelpDrawerProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label="Ajuda e primeiros passos">
      <div className="help-drawer">
        <header className="help-drawer-header">
          <h2>Ajuda</h2>
          <button type="button" className="btn-modern" onClick={onClose}>
            Fechar
          </button>
        </header>
        <div className="help-drawer-content">
          <OnboardingPanel
            onOpenGuide={onOpenGuide}
            onOpenQuickstart={onOpenQuickstart}
            onOpenWorkspace={onOpenWorkspace}
            onOpenCodexRoot={onOpenCodexRoot}
            onOpenLogs={onOpenLogs}
            onRunCheckEnvironment={onRunCheckEnvironment}
            busy={busy}
            highlight={false}
          />
        </div>
      </div>
    </div>
  );
}
