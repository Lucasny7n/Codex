import { Badge } from '../common/Badge';
import { formatDateTime } from '../../lib/format';
import type { AgentSession } from '../../types/domain';

interface SessionsPanelProps {
  sessions: AgentSession[];
  selectedSessionId?: string;
  onNewSession: () => void;
  onSelect: (id?: string) => void;
  onRename: (session: AgentSession) => void;
  onDelete: (session: AgentSession) => void;
  onExport: (session: AgentSession, format: 'markdown' | 'json') => void;
  onDuplicate: (session: AgentSession) => void;
  onInfo: (session: AgentSession) => void;
}

export function SessionsPanel({
  sessions,
  selectedSessionId,
  onNewSession,
  onSelect,
  onRename,
  onDelete,
  onExport,
  onDuplicate,
  onInfo,
}: SessionsPanelProps): JSX.Element {
  return (
    <section className="panel sessions-panel">
      <header className="panel-header">
        <h2>Sessões</h2>
        <Badge tone="info">{sessions.length}</Badge>
      </header>
      <div className="panel-body scroll-y compact-list">
        <button
          type="button"
          className={`list-item session-item session-new-item ${!selectedSessionId ? 'active' : ''}`}
          onClick={() => onNewSession()}
        >
          <div className="session-main">
            <span className="status-dot idle" />
            <div>
              <div className="list-item-title">Nova conversa</div>
              <div className="list-item-subtitle">Cria somente após a primeira mensagem</div>
            </div>
          </div>
        </button>

        {sessions.length === 0 ? (
          <div className="empty-state empty-state-inline">
            <strong>Sem sessões</strong>
            <span>Envie a primeira mensagem para salvar uma conversa.</span>
          </div>
        ) : null}

        {sessions.map((session) => (
          <article
            key={session.id}
            className={`list-item session-item ${selectedSessionId === session.id ? 'active' : ''}`}
          >
            <button type="button" className="session-select-button" onClick={() => onSelect(session.id)}>
              <div className="session-main">
                <span className={`status-dot ${session.status}`} />
                <div>
                  <div className="list-item-title">{session.title}</div>
                  <div className="list-item-subtitle">
                    {formatDateTime(session.updatedAt)} · {session.messages.length} msg
                  </div>
                  <div className="list-item-subtitle">
                    {(session.providerId ?? 'provider')} / {(session.modelId ?? 'modelo')}
                  </div>
                </div>
              </div>
            </button>

            <div className="session-actions">
              <Badge tone={session.status === 'error' ? 'danger' : session.status === 'executing' ? 'info' : 'neutral'}>
                {session.status.replace('_', ' ')}
              </Badge>
              <button type="button" className="icon-text-button" onClick={() => onInfo(session)}>
                Info
              </button>
              <button type="button" className="icon-text-button" onClick={() => onRename(session)}>
                Renomear
              </button>
              <button type="button" className="icon-text-button" onClick={() => onExport(session, 'markdown')}>
                .md
              </button>
              <button type="button" className="icon-text-button" onClick={() => onExport(session, 'json')}>
                .json
              </button>
              <button type="button" className="icon-text-button" onClick={() => onDuplicate(session)}>
                Duplicar
              </button>
              <button type="button" className="icon-text-button danger" onClick={() => onDelete(session)}>
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
