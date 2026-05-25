import type { BackendAvailability, BackendStatus } from '../../types/domain';

const AVAILABILITY_LABELS: Record<BackendAvailability, string> = {
  ready: 'Pronto',
  installed: 'Instalado',
  not_installed: 'Não instalado',
  experimental: 'Experimental',
  future_available: 'Futuro',
  unknown: 'Desconhecido',
};

function availabilityCss(a: BackendAvailability): string {
  if (a === 'ready' || a === 'installed') return 'health-ok';
  if (a === 'not_installed' || a === 'experimental') return 'health-warning';
  return '';
}

interface BackendStatusListProps {
  backends: BackendStatus[];
}

export function BackendStatusList({ backends }: BackendStatusListProps): JSX.Element {
  if (backends.length === 0) {
    return (
      <div className="model-picker-empty" role="status">
        <strong>Nenhum backend detectado</strong>
        <span>A detecção não encontrou backends instalados.</span>
      </div>
    );
  }

  return (
    <div className="health-item-grid">
      {backends.map((b) => (
        <article key={b.id} className={`health-item-card ${availabilityCss(b.availability)}`}>
          <strong>{b.label}</strong>
          <small>{AVAILABILITY_LABELS[b.availability]}</small>
          {b.experimental ? <small>⚠ Experimental</small> : null}
          {b.version ? <span>v{b.version}</span> : null}
          <p>{b.detail}</p>
          {b.installPlan ? <code>{b.installPlan}</code> : null}
        </article>
      ))}
    </div>
  );
}
