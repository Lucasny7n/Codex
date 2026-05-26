import type { AppHealthCheck, HardwareSnapshot, LocalRuntimeSnapshot } from '../../types/domain';
import type { ToolDescriptor } from './types';

/** The intended (non-secret) command for a system update on this target. */
export const SYSTEM_UPDATE_COMMAND = 'sudo pacman -Syu';

export const TOOLS: Record<string, ToolDescriptor> = {
  get_hardware_summary: {
    id: 'get_hardware_summary',
    description: 'Lê o hardware real detectado (CPU, RAM, GPU/VRAM, swap, disco, aceleradores).',
    schema: {},
    risk: 'safe',
    requiresApproval: false,
  },
  list_local_models: {
    id: 'list_local_models',
    description: 'Lista os modelos locais instalados via Ollama.',
    schema: {},
    risk: 'safe',
    requiresApproval: false,
  },
  get_health_status: {
    id: 'get_health_status',
    description: 'Roda o diagnóstico de saúde do app e do sistema.',
    schema: {},
    risk: 'safe',
    requiresApproval: false,
  },
  request_system_update: {
    id: 'request_system_update',
    description: 'Prepara uma atualização do sistema. Sempre via aprovação; nunca executa direto.',
    schema: {},
    risk: 'elevated',
    requiresApproval: true,
  },
};

function gib(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return 'desconhecido';
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

const VENDOR_LABEL: Record<string, string> = { amd: 'AMD', nvidia: 'NVIDIA', intel: 'Intel', other: 'Outro', unknown: 'Desconhecido' };
const ACCEL_STATUS_LABEL: Record<string, string> = { healthy: 'saudável', present: 'presente', unavailable: 'indisponível', unknown: 'não testado' };

export function formatHardware(snapshot: HardwareSnapshot): string {
  const lines: string[] = ['Hardware detectado:'];
  if (snapshot.cpu.model) {
    const cores = snapshot.cpu.physicalCores ? ` (${snapshot.cpu.physicalCores} núcleos / ${snapshot.cpu.logicalThreads ?? '?'} threads)` : '';
    lines.push(`- CPU: ${snapshot.cpu.model}${cores}`);
  }
  lines.push(`- RAM: ${gib(snapshot.memory.totalBytes)} (livre ~${gib(snapshot.memory.availableBytes)}, swap ${gib(snapshot.memory.swapTotalBytes)})`);
  if (snapshot.gpus.length > 0) {
    for (const gpu of snapshot.gpus) {
      lines.push(`- GPU: ${VENDOR_LABEL[gpu.vendor] ?? gpu.vendor}${gpu.name ? ` ${gpu.name}` : ''} — VRAM ${gib(gpu.vramTotalBytes)}`);
    }
  } else {
    lines.push('- GPU: nenhuma detectada');
  }
  const accels = snapshot.accelerators
    .filter((accel) => accel.api !== 'cpu')
    .map((accel) => `${accel.api.toUpperCase()}: ${ACCEL_STATUS_LABEL[accel.status] ?? accel.status}`);
  if (accels.length > 0) lines.push(`- Aceleradores: ${accels.join(', ')}`);
  if (snapshot.notes.length > 0) lines.push(`- Notas: ${snapshot.notes.join('; ')}`);
  return lines.join('\n');
}

export function formatModels(snapshot: LocalRuntimeSnapshot): string {
  if (!snapshot.apiReachable && snapshot.installedModels.length === 0) {
    return 'Não consegui falar com o Ollama agora. Verifique se o serviço local está ativo.';
  }
  if (snapshot.installedModels.length === 0) {
    return 'Você ainda não tem modelos locais instalados via Ollama.';
  }
  const lines = ['Modelos locais instalados:'];
  for (const model of snapshot.installedModels) {
    lines.push(`- ${model.id}${model.size ? ` (${model.size})` : ''}`);
  }
  if (snapshot.activeModelId) lines.push(`Ativo: ${snapshot.activeModelId}`);
  return lines.join('\n');
}

export function formatHealth(health: AppHealthCheck): string {
  const problems = (health.providers ?? []).length;
  const ollama = health.ollama;
  const lines = ['Diagnóstico do sistema:'];
  lines.push(`- Ollama: ${ollama.apiReachable ? 'acessível' : 'inacessível'}${ollama.problems.length ? ` (${ollama.problems.length} problema(s))` : ''}`);
  lines.push(`- Node: ${health.nodeOk ? 'ok' : 'ausente'} · npm: ${health.npmOk ? 'ok' : 'ausente'} · cargo: ${health.cargoOk ? 'ok' : 'ausente'}`);
  if (ollama.problems.length > 0) {
    lines.push('Problemas encontrados:');
    for (const problem of ollama.problems.slice(0, 6)) lines.push(`- ${problem}`);
  } else if (problems === 0) {
    lines.push('Nada crítico detectado.');
  }
  return lines.join('\n');
}
