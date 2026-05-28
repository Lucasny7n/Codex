import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AgentSession, ChatMessage } from '../../types/domain';
import { UiIcon } from '../common/AppIcons';
import { PopupMenu } from '../common/PremiumUI';
import { fileIconNameForKind, formatFileSize } from '../file/fileDisplay';
import { getTtsStatus, speakText, stopSpeech } from '../../lib/api';
import type { ChatAttachment } from '../../types/domain';

interface ChatPanelProps {
  session?: AgentSession;
  emptyTitle?: string;
  onOpenEnvironment?: () => void;
  onChangeModel?: () => void;
  onChangeAccount?: () => void;
  onRedoMessage?: (messageId: string) => Promise<void>;
  isResponding?: boolean;
  onToast?: (tone: 'success' | 'error' | 'info', message: string) => void;
}

interface ParsedProviderError {
  title: string;
  message: string;
  status?: string;
  provider?: string;
  model?: string;
  requestId?: string;
  technical?: string;
}

function firstMatch(content: string, pattern: RegExp): string | undefined {
  const match = content.match(pattern);
  return match?.[1]?.trim();
}

/** Removes API keys, bearer tokens, JWTs and key=value secrets before showing
 *  any original error text to the user. Never let a secret reach the UI. */
function maskSecrets(text: string): string {
  return text
    .replace(/\bsk-[A-Za-z0-9_-]{6,}/g, 'sk-***')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer ***')
    .replace(/\beyJ[A-Za-z0-9._-]{10,}/g, '***token***')
    .replace(/\b([A-Za-z0-9_-]*(?:api[_-]?key|token|secret|authorization|password))\b\s*[:=]\s*["']?[^"'\s,}]{4,}/gi, '$1=***')
    .replace(/\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET))\s*=\s*[^\s]+/g, '$1=***');
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
  if (status === '404') {
    return {
      title: 'Modelo indisponível',
      message: 'O modelo não existe neste provider. Escolha outro modelo.',
    };
  }
  if (status === '429') {
    return {
      title: 'Limite ou crédito insuficiente',
      message: 'Cota excedida nesta conta. Troque a conta, o provider ou aguarde o reset.',
    };
  }
  if (status && Number(status) >= 500) {
    return {
      title: 'Erro temporário do provider',
      message: 'O serviço respondeu com erro temporário. Tente novamente em instantes.',
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

  const requestId = firstMatch(content, /request[_-]?id["':\s]+([A-Za-z0-9-]{6,})/i);
  const statusCopy = errorCopyForStatus(status);
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(Status|Provider|Modelo):/i.test(line))
    .filter((line) => !line.startsWith('{') && !line.startsWith('['));
  const title = statusCopy?.title ?? lines[0] ?? 'Erro de provider';
  const body = statusCopy?.message ?? lines.slice(1).find((line) => !/^Detalhe:/i.test(line)) ?? 'Verifique a conta ou escolha outro modelo.';

  // Original message, sanitized (secrets stripped), capped for the details block.
  const original = maskSecrets(content).slice(0, 600);

  return {
    title,
    message: body,
    status,
    provider,
    model,
    requestId,
    technical: [
      status ? `Status HTTP: ${status}` : undefined,
      provider ? `Provider: ${provider}` : undefined,
      model ? `Modelo: ${model}` : undefined,
      requestId ? `Request ID: ${requestId}` : undefined,
      original ? `Mensagem original (sanitizada):\n${original}` : undefined,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

/** Detects the backend's fallback note (recorded in reasoningSummary) so the
 *  chat can show a discreet "respondido com fallback" line. */
function parseFallbackNotice(message: ChatMessage): string | undefined {
  if (message.role !== 'assistant') return undefined;
  const summary = message.reasoningSummary ?? '';
  if (!/fallback/i.test(summary)) return undefined;
  const target = firstMatch(summary, /fallback:\s*([A-Za-z0-9/:@_-]+(?:\.[A-Za-z0-9/:@_-]+)*)/i);
  return target
    ? `Modelo principal falhou; respondido com fallback ${maskSecrets(target.trim())}.`
    : 'Modelo principal falhou; respondido com um modelo de fallback.';
}

function ProviderErrorCard({ error, onChangeModel, onChangeAccount }: {
  error: ParsedProviderError;
  onChangeModel?: () => void;
  onChangeAccount?: () => void;
}): JSX.Element {
  const usedLine = error.provider || error.model
    ? [error.model, error.provider ? `via ${error.provider}` : undefined].filter(Boolean).join(' ')
    : undefined;
  return (
    <div className="provider-error-card" role="alert">
      <strong>{error.title}</strong>
      {usedLine ? <span className="provider-error-used">{usedLine}</span> : null}
      <p>{error.message}</p>
      <div className="provider-error-actions">
        <button type="button" className="btn-modern btn-modern-primary" onClick={onChangeModel} disabled={!onChangeModel}>
          Trocar modelo
        </button>
        <button type="button" className="btn-modern" onClick={onChangeAccount} disabled={!onChangeAccount}>
          Trocar conta
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
      const level = heading[1].length;
      const headingContent = renderInlineMarkdown(heading[2], `h-${blocks.length}`);
      if (level === 1) blocks.push(<h1 key={`h-${blocks.length}`}>{headingContent}</h1>);
      else if (level === 2) blocks.push(<h2 key={`h-${blocks.length}`}>{headingContent}</h2>);
      else blocks.push(<h3 key={`h-${blocks.length}`}>{headingContent}</h3>);
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

function attachmentReadStatus(attachment: ChatAttachment): { label: string; cls: string } {
  if (attachment.contextText) return { label: 'incluído', cls: 'status-included' };
  if (attachment.previewAvailable) return { label: 'lido', cls: 'status-read' };
  return { label: 'anexado', cls: 'status-attached' };
}

function AttachmentChip({ attachment, messageId }: { attachment: ChatAttachment; messageId: string }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const preview = attachment.previewTextLimited;
  const canExpand = Boolean(preview);
  const readStatus = attachmentReadStatus(attachment);

  return (
    <span className="message-attachment-chip" key={`${messageId}-${attachment.path}`}>
      <span
        className="message-attachment-chip-inner"
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
        onClick={canExpand ? () => setExpanded((v) => !v) : undefined}
        onKeyDown={canExpand ? (e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v); } : undefined}
        title={canExpand ? 'Clique para ver prévia' : attachment.path}
      >
        <UiIcon name={fileIconNameForKind(attachment.kind)} className="message-attachment-icon" />
        <strong>{attachment.name}</strong>
        <small>{[attachment.kind, formatFileSize(attachment.size)].filter(Boolean).join(' · ')}</small>
        {readStatus ? <span className={`attachment-status-badge ${readStatus.cls}`}>{readStatus.label}</span> : null}
      </span>
      {expanded && preview ? (
        <div className="attachment-preview-detail" role="region" aria-label="Prévia do arquivo">
          <pre>{preview}</pre>
        </div>
      ) : null}
    </span>
  );
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

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/gu, '')
    .replace(/`[^`]*`/gu, '')
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/[*_~]+/gu, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\n{2,}/gu, '. ')
    .replace(/\n/gu, ' ')
    .trim();
}

export function ChatPanel({ session, emptyTitle = 'O que gostaria de explorar?', onOpenEnvironment, onChangeModel, onChangeAccount, onRedoMessage, isResponding = false, onToast }: ChatPanelProps): JSX.Element {
  const [menuMessageId, setMenuMessageId] = useState<string>();
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [dislikedIds, setDislikedIds] = useState<Set<string>>(new Set());
  const [speakingId, setSpeakingId] = useState<string>();
  // Web Speech is detectable synchronously; undefined means "probe the backend".
  const [ttsAvailable, setTtsAvailable] = useState<boolean | undefined>(() => {
    const hasWebSpeech = typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof window.SpeechSynthesisUtterance !== 'undefined';
    return hasWebSpeech ? true : undefined;
  });
  const [ttsHint, setTtsHint] = useState<string | undefined>(undefined);
  // Tracks whether the active speech is using the backend engine (vs Web Speech).
  const backendSpeakingRef = useRef(false);

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

  const toggleLike = useCallback((id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setDislikedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const toggleDislike = useCallback((id: string) => {
    setDislikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setLikedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  // When Web Speech is absent (common in the Tauri/Linux WebView), probe the
  // local backend engine (spd-say/espeak-ng) once.
  useEffect(() => {
    if (ttsAvailable !== undefined) return undefined;
    let active = true;
    void getTtsStatus().then((status) => {
      if (!active) return;
      setTtsHint(status.installHint);
      setTtsAvailable(status.available);
    }).catch(() => {
      if (active) setTtsAvailable(false);
    });
    return () => { active = false; };
  }, [ttsAvailable]);

  const stopSpeaking = useCallback(() => {
    if (backendSpeakingRef.current) {
      void stopSpeech();
      backendSpeakingRef.current = false;
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(undefined);
  }, []);

  const speakMessage = useCallback((message: ChatMessage) => {
    if (speakingId === message.id) {
      stopSpeaking();
      return;
    }
    const text = stripMarkdownForSpeech(cleanVisibleContent(message.content));
    if (!text.trim()) return;

    const hasWebSpeech = typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof window.SpeechSynthesisUtterance !== 'undefined';

    if (hasWebSpeech) {
      window.speechSynthesis.cancel();
      backendSpeakingRef.current = false;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.0;
      utterance.onend = () => setSpeakingId((current) => current === message.id ? undefined : current);
      utterance.onerror = (event) => {
        setSpeakingId((current) => current === message.id ? undefined : current);
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          onToast?.('error', 'Não foi possível ler em voz alta neste ambiente.');
        }
      };
      setSpeakingId(message.id);
      window.speechSynthesis.speak(utterance);
      return;
    }

    // Backend fallback (Linux): spd-say / espeak-ng.
    setSpeakingId(message.id);
    void speakText(text, 'pt-BR').then((status) => {
      if (status.available && status.engine) {
        backendSpeakingRef.current = true;
      } else {
        setSpeakingId((current) => current === message.id ? undefined : current);
        setTtsAvailable(false);
        setTtsHint(status.installHint);
        onToast?.('info', status.installHint
          ? `Voz indisponível. ${status.installHint}`
          : 'Nenhuma engine de voz local encontrada.');
      }
    }).catch(() => {
      setSpeakingId((current) => current === message.id ? undefined : current);
      onToast?.('error', 'Falha ao iniciar a leitura por voz.');
    });
  }, [speakingId, stopSpeaking, onToast]);

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
          const fallbackNotice = providerError ? undefined : parseFallbackNotice(message);
          return (
            <div key={message.id} className={`message-row ${message.role}`}>
              <article className={`message-bubble role-${message.role}`}>
                {providerError ? (
                  <ProviderErrorCard error={providerError} onChangeModel={onChangeModel ?? onOpenEnvironment} onChangeAccount={onChangeAccount ?? onOpenEnvironment} />
                ) : (
                  <MarkdownContent content={cleanVisibleContent(message.content)} />
                )}
                {fallbackNotice ? (
                  <span className="fallback-notice" role="status">⚠ {fallbackNotice}</span>
                ) : null}
                {message.attachments?.filter((a) => !a.hidden && (a.contextSource == null || a.contextSource === 'document')).length ? (
                  <div className="message-attachment-list" aria-label="Anexos da mensagem">
                    {message.attachments.filter((a) => !a.hidden && (a.contextSource == null || a.contextSource === 'document')).map((attachment) => (
                      <AttachmentChip
                        key={`${message.id}-${attachment.path}`}
                        attachment={attachment}
                        messageId={message.id}
                      />
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' ? (
                  <div className="message-actions" aria-label="Ações da resposta">
                    {copiedMessageId === message.id ? <span className="message-action-chip">Copiado</span> : null}
                    <button type="button" className="message-action-button" aria-label="Copiar resposta" onClick={() => void copyMessage(message)}>
                      <UiIcon name="copy" />
                    </button>
                    <button
                      type="button"
                      className={`message-action-button${likedIds.has(message.id) ? ' message-action-active' : ''}`}
                      aria-label={likedIds.has(message.id) ? 'Remover curtida' : 'Curtir resposta'}
                      aria-pressed={likedIds.has(message.id)}
                      onClick={() => toggleLike(message.id)}
                    >
                      <UiIcon name="heart" />
                    </button>
                    <button
                      type="button"
                      className={`message-action-button${dislikedIds.has(message.id) ? ' message-action-active message-action-dislike' : ''}`}
                      aria-label={dislikedIds.has(message.id) ? 'Remover avaliação negativa' : 'Não gostei da resposta'}
                      aria-pressed={dislikedIds.has(message.id)}
                      onClick={() => toggleDislike(message.id)}
                    >
                      <UiIcon name="x" />
                    </button>
                    <button
                      type="button"
                      className={`message-action-button${speakingId === message.id ? ' message-action-active' : ''}`}
                      aria-label={speakingId === message.id ? 'Parar leitura' : 'Ouvir resposta'}
                      aria-pressed={speakingId === message.id}
                      disabled={ttsAvailable === false}
                      title={ttsAvailable === false ? (ttsHint ?? 'Voz indisponível neste ambiente') : undefined}
                      onClick={() => speakMessage(message)}
                    >
                      <UiIcon name="music" />
                    </button>
                    {onRedoMessage ? (
                      <button
                        type="button"
                        className="message-action-button"
                        aria-label="Refazer resposta"
                        disabled={isResponding}
                        onClick={() => void onRedoMessage(message.id)}
                      >
                        <UiIcon name="refresh" />
                      </button>
                    ) : null}
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
                        <button type="button" onClick={() => { setMenuMessageId(undefined); speakMessage(message); }}>
                          {speakingId === message.id ? 'Parar leitura' : 'Ouvir'}
                        </button>
                        {onRedoMessage ? (
                          <button type="button" disabled={isResponding} onClick={() => { setMenuMessageId(undefined); void onRedoMessage(message.id); }}>
                            Refazer resposta
                          </button>
                        ) : null}
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
