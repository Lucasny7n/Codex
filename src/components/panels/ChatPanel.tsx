import { Badge } from '../common/Badge';
import { formatDateTime } from '../../lib/format';
import type { AgentSession, ChatRole, SessionStatus } from '../../types/domain';

interface ChatPanelProps {
  session?: AgentSession;
}

function roleLabel(role: ChatRole): string {
  if (role === 'assistant') return 'Agente';
  if (role === 'user') return 'Você';
  if (role === 'tool') return 'Ferramenta';
  return 'Sistema';
}

function statusTone(status: SessionStatus): 'neutral' | 'info' | 'warn' | 'danger' | 'ok' {
  if (status === 'error') return 'danger';
  if (status === 'waiting_approval') return 'warn';
  if (status === 'executing' || status === 'planning' || status === 'diagnosing') return 'info';
  return 'ok';
}

export function ChatPanel({ session }: ChatPanelProps): JSX.Element {
  if (!session) {
    return (
      <section className="panel-chat-empty">
        <div className="empty-state">
          <strong>Nova conversa</strong>
          <span>A sessão será salva somente depois da primeira mensagem.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="panel-chat">
      <header className="chat-header-modern">
        <div className="agent-identity">
          <div className="agent-avatar">AI</div>
          <div>
            <h3>Agente Local</h3>
            <div className="agent-status-row">
              <span className={`status-dot ${session.status}`} />
              <span className="text-xs muted">{session.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
        <div className="chat-header-badges">
          <Badge tone={statusTone(session.status)}>{session.status}</Badge>
          <Badge tone="neutral">{session.messages.length} mensagens</Badge>
        </div>
      </header>

      <div className="chat-messages scroll-y">
        {session.messages.length === 0 ? (
          <div className="empty-state empty-state-inline">
            <strong>Histórico vazio</strong>
            <span>A conversa desta sessão aparecerá aqui.</span>
          </div>
        ) : null}
        {session.messages.map((message) => (
          <article key={message.id} className={`message-bubble role-${message.role}`}>
            <div className="message-meta">
              <span className="message-sender">{roleLabel(message.role)}</span>
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
