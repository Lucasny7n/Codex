import { Badge } from '../common/Badge';
import { formatDateTime } from '../../lib/format';
import type { AgentSession } from '../../types/domain';

interface SessionsPanelProps {
  sessions: AgentSession[];
  selectedSessionId?: string;
  onSelect: (id: string) => void;
}

export function SessionsPanel({ sessions, selectedSessionId, onSelect }: SessionsPanelProps): JSX.Element {
  return (
    <section className="panel sessions-panel">
      <header className="panel-header">
        <h2>Workspaces</h2>
        <Badge tone="info">{sessions.length}</Badge>
      </header>
      <div className="panel-body scroll-y compact-list">
        {sessions.length === 0 ? (
          <div className="empty-state empty-state-inline">
            <strong>Sem sessões</strong>
            <span>Nenhuma sessão iniciada.</span>
          </div>
        ) : null}
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={`list-item session-item ${selectedSessionId === session.id ? 'active' : ''}`}
            onClick={() => onSelect(session.id)}
          >
            <div className="session-main">
              <span className={`status-dot ${session.status}`} />
              <div>
                <div className="list-item-title">{session.title}</div>
                <div className="list-item-subtitle">{formatDateTime(session.updatedAt)}</div>
              </div>
            </div>
            <Badge tone={session.status === 'error' ? 'danger' : session.status === 'executing' ? 'info' : 'neutral'}>
              {session.status.replace('_', ' ')}
            </Badge>
          </button>
        ))}
      </div>
    </section>
  );
}
