import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface MemoryItem {
  id: number;
  content: string;
  tags: string;
  created_at: string;
}

import { useLogStore } from '../../stores/logStore';

export function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { addLog } = useLogStore();

  const fetchMemories = async () => {
    setLoading(true);
    try {
      let data;
      if (search.trim() === '') {
        data = await invoke<MemoryItem[]>('list_memories');
      } else {
        data = await invoke<MemoryItem[]>('search_memories', { query: search });
      }
      setMemories(data);
    } catch (err) {
      console.error('Falha ao buscar memórias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [search]);

  const handleDelete = async (id: number) => {
    try {
      await invoke('delete_memory', { id });
      addLog('memory', 'warn', `Memória apagada (id: ${id})`);
      fetchMemories();
    } catch (err) {
      addLog('memory', 'error', `Falha ao deletar memória: ${err}`);
      console.error('Falha ao deletar:', err);
    }
  };

  const handleTestSqlite = async () => {
    try {
      await invoke('create_memory', { content: 'Teste de conexão com banco SQLite local', tags: 'teste,sqlite' });
      addLog('memory', 'success', 'Memória de teste inserida com sucesso no SQLite.');
      fetchMemories();
    } catch (err) {
      addLog('memory', 'error', `Erro ao testar SQLite: ${err}`);
    }
  };

  return (
    <div className="p-6 bg-[var(--bg-main)] h-full flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            💾 Memória do Sistema
          </h2>
          <p className="text-sm text-gray-400 mt-1">Conhecimento persistente salvo no banco SQLite local.</p>
        </div>
        
        <div className="flex gap-2">
          <button onClick={handleTestSqlite} className="px-3 py-1.5 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-gray-300 rounded text-xs font-medium transition-colors">
            Testar SQLite
          </button>
          <button className="px-3 py-1.5 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-gray-300 rounded text-xs font-medium transition-colors">
            Importar
          </button>
          <button className="px-3 py-1.5 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-gray-300 rounded text-xs font-medium transition-colors">
            Exportar
          </button>
        </div>
      </div>
      
      <div className="mb-6 flex gap-3">
        <input 
          type="text" 
          placeholder="Buscar decisões, comandos, correções..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500"
        />
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-colors shadow-sm whitespace-nowrap">
          + Nova Memória
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {loading && <p className="text-gray-400 text-sm">Carregando memórias...</p>}
        
        {!loading && memories.length === 0 && search === '' && (
          <div className="flex flex-col items-center justify-center py-16 bg-[#161b22] border border-[#30363d] rounded-xl text-center px-6">
            <span className="text-4xl mb-4">📭</span>
            <h3 className="text-lg font-semibold text-gray-200 mb-2">O banco de memória está vazio.</h3>
            <p className="text-sm text-gray-400 max-w-md">
              Salve decisões, preferências ou resultados de comandos no chat para que o Ailu aprenda com seu uso contínuo e mantenha contexto através das reinicializações do sistema.
            </p>
            <button onClick={handleTestSqlite} className="mt-6 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white rounded-lg text-sm transition-colors">
              Inserir memória de teste
            </button>
          </div>
        )}

        {!loading && memories.length === 0 && search !== '' && (
          <p className="text-gray-400 text-center py-8">Nenhuma memória encontrada para a busca.</p>
        )}
        
        {memories.map((mem) => (
          <div key={mem.id} className="bg-[#161b22] p-5 rounded-xl border border-[#30363d] hover:border-[#8b949e] transition-colors group">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] uppercase tracking-wider font-mono text-gray-500">{new Date(mem.created_at).toLocaleString()} • ID: {mem.id}</span>
              <button onClick={() => handleDelete(mem.id)} className="text-[10px] uppercase tracking-wider text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">Apagar</button>
            </div>
            <p className="text-gray-200 mb-4 text-sm leading-relaxed">{mem.content}</p>
            <div className="flex flex-wrap gap-2">
              {mem.tags.split(',').filter(Boolean).map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 bg-[#0d1117] border border-[#30363d] text-gray-400 rounded-full">
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
