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
    <section className="panel approval-panel">
      <header className="panel-header">
        <h2>Centro de Aprovação</h2>
        <Badge tone={requests.length > 0 ? 'warn' : 'ok'}>{requests.length}</Badge>
      </header>
      <div className="panel-body scroll-y compact-list">
        <div className="permission-guidance">
          <strong>Sim/Não explícito</strong>
          <span>Sem senha na UI. Dry-run não aplica alteração real.</span>
        </div>
        {requests.length === 0 ? (
          <div className="empty-state empty-state-inline">
            <strong>Fila limpa</strong>
            <span>Nenhuma permissão pendente.</span>
          </div>
        ) : null}
        {requests.map((request) => (
          <article key={request.id} className="permission-card">
            <div className="row-between">
              <div className="permission-badges">
                <Badge tone={tone(request.category)}>{request.category}</Badge>
                <Badge tone={riskTone(request.riskLevel)}>risco {request.riskLevel}</Badge>
                {request.dryRun ? <Badge tone="ok">dry-run</Badge> : null}
                {request.requiresHighConfirmation ? <Badge tone="danger">confirmação alta</Badge> : null}
              </div>
              <small>{formatDateTime(request.requestedAt)}</small>
            </div>
            <strong>{request.title}</strong>
            <p className="muted">{request.description}</p>
            <pre className="command-preview">{request.command}</pre>
            {request.actionId ? <p className="muted">ação: {request.actionId}</p> : null}
            <div className="permission-facts">
              <span>alvo</span>
              <strong>{shortPath(request.target, 3)}</strong>
              <span>risco</span>
              <strong>{request.risk}</strong>
              {request.rollback ? (
                <>
                  <span>reversão</span>
                  <strong>{request.rollback}</strong>
                </>
              ) : null}
            </div>
            <div className="row-actions">
              <button type="button" className="btn-modern btn-modern-primary" onClick={() => onApprove(request.id)}>
                Sim
              </button>
              <button type="button" className="btn-modern" onClick={() => onReject(request.id)}>
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
            {summarize(outcome.stdout) ? <pre className="terminal-snippet">stdout: {summarize(outcome.stdout)}</pre> : null}
            {summarize(outcome.stderr) ? <pre className="terminal-snippet stream-stderr">stderr: {summarize(outcome.stderr)}</pre> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
