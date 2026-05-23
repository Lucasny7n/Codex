import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useModelStore, ModelItem } from '../../stores/modelStore';
import { HardwareProfile, calculateCompatibility, getCompatibilityColor, CompatibilityLevel } from '../../utils/compatibility';

export function ModelCatalog() {
  const { models, primaryModelId, fallbackModelId, setPrimaryModel, setFallbackModel } = useModelStore();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('todos');
  const [hwProfile, setHwProfile] = useState<HardwareProfile | null>(null);

  useEffect(() => {
    invoke<HardwareProfile>('get_system_hardware')
      .then(setHwProfile)
      .catch(console.error);
  }, []);

  const filterOptions = ['todos', 'código', 'conversa', 'raciocínio', 'leve', 'médio', 'pesado', 'experimental', 'AirLLM', 'Ollama', 'llama.cpp'];

  const filteredModels = models.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === 'todos' || m.tags.includes(activeFilter);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-6 bg-[var(--bg-main)] h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-2xl font-bold text-white">Catálogo de Modelos</h2>
        {hwProfile && (
          <div className="text-right text-xs text-gray-400 bg-[var(--bg-panel)] p-2 rounded border border-[var(--border-color)]">
            <span className="font-semibold text-gray-300 block mb-1">Seu Hardware:</span>
            {hwProfile.total_ram_gb.toFixed(1)}GB RAM • {hwProfile.cpu_name}
            {hwProfile.zram_detected && <span className="text-blue-400 ml-2">(ZRAM Detectado)</span>}
          </div>
        )}
      </div>
      
      <div className="mb-6 space-y-4 flex-shrink-0">
        <input 
          type="text" 
          placeholder="Buscar modelos..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg p-3 text-white outline-none focus:border-blue-500"
        />
        
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeFilter === filter 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-[var(--bg-hover)] text-gray-400 hover:text-gray-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
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
              onSetFallback={() => setFallbackModel(model.id)}
            />
          );
        })}
        {filteredModels.length === 0 && (
          <p className="text-gray-400 text-center py-8">Nenhum modelo encontrado.</p>
        )}
      </div>
    </div>
  );
}

function ModelCard({ model, isPrimary, isFallback, compatibility, onSetPrimary, onSetFallback }: { model: ModelItem, isPrimary: boolean, isFallback: boolean, compatibility: CompatibilityLevel, onSetPrimary: () => void, onSetFallback: () => void }) {
  return (
    <div className={`p-5 rounded-xl border ${isPrimary ? 'border-blue-500 bg-blue-900/10' : 'border-[var(--border-color)] bg-[var(--bg-panel)]'}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
            {model.name}
            {isPrimary && <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white font-medium">Principal</span>}
            {isFallback && <span className="text-xs bg-gray-600 px-2 py-0.5 rounded text-white font-medium">Fallback</span>}
          </h3>
          <p className="text-sm text-gray-400 mt-1">{model.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-1 rounded font-medium ${model.status === 'installed' ? 'bg-green-900/50 text-green-400' : model.status === 'needs_validation' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-gray-800 text-gray-500'}`}>
            {model.status === 'installed' ? 'Instalado' : model.status === 'needs_validation' ? 'Necessita Validação' : 'Não Instalado'}
          </span>
          <span className={`text-xs px-2 py-1 rounded font-medium mt-1 ${getCompatibilityColor(compatibility)}`}>
            {compatibility}
          </span>
          <span className="text-xs text-gray-500 mt-1">{model.weight} • RAM: {model.ramRequired}GB</span>
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-gray-400">
        <div>
          <span className="font-semibold text-gray-500 block mb-1">Recomendado para:</span>
          {model.recommendedUse}
        </div>
        <div>
          <span className="font-semibold text-gray-500 block mb-1">Backends:</span>
          {model.backends.join(', ')}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {model.tags.map(tag => (
          <span key={tag} className="text-[10px] px-2 py-1 bg-[var(--bg-hover)] text-gray-400 rounded">#{tag}</span>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex gap-2">
        <button onClick={onSetPrimary} disabled={isPrimary} className="text-xs px-3 py-1.5 bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] disabled:opacity-50 text-gray-300 rounded transition-colors">
          Definir Principal
        </button>
        <button onClick={onSetFallback} disabled={isFallback} className="text-xs px-3 py-1.5 bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] disabled:opacity-50 text-gray-300 rounded transition-colors">
          Definir Fallback
        </button>
      </div>
    </div>
  );
}
