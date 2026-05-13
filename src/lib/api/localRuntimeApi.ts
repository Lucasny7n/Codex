import { invoke } from '@tauri-apps/api/core';
import type {
  LocalRuntimeSnapshot,
  OllamaLibrarySearchResult,
  OllamaModelDetails,
} from '../../types/domain';

export async function getLocalRuntimeState(): Promise<LocalRuntimeSnapshot> {
  return invoke('get_local_runtime_state');
}

export async function installLocalModel(modelId: string): Promise<LocalRuntimeSnapshot> {
  return invoke('install_local_model', { modelId });
}

export async function removeLocalModel(modelId: string): Promise<LocalRuntimeSnapshot> {
  return invoke('remove_local_model', { modelId });
}

export async function showLocalModel(modelId: string): Promise<OllamaModelDetails> {
  return invoke('show_local_model', { modelId });
}

export async function searchOllamaLibrary(query: string): Promise<OllamaLibrarySearchResult[]> {
  return invoke('search_ollama_library', { query });
}
