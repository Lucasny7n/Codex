interface OnboardingPanelProps {
  onOpenGuide: () => void;
  onOpenQuickstart: () => void;
  onOpenWorkspace: () => void;
  onOpenDataRoot: () => void;
  onOpenLogs: () => void;
  onRunCheckEnvironment: () => void;
  busy?: boolean;
  highlight?: boolean;
}

const TOUR_STEPS = [
  'Escolha provider/modelo.',
  'Escolha perfil/agente.',
  'Escreva uma tarefa.',
  'Leia plano/status.',
  'Use dry-run em ações sensíveis.',
  'Aprove ou negue permissões.',
  'Abra arquivos no VS Code.',
  'Veja logs e relatório.'
];

export function OnboardingPanel({
  onOpenGuide,
  onOpenQuickstart,
  onOpenWorkspace,
  onOpenDataRoot,
  onOpenLogs,
  onRunCheckEnvironment,
  busy = false,
  highlight = false
}: OnboardingPanelProps): JSX.Element {
  return (
    <section className={`panel onboarding-panel${highlight ? ' panel-attention' : ''}`}>
      <header className="panel-header">
        <h2>Primeiros Passos</h2>
        {highlight ? <span className="first-run-badge">novo</span> : null}
      </header>
      <div className="panel-body compact-list">
        <div className="tour-panel">
          <strong>Fluxo rápido</strong>
          <div className="tour-grid">
            {TOUR_STEPS.map((step, index) => (
              <div className="tour-step" key={step}>
                <span className="tour-check" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="onboarding-actions">
          <button type="button" className="btn-modern" onClick={onOpenGuide}>
            Abrir Guia de Uso
          </button>
          <button type="button" className="btn-modern" onClick={onOpenQuickstart}>
            Abrir Quickstart
          </button>
          <button type="button" className="btn-modern" onClick={onOpenWorkspace}>
            Abrir pasta no VS Code
          </button>
          <button type="button" className="btn-modern" onClick={onOpenDataRoot}>
            Abrir ~/.codex
          </button>
          <button type="button" className="btn-modern" onClick={onOpenLogs}>
            Abrir logs
          </button>
          <button type="button" className="btn-modern btn-modern-primary" onClick={onRunCheckEnvironment} disabled={busy}>
            Rodar check-environment
          </button>
        </div>
      </div>
    </section>
  );
}
