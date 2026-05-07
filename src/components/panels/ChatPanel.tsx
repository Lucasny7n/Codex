import { formatDateTime } from '../../lib/format';
import type { AgentSession, ChatMessage, ChatRole } from '../../types/domain';

interface ChatPanelProps {
  session?: AgentSession;
  onOpenEnvironment?: () => void;
}

interface ParsedProviderError {
  title: string;
  message: string;
  status?: string;
  provider?: string;
  model?: string;
  technical?: string;
}

function roleLabel(role: ChatRole): string {
  if (role === 'assistant') return 'Agente';
  if (role === 'user') return 'Você';
  if (role === 'tool') return 'Ferramenta';
  return 'Sistema';
}

function firstMatch(content: string, pattern: RegExp): string | undefined {
  const match = content.match(pattern);
  return match?.[1]?.trim();
}

function errorCopyForStatus(status?: string): Pick<ParsedProviderError, 'title' | 'message'> | undefined {
  if (status === '401') {
    return {
      title: 'API key inválida',
      message: 'Troque a chave ou selecione outra conta.',
    };
  }
  if (status === '403') {
    return {
      title: 'Permissão negada',
      message: 'A conta não tem acesso a este modelo ou recurso.',
    };
  }
  if (status === '429') {
    return {
      title: 'Cota ou limite atingido',
      message: 'Troque a conta, aguarde alguns minutos ou selecione outro modelo.',
    };
  }
  if (status && Number(status) >= 500) {
    return {
      title: 'Provider instável',
      message: 'O serviço respondeu com erro temporário.',
    };
  }
  return undefined;
}

function parseProviderError(message: ChatMessage): ParsedProviderError | undefined {
  if (message.role !== 'assistant') return undefined;
  const content = message.content.trim();
  const status = firstMatch(content, /(?:HTTP|Status:)\s*(\d{3})/i);
  const provider = firstMatch(content, /Provider:\s*([^\n]+)/i);
  const model = firstMatch(content, /Modelo:\s*([^\n]+)/i);
  const explicitProviderFailure = /provider|api key|cota|quota|rate limit|permissão negada|unauthorized|forbidden/i.test(content);
  if (!status && !explicitProviderFailure) return undefined;

  const statusCopy = errorCopyForStatus(status);
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(Status|Provider|Modelo):/i.test(line))
    .filter((line) => !line.startsWith('{') && !line.startsWith('['));
  const title = statusCopy?.title ?? lines[0] ?? 'Erro de provider';
  const body = statusCopy?.message ?? lines.slice(1).find((line) => !/^Detalhe:/i.test(line)) ?? 'Revise a conta ou o modelo no Ambiente.';

  return {
    title,
    message: body,
    status,
    provider,
    model,
    technical: [status ? `Status: ${status}` : undefined, provider ? `Provider: ${provider}` : undefined, model ? `Modelo: ${model}` : undefined]
      .filter(Boolean)
      .join('\n'),
  };
}

function ProviderErrorCard({ error, onOpenEnvironment }: { error: ParsedProviderError; onOpenEnvironment?: () => void }): JSX.Element {
  return (
    <div className="provider-error-card" role="alert">
      <strong>{error.title}</strong>
      <p>{error.message}</p>
      <div className="provider-error-actions">
        <button type="button" className="btn-modern btn-modern-primary" onClick={onOpenEnvironment} disabled={!onOpenEnvironment}>
          Trocar conta
        </button>
        <button type="button" className="btn-modern" onClick={onOpenEnvironment} disabled={!onOpenEnvironment}>
          Trocar modelo
        </button>
      </div>
      {error.technical ? (
        <details className="provider-error-details">
          <summary>Detalhes técnicos</summary>
          <pre>{error.technical}</pre>
        </details>
      ) : null}
    </div>
  );
}

export function ChatPanel({ session, onOpenEnvironment }: ChatPanelProps): JSX.Element {
  if (!session) {
    return (
      <section className="panel-chat-empty">
        <div className="home-hero">
          <h1>Pronto para criar algo?</h1>
        </div>
      </section>
    );
  }

  return (
    <section className="panel-chat">
      <div className="chat-messages scroll-y">
        {session.messages.length === 0 ? (
          <div className="empty-state empty-state-inline">
            <strong>Conversa vazia</strong>
            <span>Envie a primeira mensagem pelo campo abaixo.</span>
          </div>
        ) : null}
        {session.messages.map((message) => {
          const providerError = parseProviderError(message);
          return (
            <article key={message.id} className={`message-bubble role-${message.role}`}>
              <div className="message-meta">
                <span className="message-sender">{roleLabel(message.role)}</span>
                <span className="text-xs muted">{formatDateTime(message.createdAt)}</span>
              </div>
              {providerError ? (
                <ProviderErrorCard error={providerError} onOpenEnvironment={onOpenEnvironment} />
              ) : (
                <div className="message-content">{message.content}</div>
              )}
              {message.reasoningSummary && !providerError ? (
                <div className="reasoning-box">
                  <header>Justificativa técnica</header>
                  <div className="reasoning-content">{message.reasoningSummary}</div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
