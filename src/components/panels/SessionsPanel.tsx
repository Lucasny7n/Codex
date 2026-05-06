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
    <section className="panel">
      <header className="panel-header">
        <h2>Sessões</h2>
        <Badge tone="info">{sessions.length}</Badge>
      </header>
      <div className="panel-body scroll-y compact-list">
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={`list-item ${selectedSessionId === session.id ? 'active' : ''}`}
            onClick={() => onSelect(session.id)}
          >
            <div className="list-item-title">{session.title}</div>
            <div className="list-item-subtitle">{formatDateTime(session.updatedAt)}</div>
            <Badge tone={session.status === 'error' ? 'danger' : session.status === 'executing' ? 'info' : 'neutral'}>
              {session.status}
            </Badge>
          </button>
        ))}
      </div>
    </section>
  );
}
