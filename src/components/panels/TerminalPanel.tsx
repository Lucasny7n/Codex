import { formatDateTime } from '../../lib/format';
import type { CommandLogChunk } from '../../types/domain';

interface TerminalPanelProps {
  logs: CommandLogChunk[];
}

export function TerminalPanel({ logs }: TerminalPanelProps): JSX.Element {
  return (
    <section className="panel terminal-panel">
      <header className="panel-header">
        <h2>Terminal e Logs</h2>
        <span className="panel-count">{logs.length}</span>
      </header>
      <div className="panel-body scroll-y terminal-output">
        {logs.length === 0 ? (
          <div className="empty-state empty-state-inline">
            <strong>Sem logs</strong>
            <span>A saída de comandos aparecerá aqui.</span>
          </div>
        ) : null}
        {logs.map((chunk, index) => (
          <div key={`${chunk.executionId}-${index}`} className={`terminal-line stream-${chunk.stream}`}>
            <span className="timestamp">{formatDateTime(chunk.at)}</span>
            <span className="line">{chunk.line}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
