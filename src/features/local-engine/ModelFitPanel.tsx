import { useState } from 'react';
import { Badge } from '../../components/common/Badge';
import { formatGib } from '../../lib/utils/format';
import type { FitClass, ModelRuntimeRequest, RuntimeEstimate, WarningSeverity } from '../../types/domain';

const FIT_LABELS: Record<FitClass, string> = {
  excellent: 'Recomendado',
  fits: 'Cabe',
  tight: 'Apertado',
  slow_swap: 'Lento / usa swap',
  wont_run: 'Não roda',
  unknown: 'Desconhecido',
};

type BadgeTone = 'ok' | 'info' | 'warn' | 'danger' | 'neutral';

const FIT_TONES: Record<FitClass, BadgeTone> = {
  excellent: 'ok',
  fits: 'info',
  tight: 'warn',
  slow_swap: 'warn',
  wont_run: 'danger',
  unknown: 'neutral',
};

const SEVERITY_TONES: Record<WarningSeverity, BadgeTone> = {
  info: 'info',
  warning: 'warn',
  strong: 'danger',
};

const QUANT_OPTIONS = [
  { value: '', label: 'Auto' },
  { value: 'Q4_K_M', label: 'Q4_K_M — menor, mais rápido' },
  { value: 'Q5_K_M', label: 'Q5_K_M — equilíbrio' },
  { value: 'Q8_0', label: 'Q8_0 — qualidade alta' },
  { value: 'F16', label: 'F16 — precisão máxima' },
];

interface ModelFitPanelProps {
  onEstimate: (req: ModelRuntimeRequest) => Promise<RuntimeEstimate>;
  loading: boolean;
  result?: RuntimeEstimate;
  error?: string;
}

export function ModelFitPanel({ onEstimate, loading, result, error }: ModelFitPanelProps): JSX.Element {
  const [modelId, setModelId] = useState('');
  const [parameterLabel, setParameterLabel] = useState('');
  const [quantization, setQuantization] = useState('');
  const [contextSize, setContextSize] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId.trim()) return;
    const req: ModelRuntimeRequest = {
      modelId: modelId.trim(),
      parameterLabel: parameterLabel.trim() || undefined,
      quantization: quantization || undefined,
      contextSize: contextSize ? parseInt(contextSize, 10) : undefined,
    };
    void onEstimate(req);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className="settings-line">
          <label htmlFor="fit-model-id">
            <strong>Modelo</strong>
            <small>ID ou nome (ex: qwen2.5-coder:7b)</small>
          </label>
          <input
            id="fit-model-id"
            type="text"
            className="settings-input"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="qwen2.5-coder:7b"
          />
        </div>

        <div className="settings-line">
          <label htmlFor="fit-params">
            <strong>Parâmetros</strong>
            <small>Tamanho aproximado (ex: 7b, 13b)</small>
          </label>
          <input
            id="fit-params"
            type="text"
            className="settings-input"
            value={parameterLabel}
            onChange={(e) => setParameterLabel(e.target.value)}
            placeholder="7b"
          />
        </div>

        <div className="settings-line">
          <label htmlFor="fit-quant">
            <strong>Quantização</strong>
          </label>
          <select
            id="fit-quant"
            className="settings-input"
            value={quantization}
            onChange={(e) => setQuantization(e.target.value)}
          >
            {QUANT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-line">
          <label htmlFor="fit-ctx">
            <strong>Contexto</strong>
            <small>Tokens (ex: 4096, 8192)</small>
          </label>
          <input
            id="fit-ctx"
            type="number"
            className="settings-input"
            value={contextSize}
            onChange={(e) => setContextSize(e.target.value)}
            placeholder="4096"
            min={512}
            max={131072}
          />
        </div>

        <button
          type="submit"
          className="settings-pill-button"
          disabled={!modelId.trim() || loading}
        >
          {loading ? 'Calculando...' : 'Estimar'}
        </button>
      </form>

      {error ? (
        <div className="input-error-tip" role="alert" style={{ marginTop: '0.5rem' }}>{error}</div>
      ) : null}

      {result ? (
        <div className="health-item-card" style={{ marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Badge tone={FIT_TONES[result.fit]}>{FIT_LABELS[result.fit]}</Badge>
            {result.recommended ? <Badge tone="ok">Recomendado</Badge> : null}
            {result.experimental ? <Badge tone="warn">Experimental</Badge> : null}
          </div>
          <p>{result.speedHint}</p>
          <small>RAM estimada: {formatGib(result.ramRequiredBytes)}</small>
          {result.vramRequiredBytes != null ? (
            <small> · VRAM estimada: {formatGib(result.vramRequiredBytes)}</small>
          ) : null}
          <small> · Contexto recomendado: {result.recommendedContext.toLocaleString()} tokens</small>

          {result.warnings.length > 0 ? (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem' }}>
              {result.warnings.map((w, i) => (
                <li key={i}>
                  <Badge tone={SEVERITY_TONES[w.severity]}>{w.message}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
