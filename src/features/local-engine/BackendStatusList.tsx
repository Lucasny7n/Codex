import type { BackendAvailability, BackendStatus } from '../../types/domain';

const AVAILABILITY_LABELS: Record<BackendAvailability, string> = {
  ready: 'Pronto',
  installed: 'Instalado',
  not_installed: 'Não instalado',
  experimental: 'Experimental — não testado em produção',
  future_available: 'Futuro',
  unknown: 'Status desconhecido',
};

const AVAILABILITY_DETAILS: Partial<Record<BackendAvailability, string>> = {
  experimental: 'Este backend está em teste. Pode haver instabilidade, falhas silenciosas ou comportamento inesperado. Não use para tarefas críticas.',
  not_installed: 'Backend não encontrado no PATH. Instale-o manualmente antes de usar.',
  future_available: 'Suporte planejado para versões futuras do app.',
  unknown: 'Não foi possível verificar o estado deste backend nesta sessão.',
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
      {backends.map((b) => {
        const extraDetail = AVAILABILITY_DETAILS[b.availability];
        return (
          <article key={b.id} className={`health-item-card ${availabilityCss(b.availability)}`}>
            <strong>{b.label}</strong>
            <small>{AVAILABILITY_LABELS[b.availability]}</small>
            {b.version ? <span>v{b.version}</span> : null}
            <p>{b.detail}</p>
            {extraDetail ? <p className="backend-availability-note">{extraDetail}</p> : null}
            {b.installPlan ? <code>{b.installPlan}</code> : null}
          </article>
        );
      })}
    </div>
  );
}
