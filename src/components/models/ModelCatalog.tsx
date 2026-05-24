import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useModelStore, ModelItem } from '../../stores/modelStore';
import { HardwareProfile, calculateCompatibility, CompatibilityLevel } from '../../utils/compatibility';
import { useApprovalStore } from '../../stores/approvalStore';
import { useRuntimeStore } from '../../stores/runtimeStore';
import { LocalModel } from '../../core/runtime/runtimeTypes';
import { useChatStore } from '../../stores/chatStore';
import { ExecutionPlan } from '../../core/skills/skillTypes';

export function ModelCatalog() {
  const { models, primaryModelId, fallbackModelId, setPrimaryModel } = useModelStore();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('todos');
  const [hwProfile, setHwProfile] = useState<HardwareProfile | null>(null);
  const { localModels, fetchLocalModels } = useRuntimeStore();

  useEffect(() => {
    invoke<HardwareProfile>('get_system_hardware')
      .then(setHwProfile)
      .catch(console.error);

    fetchLocalModels();
  }, [fetchLocalModels]);

  const filterOptions = ['todos', 'código', 'conversa', 'raciocínio', 'leve', 'médio', 'pesado', 'experimental', 'AirLLM', 'Ollama', 'llama.cpp'];

  const filteredModels = models.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === 'todos' || m.tags.includes(activeFilter);
    return matchesSearch && matchesFilter;
  }).map(m => {
    // Override installed status if found in localModels
    const isLocal = localModels.some((lm: LocalModel) => lm.id.toLowerCase() === m.id.toLowerCase() || lm.id.toLowerCase() === m.name.toLowerCase());
    return {
      ...m,
      status: isLocal ? 'installed' : m.status
    } as ModelItem;
  });

  return (
    <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
        <h2 className="app-section-title" style={{ marginBottom: 0 }}>Catálogo de Modelos</h2>
        {hwProfile && (
          <div className="app-panel" style={{ padding: 'var(--space-2) var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Seu Hardware:</span>
            <span style={{ fontSize: '0.875rem' }}>{hwProfile.total_ram_gb.toFixed(1)}GB RAM • {hwProfile.cpu_name}</span>
            {hwProfile.zram_detected && <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>(ZRAM Detectado)</span>}
          </div>
        )}
      </div>

      <div className="app-toolbar">
        <input
          type="text"
          placeholder="Buscar modelos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="app-input"
          style={{ maxWidth: '400px' }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {filterOptions.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`app-chip ${activeFilter === filter ? 'app-chip-active' : ''}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'var(--space-4)' }}>
        <div className="app-card-grid">
          {filteredModels.map((model) => {
            const compLevel = calculateCompatibility(model.ramRequired, hwProfile, model.tags.includes('experimental'));
            return (
              <ModelCard
                key={model.id}
                model={model}
                isPrimary={primaryModelId === model.id}
                isFallback={fallbackModelId === model.id}
                compatibility={compLevel}
                onSetPrimary={() => setPrimaryModel(model.id)}
              />
            );
          })}
        </div>
        {filteredModels.length === 0 && (
          <div className="app-empty-state">
            <span style={{ fontSize: '2rem', marginBottom: 'var(--space-4)' }}>🔍</span>
            <p style={{ color: 'var(--text-muted)' }}>Nenhum modelo encontrado para este filtro.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ModelCard({ model, isPrimary, isFallback, compatibility, onSetPrimary }: { model: ModelItem, isPrimary: boolean, isFallback: boolean, compatibility: CompatibilityLevel, onSetPrimary: () => void }) {
  const { requestApproval } = useApprovalStore();
  const { addMessage } = useChatStore();

  const handleDownloadPlan = async () => {
    try {
      const plan = await invoke('create_ollama_pull_plan', { model: model.id });
      requestApproval(plan as ExecutionPlan);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemovePlan = async () => {
    try {
      const plan = await invoke('create_ollama_rm_plan', { model: model.id });
      requestApproval(plan as ExecutionPlan);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestModel = async () => {
    addMessage({ sender: 'system', content: `Iniciando teste do modelo ${model.id}...` });
    // Switch to Chat Panel ideally or just send a message
    // Since we are in Catalog, we can just trigger a mock chat action
    // Real implementation would invoke runtimeClient.generate or Ollama depending on backend.
    try {
      const { generateOllamaText, checkOllamaStatus } = await import('../../core/runtime/ollamaClient');
      const start = Date.now();
      if (await checkOllamaStatus()) {
         const res = await generateOllamaText(model.id, "Responda apenas: modelo funcionando.");
         const elapsed = Date.now() - start;
         addMessage({ sender: 'ai', content: `✅ Modelo respondeu com sucesso.\nRuntime: Ollama\nModelo: ${model.id}\nTempo: ${elapsed}ms\nResposta: ${res}` });
      } else {
         addMessage({ sender: 'system', content: `❌ Falha no teste: Ollama não está ativo.` });
      }
    } catch(e) {
       addMessage({ sender: 'system', content: `❌ Falha no teste: ${String(e)}` });
    }
  };

  const compBadgeClass = compatibility === 'Excelente' ? 'app-badge-success' : compatibility === 'Sofrido' ? 'app-badge-danger' : 'app-badge-warning';
  const statusBadgeClass = model.status === 'installed' ? 'app-badge-success' : model.status === 'needs_validation' ? 'app-badge-warning' : 'app-badge-muted';

  return (
    <div className={`app-card ${isPrimary ? 'primary' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {model.name}
            {isPrimary && <span className="app-badge app-badge-info">Principal</span>}
            {isFallback && <span className="app-badge app-badge-muted">Fallback</span>}
          </h3>
          <p className="app-subtitle">{model.description}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-4)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Status:</span>
          <span className={`app-badge ${statusBadgeClass}`}>
            {model.status === 'installed' ? 'Instalado' : model.status === 'needs_validation' ? 'Necessita Validação' : 'Não Instalado'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Compatibilidade:</span>
          <span className={`app-badge ${compBadgeClass}`}>{compatibility}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Tamanho:</span>
          <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{model.weight} (Estimado)</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>RAM necessária:</span>
          <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>~{model.ramRequired} GB</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', padding: 'var(--space-3)', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <div>
          <span style={{ fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)', textTransform: 'uppercase', fontSize: '0.625rem' }}>Recomendado</span>
          <span style={{ color: 'var(--text-main)' }}>{model.recommendedUse}</span>
        </div>
        <div>
          <span style={{ fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)', textTransform: 'uppercase', fontSize: '0.625rem' }}>Backends</span>
          <span style={{ color: 'var(--text-main)' }}>{model.backends.join(', ')}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {model.tags.map(tag => (
          <span key={tag} className="app-badge app-badge-muted">#{tag}</span>
        ))}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {model.status !== 'installed' ? (
          <button onClick={handleDownloadPlan} className="app-button app-button-primary" style={{ width: '100%', marginBottom: 'var(--space-2)' }}>
            ⬇️ Baixar / Instalar
          </button>
        ) : (
          <button onClick={handleRemovePlan} className="app-button app-button-danger" style={{ width: '100%', marginBottom: 'var(--space-2)', backgroundColor: 'var(--color-danger)', color: 'white' }}>
            🗑️ Remover Modelo
          </button>
        )}

        <div style={{ display: 'flex', width: '100%', gap: 'var(--space-2)' }}>
          <button onClick={onSetPrimary} disabled={isPrimary || model.status !== 'installed'} className="app-button app-button-secondary" style={{ flex: 1 }}>
            Principal
          </button>
          <button onClick={handleTestModel} disabled={model.status !== 'installed'} className="app-button app-button-secondary" style={{ flex: 1 }}>
            Testar
          </button>
        </div>
      </div>
    </div>
  );
}
