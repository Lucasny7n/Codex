import { Badge } from '../common/Badge';
import type { AgentSession } from '../../types/domain';

interface TasksPanelProps {
  session?: AgentSession;
}

function tone(status: 'pending' | 'running' | 'done' | 'error'): 'neutral' | 'info' | 'ok' | 'danger' {
  if (status === 'running') return 'info';
  if (status === 'done') return 'ok';
  if (status === 'error') return 'danger';
  return 'neutral';
}

export function TasksPanel({ session }: TasksPanelProps): JSX.Element {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Tarefas</h2>
      </header>
      <div className="panel-body scroll-y compact-list">
        {(session?.tasks ?? []).map((task) => (
          <div key={task.id} className="list-item static">
            <div className="row-between">
              <strong>{task.title}</strong>
              <Badge tone={tone(task.status)}>{task.status}</Badge>
            </div>
            {task.detail ? <p className="muted">{task.detail}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
