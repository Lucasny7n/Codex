import type { MemorySnapshot } from '../../types/domain';

interface MemoryPanelProps {
  memory?: MemorySnapshot;
}

function ListSection({ title, items }: { title: string; items: string[] }): JSX.Element {
  return (
    <div className="memory-block">
      <div className="memory-block-header">
        <h4>{title}</h4>
        <span className="memory-block-count">{items.length}</span>
      </div>
      {items.length > 0 ? (
        <ul className="memory-items" aria-label={title}>
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="memory-empty">Sem itens registrados.</p>
      )}
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
        <p className="memory-summary">{memory.profileSummary}</p>
        <ListSection title="Preferências" items={memory.userPreferences} />
        <ListSection title="Projetos" items={memory.activeProjects} />
        <ListSection title="Correções Importantes" items={memory.importantFixHistory} />
        <ListSection title="Políticas" items={memory.operationalPolicies} />
      </div>
    </section>
  );
}
