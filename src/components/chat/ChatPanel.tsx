import { useState, type ReactNode } from 'react';
import type { AgentSession, ChatMessage } from '../../types/domain';
import { UiIcon } from '../common/AppIcons';
import { PopupMenu } from '../common/PremiumUI';
import { fileIconNameForKind, formatFileSize } from '../file/fileDisplay';

interface ChatPanelProps {
  session?: AgentSession;
  emptyTitle?: string;
  onOpenEnvironment?: () => void;
  isResponding?: boolean;
}

interface ParsedProviderError {
  title: string;
  message: string;
  status?: string;
  provider?: string;
  model?: string;
  technical?: string;
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
      message: 'Cota excedida nesta conta. Troque a conta, o provider ou aguarde o reset.',
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

function cleanVisibleContent(content: string): string {
  const visible = content
    .split('\n')
    .filter((line) => !/^\s*(JUSTIFICATIVA T[ÉE]CNICA|Resposta local conclu[ií]da(?: pela API HTTP)?|Payload|Stack trace)\b/i.test(line))
    .join('\n')
    .trim();
  return visible || 'Concluído.';
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
  const body = statusCopy?.message ?? lines.slice(1).find((line) => !/^Detalhe:/i.test(line)) ?? 'Revise a conta ou o modelo em Configurações.';

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

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /`([^`]+)`/gu;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(<code key={`${keyPrefix}-${match.index}`}>{match[1]}</code>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length ? nodes : [text];
}

function MarkdownContent({ content }: { content: string }): JSX.Element {
  const blocks: ReactNode[] = [];
  const paragraph: string[] = [];
  const bullets: string[] = [];
  const codeLines: string[] = [];
  let inCode = false;

  function flushParagraph(): void {
    if (!paragraph.length) return;
    const text = paragraph.join(' ');
    blocks.push(<p key={`p-${blocks.length}`}>{renderInlineMarkdown(text, `p-${blocks.length}`)}</p>);
    paragraph.length = 0;
  }

  function flushBullets(): void {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {bullets.map((item, index) => (
          <li key={`${index}-${item}`}>{renderInlineMarkdown(item, `li-${blocks.length}-${index}`)}</li>
        ))}
      </ul>,
    );
    bullets.length = 0;
  }

  function flushCode(): void {
    if (!codeLines.length) return;
    blocks.push(
      <pre key={`code-${blocks.length}`}>
        <code>{codeLines.join('\n')}</code>
      </pre>,
    );
    codeLines.length = 0;
  }

  for (const line of content.split('\n')) {
    if (/^\s*```/u.test(line)) {
      if (inCode) flushCode();
      else {
        flushParagraph();
        flushBullets();
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushBullets();
      continue;
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/u);
    if (heading) {
      flushParagraph();
      flushBullets();
      blocks.push(<h3 key={`h-${blocks.length}`}>{renderInlineMarkdown(heading[2], `h-${blocks.length}`)}</h3>);
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/u);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushBullets();
  flushCode();

  return <div className="message-content message-markdown">{blocks.length ? blocks : content}</div>;
}

function AssistantTypingIndicator(): JSX.Element {
  return (
    <div className="message-row assistant typing-row" aria-label="Assistente respondendo">
      <article className="message-bubble role-assistant typing-bubble">
        <div className="typing-dots" role="status" aria-live="polite">
          <span />
          <span />
          <span />
        </div>
      </article>
    </div>
  );
}

export function ChatPanel({ session, emptyTitle = 'O que gostaria de explorar?', onOpenEnvironment, isResponding = false }: ChatPanelProps): JSX.Element {
  const [menuMessageId, setMenuMessageId] = useState<string>();
  const [copiedMessageId, setCopiedMessageId] = useState<string>();

  async function copyMessage(message: ChatMessage): Promise<void> {
    const content = cleanVisibleContent(message.content);
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? undefined : current), 1600);
    } catch {
      setCopiedMessageId(undefined);
    }
  }

  if (!session) {
    return (
      <section className="panel-chat-empty">
        <div className="home-hero">
          <h1>{emptyTitle}</h1>
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
            <div key={message.id} className={`message-row ${message.role}`}>
              <article className={`message-bubble role-${message.role}`}>
                {providerError ? (
                  <ProviderErrorCard error={providerError} onOpenEnvironment={onOpenEnvironment} />
                ) : (
                  <MarkdownContent content={cleanVisibleContent(message.content)} />
                )}
                {message.attachments?.filter((attachment) => !attachment.hidden).length ? (
                  <div className="message-attachment-list" aria-label="Anexos da mensagem">
                    {message.attachments.filter((attachment) => !attachment.hidden).map((attachment) => (
                      <span key={`${message.id}-${attachment.path}`} className="message-attachment-chip" title={attachment.path}>
                        <UiIcon name={fileIconNameForKind(attachment.kind)} className="message-attachment-icon" />
                        <strong>{attachment.name}</strong>
                        <small>{[attachment.kind, formatFileSize(attachment.size)].filter(Boolean).join(' · ')}</small>
                      </span>
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' ? (
                  <div className="message-actions" aria-label="Ações da resposta">
                    {copiedMessageId === message.id ? <span className="message-action-chip">Copiado</span> : null}
                    <button type="button" className="message-action-button" aria-label="Copiar resposta" onClick={() => void copyMessage(message)}>
                      <UiIcon name="copy" />
                    </button>
                    <button type="button" className="message-action-button" aria-label="Curtir resposta">
                      <UiIcon name="heart" />
                    </button>
                    <button type="button" className="message-action-button" aria-label="Não gostei da resposta">
                      <UiIcon name="x" />
                    </button>
                    <button type="button" className="message-action-button" aria-label="Compartilhar resposta">
                      <UiIcon name="send" />
                    </button>
                    <button type="button" className="message-action-button" aria-label="Refazer resposta">
                      <UiIcon name="refresh" />
                    </button>
                    <div className="popup-anchor">
                      <button
                        type="button"
                        className="message-action-button"
                        aria-label="Mais ações da resposta"
                        onClick={() => setMenuMessageId((current) => current === message.id ? undefined : message.id)}
                      >
                        <UiIcon name="more" />
                      </button>
                      <PopupMenu open={menuMessageId === message.id} onClose={() => setMenuMessageId(undefined)} placement="auto">
                        <button type="button" onClick={() => { setMenuMessageId(undefined); void copyMessage(message); }}>
                          Copiar
                        </button>
                        <button type="button" disabled>
                          Compartilhar
                        </button>
                        <button type="button" disabled>
                          Refazer resposta
                        </button>
                        <button type="button" disabled>
                          Mais opções
                        </button>
                      </PopupMenu>
                    </div>
                  </div>
                ) : null}
              </article>
            </div>
          );
        })}
        {isResponding ? <AssistantTypingIndicator /> : null}
      </div>
    </section>
  );
}
