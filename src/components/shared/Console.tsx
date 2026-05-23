
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
      case 'info': return 'text-blue-400';
      case 'warn': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className={`console-panel flex flex-col ${isOpen ? 'h-64' : 'h-10'} bg-[#121216] border-t border-[var(--border-color)] transition-all duration-300 absolute bottom-0 w-full z-40`}>
      <div className="flex justify-between items-center px-4 py-2 cursor-pointer bg-[#1a1a20] hover:bg-[#202028] border-b border-[var(--border-color)]" onClick={toggle}>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-300 text-sm flex items-center gap-2">
            🖥️ Console & Logs
          </span>
          {isOpen && (
             <div className="flex gap-2 ml-4" onClick={e => e.stopPropagation()}>
               <select className="bg-black border border-gray-700 text-xs text-gray-300 rounded px-2 py-0.5 outline-none" value={filter} onChange={e => setFilter(e.target.value)}>
                 <option value="all">Todos</option>
                 <option value="chat">Chat</option>
                 <option value="approval">Aprovação</option>
                 <option value="runtime">Runtime</option>
                 <option value="memory">Memória</option>
               </select>
             </div>
          )}
        </div>
        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          {isOpen && (
            <>
              <button onClick={clearLogs} className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded bg-gray-800">Limpar</button>
              <button onClick={copyLogs} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-blue-900/30">Copiar</button>
            </>
          )}
          <span className="text-gray-500 hover:text-white cursor-pointer" onClick={toggle}>{isOpen ? '▼' : '▲'}</span>
        </div>
      </div>
      
      {isOpen && (
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-[#09090b] space-y-1">
          {filteredLogs.map(log => (
            <div key={log.id} className="flex gap-3 hover:bg-gray-800/50 py-0.5 px-1 rounded group">
              <span className="text-gray-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span className={`shrink-0 w-16 font-semibold ${getLogColor(log.level)}`}>[{log.level.toUpperCase()}]</span>
              <span className="text-gray-500 shrink-0 w-20">[{log.type}]</span>
              <span className="text-gray-300 break-words">{log.message}</span>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="text-gray-500 italic">Nenhum log registrado.</div>
          )}
        </div>
      )}
    </div>
  );
}
