
import { useState } from 'react';
import { useLogStore } from '../../stores/logStore';

interface ConsoleProps {
  isOpen: boolean;
  toggle: () => void;
}

export function Console({ isOpen, toggle }: ConsoleProps) {
  const { logs, clearLogs } = useLogStore();
  const [filter, setFilter] = useState<string>('all');

  const filteredLogs = logs.filter(log => filter === 'all' || log.type === filter);

  const copyLogs = () => {
    const text = filteredLogs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] [${l.type}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  const getLogColor = (level: string) => {
    switch(level) {
      case 'info': return 'var(--text-active)';
      case 'warn': return 'var(--color-warning)';
      case 'error': return 'var(--color-danger)';
      case 'success': return 'var(--color-success)';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div className={`app-console ${isOpen ? 'open' : 'closed'}`}>
      <div 
        onClick={toggle}
        style={{
          height: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          padding: '0 var(--space-4)', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)',
          cursor: 'pointer'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-panel)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            🖥️ Console & Logs
          </span>
          {isOpen && (
             <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'var(--space-4)' }} onClick={e => e.stopPropagation()}>
               <select 
                 className="app-input"
                 style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                 value={filter} 
                 onChange={e => setFilter(e.target.value)}
               >
                 <option value="all">Todos</option>
                 <option value="chat">Chat</option>
                 <option value="approval">Aprovação</option>
                 <option value="runtime">Runtime</option>
                 <option value="memory">Memória</option>
               </select>
             </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }} onClick={e => e.stopPropagation()}>
          {isOpen && (
            <>
              <button onClick={clearLogs} className="app-button app-button-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Limpar</button>
              <button onClick={copyLogs} className="app-button app-button-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Copiar</button>
            </>
          )}
          <span style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }} onClick={toggle}>{isOpen ? '▼' : '▲'}</span>
        </div>
      </div>
      
      {isOpen && (
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-main)' }}>
          {filteredLogs.map(log => (
            <div key={log.id} className="app-log-row">
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span style={{ flexShrink: 0, width: '60px', fontWeight: 600, color: getLogColor(log.level) }}>[{log.level.toUpperCase()}]</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: '80px' }}>[{log.type}]</span>
              <span style={{ color: 'var(--text-main)', wordBreak: 'break-word' }}>{log.message}</span>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: 'var(--space-4)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>Nenhum log registrado.</div>
          )}
        </div>
      )}
    </div>
  );
}
