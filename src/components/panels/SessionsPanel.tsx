import { useMemo, useState } from 'react';
import { PopupMenu } from '../common/PremiumUI';
import type { AgentSession } from '../../types/domain';

interface SessionsPanelProps {
  sessions: AgentSession[];
  selectedSessionId?: string;
  onNewSession: () => void;
  onSelect: (id?: string) => void;
  onRename: (session: AgentSession) => void;
  onDelete: (session: AgentSession) => void;
  onExport: (session: AgentSession, format: 'markdown' | 'json' | 'txt') => void;
  onDuplicate: (session: AgentSession) => void;
  onInfo: (session: AgentSession) => void;
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
  const [query, setQuery] = useState('');
  const [menuSessionId, setMenuSessionId] = useState<string>();
  const [exportMenuSessionId, setExportMenuSessionId] = useState<string>();
  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => session.title.toLowerCase().includes(normalized));
  }, [query, sessions]);

  const visibleSessions = filteredSessions.slice(0, 7);

  return (
    <section className="qwen-sidebar" aria-label="Conversas">
      <header className="qwen-sidebar-top">
        <button type="button" className="qwen-logo-button" onClick={() => onSelect(undefined)} aria-label="Início">
          <span className="qwen-logo-mark" aria-hidden="true">◆</span>
          <span>Codex</span>
        </button>
        <button type="button" className="qwen-collapse-button" aria-label="Recolher sidebar">
          ◧
        </button>
      </header>

      <nav className="qwen-primary-nav" aria-label="Navegação">
        <button type="button" onClick={() => onNewSession()}>
          <span aria-hidden="true">+</span>
          Nova Conversa
        </button>
        <label className="qwen-search-row">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            placeholder="Pesquisar Conversas"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="button">
          <span aria-hidden="true">⊞</span>
          Comunidade
        </button>
        <button type="button">
          <span aria-hidden="true">◎</span>
          Coder
        </button>
      </nav>

      <div className="qwen-projects">
        <button type="button" className="qwen-projects-title">
          <span>Projetos</span>
          <span aria-hidden="true">⌄</span>
        </button>
        <button type="button" className="qwen-project-action">
          <span aria-hidden="true">▣</span>
          Novo Projeto
        </button>
        <div className="qwen-project-group">
          <button type="button" className="qwen-project-name" onClick={() => onSelect(undefined)}>
            <span aria-hidden="true">▢</span>
            Lucas
          </button>
          <div className="qwen-session-list">
            {visibleSessions.map((session) => (
              <article key={session.id} className={`qwen-session-item ${selectedSessionId === session.id ? 'active' : ''}`}>
                <button type="button" className="qwen-session-select" onClick={() => onSelect(session.id)}>
                  <span>{session.title}</span>
                  <small>{shortDate(session.updatedAt)}</small>
                </button>
                <div className="popup-anchor">
                  <button
                    type="button"
                    className="qwen-session-menu"
                    aria-label={`Ações da sessão ${session.title}`}
                    onClick={() => setMenuSessionId((current) => current === session.id ? undefined : session.id)}
                  >
                    ⋮
                  </button>
                  <PopupMenu open={menuSessionId === session.id} onClose={() => setMenuSessionId(undefined)}>
                    <button type="button" onClick={() => { setMenuSessionId(undefined); onInfo(session); }}>
                      Informações
                    </button>
                    <button type="button" onClick={() => { setMenuSessionId(undefined); onRename(session); }}>
                      Renomear
                    </button>
                    <button type="button" onClick={() => { setMenuSessionId(undefined); onDuplicate(session); }}>
                      Duplicar
                    </button>
                    <button type="button" onClick={() => setExportMenuSessionId((current) => current === session.id ? undefined : session.id)}>
                      Exportar
                    </button>
                    {exportMenuSessionId === session.id ? (
                      <div className="popup-submenu" role="group" aria-label="Formatos de exportação">
                        <button type="button" onClick={() => { setMenuSessionId(undefined); setExportMenuSessionId(undefined); onExport(session, 'markdown'); }}>
                          Markdown .md
                        </button>
                        <button type="button" onClick={() => { setMenuSessionId(undefined); setExportMenuSessionId(undefined); onExport(session, 'json'); }}>
                          JSON .json
                        </button>
                        <button type="button" onClick={() => { setMenuSessionId(undefined); setExportMenuSessionId(undefined); onExport(session, 'txt'); }}>
                          Texto .txt
                        </button>
                      </div>
                    ) : null}
                    <button type="button" className="danger" onClick={() => { setMenuSessionId(undefined); onDelete(session); }}>
                      Excluir
                    </button>
                  </PopupMenu>
                </div>
              </article>
            ))}
          </div>
          {sessions.length > visibleSessions.length ? (
            <button type="button" className="qwen-view-all" onClick={() => onSelect(undefined)}>
              Ver Tudo
            </button>
          ) : null}
        </div>
      </div>

      <footer className="qwen-sidebar-footer" title="Workspace local">
        <span className="qwen-avatar" aria-hidden="true">L</span>
        <span>Lucas</span>
      </footer>
    </section>
  );
}
