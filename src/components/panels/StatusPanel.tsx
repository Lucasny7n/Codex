import { Badge } from '../common/Badge';
import { formatDateTime } from '../../lib/format';
import type { StatusNote } from '../../types/domain';

interface StatusPanelProps {
  feed: StatusNote[];
}

function toneFor(kind: StatusNote['kind']): 'neutral' | 'info' | 'warn' | 'danger' | 'ok' {
  if (kind === 'error') return 'danger';
  if (kind === 'warn') return 'warn';
  if (kind === 'success') return 'ok';
  if (kind === 'info') return 'info';
  return 'neutral';
}

export function StatusPanel({ feed }: StatusPanelProps): JSX.Element {
  return (
    <section className="panel status-panel">
      <header className="panel-header">
        <h2>Status</h2>
        <span className="panel-count">{feed.length}</span>
      </header>
      <div className="panel-body scroll-y compact-list">
        {feed.length === 0 ? (
          <div className="empty-state empty-state-inline">
            <strong>Sem eventos</strong>
            <span>Notas de execução aparecerão aqui.</span>
          </div>
        ) : null}
        {feed.map((note) => (
          <div key={note.id} className="note-item">
            <span className={`note-rail note-${note.kind}`} aria-hidden="true" />
            <div className="row-between">
              <strong>{note.title}</strong>
              <Badge tone={toneFor(note.kind)}>{note.kind}</Badge>
            </div>
            <p>{note.detail}</p>
            <small>{formatDateTime(note.at)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
