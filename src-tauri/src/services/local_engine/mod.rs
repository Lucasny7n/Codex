//! Ailu Local Engine (Runtime Manager).
//!
//! Detects hardware, profiles models, recommends a runtime backend, manages
//! per-model presets and runs quick benchmarks. Builds on `services::hardware`
//! and `services::local_runtime` rather than duplicating them.

pub mod backends;
pub mod benchmark;
pub mod hardware_profiler;
pub mod model_profiler;
pub mod presets;
pub mod runtime_selector;

use std::path::Path;

use crate::models::local_engine::{
    BackendStatus, BenchmarkKind, BenchmarkResult, ExecutionProfile, HardwareSnapshot,
    ModelProfile, ModelRuntimeRequest, RuntimeBackendId, RuntimeEstimate, RuntimePreset,
    RuntimeRecommendation,
};

use presets::PresetStore;

pub struct LocalEngineService {
    preset_store: PresetStore,
}

impl LocalEngineService {
    pub fn new(home: &Path) -> Self {
        Self {
            preset_store: PresetStore::default_for_home(home),
        }
    }

    pub async fn detect_hardware(&self) -> HardwareSnapshot {
        hardware_profiler::detect().await
    }

    pub async fn list_backends(&self) -> Vec<BackendStatus> {
        let snapshot = self.detect_hardware().await;
        backends::detect_backends(&snapshot).await
    }

    fn context_for(request: &ModelRuntimeRequest) -> u32 {
        let base = request.context_size.unwrap_or(4096);
        match request.profile {
            Some(profile) => model_profiler::context_for_profile(profile, base),
            None => base,
        }
    }

    pub fn estimate(
        &self,
        snapshot: &HardwareSnapshot,
        request: &ModelRuntimeRequest,
    ) -> (ModelProfile, RuntimeEstimate) {
        let profile = model_profiler::profile_model(request);
        let estimate = model_profiler::classify_fit(snapshot, &profile, Self::context_for(request));
        (profile, estimate)
    }

    pub async fn estimate_runtime(&self, request: &ModelRuntimeRequest) -> RuntimeEstimate {
        let snapshot = self.detect_hardware().await;
        self.estimate(&snapshot, request).1
    }

    pub async fn recommend(&self, request: &ModelRuntimeRequest) -> RuntimeRecommendation {
        let snapshot = self.detect_hardware().await;
        let backends = backends::detect_backends(&snapshot).await;
        let (profile, estimate) = self.estimate(&snapshot, request);
        let exec_profile = request.profile.unwrap_or(ExecutionProfile::Balanced);
        runtime_selector::recommend(&snapshot, &backends, &profile, &estimate, exec_profile)
    }

    pub fn list_presets(&self) -> Vec<RuntimePreset> {
        self.preset_store.list()
    }

    pub fn save_preset(&self, preset: RuntimePreset) -> Result<Vec<RuntimePreset>, String> {
        self.preset_store.save(preset)
    }

    pub fn delete_preset(
        &self,
        model_id: &str,
        backend_id: RuntimeBackendId,
    ) -> Result<Vec<RuntimePreset>, String> {
        self.preset_store.delete(model_id, backend_id)
    }

    /// Smoke/quick benchmark. Implemented for Ollama; other backends return an
    /// honest "not measured yet" result without faking metrics.
    pub async fn benchmark(
        &self,
        model_id: &str,
        backend_id: RuntimeBackendId,
        kind: BenchmarkKind,
    ) -> BenchmarkResult {
        match backend_id {
            RuntimeBackendId::Ollama => benchmark::run_ollama_benchmark(model_id, kind).await,
            other => BenchmarkResult {
                model_id: model_id.to_owned(),
                backend_id: other,
                kind,
                ok: false,
                tokens_per_second: None,
                time_to_first_token_ms: None,
                ram_peak_bytes: None,
                vram_peak_bytes: None,
                bottleneck: None,
                detail: "Benchmark para este backend ainda não foi implementado.".to_owned(),
                at: crate::models::now_iso(),
            },
        }
    }
}
