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

  // Initial load: initialize to loading=true and only set state in .then() callbacks (async)
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
        <span>Meu PC</span>
        <h3>Hardware local e engines de IA</h3>
      </header>

      {/* Hardware */}
      <section className="settings-block">
        <div className="ollama-manager-header">
          <div>
            <strong>Hardware detectado</strong>
            <small>CPU, GPU, RAM, disco e aceleradores disponíveis neste PC.</small>
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

      {/* Backends */}
      <section className="settings-block">
        <div className="ollama-manager-header">
          <div>
            <strong>Backends disponíveis</strong>
            <small>Engines de inferência detectados neste sistema.</small>
          </div>
          <button
            type="button"
            className="settings-pill-button"
            disabled={backendsLoading}
            onClick={loadBackends}
          >
            {backendsLoading ? 'Carregando...' : 'Atualizar backends'}
          </button>
        </div>
        {backendsError ? (
          <div className="input-error-tip" role="alert">{backendsError}</div>
        ) : null}
        {backendsLoading && backends.length === 0 ? (
          <div className="model-picker-empty" role="status">
            <span>Carregando backends...</span>
          </div>
        ) : null}
        {!backendsLoading || backends.length > 0 ? (
          <BackendStatusList backends={backends} />
        ) : null}
      </section>

      {/* Recomendação */}
      <section className="settings-block">
        <div className="ollama-manager-header">
          <div>
            <strong>Recomendação de runtime</strong>
            <small>Qual backend é melhor para um modelo específico neste PC.</small>
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
      </section>

      {/* Estimativa de fit */}
      <section className="settings-block">
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
      </section>

      {/* Benchmark */}
      {hardware ? (
        <section className="settings-block">
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
        </section>
      ) : null}
    </div>
  );
}
