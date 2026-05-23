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

  const fetchMemories = async (searchQuery: string, isSubscribed = true) => {
    if (isSubscribed) setLoading(true);
    try {
      let data;
      if (searchQuery.trim() === '') {
        data = await invoke<MemoryItem[]>('list_memories');
      } else {
        data = await invoke<MemoryItem[]>('search_memories', { query: searchQuery });
      }
      if (isSubscribed) setMemories(data);
    } catch (err) {
      console.error('Falha ao buscar memórias:', err);
    } finally {
      if (isSubscribed) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) fetchMemories(search, active);
    });
    return () => { active = false; };
  }, [search]);

  const handleDelete = async (id: number) => {
    try {
      await invoke('delete_memory', { id });
      addLog('memory', 'warn', `Memória apagada (id: ${id})`);
      fetchMemories(search);
    } catch (err) {
      addLog('memory', 'error', `Falha ao deletar memória: ${err}`);
      console.error('Falha ao deletar:', err);
    }
  };

  const handleTestSqlite = async () => {
    try {
      await invoke('create_memory', { content: 'Teste de conexão com banco SQLite local', tags: 'teste,sqlite' });
      addLog('memory', 'success', 'Memória de teste inserida com sucesso no SQLite.');
      fetchMemories(search);
    } catch (err) {
      addLog('memory', 'error', `Erro ao testar SQLite: ${err}`);
    }
  };

  return (
    <div style={{ padding: 'var(--space-6)', backgroundColor: 'var(--bg-main)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
        <div>
          <h2 className="app-section-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            💾 Memória do Sistema
          </h2>
          <p className="app-subtitle">Conhecimento persistente salvo no banco SQLite local.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={handleTestSqlite} className="app-button app-button-secondary">
            Testar SQLite
          </button>
          <button className="app-button app-button-secondary">
            Importar
          </button>
          <button className="app-button app-button-secondary">
            Exportar
          </button>
        </div>
      </div>
      
      <div className="app-toolbar">
        <input 
          type="text" 
          placeholder="Buscar decisões, comandos, correções..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="app-input"
          style={{ flex: 1 }}
        />
        <button className="app-button app-button-primary" style={{ whiteSpace: 'nowrap' }}>
          + Nova Memória
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {loading && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Carregando memórias...</p>}
        
        {!loading && memories.length === 0 && search === '' && (
          <div className="app-empty-state">
            <span style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>📭</span>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 'var(--space-2)' }}>O banco de memória está vazio.</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '400px', margin: '0 auto' }}>
              Salve decisões, preferências ou resultados de comandos no chat para que o Ailu aprenda com seu uso contínuo e mantenha contexto através das reinicializações do sistema.
            </p>
            <button onClick={handleTestSqlite} className="app-button app-button-secondary" style={{ marginTop: 'var(--space-6)' }}>
              Inserir memória de teste
            </button>
          </div>
        )}

        {!loading && memories.length === 0 && search !== '' && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>Nenhuma memória encontrada para a busca.</p>
        )}
        
        {memories.map((mem) => (
          <div key={mem.id} className="app-card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
              <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {new Date(mem.created_at).toLocaleString()} • ID: {mem.id}
              </span>
              <button 
                onClick={() => handleDelete(mem.id)} 
                className="app-button app-button-danger" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.625rem' }}
              >
                Apagar
              </button>
            </div>
            <p style={{ color: 'var(--text-main)', marginBottom: 'var(--space-4)', fontSize: '0.875rem', lineHeight: 1.6 }}>{mem.content}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {mem.tags.split(',').filter(Boolean).map(tag => (
                <span key={tag} className="app-badge app-badge-muted">
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
