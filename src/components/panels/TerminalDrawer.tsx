import type { CommandLogChunk } from '../../types/domain';
import { TerminalPanel } from './TerminalPanel';

interface TerminalDrawerProps {
  logs: CommandLogChunk[];
  open: boolean;
  onToggle: () => void;
}

export function TerminalDrawer({ logs, open, onToggle }: TerminalDrawerProps): JSX.Element {
  return (
    <section className={`terminal-drawer${open ? ' open' : ''}`} data-testid="terminal-drawer">
      <header className="terminal-drawer-header">
        <button
          type="button"
          className="terminal-drawer-toggle"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span className="terminal-drawer-title">Terminal e logs</span>
          <span className="terminal-drawer-meta">
            {logs.length > 0 ? `${logs.length} linhas` : 'Sem logs'}
            <span className="terminal-drawer-chevron" aria-hidden="true">
              {open ? '▾' : '▸'}
            </span>
          </span>
        </button>
      </header>
      {open ? (
        <div className="terminal-drawer-body">
          <TerminalPanel logs={logs} embedded />
        </div>
      ) : null}
    </section>
  );
}
