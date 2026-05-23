import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { HardwareInfo, RuntimeStatus, SidecarStatusResponse, SidecarGenerateResponse, LocalModel } from '../core/runtime/runtimeTypes';
import { ExecutionPlan } from '../types/approval';

interface RuntimeStore {
  hardware: HardwareInfo | null;
  status: RuntimeStatus;
  localModels: LocalModel[];
  
  checkRuntimeStatus: () => Promise<void>;
  loadHardware: () => Promise<void>;
  fetchLocalModels: () => Promise<void>;
  generateText: (modelPath: string, prompt: string) => Promise<SidecarGenerateResponse>;
  createSetupPlan: () => Promise<ExecutionPlan>;
}

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  hardware: null,
  status: {
    installed: false,
    ready: false,
    selectedModelId: null,
    loadedModelId: null,
    fallbackActive: true,
    lastRuntimeError: null,
    device: null,
    pythonVersion: null,
  },
  localModels: [],

  checkRuntimeStatus: async () => {
    try {
      const resp: SidecarStatusResponse = await invoke('run_airllm_status');
      
      set(state => ({
        status: {
          ...state.status,
          installed: !!resp.airllm_installed,
          ready: resp.ok,
          fallbackActive: !resp.ok,
          lastRuntimeError: resp.ok ? null : resp.message,
          device: resp.device || null,
          pythonVersion: resp.python || null,
        }
      }));
    } catch (e: unknown) {
      set(state => ({
        status: {
          ...state.status,
          installed: false,
          ready: false,
          fallbackActive: true,
          lastRuntimeError: String(e),
        }
      }));
    }
  },

  fetchLocalModels: async () => {
    try {
      const models: LocalModel[] = await invoke('list_local_models');
      set({ localModels: models });
    } catch (e) {
      console.error("Erro ao buscar modelos locais", e);
    }
  },

  generateText: async (modelPath: string, prompt: string) => {
    return await invoke('run_airllm_generate', { model: modelPath, prompt });
  },

  createSetupPlan: async () => {
    return await invoke('create_airllm_setup_plan');
  },

  loadHardware: async () => {
    try {
      const hw: HardwareInfo = await invoke('get_system_hardware');
      set({ hardware: hw });
    } catch (e) {
      console.error(e);
    }
  }
}));
