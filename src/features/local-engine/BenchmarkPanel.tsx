import { useState } from 'react';
import { formatGib } from '../../lib/utils/format';
import type { BackendStatus, BenchmarkResult, RuntimeBackendId } from '../../types/domain';

interface BenchmarkPanelProps {
  modelId: string;
  backends: BackendStatus[];
  onTest: (modelId: string, backendId: RuntimeBackendId) => Promise<BenchmarkResult>;
  onBenchmark: (modelId: string, backendId: RuntimeBackendId) => Promise<BenchmarkResult>;
}

export function BenchmarkPanel({ modelId, backends, onTest, onBenchmark }: BenchmarkPanelProps): JSX.Element {
  const readyBackends = backends.filter((b) => b.availability === 'ready');
  const [selectedBackendId, setSelectedBackendId] = useState<RuntimeBackendId | ''>('');
  const [result, setResult] = useState<BenchmarkResult | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (readyBackends.length === 0) {
    return (
      <div className="model-picker-empty" role="status">
        <strong>Benchmark indisponível</strong>
        <span>Nenhum backend pronto. Instale Ollama ou llama.cpp primeiro.</span>
      </div>
    );
  }

  const backendId = (selectedBackendId || readyBackends[0]?.id) as RuntimeBackendId;

  async function run(fn: (m: string, b: RuntimeBackendId) => Promise<BenchmarkResult>) {
    if (!modelId.trim() || !backendId) return;
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const r = await fn(modelId.trim(), backendId);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="settings-line">
        <label htmlFor="bench-backend">
          <strong>Backend</strong>
        </label>
        <select
          id="bench-backend"
          className="settings-input"
          value={selectedBackendId || (readyBackends[0]?.id ?? '')}
          onChange={(e) => setSelectedBackendId(e.target.value as RuntimeBackendId)}
          disabled={busy}
        >
          {readyBackends.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button
          type="button"
          className="settings-pill-button"
          disabled={busy || !modelId.trim()}
          onClick={() => void run(onTest)}
        >
          {busy ? 'Executando...' : 'Testar (rápido)'}
        </button>
        <button
          type="button"
          className="settings-pill-button"
          disabled={busy || !modelId.trim()}
          onClick={() => void run(onBenchmark)}
        >
          Benchmark completo
        </button>
      </div>

      {error ? (
        <div className="input-error-tip" role="alert" style={{ marginTop: '0.5rem' }}>{error}</div>
      ) : null}

      {result ? (
        <div className={`health-item-card ${result.ok ? 'health-ok' : 'health-error'}`} style={{ marginTop: '0.75rem' }}>
          {result.ok ? (
            <div className="ollama-model-meta">
              <span>
                <strong>Tokens/s</strong>
                <small>{result.tokensPerSecond != null ? `${result.tokensPerSecond.toFixed(1)} t/s` : 'não medido'}</small>
              </span>
              <span>
                <strong>TTFT</strong>
                <small>{result.timeToFirstTokenMs != null ? `${result.timeToFirstTokenMs} ms` : 'não medido'}</small>
              </span>
              <span>
                <strong>RAM pico</strong>
                <small>{result.ramPeakBytes != null ? formatGib(result.ramPeakBytes) : 'não medido'}</small>
              </span>
              <span>
                <strong>VRAM pico</strong>
                <small>{result.vramPeakBytes != null ? formatGib(result.vramPeakBytes) : 'não medido'}</small>
              </span>
              {result.bottleneck ? (
                <span>
                  <strong>Gargalo</strong>
                  <small>{result.bottleneck}</small>
                </span>
              ) : null}
            </div>
          ) : null}
          <p>{result.detail}</p>
        </div>
      ) : null}
    </div>
  );
}
