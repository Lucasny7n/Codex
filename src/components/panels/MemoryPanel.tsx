import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface MemoryItem {
  id: number;
  content: string;
  tags: string;
  created_at: string;
}

export function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchMemories = async () => {
      setLoading(true);
      try {
        let data;
        if (search.trim() === '') {
          data = await invoke<MemoryItem[]>('list_memories');
        } else {
          data = await invoke<MemoryItem[]>('search_memories', { query: search });
        }
        if (active) setMemories(data);
      } catch (err) {
        console.error('Falha ao buscar memórias:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchMemories();
    return () => { active = false; };
  }, [search]);

  const handleDelete = async (id: number) => {
    try {
      await invoke('delete_memory', { id });
      // Reload is simplified, we just trigger a search refresh or manual fetch
      const data = await invoke<MemoryItem[]>('list_memories');
      setMemories(data);
    } catch (err) {
      console.error('Falha ao deletar:', err);
    }
  };

  return (
    <div className="p-6 bg-[var(--bg-main)] h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-4">Memória do Sistema (SQLite)</h2>
      
      <div className="mb-6">
        <input 
          type="text" 
          placeholder="Buscar decisões, comandos, correções..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg p-3 text-white outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {loading && <p className="text-gray-400">Carregando memórias...</p>}
        {!loading && memories.length === 0 && (
          <p className="text-gray-400 text-center py-8">O banco de dados de memória está vazio.</p>
        )}
        
        {memories.map((mem) => (
          <div key={mem.id} className="bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--border-color)]">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-gray-500">{new Date(mem.created_at).toLocaleString()}</span>
              <button onClick={() => handleDelete(mem.id)} className="text-xs text-red-400 hover:text-red-300">Apagar</button>
            </div>
            <p className="text-gray-200 mb-3">{mem.content}</p>
            <div className="flex gap-2">
              {mem.tags.split(',').filter(Boolean).map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-[var(--bg-hover)] text-gray-400 rounded">
                  #{tag.trim()}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
