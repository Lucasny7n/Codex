import { create } from 'zustand';

export interface RuntimeStatus {
  python_detected: boolean;
  python_version: string | null;
  python_path: string | null;
  venv_exists: boolean;
  airllm_installed: boolean;
}

export interface HardwareInfo {
  cpu_name: string;
  total_ram_gb: number;
  free_ram_gb: number;
  swap_total_gb: number;
  zram_detected: boolean;
  os_name: string;
  kernel_version: string;
  wayland_detected: boolean;
}

interface RuntimeStore {
  runtime: RuntimeStatus | null;
  hardware: HardwareInfo | null;
  setRuntime: (status: RuntimeStatus) => void;
  setHardware: (hw: HardwareInfo) => void;
}

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  runtime: null,
  hardware: null,
  setRuntime: (status) => set({ runtime: status }),
  setHardware: (hw) => set({ hardware: hw })
}));
