import { useMemo, useState } from 'react';
import { UiIcon, type UiIconName } from '../common/AppIcons';
import { PopupMenu } from '../common/PremiumUI';
import type { AgentSession } from '../../types/domain';
import type { SettingsTab } from '../settings/SettingsPanel';
import appLogo from '../../assets/app-logo.svg';

type SessionMenuAction =
  | 'pin'
  | 'archive'
  | 'move-to-project'
  | 'remove-from-project';

interface SessionsPanelProps {
  sessions: AgentSession[];
  projects: string[];
  projectAppearance?: Record<string, { icon?: UiIconName; color?: string }>;
  projectSessions?: Record<string, AgentSession[]>;
  activeProject?: string;
  selectedSessionId?: string;
  onNewSession: () => void;
  onNewProject: () => void;
  onEditProject: (project: string) => void;
  onDeleteProject: (project: string) => void;
  onSelectProject: (project: string) => void;
  onToggleSidebar: () => void;
  onSelect: (id?: string) => void;
  onRename: (session: AgentSession, title: string) => void;
  onDelete: (session: AgentSession) => void;
  onExport: (session: AgentSession, format: 'markdown' | 'json' | 'txt') => void;
  onDuplicate: (session: AgentSession) => void;
  onSessionMenuAction: (session: AgentSession, action: SessionMenuAction) => void;
  onOpenSettings: (tab: SettingsTab) => void;
  onOpenArchivedConversations: () => void;
  onCloseSession: () => void;
  collapsed?: boolean;
}

function readLocalStorage(key: string): string | undefined {
  const storage = window.localStorage;
  if (!storage || typeof storage.getItem !== 'function') return undefined;
  try {
    return storage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeLocalStorage(key: string, value: string): void {
  const storage = window.localStorage;
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    storage.setItem(key, value);
  } catch {
    // Persistência visual não deve impedir o uso da sidebar.
  }
}

function removeLocalStorage(key: string): void {
  const storage = window.localStorage;
  if (!storage || typeof storage.removeItem !== 'function') return;
  try {
    storage.removeItem(key);
  } catch {
    // Limpeza de compatibilidade é opcional.
  }
}

function readSidebarStorage(key: string, legacyKey: string): string | undefined {
  const current = readLocalStorage(key);
  if (current !== undefined) return current;
  const legacy = readLocalStorage(legacyKey);
  if (legacy !== undefined) {
    writeLocalStorage(key, legacy);
    removeLocalStorage(legacyKey);
  }
  return legacy;
}

function FolderIcon({ compact = false }: { compact?: boolean }): JSX.Element {
  return <UiIcon name="folder" className={compact ? 'qwen-row-icon qwen-row-icon-compact' : 'qwen-row-icon'} />;
}

function NewProjectIcon(): JSX.Element {
  return <UiIcon name="folderPlus" className="qwen-row-icon" />;
}

function ChatIcon(): JSX.Element {
  return <UiIcon name="message" className="qwen-row-icon qwen-row-icon-compact" />;
}

function SidebarToggleIcon({ direction }: { direction: 'collapse' | 'expand' }): JSX.Element {
  return <UiIcon name={direction === 'collapse' ? 'chevronLeft' : 'chevronRight'} className="qwen-toggle-icon" />;
}

function isToday(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

type TimeBucket = 'today' | 'week' | 'month' | 'older';

const TIME_BUCKET_LABELS: Record<TimeBucket, string> = {
  today: 'Hoje',
  week: 'Últimos 7 dias',
  month: 'Últimos 30 dias',
  older: 'Anteriores',
};

function timeBucket(value: string): TimeBucket {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'older';
  if (isToday(value)) return 'today';
  const days = (Date.now() - date.getTime()) / 86_400_000;
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  return 'older';
}

export function SessionsPanel({
  sessions,
  projects,
  projectAppearance = {},
  projectSessions = {},
  activeProject,
  selectedSessionId,
  onNewSession,
  onNewProject,
  onEditProject,
  onDeleteProject,
  onSelectProject,
  onToggleSidebar,
  onSelect,
  onRename,
  onDelete,
  onExport,
  onDuplicate,
  onSessionMenuAction,
  onOpenSettings,
  onOpenArchivedConversations,
  onCloseSession,
  collapsed = false,
}: SessionsPanelProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [menuSessionId, setMenuSessionId] = useState<string>();
  const [menuProject, setMenuProject] = useState<string>();
  const [editingSessionId, setEditingSessionId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState('');
  const [projectsOpen, setProjectsOpen] = useState(() => readSidebarStorage('ailu-sidebar-projects-open', 'codex-sidebar-projects-open') === 'true');
  const [conversationsOpen, setConversationsOpen] = useState(() => readSidebarStorage('ailu-sidebar-conversations-open', 'codex-sidebar-conversations-open') === 'true');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => session.title.toLowerCase().includes(normalized));
  }, [query, sessions]);

  const visibleSessions = filteredSessions;
  const visibleProjects = projects.filter((project) => project.trim().length > 0);
  // Sessions shown nested under the active project must NOT also appear in the
  // flat "Todas as conversas" list — otherwise the same row (and its menu)
  // renders twice and the menus overlap, looking like duplicated items.
  const nestedSessionIds = useMemo(() => {
    const ids = new Set<string>();
    if (activeProject) {
      for (const session of projectSessions[activeProject] ?? []) ids.add(session.id);
    }
    return ids;
  }, [activeProject, projectSessions]);
  const flatSessions = useMemo(
    () => visibleSessions.filter((session) => !nestedSessionIds.has(session.id)),
    [visibleSessions, nestedSessionIds],
  );
  const groupedSessions = useMemo(() => {
    const groups: Array<{ bucket: TimeBucket; sessions: AgentSession[] }> = [
      { bucket: 'today', sessions: [] },
      { bucket: 'week', sessions: [] },
      { bucket: 'month', sessions: [] },
      { bucket: 'older', sessions: [] },
    ];
    const byBucket = new Map(groups.map((g) => [g.bucket, g.sessions]));
    for (const session of flatSessions) {
      byBucket.get(timeBucket(session.updatedAt || session.createdAt))?.push(session);
    }
    return groups.filter((g) => g.sessions.length > 0);
  }, [flatSessions]);

  function toggleProjects(): void {
    setProjectsOpen((current) => {
      writeLocalStorage('ailu-sidebar-projects-open', current ? 'false' : 'true');
      removeLocalStorage('codex-sidebar-projects-open');
      return !current;
    });
  }

  function toggleConversations(): void {
    setConversationsOpen((current) => {
      writeLocalStorage('ailu-sidebar-conversations-open', current ? 'false' : 'true');
      removeLocalStorage('codex-sidebar-conversations-open');
      return !current;
    });
  }

  function startRename(session: AgentSession): void {
    setMenuSessionId(undefined);
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }

  function finishRename(session: AgentSession): void {
    const nextTitle = editingTitle.trim();
    setEditingSessionId(undefined);
    if (!nextTitle || nextTitle === session.title) {
      setEditingTitle('');
      return;
    }
    onRename(session, nextTitle);
    setEditingTitle('');
  }

  function cancelRename(): void {
    setEditingSessionId(undefined);
    setEditingTitle('');
  }

  function handleSessionAction(session: AgentSession, action: SessionMenuAction): void {
    setMenuSessionId(undefined);
    onSessionMenuAction(session, action);
  }

  function renderConversationItem(session: AgentSession, nested = false): JSX.Element {
    const menuOpen = menuSessionId === session.id;
    return (
      <article key={session.id} className={`qwen-session-item ${nested ? 'qwen-session-item-nested' : ''} ${selectedSessionId === session.id ? 'active' : ''} ${menuOpen ? 'menu-open' : ''}`}>
        {editingSessionId === session.id ? (
          <input
            className="qwen-session-rename"
            value={editingTitle}
            autoFocus
            onChange={(event) => setEditingTitle(event.target.value)}
            onBlur={() => finishRename(session)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                finishRename(session);
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelRename();
              }
            }}
          />
        ) : (
          <button type="button" className="qwen-session-select" onClick={() => onSelect(session.id)}>
            {nested ? <ChatIcon /> : null}
            <span>{session.title}</span>
          </button>
        )}
        <div className="popup-anchor">
          <button
            type="button"
            className="qwen-row-menu qwen-session-menu"
            aria-label={`Ações da sessão ${session.title}`}
            onClick={() => setMenuSessionId((current) => current === session.id ? undefined : session.id)}
          >
            ⋯
          </button>
          <PopupMenu open={menuOpen} onClose={() => setMenuSessionId(undefined)}>
            <button type="button" onClick={() => handleSessionAction(session, 'pin')}>
              <UiIcon name="pin" className="menu-icon" />
              Pino
            </button>
            <button type="button" onClick={() => startRename(session)}>
              <UiIcon name="edit" className="menu-icon" />
              Renomear
            </button>
            <button type="button" onClick={() => { setMenuSessionId(undefined); onDuplicate(session); }}>
              <UiIcon name="copy" className="menu-icon" />
              Clonar
            </button>
            <button type="button" onClick={() => handleSessionAction(session, 'archive')}>
              <UiIcon name="archive" className="menu-icon" />
              Arquivo
            </button>
            <button type="button" onClick={() => { setMenuSessionId(undefined); onExport(session, 'markdown'); }}>
              <UiIcon name="download" className="menu-icon" />
              Baixar
            </button>
            <button type="button" onClick={() => handleSessionAction(session, 'move-to-project')}>
              <UiIcon name="moveToProject" className="menu-icon" />
              Mover para Projeto
            </button>
            <button type="button" onClick={() => handleSessionAction(session, 'remove-from-project')}>
              <UiIcon name="moveFromProject" className="menu-icon" />
              Mover do Projeto
            </button>
            <button type="button" className="danger" onClick={() => { setMenuSessionId(undefined); onDelete(session); }}>
              <UiIcon name="trash" className="menu-icon" />
              Excluir
            </button>
          </PopupMenu>
        </div>
      </article>
    );
  }

  if (collapsed) {
    return (
      <section className="qwen-sidebar qwen-sidebar-collapsed" aria-label="Conversas">
        <header className="qwen-sidebar-collapsed-top">
          <button type="button" className="qwen-collapse-button" aria-label="Abrir sidebar" onClick={onToggleSidebar}>
            <SidebarToggleIcon direction="expand" />
          </button>
        </header>
        <nav className="qwen-collapsed-nav" aria-label="Navegação compacta">
          <button type="button" onClick={() => onNewSession()} aria-label="Nova Conversa">
            <UiIcon name="plus" className="qwen-nav-icon" />
          </button>
          <button type="button" onClick={onToggleSidebar} aria-label="Pesquisar Conversas">
            <UiIcon name="search" className="qwen-nav-icon" />
          </button>
        </nav>
        <footer className="qwen-sidebar-collapsed-footer" title="Conta local">
          <button type="button" className="qwen-user-button qwen-user-button-collapsed" onClick={() => setUserMenuOpen((current) => !current)} aria-label="Menu do usuário">
            <span className="qwen-avatar" aria-hidden="true">L</span>
          </button>
          <PopupMenu open={userMenuOpen} onClose={() => setUserMenuOpen(false)} align="left" placement="top">
            <span className="popup-menu-label menu-item-label">lucas545camargo@...</span>
            <button type="button" className="menu-item" onClick={() => { setUserMenuOpen(false); onOpenSettings('general'); }}>
              <UiIcon name="settings" className="menu-icon menu-item-icon" />
              Configurações
            </button>
            <button type="button" className="menu-item" onClick={() => { setUserMenuOpen(false); onOpenArchivedConversations(); }}>
              <UiIcon name="archive" className="menu-icon menu-item-icon" />
              Conversas arquivadas
            </button>
            <span className="popup-menu-separator" aria-hidden="true" />
            <button type="button" className="menu-item danger menu-item-danger" onClick={() => { setUserMenuOpen(false); onCloseSession(); }}>
              <UiIcon name="logout" className="menu-icon menu-item-icon" />
              Sair
            </button>
          </PopupMenu>
        </footer>
      </section>
    );
  }

  return (
    <section className="qwen-sidebar" aria-label="Conversas">
      <header className="qwen-sidebar-top">
        <button type="button" className="qwen-logo-button qwen-logo-button-icon-only" onClick={() => onSelect(undefined)} aria-label="Início">
          <img className="qwen-logo-img" src={appLogo} alt="" aria-hidden="true" />
        </button>
        <button type="button" className="qwen-collapse-button" aria-label="Recolher sidebar" onClick={onToggleSidebar}>
          <SidebarToggleIcon direction="collapse" />
        </button>
      </header>

      <nav className="qwen-primary-nav" aria-label="Navegação">
        <button type="button" onClick={() => onNewSession()}>
          <UiIcon name="plus" className="qwen-nav-icon" />
          Nova Conversa
        </button>
        <label className="qwen-search-row">
          <UiIcon name="search" className="qwen-nav-icon" />
          <input
            value={query}
            placeholder="Pesquisar Conversas"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </nav>

      <div className="qwen-projects">
        <button type="button" className="qwen-projects-title" onClick={toggleProjects} aria-expanded={projectsOpen}>
          <span>Projetos</span>
          <span aria-hidden="true">{projectsOpen ? '⌄' : '›'}</span>
        </button>
        {projectsOpen ? (
          <div className="qwen-project-group">
            <button type="button" className="qwen-project-action" onClick={onNewProject}>
              <NewProjectIcon />
              Novo Projeto
            </button>
            {visibleProjects.map((project) => {
              const projectActive = activeProject === project;
              const projectMenuOpen = menuProject === project;
              const nestedSessions = projectActive ? projectSessions[project] ?? [] : [];
              const appearance = projectAppearance[project];
              return (
                <div key={project} className={`qwen-project-stack ${projectActive ? 'active' : ''}`}>
                  <article className={`qwen-project-item ${projectActive ? 'active' : ''} ${projectMenuOpen ? 'menu-open' : ''}`}>
                    <button type="button" className="qwen-project-name" onClick={() => onSelectProject(project)}>
                      {appearance?.icon ? (
                        <span
                          className="qwen-project-icon-badge"
                          style={appearance.color ? { color: appearance.color } : undefined}
                          aria-hidden="true"
                        >
                          <UiIcon name={appearance.icon} className="qwen-row-icon qwen-row-icon-compact" />
                        </span>
                      ) : (
                        <FolderIcon />
                      )}
                      <span>{project}</span>
                    </button>
                    <div className="popup-anchor">
                      <button
                        type="button"
                        className="qwen-row-menu qwen-project-menu"
                        aria-label={`Ações do projeto ${project}`}
                        onClick={() => setMenuProject((current) => current === project ? undefined : project)}
                      >
                        ⋯
                      </button>
                      <PopupMenu open={projectMenuOpen} onClose={() => setMenuProject(undefined)} align="left" className="project-menu">
                        <button type="button" className="menu-item" onClick={() => { setMenuProject(undefined); onEditProject(project); }}>
                          <UiIcon name="edit" className="menu-icon menu-item-icon" />
                          Editar Projeto
                        </button>
                        <button type="button" className="menu-item danger menu-item-danger" onClick={() => { setMenuProject(undefined); onDeleteProject(project); }}>
                          <UiIcon name="trash" className="menu-icon menu-item-icon" />
                          Excluir Projeto
                        </button>
                      </PopupMenu>
                    </div>
                  </article>
                  {nestedSessions.length > 0 ? (
                    <div className="qwen-project-conversations" aria-label={`Conversas do projeto ${project}`}>
                      {nestedSessions.map((session) => renderConversationItem(session, true))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="qwen-conversations">
        <button type="button" className="qwen-projects-title" onClick={toggleConversations} aria-expanded={conversationsOpen}>
          <span>Todas as conversas</span>
          <span aria-hidden="true">{conversationsOpen ? '⌄' : '›'}</span>
        </button>
        {conversationsOpen ? (
          <div className="qwen-session-list">
            {groupedSessions.map((group) => (
              <div key={group.bucket}>
                <span className="qwen-date-group">{TIME_BUCKET_LABELS[group.bucket]}</span>
                {group.sessions.map((session) => renderConversationItem(session))}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <footer className="qwen-sidebar-footer" title="Conta local">
        <button type="button" className="qwen-user-button" onClick={() => setUserMenuOpen((current) => !current)} aria-label="Menu do usuário">
          <span className="qwen-avatar" aria-hidden="true">L</span>
          <span>Lucas</span>
        </button>
        <PopupMenu open={userMenuOpen} onClose={() => setUserMenuOpen(false)} align="left" placement="top">
          <span className="popup-menu-label menu-item-label">lucas545camargo@...</span>
          <button type="button" className="menu-item" onClick={() => { setUserMenuOpen(false); onOpenSettings('general'); }}>
            <UiIcon name="settings" className="menu-icon menu-item-icon" />
            Configurações
          </button>
          <button type="button" className="menu-item" onClick={() => { setUserMenuOpen(false); onOpenArchivedConversations(); }}>
            <UiIcon name="archive" className="menu-icon menu-item-icon" />
            Conversas arquivadas
          </button>
          <span className="popup-menu-separator" aria-hidden="true" />
          <button type="button" className="menu-item danger menu-item-danger" onClick={() => { setUserMenuOpen(false); onCloseSession(); }}>
            <UiIcon name="logout" className="menu-icon menu-item-icon" />
            Sair
          </button>
        </PopupMenu>
      </footer>
    </section>
  );
}
