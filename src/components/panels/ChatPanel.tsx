import { Badge } from '../common/Badge';
import { formatDateTime } from '../../lib/format';
import type { AgentSession } from '../../types/domain';

interface ChatPanelProps {
  session?: AgentSession;
}

export function ChatPanel({ session }: ChatPanelProps): JSX.Element {
  if (!session) {
    return (
      <section className="panel-chat-empty">
        <div className="muted">Nenhuma sessão selecionada.</div>
      </section>
    );
  }

  return (
    <section className="panel-chat">
      <header className="chat-header-modern">
        <div className="agent-identity">
          <div className="agent-avatar">C</div>
          <div>
            <h3>Codex Agent</h3>
            <div className="agent-status-row">
              <span className={`status-dot ${session.status}`} />
              <span className="text-xs muted">{session.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
        <Badge tone="neutral">{session.messages.length} mensagens</Badge>
      </header>

      <div className="chat-messages scroll-y">
        {session.messages.map((message) => (
          <article key={message.id} className={`message-bubble role-${message.role}`}>
            <div className="message-meta">
              <span className="message-sender">{message.role === 'assistant' ? 'Codex' : 'Você'}</span>
              <span className="text-xs muted">{formatDateTime(message.createdAt)}</span>
            </div>
            <div className="message-content">{message.content}</div>
            {message.reasoningSummary && (
              <div className="reasoning-box">
                <header>Justificativa Técnica</header>
                <div className="reasoning-content">{message.reasoningSummary}</div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

