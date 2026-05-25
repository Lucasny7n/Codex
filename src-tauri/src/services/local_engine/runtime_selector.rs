//! Score-based runtime selector.
//!
//! Chooses which backend should run a model on the detected hardware. For the
//! AMD RX 7600 target the priority is: Vulkan first, ROCm/HIP only when healthy,
//! then Ollama, then CPU, with cloud fallback when local is not recommended.
//! Never assumes ROCm works just because the GPU is AMD.

use crate::models::local_engine::{
    AcceleratorApi, AcceleratorStatus, BackendAvailability, BackendStatus, ExecutionProfile,
    FitClass, GpuVendor, HardwareSnapshot, ModelProfile, RuntimeBackendId, RuntimeEstimate,
    RuntimeRecommendation,
};

fn api_status(snapshot: &HardwareSnapshot, api: AcceleratorApi) -> AcceleratorStatus {
    snapshot
        .accelerators
        .iter()
        .find(|info| info.api == api)
        .map(|info| info.status)
        .unwrap_or(AcceleratorStatus::Unknown)
}

fn available(status: AcceleratorStatus) -> bool {
    matches!(
        status,
        AcceleratorStatus::Healthy | AcceleratorStatus::Present
    )
}

fn healthy(status: AcceleratorStatus) -> bool {
    matches!(status, AcceleratorStatus::Healthy)
}

fn required_api(backend: RuntimeBackendId) -> Option<AcceleratorApi> {
    match backend {
        RuntimeBackendId::LlamaCppVulkan => Some(AcceleratorApi::Vulkan),
        RuntimeBackendId::LlamaCppRocm => Some(AcceleratorApi::Rocm),
        RuntimeBackendId::LlamaCppHip => Some(AcceleratorApi::Hip),
        RuntimeBackendId::LlamaCppCuda => Some(AcceleratorApi::Cuda),
        RuntimeBackendId::LlamaCppSycl => Some(AcceleratorApi::Sycl),
        _ => None,
    }
}

fn base_score(backend: RuntimeBackendId) -> i32 {
    match backend {
        RuntimeBackendId::LlamaCppVulkan => 100,
        RuntimeBackendId::LlamaCppRocm | RuntimeBackendId::LlamaCppHip => 95,
        RuntimeBackendId::Ollama => 90,
        RuntimeBackendId::LlamaCppServer => 75,
        RuntimeBackendId::LlamaCppCuda => 95,
        RuntimeBackendId::LlamaCppSycl => 80,
        RuntimeBackendId::OpenAiCompatible => 70,
        RuntimeBackendId::LlamaCppCpu => 60,
        RuntimeBackendId::KoboldCpp => 55,
        RuntimeBackendId::CloudFallback => 45,
        RuntimeBackendId::AirLlm
        | RuntimeBackendId::Vllm
        | RuntimeBackendId::ExLlamaV2
        | RuntimeBackendId::MlcLlm
        | RuntimeBackendId::TensorRtLlm
        | RuntimeBackendId::SgLang
        | RuntimeBackendId::FlexGen
        | RuntimeBackendId::TransformersAccelerate => 10,
    }
}

fn availability_score(availability: BackendAvailability) -> Option<i32> {
    match availability {
        BackendAvailability::Ready => Some(30),
        BackendAvailability::Installed => Some(10),
        BackendAvailability::Experimental => Some(-40),
        BackendAvailability::Unknown => Some(-20),
        // Not present at all -> not a candidate.
        BackendAvailability::NotInstalled | BackendAvailability::FutureAvailable => None,
    }
}

fn fit_score(fit: FitClass) -> i32 {
    match fit {
        FitClass::Excellent => 20,
        FitClass::Fits => 10,
        FitClass::Tight => 0,
        FitClass::SlowSwap => -25,
        FitClass::WontRun => -60,
        FitClass::Unknown => -10,
    }
}

fn vendor(snapshot: &HardwareSnapshot) -> GpuVendor {
    snapshot
        .gpus
        .first()
        .map(|gpu| gpu.vendor)
        .unwrap_or(GpuVendor::Unknown)
}

/// Returns `None` when the backend cannot be a candidate on this hardware.
fn score_backend(
    snapshot: &HardwareSnapshot,
    backend: &BackendStatus,
    estimate: &RuntimeEstimate,
    exec_profile: ExecutionProfile,
) -> Option<i32> {
    let mut score = base_score(backend.id) + availability_score(backend.availability)?;

    if let Some(api) = required_api(backend.id) {
        let status = api_status(snapshot, api);
        match api {
            // ROCm/HIP only when actually healthy.
            AcceleratorApi::Rocm | AcceleratorApi::Hip => {
                if !healthy(status) {
                    return None;
                }
                score += 15;
            }
            AcceleratorApi::Cuda => {
                if !available(status) {
                    return None;
                }
                score += 20;
            }
            AcceleratorApi::Vulkan => {
                if !available(status) {
                    return None;
                }
                score += if healthy(status) { 20 } else { 10 };
            }
            AcceleratorApi::Sycl => {
                if !available(status) {
                    return None;
                }
                score += 5;
            }
            AcceleratorApi::OpenCl | AcceleratorApi::Cpu => {}
        }
    }

    // GPU vendor sanity: never propose CUDA on a non-NVIDIA box.
    if backend.id == RuntimeBackendId::LlamaCppCuda && vendor(snapshot) != GpuVendor::Nvidia {
        return None;
    }

    score += fit_score(estimate.fit);
    if estimate.expected_slow {
        score -= 15;
    }
    if backend.experimental {
        score -= 20;
    }

    score += profile_adjustment(backend.id, exec_profile, estimate);
    Some(score)
}

fn profile_adjustment(
    backend: RuntimeBackendId,
    exec_profile: ExecutionProfile,
    estimate: &RuntimeEstimate,
) -> i32 {
    match exec_profile {
        // Safe: strongly favor stable backends, punish experimental/slow.
        ExecutionProfile::Safe => {
            let mut delta = 0;
            if matches!(
                backend,
                RuntimeBackendId::LlamaCppVulkan
                    | RuntimeBackendId::Ollama
                    | RuntimeBackendId::LlamaCppCpu
            ) {
                delta += 10;
            }
            if estimate.experimental {
                delta -= 15;
            }
            delta
        }
        // Max / Heavy: tolerate experimental more.
        ExecutionProfile::Max | ExecutionProfile::Heavy => {
            if estimate.experimental {
                10
            } else {
                0
            }
        }
        // VRAM / RAM saver: CPU and offload-friendly paths get a nudge.
        ExecutionProfile::VramSaver | ExecutionProfile::RamSaver => {
            if matches!(
                backend,
                RuntimeBackendId::LlamaCppCpu | RuntimeBackendId::Ollama
            ) {
                8
            } else {
                0
            }
        }
        _ => 0,
    }
}

fn message_for(
    snapshot: &HardwareSnapshot,
    backend: RuntimeBackendId,
    estimate: &RuntimeEstimate,
) -> String {
    let is_amd = vendor(snapshot) == GpuVendor::Amd;
    let rocm_ok = healthy(api_status(snapshot, AcceleratorApi::Rocm))
        || healthy(api_status(snapshot, AcceleratorApi::Hip));
    let vulkan_ok = available(api_status(snapshot, AcceleratorApi::Vulkan));

    if backend == RuntimeBackendId::CloudFallback {
        return "Esse modelo não compensa localmente neste PC. Sugiro usar um provedor cloud."
            .to_owned();
    }
    if is_amd && backend == RuntimeBackendId::LlamaCppVulkan {
        return "AMD RX 7600 detectada. Vulkan parece ser o backend mais seguro neste sistema."
            .to_owned();
    }
    if is_amd
        && matches!(
            backend,
            RuntimeBackendId::LlamaCppRocm | RuntimeBackendId::LlamaCppHip
        )
    {
        return "ROCm/HIP foi detectado e saudável. O Ailu pode testar HIP/ROCm, mas Vulkan continua como fallback."
            .to_owned();
    }
    if is_amd && rocm_ok && backend == RuntimeBackendId::Ollama {
        return "AMD detectada com ROCm/HIP. Ollama está pronto; Vulkan segue como fallback seguro."
            .to_owned();
    }
    if is_amd && !rocm_ok && vulkan_ok {
        return "AMD detectada. Vulkan é o caminho mais seguro aqui; ROCm/HIP não foi confirmado."
            .to_owned();
    }
    if estimate.expected_slow {
        return "Runtime escolhido, mas espere lentidão nessa máquina.".to_owned();
    }
    "Runtime recomendado para o modelo e hardware atuais.".to_owned()
}

/// Pick the best backend by score. Falls back to cloud when nothing local is
/// a candidate or when the model simply should not run locally here.
pub fn recommend(
    snapshot: &HardwareSnapshot,
    backends: &[BackendStatus],
    _profile: &ModelProfile,
    estimate: &RuntimeEstimate,
    exec_profile: ExecutionProfile,
) -> RuntimeRecommendation {
    let mut scored: Vec<(RuntimeBackendId, i32)> = backends
        .iter()
        .filter_map(|backend| {
            score_backend(snapshot, backend, estimate, exec_profile).map(|s| (backend.id, s))
        })
        .collect();
    scored.sort_by(|a, b| b.1.cmp(&a.1));

    let cloud_available = backends.iter().any(|b| {
        b.id == RuntimeBackendId::CloudFallback && availability_score(b.availability).is_some()
    });

    // When nothing local qualifies, or the model won't run, prefer cloud.
    let force_cloud = matches!(estimate.fit, FitClass::WontRun)
        || scored
            .iter()
            .filter(|(id, _)| *id != RuntimeBackendId::CloudFallback)
            .all(|(_, score)| *score < 0);

    let (backend, score) = if force_cloud && cloud_available {
        (RuntimeBackendId::CloudFallback, 45)
    } else if let Some((id, score)) = scored.first().copied() {
        (id, score)
    } else if cloud_available {
        (RuntimeBackendId::CloudFallback, 45)
    } else {
        (RuntimeBackendId::LlamaCppCpu, 0)
    };

    let alternatives: Vec<RuntimeBackendId> = scored
        .iter()
        .map(|(id, _)| *id)
        .filter(|id| *id != backend)
        .take(3)
        .collect();

    let rationale = format!(
        "Selecionado {:?} (score {score}) entre {} candidato(s).",
        backend,
        scored.len()
    );

    RuntimeRecommendation {
        backend,
        profile: exec_profile,
        estimate: estimate.clone(),
        score,
        rationale,
        message: message_for(snapshot, backend, estimate),
        alternatives,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::local_engine::{
        AcceleratorInfo, CpuInfo, FitClass, GpuDevice, MemoryInfo, ModelSizeClass, OsInfo,
    };

    const GIB: u64 = 1024 * 1024 * 1024;

    fn snapshot(vulkan: AcceleratorStatus, rocm: AcceleratorStatus) -> HardwareSnapshot {
        HardwareSnapshot {
            os: OsInfo {
                os: "linux".to_owned(),
                kernel: None,
                distro: Some("arch".to_owned()),
            },
            cpu: CpuInfo {
                model: Some("Ryzen 5 5500".to_owned()),
                physical_cores: Some(6),
                logical_threads: Some(12),
            },
            memory: MemoryInfo {
                total_bytes: 16 * GIB,
                available_bytes: Some(11 * GIB),
                swap_total_bytes: 8 * GIB,
                headroom_bytes: 1536 * 1024 * 1024,
            },
            gpus: vec![GpuDevice {
                vendor: GpuVendor::Amd,
                name: Some("RX 7600".to_owned()),
                vram_total_bytes: Some(8 * GIB),
                vram_used_bytes: None,
                source: "test".to_owned(),
            }],
            disks: vec![],
            accelerators: vec![
                AcceleratorInfo {
                    api: AcceleratorApi::Vulkan,
                    status: vulkan,
                    detail: String::new(),
                },
                AcceleratorInfo {
                    api: AcceleratorApi::Rocm,
                    status: rocm,
                    detail: String::new(),
                },
                AcceleratorInfo {
                    api: AcceleratorApi::Cpu,
                    status: AcceleratorStatus::Healthy,
                    detail: String::new(),
                },
            ],
            profile_tags: vec![],
            notes: vec![],
            detected_at: "now".to_owned(),
        }
    }

    fn backend(id: RuntimeBackendId, availability: BackendAvailability) -> BackendStatus {
        BackendStatus {
            id,
            label: format!("{id:?}"),
            availability,
            version: None,
            detail: String::new(),
            experimental: false,
            install_plan: None,
        }
    }

    fn profile() -> ModelProfile {
        ModelProfile {
            model_id: "llama3:8b".to_owned(),
            parameter_count: Some(8_000_000_000),
            size_class: ModelSizeClass::Medium,
            format: crate::models::local_engine::ModelFormat::Gguf,
            quantization: Some("Q4_K_M".to_owned()),
            weight_bytes: Some(5 * GIB),
        }
    }

    fn good_estimate() -> RuntimeEstimate {
        RuntimeEstimate {
            fit: FitClass::Fits,
            recommended: true,
            experimental: false,
            vram_required_bytes: Some(6 * GIB),
            ram_required_bytes: 6 * GIB,
            recommended_context: 8192,
            uses_offload: false,
            expected_slow: false,
            speed_hint: String::new(),
            warnings: vec![],
        }
    }

    fn all_backends() -> Vec<BackendStatus> {
        vec![
            backend(RuntimeBackendId::LlamaCppVulkan, BackendAvailability::Ready),
            backend(RuntimeBackendId::LlamaCppRocm, BackendAvailability::Ready),
            backend(RuntimeBackendId::Ollama, BackendAvailability::Ready),
            backend(RuntimeBackendId::LlamaCppCpu, BackendAvailability::Ready),
            backend(RuntimeBackendId::CloudFallback, BackendAvailability::Ready),
        ]
    }

    #[test]
    fn amd_prefers_vulkan_when_rocm_absent() {
        let snap = snapshot(AcceleratorStatus::Present, AcceleratorStatus::Unavailable);
        let rec = recommend(
            &snap,
            &all_backends(),
            &profile(),
            &good_estimate(),
            ExecutionProfile::Balanced,
        );
        assert_eq!(rec.backend, RuntimeBackendId::LlamaCppVulkan);
    }

    #[test]
    fn amd_keeps_vulkan_first_even_with_rocm_healthy() {
        let snap = snapshot(AcceleratorStatus::Healthy, AcceleratorStatus::Healthy);
        let rec = recommend(
            &snap,
            &all_backends(),
            &profile(),
            &good_estimate(),
            ExecutionProfile::Balanced,
        );
        assert_eq!(rec.backend, RuntimeBackendId::LlamaCppVulkan);
        assert!(rec.alternatives.contains(&RuntimeBackendId::LlamaCppRocm));
    }

    #[test]
    fn rocm_excluded_when_not_healthy() {
        // Vulkan also absent so ROCm would be the only GPU path -- but it's only Present, not Healthy.
        let snap = snapshot(AcceleratorStatus::Unavailable, AcceleratorStatus::Present);
        let rec = recommend(
            &snap,
            &all_backends(),
            &profile(),
            &good_estimate(),
            ExecutionProfile::Balanced,
        );
        assert_ne!(rec.backend, RuntimeBackendId::LlamaCppRocm);
        assert_eq!(rec.backend, RuntimeBackendId::Ollama);
    }

    #[test]
    fn falls_back_to_ollama_without_gpu_apis() {
        let snap = snapshot(
            AcceleratorStatus::Unavailable,
            AcceleratorStatus::Unavailable,
        );
        let rec = recommend(
            &snap,
            &all_backends(),
            &profile(),
            &good_estimate(),
            ExecutionProfile::Balanced,
        );
        assert_eq!(rec.backend, RuntimeBackendId::Ollama);
    }

    #[test]
    fn cpu_only_when_nothing_else() {
        let snap = snapshot(
            AcceleratorStatus::Unavailable,
            AcceleratorStatus::Unavailable,
        );
        let backends = vec![
            backend(RuntimeBackendId::LlamaCppCpu, BackendAvailability::Ready),
            backend(
                RuntimeBackendId::LlamaCppVulkan,
                BackendAvailability::NotInstalled,
            ),
        ];
        let rec = recommend(
            &snap,
            &backends,
            &profile(),
            &good_estimate(),
            ExecutionProfile::Balanced,
        );
        assert_eq!(rec.backend, RuntimeBackendId::LlamaCppCpu);
    }

    #[test]
    fn wont_run_model_prefers_cloud() {
        let snap = snapshot(AcceleratorStatus::Present, AcceleratorStatus::Unavailable);
        let mut estimate = good_estimate();
        estimate.fit = FitClass::WontRun;
        estimate.recommended = false;
        let rec = recommend(
            &snap,
            &all_backends(),
            &profile(),
            &estimate,
            ExecutionProfile::Balanced,
        );
        assert_eq!(rec.backend, RuntimeBackendId::CloudFallback);
    }
}
