import { Badge } from '../../components/common/Badge';
import { formatGib } from '../../lib/utils/format';
import { formatDateTime } from '../../lib/utils/format';
import type {
  AcceleratorStatus,
  HardwareSnapshot,
} from '../../types/domain';

const PROFILE_TAG_LABELS: Record<string, string> = {
  weak_pc: 'PC fraco',
  medium_pc: 'PC médio',
  low_ram_pc: 'Pouca RAM',
  high_ram_pc: 'RAM abundante',
  amd_pc: 'AMD',
  amd_vulkan_pc: 'AMD + Vulkan',
  amd_rocm_pc: 'AMD + ROCm',
  nvidia_pc: 'NVIDIA',
  intel_arc_pc: 'Intel Arc',
  server: 'Servidor',
  experimental: 'Experimental',
};

const ACCEL_LABELS: Record<string, string> = {
  cuda: 'CUDA',
  rocm: 'ROCm',
  hip: 'HIP',
  vulkan: 'Vulkan',
  sycl: 'SYCL',
  open_cl: 'OpenCL',
  cpu: 'CPU',
};

function accelTone(status: AcceleratorStatus) {
  if (status === 'healthy') return 'ok' as const;
  if (status === 'present') return 'info' as const;
  if (status === 'unavailable') return 'warn' as const;
  return 'neutral' as const;
}

interface HardwareSummaryProps {
  snapshot: HardwareSnapshot;
}

export function HardwareSummary({ snapshot }: HardwareSummaryProps): JSX.Element {
  const { os, cpu, memory, gpus, disks, accelerators, profileTags, notes, detectedAt } = snapshot;

  // Warn for systems with 16 GB or less (threshold: 17 GiB)
  const ramLimited = memory.totalBytes <= 17_179_869_184;

  return (
    <div className="ollama-manager">
      <div className="ollama-manager-header">
        <div>
          <strong>{os.distro ?? os.os}</strong>
          {os.kernel ? <small> · kernel {os.kernel}</small> : null}
        </div>
        <small>Detectado em {formatDateTime(detectedAt)}</small>
      </div>

      <div className="ollama-model-meta">
        <span>
          <strong>CPU</strong>
          <small>{cpu.model ?? 'desconhecida'}</small>
          {cpu.physicalCores != null && cpu.logicalThreads != null ? (
            <small>{cpu.physicalCores}c / {cpu.logicalThreads}t</small>
          ) : null}
        </span>

        <span>
          <strong>RAM</strong>
          <small>{formatGib(memory.totalBytes)} total</small>
          {memory.availableBytes != null ? (
            <small>{formatGib(memory.availableBytes)} livre</small>
          ) : null}
          {memory.swapTotalBytes > 0 ? (
            <small>swap {formatGib(memory.swapTotalBytes)}</small>
          ) : null}
        </span>

        {gpus.map((gpu, i) => (
          <span key={i}>
            <strong>GPU</strong>
            <small>{gpu.name ?? gpu.vendor}</small>
            {gpu.vramTotalBytes != null ? (
              <small>VRAM {formatGib(gpu.vramTotalBytes)}</small>
            ) : null}
          </span>
        ))}

        {disks.map((disk, i) => (
          <span key={i}>
            <strong>Disco ({disk.mount})</strong>
            <small>{formatGib(disk.availableBytes)} livres de {formatGib(disk.totalBytes)}</small>
          </span>
        ))}
      </div>

      {ramLimited ? (
        <div className="input-error-tip" role="note">
          RAM limitada — modelos acima de 7B podem usar swap e ficarem lentos.
        </div>
      ) : null}

      {accelerators.length > 0 || profileTags.length > 0 || notes.length > 0 ? (
        <details className="settings-details hardware-tech-details">
          <summary>Detalhes técnicos</summary>
          {accelerators.length > 0 ? (
            <div className="health-item-grid" style={{ marginTop: '0.5rem' }}>
              {accelerators.map((acc, i) => (
                <article key={i} className="health-item-card">
                  <strong>{ACCEL_LABELS[acc.api] ?? acc.api}</strong>
                  <Badge tone={accelTone(acc.status)}>
                    {acc.status === 'healthy' ? 'funcional' :
                     acc.status === 'present' ? 'presente' :
                     acc.status === 'unavailable' ? 'indisponível' : 'desconhecido'}
                  </Badge>
                  {acc.detail ? <p>{acc.detail}</p> : null}
                </article>
              ))}
            </div>
          ) : null}

          {profileTags.length > 0 ? (
            <div className="ollama-model-meta" style={{ marginTop: '0.5rem' }}>
              {profileTags.map((tag) => (
                <Badge key={tag} tone="neutral">{PROFILE_TAG_LABELS[tag] ?? tag}</Badge>
              ))}
            </div>
          ) : null}

          {notes.length > 0 ? (
            <ul className="settings-block">
              {notes.map((note, i) => <li key={i}><small>{note}</small></li>)}
            </ul>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
