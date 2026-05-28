import { useEffect, useMemo, useState } from 'react';
import { PremiumModal } from '../common/PremiumUI';
import { listMemoryEntries, saveMemoryEntry, deleteMemoryEntry } from '../../lib/api';
import type { MemoryEntry, MemoryEntryKind, MemoryScope } from '../../types/domain';

interface MemoryManagerModalProps {
  open: boolean;
  projects?: string[];
  activeProject?: string;
  onClose: () => void;
  onToast: (tone: 'success' | 'error' | 'info', message: string) => void;
}

type ScopeFilter = 'all' | 'global' | 'project';

const KIND_LABEL: Record<MemoryEntryKind, string> = {
  preference: 'Preferência',
  fact: 'Fato',
  policy: 'Política',
  fix: 'Correção',
  note: 'Nota',
};

const ORIGIN_LABEL: Record<MemoryEntry['origin'], string> = {
  user: 'Você',
  inferred: 'Inferida',
  imported: 'Importada',
};

function emptyDraft(scope: MemoryScope, project?: string): MemoryEntry {
  return {
    id: '',
    content: '',
    kind: 'note',
    scope,
    project: scope === 'project' ? project : undefined,
    origin: 'user',
    confidence: 1,
    manual: true,
    createdAt: '',
  };
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `mem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function MemoryManagerModal({ open, projects = [], activeProject, onClose, onToast }: MemoryManagerModalProps): JSX.Element | null {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [filter, setFilter] = useState<ScopeFilter>('all');
  const [draft, setDraft] = useState<MemoryEntry>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    async function load(): Promise<void> {
      try {
        const next = await listMemoryEntries();
        if (active) {
          setEntries(next);
          setError(undefined);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Falha ao carregar memórias.');
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [open]);

  const visible = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
    if (filter === 'all') return sorted;
    return sorted.filter((entry) => entry.scope === filter);
  }, [entries, filter]);

  async function handleSave(): Promise<void> {
    if (!draft) return;
    const content = draft.content.trim();
    if (!content) {
      setError('Escreva o conteúdo da memória.');
      return;
    }
    if (draft.scope === 'project' && !draft.project?.trim()) {
      setError('Escolha o projeto para uma memória de projeto.');
      return;
    }
    setBusy(true);
    try {
      const entry: MemoryEntry = {
        ...draft,
        id: draft.id || newId(),
        content,
        project: draft.scope === 'project' ? draft.project?.trim() : undefined,
        manual: true,
      };
      const next = await saveMemoryEntry(entry);
      setEntries(next);
      setDraft(undefined);
      setError(undefined);
      onToast('success', 'Memória salva.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar memória.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setBusy(true);
    try {
      const next = await deleteMemoryEntry(id);
      setEntries(next);
      if (draft?.id === id) setDraft(undefined);
      onToast('info', 'Memória apagada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao apagar memória.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <PremiumModal open={open} title="Memórias" onClose={onClose} className="memory-modal">
      <div className="memory-manager">
        <div className="memory-toolbar">
          <div className="memory-filters" role="tablist" aria-label="Filtrar memórias">
            {(['all', 'global', 'project'] as ScopeFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={`memory-filter${filter === value ? ' memory-filter-active' : ''}`}
                onClick={() => setFilter(value)}
              >
                {value === 'all' ? 'Todas' : value === 'global' ? 'Global' : 'Projeto'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-modern btn-modern-primary"
            onClick={() => setDraft(emptyDraft(filter === 'project' ? 'project' : 'global', activeProject))}
          >
            Nova memória
          </button>
        </div>

        {error ? <p className="memory-error" role="alert">{error}</p> : null}

        {draft ? (
          <div className="memory-editor" aria-label="Editar memória">
            <textarea
              value={draft.content}
              placeholder="O que o Ailu deve lembrar?"
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              rows={3}
            />
            <div className="memory-editor-row">
              <label>
                Tipo
                <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as MemoryEntryKind })}>
                  {(Object.keys(KIND_LABEL) as MemoryEntryKind[]).map((kind) => (
                    <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>
                  ))}
                </select>
              </label>
              <label>
                Escopo
                <select
                  value={draft.scope}
                  onChange={(event) => {
                    const scope = event.target.value as MemoryScope;
                    setDraft({ ...draft, scope, project: scope === 'project' ? draft.project ?? activeProject : undefined });
                  }}
                >
                  <option value="global">Global</option>
                  <option value="project">Projeto</option>
                </select>
              </label>
              {draft.scope === 'project' ? (
                <label>
                  Projeto
                  {projects.length > 0 ? (
                    <select value={draft.project ?? ''} onChange={(event) => setDraft({ ...draft, project: event.target.value })}>
                      <option value="" disabled>Selecione</option>
                      {projects.map((project) => (
                        <option key={project} value={project}>{project}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={draft.project ?? ''}
                      placeholder="nome do projeto"
                      onChange={(event) => setDraft({ ...draft, project: event.target.value })}
                    />
                  )}
                </label>
              ) : null}
            </div>
            <div className="memory-editor-actions">
              <button type="button" className="btn-modern" onClick={() => setDraft(undefined)} disabled={busy}>
                Cancelar
              </button>
              <button type="button" className="btn-modern btn-modern-primary" onClick={() => void handleSave()} disabled={busy}>
                Salvar
              </button>
            </div>
          </div>
        ) : null}

        {visible.length === 0 ? (
          <div className="memory-empty empty-state">
            <strong>Nenhuma memória {filter === 'global' ? 'global' : filter === 'project' ? 'de projeto' : ''} ainda</strong>
            <span>Crie uma memória para o Ailu lembrar de preferências, fatos e políticas.</span>
          </div>
        ) : (
          <ul className="memory-list">
            {visible.map((entry) => (
              <li key={entry.id} className="memory-item">
                <p className="memory-content">{entry.content}</p>
                <div className="memory-meta">
                  <span className={`memory-badge memory-scope-${entry.scope}`}>
                    {entry.scope === 'global' ? 'Global' : `Projeto: ${entry.project ?? '—'}`}
                  </span>
                  <span className="memory-badge">{KIND_LABEL[entry.kind]}</span>
                  <span className="memory-badge memory-origin">Origem: {ORIGIN_LABEL[entry.origin]}</span>
                  {entry.confidence < 1 ? (
                    <span className="memory-badge">Confiança: {Math.round(entry.confidence * 100)}%</span>
                  ) : null}
                  <span className="memory-date">{(entry.updatedAt ?? entry.createdAt).slice(0, 10)}</span>
                </div>
                <div className="memory-item-actions">
                  <button type="button" className="btn-modern" onClick={() => setDraft({ ...entry })} disabled={busy}>
                    Editar
                  </button>
                  <button type="button" className="btn-modern" onClick={() => void handleDelete(entry.id)} disabled={busy}>
                    Apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PremiumModal>
  );
}
