import { Badge } from '../common/Badge';
import { formatDateTime, shortPath } from '../../lib/format';
import type { PermissionOutcome, PermissionRequest } from '../../types/domain';

interface PermissionsPanelProps {
  requests: PermissionRequest[];
  outcomes: PermissionOutcome[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function tone(category: PermissionRequest['category']): 'neutral' | 'info' | 'warn' | 'danger' | 'ok' {
  if (category === 'safe_read') return 'ok';
  if (category === 'workspace_write') return 'info';
  if (category === 'external_write' || category === 'network' || category === 'package_install') return 'warn';
  return 'danger';
}

function riskTone(level: PermissionRequest['riskLevel']): 'info' | 'warn' | 'danger' | 'ok' {
  if (level === 'low') return 'ok';
  if (level === 'medium') return 'info';
  if (level === 'high') return 'warn';
  return 'danger';
}

function statusTone(status: PermissionOutcome['status']): 'ok' | 'warn' | 'danger' {
  if (status === 'success') return 'ok';
  if (status === 'denied') return 'warn';
  return 'danger';
}

function summarize(text?: string): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (trimmed.length <= 200) return trimmed;
  return `${trimmed.slice(0, 200)}...`;
}

export function PermissionsPanel({ requests, outcomes, onApprove, onReject }: PermissionsPanelProps): JSX.Element {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Permissões Pendentes</h2>
        <Badge tone={requests.length > 0 ? 'warn' : 'ok'}>{requests.length}</Badge>
      </header>
      <div className="panel-body scroll-y compact-list">
        <div className="permission-guidance">
          <p className="muted">Dry-run simula sem aplicar.</p>
          <p className="muted">Ação privilegiada nunca pede senha no app.</p>
          <p className="muted">Leia risco, alvo e reversão antes de aprovar.</p>
          <p className="muted">Sim executa a ação; Não cancela.</p>
        </div>
        {requests.length === 0 ? <p className="muted">Nenhuma permissão pendente no momento.</p> : null}
        {requests.map((request) => (
          <article key={request.id} className="permission-card">
            <div className="row-between">
              <Badge tone={tone(request.category)}>{request.category}</Badge>
              <Badge tone={riskTone(request.riskLevel)}>risco {request.riskLevel}</Badge>
              {request.requiresHighConfirmation ? <Badge tone="danger">confirmação alta</Badge> : null}
              <small>{formatDateTime(request.requestedAt)}</small>
            </div>
            <strong>{request.title}</strong>
            <p className="muted">{request.description}</p>
            <p className="command-preview">{request.command}</p>
            {request.actionId ? <p className="muted">ação: {request.actionId}</p> : null}
            <p className="muted">alvo: {shortPath(request.target, 3)}</p>
            <p className="muted">risco: {request.risk}</p>
            {request.rollback ? <p className="muted">reversão: {request.rollback}</p> : null}
            <div className="row-actions">
              <button type="button" className="btn btn-primary" onClick={() => onApprove(request.id)}>
                Sim
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => onReject(request.id)}>
                Não
              </button>
            </div>
          </article>
        ))}

        {outcomes.length > 0 ? <h3 className="panel-subtitle">Execuções Recentes</h3> : null}
        {outcomes.map((outcome) => (
          <article key={`${outcome.requestId}-${outcome.at}`} className="permission-card permission-outcome">
            <div className="row-between">
              <Badge tone={statusTone(outcome.status)}>{outcome.status}</Badge>
              <small>{formatDateTime(outcome.at)}</small>
            </div>
            <p>{outcome.summary}</p>
            {summarize(outcome.stdout) ? <p className="muted">stdout: {summarize(outcome.stdout)}</p> : null}
            {summarize(outcome.stderr) ? <p className="muted">stderr: {summarize(outcome.stderr)}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
