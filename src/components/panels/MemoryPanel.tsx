import type { MemorySnapshot } from '../../types/domain';

interface MemoryPanelProps {
  memory?: MemorySnapshot;
}

function ListSection({ title, items }: { title: string; items: string[] }): JSX.Element {
  return (
    <div className="memory-block">
      <h4>{title}</h4>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function MemoryPanel({ memory }: MemoryPanelProps): JSX.Element {
  if (!memory) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>Memórias</h2>
        </header>
        <div className="panel-body centered muted">Sem snapshot carregado.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Memórias Ativas (~/.codex)</h2>
      </header>
      <div className="panel-body scroll-y memory-layout">
        <p className="muted">{memory.profileSummary}</p>
        <ListSection title="Preferências" items={memory.userPreferences} />
        <ListSection title="Projetos" items={memory.activeProjects} />
        <ListSection title="Correções Importantes" items={memory.importantFixHistory} />
        <ListSection title="Políticas" items={memory.operationalPolicies} />
      </div>
    </section>
  );
}
