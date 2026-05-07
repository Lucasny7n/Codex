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
    <section className="panel tasks-panel">
      <header className="panel-header">
        <h2>Timeline</h2>
        <Badge tone={session?.tasks?.some((task) => task.status === 'running') ? 'info' : 'neutral'}>
          {session?.tasks?.length ?? 0}
        </Badge>
      </header>
      <div className="panel-body scroll-y compact-list">
        {!session || (session.tasks ?? []).length === 0 ? (
          <div className="empty-state empty-state-inline">
            <strong>Sem etapas</strong>
            <span>Nenhuma tarefa ativa.</span>
          </div>
        ) : null}
        {(session?.tasks ?? []).map((task) => (
          <div key={task.id} className={`list-item static task-item task-${task.status}`}>
            <div className="task-marker" aria-hidden="true" />
            <div className="task-copy">
              <div className="row-between">
                <strong>{task.title}</strong>
                <Badge tone={tone(task.status)}>{task.status}</Badge>
              </div>
              {task.detail ? <p className="muted">{task.detail}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
