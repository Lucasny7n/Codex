import { useMemo, useState } from 'react';
import { UiIcon } from '../common/AppIcons';
import { ConfirmDialog, PremiumModal } from '../common/PremiumUI';
import type { AgentSession } from '../../types/domain';

interface ArchivedConversationsModalProps {
  open: boolean;
  sessions: AgentSession[];
  loading: boolean;
  error?: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onRestore: (session: AgentSession) => Promise<void>;
  onDelete: (session: AgentSession) => Promise<void>;
}

function formatSessionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function ArchivedConversationsModal({
  open,
  sessions,
  loading,
  error,
  onClose,
  onRefresh,
  onRestore,
  onDelete,
}: ArchivedConversationsModalProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string>();
  const [deleteTarget, setDeleteTarget] = useState<AgentSession>();
  const [inlineError, setInlineError] = useState<string>();
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => {
      const haystack = [
        session.title,
        session.messages.at(-1)?.content,
        session.updatedAt,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, sessions]);

  async function runAction(session: AgentSession, action: 'restore' | 'delete'): Promise<void> {
    setInlineError(undefined);
    setBusyId(session.id);
    try {
      if (action === 'restore') {
        await onRestore(session);
      } else {
        await onDelete(session);
      }
      setDeleteTarget(undefined);
    } catch (cause) {
      setInlineError(cause instanceof Error ? cause.message : 'Ação não concluída.');
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <>
      <PremiumModal
        open={open}
        title="Conversas arquivadas"
        description="Histórico removido da lista principal, sem misturar com conversas ativas."
        onClose={onClose}
        className="archived-modal"
      >
        <section className="archived-shell">
          <header className="archived-toolbar">
            <label className="archived-search">
              <UiIcon name="search" className="archived-search-icon" />
              <input
                value={query}
                placeholder="Buscar conversa arquivada"
                aria-label="Buscar conversa arquivada"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button type="button" className="btn-modern" disabled={loading} onClick={() => void onRefresh()}>
              <UiIcon name="refresh" className="menu-icon" />
              Atualizar
            </button>
          </header>

          {error ? <div className="input-error-tip" role="alert">{error}</div> : null}
          {inlineError ? <div className="input-error-tip" role="alert">{inlineError}</div> : null}

          <div className="archived-list" aria-label="Lista de conversas arquivadas">
            {loading ? <div className="archived-empty">Carregando conversas arquivadas...</div> : null}
            {!loading && filtered.length === 0 ? (
              <div className="archived-empty">
                <strong>Nenhuma conversa arquivada</strong>
                <span>{query ? 'A busca não encontrou itens arquivados.' : 'Quando uma conversa for arquivada, ela aparecerá aqui.'}</span>
              </div>
            ) : null}
            {!loading ? filtered.map((session) => (
              <article key={session.id} className="archived-row">
                <div className="archived-row-main">
                  <UiIcon name="archive" className="archived-row-icon" />
                  <span>
                    <strong>{session.title}</strong>
                    <small>{formatSessionDate(session.updatedAt || session.createdAt)} · {session.messages.length} mensagem(ns)</small>
                  </span>
                </div>
                <div className="archived-row-actions">
                  <button
                    type="button"
                    className="btn-modern"
                    disabled={busyId === session.id}
                    onClick={() => void runAction(session, 'restore')}
                  >
                    Restaurar
                  </button>
                  <button
                    type="button"
                    className="btn-modern btn-danger"
                    disabled={busyId === session.id}
                    onClick={() => setDeleteTarget(session)}
                  >
                    Excluir definitivamente
                  </button>
                </div>
              </article>
            )) : null}
          </div>
        </section>
      </PremiumModal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir definitivamente?"
        message={`A conversa "${deleteTarget?.title ?? ''}" será removida do disco e não aparecerá em backups futuros.`}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeleteTarget(undefined)}
        onConfirm={() => deleteTarget ? void runAction(deleteTarget, 'delete') : undefined}
      />
    </>
  );
}
