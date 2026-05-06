import type { MemorySnapshot } from '../../types/domain';

interface MemoryPanelProps {
  memory?: MemorySnapshot;
}

function ListSection({ title, items }: { title: string; items: string[] }): JSX.Element {
  const visibleItems = items.slice(0, 4);
  const hiddenCount = Math.max(items.length - visibleItems.length, 0);

  return (
    <div className="memory-block">
      <div className="memory-block-header">
        <h4>{title}</h4>
        <span>{items.length}</span>
      </div>
      <ul>
        {visibleItems.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
        {hiddenCount > 0 ? <li className="muted">+{hiddenCount} itens</li> : null}
      </ul>
    </div>
  );
}

export function MemoryPanel({ memory }: MemoryPanelProps): JSX.Element {
  if (!memory) {
    return (
      <section className="panel memory-panel">
        <header className="panel-header">
          <h2>Contexto</h2>
        </header>
        <div className="panel-body empty-state empty-state-inline">
          <strong>Sem snapshot</strong>
          <span>Nenhum contexto carregado.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="panel memory-panel">
      <header className="panel-header">
        <h2>Contexto ~/.codex</h2>
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
