export interface RuntimeStatus {
  installed: boolean;
  ready: boolean;
  selectedModelId: string | null;
  loadedModelId: string | null;
  fallbackActive: boolean;
  lastRuntimeError: string | null;
  device: string | null;
  pythonVersion: string | null;
}

export interface SidecarStatusResponse {
  ok: boolean;
  python?: string;
  airllm_installed?: boolean;
  torch_installed?: boolean;
  device?: string;
  code?: string;
  message: string;
}

export interface SidecarGenerateResponse {
  ok: boolean;
  model?: string;
  response?: string;
  tokens_per_second?: number;
  elapsed_ms?: number;
  code?: string;
  message?: string;
}

export interface LocalModel {
  id: string;
  path: string;
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
