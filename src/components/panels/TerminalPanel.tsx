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
      </header>
      <div className="panel-body scroll-y terminal-output">
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
