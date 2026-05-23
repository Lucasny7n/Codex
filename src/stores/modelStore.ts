import { create } from 'zustand';

export interface ModelItem {
  id: string;
  name: string;
  description: string;
  recommendedUse: string;
  weight: string;
  ramRequired: number; // In GB
  backends: string[];
  tags: string[];
  needsValidation: boolean;
  status: 'installed' | 'not_installed' | 'needs_validation';
}

interface ModelStore {
  models: ModelItem[];
  primaryModelId: string | null;
  fallbackModelId: string | null;
  setPrimaryModel: (id: string) => void;
  setFallbackModel: (id: string) => void;
}

export const CATALOG: ModelItem[] = [
  {
    id: 'gpt-oss-20b', name: 'gpt-oss-20b', description: 'Modelo geral open-source otimizado.', recommendedUse: 'Tarefas gerais, análise de texto.', weight: '12GB', ramRequired: 16, backends: ['Ollama', 'llama.cpp'], tags: ['conversa', 'médio', 'Ollama', 'llama.cpp'], needsValidation: false, status: 'not_installed'
  },
  {
    id: 'gpt-oss-120b', name: 'gpt-oss-120b', description: 'Modelo gigante para raciocínio profundo.', recommendedUse: 'Análise complexa, arquitetura.', weight: '70GB', ramRequired: 128, backends: ['AirLLM'], tags: ['raciocínio', 'pesado', 'experimental', 'AirLLM'], needsValidation: true, status: 'not_installed'
  },
  {
    id: 'qwen2.5-coder-7b', name: 'Qwen2.5-Coder 7B', description: 'Modelo focado em código rápido.', recommendedUse: 'Autocompletar, scripts curtos.', weight: '4.5GB', ramRequired: 8, backends: ['Ollama'], tags: ['código', 'leve', 'Ollama'], needsValidation: false, status: 'not_installed'
  },
  {
    id: 'qwen2.5-coder-14b', name: 'Qwen2.5-Coder 14B', description: 'Modelo avançado para código.', recommendedUse: 'Refatoração, análise de projetos.', weight: '9GB', ramRequired: 16, backends: ['Ollama', 'llama.cpp'], tags: ['código', 'médio', 'Ollama', 'llama.cpp'], needsValidation: false, status: 'installed' // Fake para MVP parecer que tem algo
  },
  {
    id: 'qwen2.5-coder-32b', name: 'Qwen2.5-Coder 32B', description: 'Modelo estado da arte para código.', recommendedUse: 'Desenvolvimento complexo ponta a ponta.', weight: '20GB', ramRequired: 32, backends: ['llama.cpp', 'AirLLM'], tags: ['código', 'pesado', 'AirLLM', 'llama.cpp'], needsValidation: true, status: 'not_installed'
  },
  {
    id: 'deepseek-r1-distill-14b', name: 'DeepSeek-R1-Distill 14B', description: 'Modelo destilado do R1.', recommendedUse: 'Raciocínio lógico intermediário.', weight: '9GB', ramRequired: 16, backends: ['Ollama'], tags: ['raciocínio', 'médio', 'Ollama'], needsValidation: false, status: 'not_installed'
  },
  {
    id: 'deepseek-r1-distill-32b', name: 'DeepSeek-R1-Distill 32B', description: 'Modelo destilado poderoso.', recommendedUse: 'Raciocínio lógico avançado.', weight: '20GB', ramRequired: 32, backends: ['Ollama', 'llama.cpp'], tags: ['raciocínio', 'pesado', 'Ollama', 'llama.cpp'], needsValidation: false, status: 'not_installed'
  },
  {
    id: 'llama-3.1-8b', name: 'Llama 3.1 8B', description: 'Modelo versátil de 8B da Meta.', recommendedUse: 'Assistente geral rápido.', weight: '5GB', ramRequired: 8, backends: ['Ollama'], tags: ['conversa', 'leve', 'Ollama'], needsValidation: false, status: 'not_installed'
  },
  {
    id: 'mistral-7b', name: 'Mistral 7B', description: 'Modelo clássico muito rápido.', recommendedUse: 'Geração rápida de texto.', weight: '4.5GB', ramRequired: 8, backends: ['Ollama', 'llama.cpp'], tags: ['conversa', 'leve', 'Ollama', 'llama.cpp'], needsValidation: false, status: 'not_installed'
  },
  {
    id: 'gemma-2-9b', name: 'Gemma 2 9B', description: 'Modelo Google leve e denso.', recommendedUse: 'Tarefas em português, raciocínio.', weight: '6GB', ramRequired: 12, backends: ['Ollama'], tags: ['conversa', 'médio', 'Ollama'], needsValidation: false, status: 'not_installed'
  }
];

export const useModelStore = create<ModelStore>((set) => ({
  models: CATALOG,
  primaryModelId: 'qwen2.5-coder-14b',
  fallbackModelId: 'llama-3.1-8b',
  setPrimaryModel: (id) => set({ primaryModelId: id }),
  setFallbackModel: (id) => set({ fallbackModelId: id }),
}));
