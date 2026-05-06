import { Badge } from '../common/Badge';
import { formatDateTime } from '../../lib/format';
import type { AgentSession } from '../../types/domain';

interface ChatPanelProps {
  session?: AgentSession;
}

export function ChatPanel({ session }: ChatPanelProps): JSX.Element {
  if (!session) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>Conversa</h2>
        </header>
        <div className="panel-body centered muted">Nenhuma sessão selecionada.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Conversa</h2>
        <Badge tone="neutral">{session.messages.length} mensagens</Badge>
      </header>
      <div className="panel-body scroll-y chat-list">
        {session.messages.map((message) => (
          <article key={message.id} className={`chat-item role-${message.role}`}>
            <div className="chat-head">
              <span>{message.role}</span>
              <small>{formatDateTime(message.createdAt)}</small>
            </div>
            <p>{message.content}</p>
            {message.reasoningSummary ? <pre className="reasoning">{message.reasoningSummary}</pre> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
