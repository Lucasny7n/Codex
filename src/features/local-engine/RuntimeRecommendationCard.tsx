import { Badge } from '../../components/common/Badge';
import type { BackendStatus, FitClass, RuntimeRecommendation, RuntimeBackendId, WarningSeverity } from '../../types/domain';

const FIT_LABELS: Record<FitClass, string> = {
  excellent: 'Recomendado',
  fits: 'Cabe',
  tight: 'Apertado',
  slow_swap: 'Lento / usa swap',
  wont_run: 'Não roda',
  unknown: 'Desconhecido',
};

type BadgeTone = 'ok' | 'info' | 'warn' | 'danger' | 'neutral';

const FIT_TONES: Record<FitClass, BadgeTone> = {
  excellent: 'ok',
  fits: 'info',
  tight: 'warn',
  slow_swap: 'warn',
  wont_run: 'danger',
  unknown: 'neutral',
};

const SEVERITY_TONES: Record<WarningSeverity, BadgeTone> = {
  info: 'info',
  warning: 'warn',
  strong: 'danger',
};

function backendLabel(id: RuntimeBackendId, backends: BackendStatus[]): string {
  return backends.find((b) => b.id === id)?.label ?? id;
}

interface RuntimeRecommendationCardProps {
  recommendation: RuntimeRecommendation;
  backends: BackendStatus[];
}

export function RuntimeRecommendationCard({ recommendation, backends }: RuntimeRecommendationCardProps): JSX.Element {
  const { backend, estimate, message, rationale, alternatives } = recommendation;
  const { fit, speedHint, warnings } = estimate;

  return (
    <article className="health-item-card health-ok">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong>{backendLabel(backend, backends)}</strong>
        <Badge tone={FIT_TONES[fit]}>{FIT_LABELS[fit]}</Badge>
      </div>
      <p>{message}</p>
      <small>{rationale}</small>
      {speedHint ? <span>{speedHint}</span> : null}

      {warnings.length > 0 ? (
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem' }}>
          {warnings.map((w, i) => (
            <li key={i}>
              <Badge tone={SEVERITY_TONES[w.severity]}>{w.message}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {alternatives.length > 0 ? (
        <div>
          <small>Alternativas: {alternatives.map((a) => backendLabel(a, backends)).join(', ')}</small>
        </div>
      ) : null}
    </article>
  );
}
