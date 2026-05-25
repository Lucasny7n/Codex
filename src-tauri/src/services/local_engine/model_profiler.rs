//! Model profiling and honest "does it fit?" classification.
//!
//! Reuses the pure primitives from `services::hardware` (parameter parsing,
//! weight estimation) and adds size classes, KV-cache-aware fit and the
//! conservative posture required for a 16 GB RX 7600 machine.

use crate::models::local_engine::{
    ExecutionProfile, FitClass, HardwareSnapshot, ModelFormat, ModelProfile, ModelRuntimeRequest,
    ModelSizeClass, RuntimeEstimate, RuntimeWarning, WarningSeverity,
};
use crate::services::hardware::{
    estimate_runtime_bytes, parse_parameter_count, RAM_HEADROOM_BYTES,
};

const DEFAULT_CONTEXT: u32 = 4096;
const LONG_CONTEXT_THRESHOLD: u32 = 16384;

pub fn bpw_from_quant(quant: Option<&str>) -> f64 {
    let Some(raw) = quant else { return 4.85 };
    let q = raw.to_uppercase();
    if q.contains("F32") || q.contains("FP32") {
        32.0
    } else if q.contains("F16") || q.contains("FP16") || q.contains("BF16") {
        16.0
    } else if q.contains("Q8") {
        8.5
    } else if q.contains("Q6") {
        6.6
    } else if q.contains("Q5") {
        5.7
    } else if q.contains("Q4") {
        4.85
    } else if q.contains("Q3") {
        3.9
    } else if q.contains("Q2") {
        3.35
    } else {
        4.85
    }
}

pub fn size_class(parameter_count: Option<u64>) -> ModelSizeClass {
    let Some(params) = parameter_count else {
        return ModelSizeClass::Unknown;
    };
    let billions = params as f64 / 1e9;
    if billions <= 4.0 {
        ModelSizeClass::Light
    } else if billions <= 9.0 {
        ModelSizeClass::Medium
    } else if billions <= 34.0 {
        ModelSizeClass::Heavy
    } else if billions <= 70.0 {
        ModelSizeClass::VeryHeavy
    } else {
        ModelSizeClass::Absurd
    }
}

pub fn detect_format(model_id: &str) -> ModelFormat {
    let lower = model_id.to_lowercase();
    if lower.ends_with(".gguf") || lower.contains("gguf") {
        ModelFormat::Gguf
    } else if lower.ends_with(".safetensors") || lower.contains("safetensors") {
        ModelFormat::Safetensors
    } else {
        ModelFormat::Unknown
    }
}

pub fn profile_model(request: &ModelRuntimeRequest) -> ModelProfile {
    let parameter_count = request
        .parameter_label
        .as_deref()
        .and_then(parse_parameter_count)
        .or_else(|| parse_parameter_count(&request.model_id));
    let weight_bytes = request.file_bytes.or_else(|| {
        parameter_count.map(|params| {
            let bpw = bpw_from_quant(request.quantization.as_deref());
            ((params as f64) * bpw / 8.0) as u64
        })
    });
    ModelProfile {
        model_id: request.model_id.clone(),
        parameter_count,
        size_class: size_class(parameter_count),
        format: detect_format(&request.model_id),
        quantization: request.quantization.clone(),
        weight_bytes,
    }
}

/// Conservative per-token KV-cache estimate. Documented heuristic, not exact:
/// it grows with model size so long context honestly costs more memory.
fn kv_per_token_bytes(size_class: ModelSizeClass) -> u64 {
    match size_class {
        ModelSizeClass::Light => 80 * 1024,
        ModelSizeClass::Medium => 160 * 1024,
        ModelSizeClass::Heavy => 320 * 1024,
        ModelSizeClass::VeryHeavy | ModelSizeClass::Absurd => 512 * 1024,
        ModelSizeClass::Unknown => 160 * 1024,
    }
}

fn best_vram_bytes(snapshot: &HardwareSnapshot) -> Option<u64> {
    snapshot
        .gpus
        .iter()
        .filter_map(|gpu| gpu.vram_total_bytes)
        .max()
}

/// Classify how a model fits given the detected hardware, honoring the RAM
/// headroom and emitting honest warnings for offload / swap / long context.
pub fn classify_fit(
    snapshot: &HardwareSnapshot,
    profile: &ModelProfile,
    context_size: u32,
) -> RuntimeEstimate {
    let mut warnings = Vec::new();
    let context = if context_size == 0 {
        DEFAULT_CONTEXT
    } else {
        context_size
    };

    let Some(weight_bytes) = profile.weight_bytes else {
        return RuntimeEstimate {
            fit: FitClass::Unknown,
            recommended: false,
            experimental: false,
            vram_required_bytes: None,
            ram_required_bytes: 0,
            recommended_context: DEFAULT_CONTEXT,
            uses_offload: false,
            expected_slow: false,
            speed_hint: "Tamanho do modelo desconhecido; não dá para estimar com honestidade."
                .to_owned(),
            warnings: vec![RuntimeWarning {
                code: "unknown_size".to_owned(),
                severity: WarningSeverity::Warning,
                message: "Não foi possível identificar o tamanho do modelo pelo nome ou arquivo."
                    .to_owned(),
            }],
        };
    };

    let kv_bytes = (context as u64) * kv_per_token_bytes(profile.size_class);
    let required = estimate_runtime_bytes(weight_bytes) + kv_bytes;

    let vram = best_vram_bytes(snapshot).unwrap_or(0);
    let safe_vram = ((vram as f64) * 0.9) as u64;
    let usable_ram = snapshot
        .memory
        .total_bytes
        .saturating_sub(RAM_HEADROOM_BYTES);
    let swap = snapshot.memory.swap_total_bytes;

    let fits_vram_excellent = vram > 0 && required <= (safe_vram as f64 * 0.7) as u64;
    let fits_vram = vram > 0 && required <= safe_vram;
    let after_vram = required.saturating_sub(required.min(vram));
    let fits_ram = after_vram <= usable_ram;
    let fits_swap = after_vram <= usable_ram.saturating_add(swap);

    let fit = if fits_vram_excellent {
        FitClass::Excellent
    } else if fits_vram {
        FitClass::Fits
    } else if fits_ram {
        FitClass::Tight
    } else if fits_swap {
        FitClass::SlowSwap
    } else {
        FitClass::WontRun
    };

    let uses_offload = matches!(fit, FitClass::Tight | FitClass::SlowSwap);
    let expected_slow = matches!(fit, FitClass::SlowSwap)
        || (vram == 0
            && matches!(
                profile.size_class,
                ModelSizeClass::Heavy | ModelSizeClass::VeryHeavy | ModelSizeClass::Absurd
            ));

    if uses_offload {
        warnings.push(RuntimeWarning {
            code: "offload".to_owned(),
            severity: WarningSeverity::Warning,
            message:
                "O modelo não cabe inteiro na GPU; parte vai para a RAM. Reduza contexto ou use Q4."
                    .to_owned(),
        });
    }
    if matches!(fit, FitClass::SlowSwap) {
        warnings.push(RuntimeWarning {
            code: "swap".to_owned(),
            severity: WarningSeverity::Strong,
            message: "Esse modelo deve cair em swap nessa máquina e ficar muito lento (abaixo de ~1 token/s)."
                .to_owned(),
        });
    }
    if matches!(fit, FitClass::WontRun) {
        warnings.push(RuntimeWarning {
            code: "wont_run".to_owned(),
            severity: WarningSeverity::Strong,
            message: "Esse modelo não é recomendado para este PC atual. Prefira cloud ou um modelo menor."
                .to_owned(),
        });
    }
    if context >= LONG_CONTEXT_THRESHOLD {
        warnings.push(RuntimeWarning {
            code: "long_context".to_owned(),
            severity: WarningSeverity::Strong,
            message: format!(
                "Contexto de {context} tokens aumenta bastante o uso de memória nesta máquina."
            ),
        });
    }
    if matches!(
        profile.size_class,
        ModelSizeClass::VeryHeavy | ModelSizeClass::Absurd
    ) {
        warnings.push(RuntimeWarning {
            code: "absurd_size".to_owned(),
            severity: WarningSeverity::Strong,
            message: "Modelos muito grandes (35B+) são inviáveis ou lentíssimos com 16 GB de RAM."
                .to_owned(),
        });
    }

    // Conservative posture: never call an offloaded/large model "recommended".
    let recommended = matches!(fit, FitClass::Excellent | FitClass::Fits)
        && !matches!(
            profile.size_class,
            ModelSizeClass::VeryHeavy | ModelSizeClass::Absurd
        );
    let experimental = matches!(fit, FitClass::SlowSwap)
        || matches!(
            profile.size_class,
            ModelSizeClass::Heavy | ModelSizeClass::VeryHeavy | ModelSizeClass::Absurd
        );

    let speed_hint = match fit {
        FitClass::Excellent => "Folga na GPU: rápido.".to_owned(),
        FitClass::Fits => "Cabe na GPU: bom desempenho.".to_owned(),
        FitClass::Tight => "Parte na GPU, parte na RAM: usável, mais lento.".to_owned(),
        FitClass::SlowSwap => "Vai para swap: muito lento.".to_owned(),
        FitClass::WontRun => "Não roda de forma utilizável aqui.".to_owned(),
        FitClass::Unknown => "Desconhecido.".to_owned(),
    };

    let recommended_context = recommended_context_for(&fit, context);

    RuntimeEstimate {
        fit,
        recommended,
        experimental,
        vram_required_bytes: if vram > 0 {
            Some(required.min(vram))
        } else {
            None
        },
        ram_required_bytes: (required as f64).round() as u64,
        recommended_context,
        uses_offload,
        expected_slow,
        speed_hint,
        warnings,
    }
}

fn recommended_context_for(fit: &FitClass, requested: u32) -> u32 {
    let cap = match fit {
        FitClass::Excellent => 16384,
        FitClass::Fits => 8192,
        FitClass::Tight => 4096,
        FitClass::SlowSwap | FitClass::WontRun => 2048,
        FitClass::Unknown => DEFAULT_CONTEXT,
    };
    requested.min(cap)
}

/// Profiles pushed toward smaller footprints reduce context further.
pub fn context_for_profile(profile: ExecutionProfile, base: u32) -> u32 {
    match profile {
        ExecutionProfile::LongContext => base.max(8192),
        ExecutionProfile::VramSaver | ExecutionProfile::RamSaver | ExecutionProfile::Safe => {
            base.min(4096)
        }
        _ => base,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::local_engine::{CpuInfo, GpuDevice, GpuVendor, MemoryInfo, OsInfo};

    const GIB_U64: u64 = 1024 * 1024 * 1024;

    fn rx7600_snapshot() -> HardwareSnapshot {
        HardwareSnapshot {
            os: OsInfo {
                os: "linux".to_owned(),
                kernel: None,
                distro: Some("arch".to_owned()),
            },
            cpu: CpuInfo {
                model: Some("AMD Ryzen 5 5500".to_owned()),
                physical_cores: Some(6),
                logical_threads: Some(12),
            },
            memory: MemoryInfo {
                total_bytes: 16 * GIB_U64,
                available_bytes: Some(11 * GIB_U64),
                swap_total_bytes: 8 * GIB_U64,
                headroom_bytes: RAM_HEADROOM_BYTES,
            },
            gpus: vec![GpuDevice {
                vendor: GpuVendor::Amd,
                name: Some("AMD Radeon RX 7600".to_owned()),
                vram_total_bytes: Some(8 * GIB_U64),
                vram_used_bytes: None,
                source: "test".to_owned(),
            }],
            disks: vec![],
            accelerators: vec![],
            profile_tags: vec![],
            notes: vec![],
            detected_at: "now".to_owned(),
        }
    }

    fn request(model_id: &str, label: &str, quant: &str) -> ModelRuntimeRequest {
        ModelRuntimeRequest {
            model_id: model_id.to_owned(),
            parameter_label: Some(label.to_owned()),
            quantization: Some(quant.to_owned()),
            file_bytes: None,
            context_size: None,
            profile: None,
        }
    }

    #[test]
    fn size_classes_are_correct() {
        assert_eq!(size_class(Some(3_000_000_000)), ModelSizeClass::Light);
        assert_eq!(size_class(Some(7_000_000_000)), ModelSizeClass::Medium);
        assert_eq!(size_class(Some(14_000_000_000)), ModelSizeClass::Heavy);
        assert_eq!(size_class(Some(70_000_000_000)), ModelSizeClass::VeryHeavy);
        assert_eq!(size_class(Some(120_000_000_000)), ModelSizeClass::Absurd);
        assert_eq!(size_class(None), ModelSizeClass::Unknown);
    }

    #[test]
    fn seven_b_q4_is_recommended() {
        let profile = profile_model(&request("llama3:8b", "8b", "Q4_K_M"));
        let estimate = classify_fit(&rx7600_snapshot(), &profile, 4096);
        assert!(matches!(estimate.fit, FitClass::Excellent | FitClass::Fits));
        assert!(estimate.recommended);
    }

    #[test]
    fn fourteen_b_q4_is_tight_not_recommended() {
        let profile = profile_model(&request("qwen2.5:14b", "14b", "Q4_K_M"));
        let estimate = classify_fit(&rx7600_snapshot(), &profile, 4096);
        assert!(matches!(estimate.fit, FitClass::Tight | FitClass::SlowSwap));
        assert!(!estimate.recommended);
        assert!(estimate.experimental);
        assert!(estimate.uses_offload);
    }

    #[test]
    fn thirty_b_is_experimental_or_worse() {
        let profile = profile_model(&request("yi:34b", "34b", "Q4_K_M"));
        let estimate = classify_fit(&rx7600_snapshot(), &profile, 4096);
        assert!(matches!(
            estimate.fit,
            FitClass::SlowSwap | FitClass::WontRun
        ));
        assert!(!estimate.recommended);
        assert!(estimate.experimental);
    }

    #[test]
    fn seventy_b_wont_run() {
        let profile = profile_model(&request("llama3:70b", "70b", "Q4_K_M"));
        let estimate = classify_fit(&rx7600_snapshot(), &profile, 4096);
        assert_eq!(estimate.fit, FitClass::WontRun);
        assert!(estimate.warnings.iter().any(|w| w.code == "wont_run"));
    }

    #[test]
    fn q8_on_medium_model_warns_offload() {
        let profile = profile_model(&request("llama3:8b", "8b", "Q8_0"));
        let estimate = classify_fit(&rx7600_snapshot(), &profile, 4096);
        // 8B Q8 ~ 8.5GB weights -> exceeds 8GB VRAM, offload to RAM.
        assert!(estimate.uses_offload || matches!(estimate.fit, FitClass::Fits));
    }

    #[test]
    fn long_context_warns() {
        let profile = profile_model(&request("llama3:8b", "8b", "Q4_K_M"));
        let estimate = classify_fit(&rx7600_snapshot(), &profile, 32768);
        assert!(estimate.warnings.iter().any(|w| w.code == "long_context"));
    }

    #[test]
    fn unknown_size_is_honest() {
        let mut req = request("mystery", "latest", "Q4_K_M");
        req.parameter_label = Some("latest".to_owned());
        let profile = profile_model(&req);
        let estimate = classify_fit(&rx7600_snapshot(), &profile, 4096);
        assert_eq!(estimate.fit, FitClass::Unknown);
        assert!(!estimate.recommended);
    }
}
