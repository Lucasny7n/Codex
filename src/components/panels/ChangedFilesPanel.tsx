import { formatDateTime, shortPath } from '../../lib/format';
import type { FileChangeEntry } from '../../types/domain';

interface ChangedFilesPanelProps {
  entries: FileChangeEntry[];
  onOpen: (path: string) => void;
}

export function ChangedFilesPanel({ entries, onOpen }: ChangedFilesPanelProps): JSX.Element {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Arquivos Alterados</h2>
      </header>
      <div className="panel-body scroll-y compact-list">
        {entries.map((entry) => (
          <button key={`${entry.path}-${entry.at}`} type="button" className="list-item" onClick={() => onOpen(entry.path)}>
            <div className="row-between">
              <strong>{shortPath(entry.path, 4)}</strong>
              <span className={`chip-${entry.event}`}>{entry.event}</span>
            </div>
            <small>{formatDateTime(entry.at)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
