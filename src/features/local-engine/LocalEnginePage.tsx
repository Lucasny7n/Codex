import { useEffect, useState } from 'react';
import {
  benchmarkModelRuntime,
  detectLocalHardware,
  estimateModelRuntime,
  listRuntimeBackends,
  recommendModelRuntime,
  testModelRuntime,
} from '../../lib/api';
import type {
  BackendStatus,
  BenchmarkResult,
  HardwareSnapshot,
  ModelRuntimeRequest,
  RuntimeBackendId,
  RuntimeEstimate,
  RuntimeRecommendation,
} from '../../types/domain';
import { BackendStatusList } from './BackendStatusList';
import { BenchmarkPanel } from './BenchmarkPanel';
import { HardwareSummary } from './HardwareSummary';
import { ModelFitPanel } from './ModelFitPanel';
import { RuntimeRecommendationCard } from './RuntimeRecommendationCard';

function CapabilitySummary({ hardware, backends }: { hardware: HardwareSnapshot; backends: BackendStatus[] }): JSX.Element {
  const installedRuntime = backends.find(
    (b) => b.availability === 'ready' || b.availability === 'installed',
  );
  const hasRuntime = Boolean(installedRuntime);
  const ramGib = hardware.memory.totalBytes / (1024 ** 3);
  const vramGib = hardware.gpus[0]?.vramTotalBytes
    ? hardware.gpus[0].vramTotalBytes / (1024 ** 3)
    : 0;
  const effectiveGib = Math.max(ramGib, vramGib);

  let headline: string;
  let sub: string;
  let tone: 'ok' | 'warn' | 'info';
  let statusWord: string;
  let modelSize: string;

  if (effectiveGib >= 24) {
    statusWord = 'bom';
    headline = 'Seu PC é adequado para IA local';
    sub = `Roda modelos grandes com conforto. ${vramGib > 0 ? `GPU com ${vramGib.toFixed(0)} GB de VRAM.` : `${ramGib.toFixed(0)} GB de RAM.`}`;
    modelSize = '13B–34B';
    tone = 'ok';
  } else if (effectiveGib >= 12) {
    statusWord = 'bom';
    headline = 'Seu PC é adequado para IA local';
    sub = `Modelos médios funcionam bem. ${vramGib > 0 ? `GPU com ${vramGib.toFixed(0)} GB de VRAM.` : `${ramGib.toFixed(0)} GB de RAM.`}`;
    modelSize = '7B–13B';
    tone = 'ok';
  } else if (effectiveGib >= 6) {
    statusWord = 'limitado';
    headline = 'Seu PC roda IA local com limites';
    sub = 'Modelos pequenos funcionam; acima de 7B pode ficar lento.';
    modelSize = 'até 7B';
    tone = 'info';
  } else {
    statusWord = 'fraco';
    headline = 'Seu PC tem capacidade limitada para IA local';
    sub = 'RAM baixa: prefira modelos pequenos (1B–3B) ou use nuvem.';
    modelSize = '1B–3B';
    tone = 'warn';
  }

  const runtimeRec = installedRuntime?.label ?? 'Ollama (recomendado instalar)';
  const toneClass = tone === 'ok' ? 'health-row-ok' : tone === 'warn' ? 'health-row-warning' : 'health-row-info';

  return (
    <div className="capability-summary">
      <div className={`health-row ${toneClass}`} style={{ marginBottom: '0.5rem' }}>
        <span className="health-row-icon" aria-hidden="true">
          {tone === 'ok' ? '✓' : tone === 'warn' ? '⚠' : 'ℹ'}
        </span>
        <div className="health-row-body">
          <strong className="health-row-label">{headline} · {statusWord}</strong>
          <span className="health-row-detail">{sub}</span>
        </div>
      </div>
      <div className="capability-facts">
        <span><strong>Tamanho recomendado</strong>{modelSize}</span>
        <span><strong>Runtime recomendado</strong>{runtimeRec}</span>
      </div>
      {!hasRuntime ? (
        <p className="capability-install-hint">
          Nenhum runtime instalado ainda. Veja "Runtimes" abaixo para instalar o Ollama e começar.
        </p>
      ) : null}
    </div>
  );
}

export function LocalEnginePage(): JSX.Element {
  const [hardware, setHardware] = useState<HardwareSnapshot | undefined>();
  const [hardwareLoading, setHardwareLoading] = useState(true);
  const [hardwareError, setHardwareError] = useState<string | undefined>();

  const [backends, setBackends] = useState<BackendStatus[]>([]);
  const [backendsLoading, setBackendsLoading] = useState(true);
  const [backendsError, setBackendsError] = useState<string | undefined>();

  const [recommendModelId, setRecommendModelId] = useState('');
  const [recommendation, setRecommendation] = useState<RuntimeRecommendation | undefined>();
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState<string | undefined>();

  const [fitLoading, setFitLoading] = useState(false);
  const [fitResult, setFitResult] = useState<RuntimeEstimate | undefined>();
  const [fitError, setFitError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    detectLocalHardware().then(
      (h) => { if (!cancelled) { setHardware(h); setHardwareLoading(false); } },
      (e: unknown) => {
        if (!cancelled) {
          setHardwareError(e instanceof Error ? e.message : String(e));
          setHardwareLoading(false);
        }
      },
    );
    listRuntimeBackends().then(
      (b) => { if (!cancelled) { setBackends(b); setBackendsLoading(false); } },
      (e: unknown) => {
        if (!cancelled) {
          setBackendsError(e instanceof Error ? e.message : String(e));
          setBackendsLoading(false);
        }
      },
    );
    return () => { cancelled = true; };
  }, []);

  function loadHardware() {
    setHardwareLoading(true);
    setHardwareError(undefined);
    detectLocalHardware().then(
      (h) => { setHardware(h); setHardwareLoading(false); },
      (e: unknown) => {
        setHardwareError(e instanceof Error ? e.message : String(e));
        setHardwareLoading(false);
      },
    );
  }

  function loadBackends() {
    setBackendsLoading(true);
    setBackendsError(undefined);
    listRuntimeBackends().then(
      (b) => { setBackends(b); setBackendsLoading(false); },
      (e: unknown) => {
        setBackendsError(e instanceof Error ? e.message : String(e));
        setBackendsLoading(false);
      },
    );
  }

  function handleRecommend(e: React.FormEvent) {
    e.preventDefault();
    if (!recommendModelId.trim()) return;
    setRecommendLoading(true);
    setRecommendError(undefined);
    setRecommendation(undefined);
    recommendModelRuntime({ modelId: recommendModelId.trim() }).then(
      (r) => { setRecommendation(r); setRecommendLoading(false); },
      (e: unknown) => {
        setRecommendError(e instanceof Error ? e.message : String(e));
        setRecommendLoading(false);
      },
    );
  }

  function handleEstimate(req: ModelRuntimeRequest): Promise<RuntimeEstimate> {
    setFitLoading(true);
    setFitError(undefined);
    setFitResult(undefined);
    return estimateModelRuntime(req).then(
      (r) => { setFitResult(r); setFitLoading(false); return r; },
      (e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setFitError(msg);
        setFitLoading(false);
        return Promise.reject(e);
      },
    );
  }

  function handleTest(modelId: string, backendId: RuntimeBackendId): Promise<BenchmarkResult> {
    return testModelRuntime(modelId, backendId);
  }

  function handleBenchmark(modelId: string, backendId: RuntimeBackendId): Promise<BenchmarkResult> {
    return benchmarkModelRuntime(modelId, backendId);
  }

  const benchmarkModelId = recommendModelId.trim() || 'qwen2.5-coder:1.5b';

  return (
    <div className="settings-page">
      <header className="settings-page-heading">
        <span>Máquina Local</span>
        <h3>Hardware e engines de IA instaladas</h3>
      </header>

      {/* Resumo de capacidade */}
      {hardware && !hardwareLoading ? (
        <section className="settings-block">
          <CapabilitySummary hardware={hardware} backends={backends} />
        </section>
      ) : null}

      {/* Hardware */}
      <section className="settings-block">
        <div className="ollama-manager-header">
          <div>
            <strong>Hardware</strong>
            <small>CPU, GPU, RAM e aceleradores neste PC.</small>
          </div>
          <button
            type="button"
            className="settings-pill-button"
            disabled={hardwareLoading}
            onClick={loadHardware}
          >
            {hardwareLoading ? 'Detectando...' : 'Atualizar hardware'}
          </button>
        </div>
        {hardwareError ? (
          <div className="input-error-tip" role="alert">{hardwareError}</div>
        ) : null}
        {hardwareLoading && !hardware ? (
          <div className="model-picker-empty" role="status">
            <span>Detectando hardware...</span>
          </div>
        ) : null}
        {hardware ? <HardwareSummary snapshot={hardware} /> : null}
      </section>

      {/* Runtimes */}
      <section className="settings-block">
        <div className="ollama-manager-header">
          <div>
            <strong>Runtimes</strong>
            <small>Engines de inferência detectadas neste sistema.</small>
          </div>
          <button
            type="button"
            className="settings-pill-button"
            disabled={backendsLoading}
            onClick={loadBackends}
          >
            {backendsLoading ? 'Carregando...' : 'Atualizar runtimes'}
          </button>
        </div>
        {backendsError ? (
          <div className="input-error-tip" role="alert">{backendsError}</div>
        ) : null}
        {backendsLoading && backends.length === 0 ? (
          <div className="model-picker-empty" role="status">
            <span>Carregando runtimes...</span>
          </div>
        ) : null}
        {!backendsLoading || backends.length > 0 ? (
          <BackendStatusList backends={backends} />
        ) : null}
      </section>

      {/* Ferramentas avançadas — ocultas por padrão */}
      {hardware ? (
        <section className="settings-block">
          <details className="settings-details" style={{ paddingTop: 0, borderTop: 'none' }}>
            <summary style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Ferramentas avançadas
            </summary>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Recomendação */}
              <div>
                <div className="ollama-manager-header">
                  <div>
                    <strong>Recomendação de runtime</strong>
                    <small>Qual engine é melhor para um modelo específico neste PC.</small>
                  </div>
                </div>
                <form onSubmit={handleRecommend} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <input
                    type="text"
                    className="settings-input"
                    value={recommendModelId}
                    onChange={(e) => setRecommendModelId(e.target.value)}
                    placeholder="qwen2.5-coder:7b"
                    aria-label="ID do modelo para recomendar"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="settings-pill-button"
                    disabled={!recommendModelId.trim() || recommendLoading}
                  >
                    {recommendLoading ? 'Calculando...' : 'Recomendar'}
                  </button>
                </form>
                {recommendError ? (
                  <div className="input-error-tip" role="alert" style={{ marginTop: '0.5rem' }}>{recommendError}</div>
                ) : null}
                {recommendation ? (
                  <div style={{ marginTop: '0.75rem' }}>
                    <RuntimeRecommendationCard recommendation={recommendation} backends={backends} />
                  </div>
                ) : null}
              </div>

              {/* Estimativa de fit */}
              <div>
                <div className="ollama-manager-header">
                  <div>
                    <strong>Estimativa de modelo</strong>
                    <small>Veja se um modelo cabe neste PC com os recursos disponíveis.</small>
                  </div>
                </div>
                <ModelFitPanel
                  onEstimate={handleEstimate}
                  loading={fitLoading}
                  result={fitResult}
                  error={fitError}
                />
              </div>

              {/* Benchmark */}
              <div>
                <div className="ollama-manager-header">
                  <div>
                    <strong>Benchmark</strong>
                    <small>Mede velocidade real de inferência. Exige modelo instalado.</small>
                  </div>
                </div>
                <BenchmarkPanel
                  modelId={benchmarkModelId}
                  backends={backends}
                  onTest={handleTest}
                  onBenchmark={handleBenchmark}
                />
              </div>
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}
