import type { BackendAvailability, BackendStatus } from '../../types/domain';

const AVAILABILITY_LABELS: Record<BackendAvailability, string> = {
  ready: 'Pronto',
  installed: 'Instalado',
  not_installed: 'Não instalado',
  experimental: 'Experimental',
  future_available: 'Futuro',
  unknown: 'Status desconhecido',
};

function availabilityCss(a: BackendAvailability): string {
  if (a === 'ready' || a === 'installed') return 'health-ok';
  if (a === 'not_installed') return 'health-warning';
  return '';
}

function isAvailableNow(b: BackendStatus): boolean {
  return b.availability === 'ready'
    || b.availability === 'installed'
    || b.availability === 'not_installed';
}

interface BackendStatusListProps {
  backends: BackendStatus[];
}

function BackendCard({ b }: { b: BackendStatus }): JSX.Element {
  return (
    <article key={b.id} className={`health-item-card ${availabilityCss(b.availability)}`}>
      <strong>{b.label}</strong>
      <small>{AVAILABILITY_LABELS[b.availability]}</small>
      {b.version ? <span>v{b.version}</span> : null}
      <p>{b.detail}</p>
      {b.availability === 'not_installed' && b.installPlan ? (
        <details className="settings-details">
          <summary>Como instalar</summary>
          <code style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.78rem' }}>{b.installPlan}</code>
        </details>
      ) : null}
    </article>
  );
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

  const available = backends.filter(isAvailableNow);
  const future = backends.filter((b) => !isAvailableNow(b));

  return (
    <div>
      {available.length > 0 ? (
        <div className="health-item-grid">
          {available.map((b) => <BackendCard key={b.id} b={b} />)}
        </div>
      ) : null}

      {future.length > 0 ? (
        <details className="settings-details" style={{ marginTop: available.length > 0 ? '0.75rem' : 0 }}>
          <summary>Engines futuras / experimentais ({future.length})</summary>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.5rem 0' }}>
            Essas engines ainda não estão implementadas nesta versão. O suporte será adicionado em versões futuras.
          </p>
          <div className="health-item-grid" style={{ marginTop: '0.5rem', opacity: 0.65 }}>
            {future.map((b) => (
              <article key={b.id} className="health-item-card">
                <strong>{b.label}</strong>
                <small style={{ color: 'var(--text-secondary)' }}>
                  {b.availability === 'future_available' ? 'Futuro' : 'Experimental — não testado em produção'}
                </small>
                <p>{b.detail}</p>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
