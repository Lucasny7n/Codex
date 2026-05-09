import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { getFileAttachment, listFileDirectory } from '../../lib/api';
import type { FileBrowserEntry, FileEntryKind, SelectedFileAttachment } from '../../types/domain';
import { UiIcon, type UiIconName } from '../common/AppIcons';
import { PremiumModal } from '../common/PremiumUI';

interface FileManagerModalProps {
  open: boolean;
  initialPathMode?: boolean;
  onClose: () => void;
  onSelect: (attachment: SelectedFileAttachment) => void;
}

const SEARCH_LIMIT = 240;

export function fileIconNameForKind(kind: FileEntryKind): UiIconName {
  if (kind === 'directory') return 'folder';
  if (kind === 'pdf') return 'filePdf';
  if (kind === 'zip') return 'zip';
  if (kind === 'text') return 'fileText';
  if (kind === 'json') return 'fileJson';
  if (kind === 'image') return 'image';
  if (kind === 'code') return 'fileCode';
  if (kind === 'audio') return 'music';
  if (kind === 'video') return 'video';
  return 'file';
}

export function formatFileSize(size?: number): string {
  if (typeof size !== 'number') return 'Pasta';
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

function kindLabel(entry: Pick<FileBrowserEntry, 'kind' | 'extension' | 'isDirectory'>): string {
  if (entry.isDirectory) return 'Pasta';
  if (entry.kind === 'pdf') return 'PDF';
  if (entry.kind === 'zip') return 'ZIP';
  if (entry.kind === 'json') return 'JSON';
  if (entry.kind === 'image') return 'Imagem';
  if (entry.kind === 'code') return entry.extension ? `Código .${entry.extension}` : 'Código';
  if (entry.kind === 'text') return entry.extension ? `Texto .${entry.extension}` : 'Texto';
  if (entry.kind === 'audio') return 'Áudio';
  if (entry.kind === 'video') return 'Vídeo';
  return entry.extension ? `.${entry.extension}` : 'Arquivo';
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function FileManagerModal({ open, initialPathMode = false, onClose, onSelect }: FileManagerModalProps): JSX.Element | null {
  const [path, setPath] = useState<string>();
  const [parentPath, setParentPath] = useState<string>();
  const [entries, setEntries] = useState<FileBrowserEntry[]>([]);
  const [shortcuts, setShortcuts] = useState<Array<{ id: string; label: string; path: string; exists: boolean }>>([]);
  const [truncated, setTruncated] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [manualOpen, setManualOpen] = useState(initialPathMode);
  const [manualPath, setManualPath] = useState('');
  const [manualError, setManualError] = useState<string>();

  async function loadDirectory(nextPath?: string): Promise<void> {
    setLoading(true);
    setError(undefined);
    try {
      const listing = await listFileDirectory(nextPath);
      setPath(listing.path);
      setParentPath(listing.parentPath);
      setEntries(listing.entries);
      setShortcuts(listing.shortcuts);
      setTruncated(listing.truncated);
      setSelectedPath(undefined);
      setSearch('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível listar esta pasta.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const loadHandle = window.setTimeout(() => {
      void loadDirectory(undefined);
    }, 0);
    return () => window.clearTimeout(loadHandle);
  }, [open]);

  const visibleEntries = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const source = normalized
      ? entries.filter((entry) => entry.name.toLowerCase().includes(normalized))
      : entries;
    return source.slice(0, SEARCH_LIMIT);
  }, [entries, search]);

  const selectedEntry = entries.find((entry) => entry.path === selectedPath);

  async function selectAttachment(targetPath: string): Promise<void> {
    setError(undefined);
    try {
      const attachment = await getFileAttachment(targetPath);
      onSelect(attachment);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível selecionar este caminho.');
    }
  }

  async function openOrSelect(entry: FileBrowserEntry): Promise<void> {
    if (entry.isDirectory) {
      await loadDirectory(entry.path);
      return;
    }
    await selectAttachment(entry.path);
  }

  async function submitManualPath(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const cleaned = manualPath.trim();
    setManualError(undefined);
    if (!cleaned) {
      setManualError('Informe um caminho local.');
      return;
    }
    try {
      const attachment = await getFileAttachment(cleaned);
      onSelect(attachment);
      onClose();
    } catch (cause) {
      setManualError(cause instanceof Error ? cause.message : 'Caminho inválido ou inacessível.');
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    const target = event.target;
    const isTextInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    if (event.key === 'Backspace' && !isTextInput && parentPath) {
      event.preventDefault();
      void loadDirectory(parentPath);
      return;
    }
    if (event.key === 'Enter' && selectedEntry && !isTextInput) {
      event.preventDefault();
      void openOrSelect(selectedEntry);
    }
  }

  return (
    <PremiumModal open={open} title="Selecionar arquivo" onClose={onClose} className="file-manager-modal">
      <section className="file-manager-shell" onKeyDown={handleKeyDown}>
        <aside className="file-manager-shortcuts" aria-label="Atalhos">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.id}
              type="button"
              disabled={!shortcut.exists}
              className={path === shortcut.path ? 'active' : ''}
              onClick={() => void loadDirectory(shortcut.path)}
            >
              <UiIcon name={shortcut.id === 'home' ? 'home' : shortcut.id === 'downloads' ? 'download' : shortcut.id === 'images' ? 'image' : shortcut.id === 'videos' ? 'video' : shortcut.id === 'music' ? 'music' : shortcut.id === 'desktop' ? 'desktop' : shortcut.id === 'recent' ? 'refresh' : 'folder'} className="file-manager-nav-icon" />
              {shortcut.label}
            </button>
          ))}
        </aside>

        <div className="file-manager-main">
          <header className="file-manager-toolbar">
            <button type="button" className="file-manager-icon-button" disabled={!parentPath} onClick={() => parentPath ? void loadDirectory(parentPath) : undefined} aria-label="Voltar">
              <UiIcon name="arrowLeft" />
            </button>
            <button type="button" className="file-manager-icon-button" disabled={!parentPath} onClick={() => parentPath ? void loadDirectory(parentPath) : undefined} aria-label="Subir pasta">
              <UiIcon name="arrowUp" />
            </button>
            <button type="button" className="file-manager-icon-button" onClick={() => void loadDirectory(path)} aria-label="Atualizar">
              <UiIcon name="refresh" />
            </button>
            <div className="file-manager-path-bar" title={path}>
              <UiIcon name="path" />
              <span>{path ?? 'Carregando...'}</span>
            </div>
            <label className="file-manager-search">
              <UiIcon name="search" />
              <input value={search} placeholder="Buscar" onChange={(event) => setSearch(event.target.value)} />
            </label>
          </header>

          <button type="button" className="file-manager-path-toggle" onClick={() => setManualOpen((current) => !current)}>
            <UiIcon name="path" />
            Usar caminho do PC
            <UiIcon name={manualOpen ? 'chevronDown' : 'chevronRight'} />
          </button>

          {manualOpen ? (
            <form className="file-manager-manual-path" onSubmit={(event) => void submitManualPath(event)}>
              <input
                aria-label="Caminho local"
                value={manualPath}
                placeholder="/home/lucas/Downloads/arquivo.pdf"
                onChange={(event) => setManualPath(event.target.value)}
              />
              <button type="submit" className="btn-modern btn-modern-primary">Validar</button>
              {manualError ? <span role="alert">{manualError}</span> : null}
            </form>
          ) : null}

          {error ? <div className="file-manager-error" role="alert">{error}</div> : null}
          {truncated ? <div className="file-manager-note">Mostrando os primeiros itens desta pasta para manter a interface responsiva.</div> : null}

          <div className="file-manager-list" role="listbox" aria-label="Arquivos">
            <div className="file-manager-list-head" aria-hidden="true">
              <span>Nome</span>
              <span>Tipo</span>
              <span>Tamanho</span>
              <span>Modificado</span>
            </div>
            {loading ? (
              <div className="file-manager-empty">Carregando arquivos...</div>
            ) : visibleEntries.length > 0 ? (
              visibleEntries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  className={`file-manager-row ${selectedPath === entry.path ? 'active' : ''}`}
                  role="option"
                  aria-selected={selectedPath === entry.path}
                  onClick={() => setSelectedPath(entry.path)}
                  onDoubleClick={() => void openOrSelect(entry)}
                >
                  <span className="file-manager-name">
                    <UiIcon name={fileIconNameForKind(entry.kind)} className="file-manager-file-icon" />
                    <span title={entry.name}>{entry.name}</span>
                  </span>
                  <span>{kindLabel(entry)}</span>
                  <span>{entry.isDirectory ? '-' : formatFileSize(entry.size)}</span>
                  <span>{formatDate(entry.modifiedAt)}</span>
                </button>
              ))
            ) : (
              <div className="file-manager-empty">Nenhum item encontrado.</div>
            )}
          </div>

          <footer className="file-manager-footer">
            <div>
              {selectedEntry ? (
                <>
                  <strong>{selectedEntry.name}</strong>
                  <span>{kindLabel(selectedEntry)} · {selectedEntry.isDirectory ? 'pasta' : formatFileSize(selectedEntry.size)}</span>
                </>
              ) : (
                <span>Selecione um arquivo para anexar ao contexto.</span>
              )}
            </div>
            <button type="button" className="btn-modern" onClick={onClose}>Cancelar</button>
            <button
              type="button"
              className="btn-modern btn-modern-primary"
              disabled={!selectedEntry || selectedEntry.isDirectory}
              onClick={() => selectedEntry ? void selectAttachment(selectedEntry.path) : undefined}
            >
              Selecionar
            </button>
          </footer>
        </div>
      </section>
    </PremiumModal>
  );
}
