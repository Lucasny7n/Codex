import { useState } from 'react';
import type { MemorySnapshot } from '../../types/domain';

interface MemoryPanelProps {
  memory?: MemorySnapshot;
}

function ListSection({ title, items }: { title: string; items: string[] }): JSX.Element {
  return (
    <details className="memory-block" open>
      <summary className="memory-block-header">
        <h4>{title}</h4>
        <span className="memory-block-count">{items.length}</span>
      </summary>
      {items.length > 0 ? (
        <ul className="memory-items" aria-label={title}>
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="memory-empty">Sem itens registrados.</p>
      )}
    </details>
  );
}

function memoryAsText(memory: MemorySnapshot): string {
  return [
    '# Snapshot de memória',
    '',
    memory.profileSummary,
    '',
    '## Preferências',
    ...memory.userPreferences.map((item) => `- ${item}`),
    '',
    '## Projetos',
    ...memory.activeProjects.map((item) => `- ${item}`),
    '',
    '## Correções importantes',
    ...memory.importantFixHistory.map((item) => `- ${item}`),
    '',
    '## Políticas',
    ...memory.operationalPolicies.map((item) => `- ${item}`),
  ].join('\n');
}

export function MemoryPanel({ memory }: MemoryPanelProps): JSX.Element {
  const [copyError, setCopyError] = useState<string>();

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

  async function copyContext(): Promise<void> {
    if (!memory) return;
    setCopyError(undefined);
    try {
      await navigator.clipboard.writeText(memoryAsText(memory));
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'clipboard indisponível';
      setCopyError(`Não foi possível copiar contexto. Detalhe: ${detail}`);
    }
  }

  return (
    <section className="panel memory-panel">
      <header className="panel-header">
        <h2>Contexto ~/.codex</h2>
      </header>
      <div className="panel-body scroll-y memory-layout">
        <p className="memory-summary">{memory.profileSummary}</p>
        <div className="memory-actions">
          <button
            type="button"
            className="btn-modern"
            onClick={() => void copyContext()}
          >
            Copiar contexto
          </button>
          <button
            type="button"
            className="btn-modern"
            onClick={() => {
              const blob = new Blob([memoryAsText(memory)], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = 'codex-memory-snapshot.md';
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            Exportar snapshot
          </button>
        </div>
        {copyError ? <div className="input-error-tip" role="alert">{copyError}</div> : null}
        <ListSection title="Preferências" items={memory.userPreferences} />
        <ListSection title="Projetos" items={memory.activeProjects} />
        <ListSection title="Correções Importantes" items={memory.importantFixHistory} />
        <ListSection title="Políticas" items={memory.operationalPolicies} />
      </div>
    </section>
  );
}
