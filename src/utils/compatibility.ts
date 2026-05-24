export type CompatibilityLevel = 'Excelente' | 'Bom' | 'Usável' | 'Pesado' | 'Sofrido' | 'Experimental' | 'Não recomendado' | 'Impossível';

export interface HardwareProfile {
  cpu_name: string;
  total_ram_gb: number;
  free_ram_gb: number;
  swap_total_gb: number;
  zram_detected: boolean;
  os_name: string;
  kernel_version: string;
  wayland_detected: boolean;
}

export function calculateCompatibility(modelRamRequired: number, hw: HardwareProfile | null, isExperimentalTag: boolean): CompatibilityLevel {
  if (!hw) return 'Experimental';
  
  if (isExperimentalTag) {
    if (modelRamRequired > hw.total_ram_gb * 1.5) return 'Impossível';
    return 'Experimental';
  }

  const ratio = modelRamRequired / hw.total_ram_gb;

  if (ratio > 2.0) return 'Impossível';
  if (ratio > 1.2) return 'Não recomendado';
  if (ratio > 0.9) return 'Sofrido';
  if (ratio > 0.7) return 'Pesado';
  if (ratio > 0.5) return 'Usável';
  if (ratio > 0.3) return 'Bom';
  
  return 'Excelente';
}

export function getCompatibilityColor(level: CompatibilityLevel): string {
  switch (level) {
    case 'Excelente': return 'text-green-400 bg-green-900/30';
    case 'Bom': return 'text-emerald-400 bg-emerald-900/30';
    case 'Usável': return 'text-blue-400 bg-blue-900/30';
    case 'Pesado': return 'text-yellow-400 bg-yellow-900/30';
    case 'Sofrido': return 'text-orange-400 bg-orange-900/30';
    case 'Experimental': return 'text-purple-400 bg-purple-900/30 border border-purple-800';
    case 'Não recomendado': return 'text-red-400 bg-red-900/30';
    case 'Impossível': return 'text-red-600 bg-red-900/50 font-bold border border-red-900';
    default: return 'text-gray-400 bg-gray-800';
  }
}
