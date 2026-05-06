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
    <section className="panel">
      <header className="panel-header">
        <h2>Status e Justificativas</h2>
      </header>
      <div className="panel-body scroll-y compact-list">
        {feed.map((note) => (
          <div key={note.id} className="note-item">
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
