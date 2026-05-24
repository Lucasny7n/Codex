//! Honest hardware detection and "does it fit on my machine?" classification.
//!
//! Detection reads real system sources only (`/proc/meminfo`, `rocm-smi`,
//! sysfs DRM) and never fabricates a value. When a source is unavailable the
//! corresponding field is `None` and a note explains why, so the UI can stay
//! honest instead of guessing.

use std::time::Duration;

use tokio::process::Command;
use tokio::time::timeout;

use crate::models::{
    now_iso, GpuDetectionSource, HardwareProfile, ModelFitEstimate, ModelFitRequest, ModelFitTier,
    QuantOption, QuantPreset,
};

/// Always kept free for the user; weights are never allowed to consume it.
pub const RAM_HEADROOM_BYTES: u64 = 1_536 * 1024 * 1024;
const FRAMEWORK_OVERHEAD_BYTES: u64 = 700 * 1024 * 1024;
const RUNTIME_KV_FACTOR: f64 = 1.20;
const VRAM_SAFE_FRACTION: f64 = 0.95;
const GIB: f64 = (1024 * 1024 * 1024) as f64;

#[derive(Default)]
pub struct HardwareService;

impl HardwareService {
    pub fn new() -> Self {
        Self
    }

    pub async fn detect(&self) -> HardwareProfile {
        let mut notes = Vec::new();

        let (ram_total, ram_available, swap_total) = match std::fs::read_to_string("/proc/meminfo")
        {
            Ok(content) => parse_meminfo(&content),
            Err(_) => {
                notes.push("Não foi possível ler /proc/meminfo (RAM desconhecida).".to_owned());
                (0, None, 0)
            }
        };

        let (vram_total, gpu_name, gpu_source) = detect_gpu(&mut notes).await;

        HardwareProfile {
            ram_total_bytes: ram_total,
            ram_available_bytes: ram_available,
            swap_total_bytes: swap_total,
            vram_total_bytes: vram_total,
            gpu_name,
            gpu_source,
            cpu_threads: std::thread::available_parallelism().ok().map(|n| n.get()),
            ram_headroom_bytes: RAM_HEADROOM_BYTES,
            notes,
            detected_at: now_iso(),
        }
    }

    pub fn quant_presets(&self) -> Vec<QuantOption> {
        quant_presets()
    }

    pub fn estimate_fits(
        &self,
        profile: &HardwareProfile,
        requests: &[ModelFitRequest],
    ) -> Vec<ModelFitEstimate> {
        requests
            .iter()
            .map(|request| {
                let preset = request.preset.unwrap_or(QuantPreset::Speed);
                estimate_fit(profile, &request.model_id, &request.parameter_label, preset)
            })
            .collect()
    }
}

async fn detect_gpu(notes: &mut Vec<String>) -> (Option<u64>, Option<String>, GpuDetectionSource) {
    if let Some((vram, name)) = rocm_smi_vram().await {
        return (Some(vram), name, GpuDetectionSource::RocmSmi);
    }
    if let Some(vram) = sysfs_vram() {
        notes.push("rocm-smi indisponível; VRAM lida do sysfs DRM.".to_owned());
        return (Some(vram), None, GpuDetectionSource::SysfsDrm);
    }
    notes.push("GPU não detectada (sem rocm-smi nem VRAM no sysfs).".to_owned());
    (None, None, GpuDetectionSource::None)
}

async fn rocm_smi_vram() -> Option<(u64, Option<String>)> {
    let run = timeout(
        Duration::from_secs(4),
        Command::new("rocm-smi")
            .args(["--showmeminfo", "vram", "--json"])
            .output(),
    )
    .await
    .ok()?
    .ok()?;
    if !run.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&run.stdout);
    let vram = parse_rocm_smi_vram(&stdout)?;
    Some((vram, None))
}

fn sysfs_vram() -> Option<u64> {
    for card in 0..8 {
        let path = format!("/sys/class/drm/card{card}/device/mem_info_vram_total");
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(value) = content.trim().parse::<u64>() {
                if value > 0 {
                    return Some(value);
                }
            }
        }
    }
    None
}

pub fn quant_presets() -> Vec<QuantOption> {
    vec![
        QuantOption {
            preset: QuantPreset::Quality,
            label: "Qualidade".to_owned(),
            ollama_quant: "Q8_0".to_owned(),
            bits_per_weight: 8.5,
            description: "Máxima fidelidade (Q8_0/Q6_K). Maior e mais lento.".to_owned(),
        },
        QuantOption {
            preset: QuantPreset::Balanced,
            label: "Equilíbrio".to_owned(),
            ollama_quant: "Q5_K_M".to_owned(),
            bits_per_weight: 5.67,
            description: "Bom custo-benefício entre qualidade e tamanho.".to_owned(),
        },
        QuantOption {
            preset: QuantPreset::Speed,
            label: "Velocidade".to_owned(),
            ollama_quant: "Q4_K_M".to_owned(),
            bits_per_weight: 4.83,
            description: "Padrão recomendado. Menor e mais rápido com perda baixa.".to_owned(),
        },
        QuantOption {
            preset: QuantPreset::Extreme,
            label: "Extremo".to_owned(),
            ollama_quant: "Q2_K".to_owned(),
            bits_per_weight: 3.35,
            description: "Compressão agressiva. Cabe mais, perde qualidade visível.".to_owned(),
        },
    ]
}

pub fn quant_bits_per_weight(preset: QuantPreset) -> f64 {
    match preset {
        QuantPreset::Quality => 8.5,
        QuantPreset::Balanced => 5.67,
        QuantPreset::Speed => 4.83,
        QuantPreset::Extreme => 3.35,
    }
}

/// Parse a parameter-size label ("70b", "7B", "8x7b", "1.5b") into a parameter count.
pub fn parse_parameter_count(label: &str) -> Option<u64> {
    let lower = label.trim().to_lowercase();
    let mut best: Option<u64> = None;
    for token in
        lower.split(|c: char| !(c.is_ascii_digit() || c == '.' || c == 'x' || c == 'b' || c == 'm'))
    {
        if token.is_empty() {
            continue;
        }
        if let Some(count) = parse_param_token(token) {
            best = Some(best.map_or(count, |current| current.max(count)));
        }
    }
    best
}

fn parse_param_token(token: &str) -> Option<u64> {
    let (digits, scale) = if let Some(rest) = token.strip_suffix('b') {
        (rest, 1_000_000_000f64)
    } else if let Some(rest) = token.strip_suffix('m') {
        (rest, 1_000_000f64)
    } else {
        return None;
    };
    if digits.is_empty() {
        return None;
    }
    if let Some((left, right)) = digits.split_once('x') {
        let experts: f64 = left.parse().ok()?;
        let per: f64 = right.parse().ok()?;
        if experts <= 0.0 || per <= 0.0 {
            return None;
        }
        return Some((experts * per * scale) as u64);
    }
    let value: f64 = digits.parse().ok()?;
    if value <= 0.0 {
        return None;
    }
    Some((value * scale) as u64)
}

pub fn estimate_weight_bytes(parameters: u64, preset: QuantPreset) -> u64 {
    ((parameters as f64) * quant_bits_per_weight(preset) / 8.0) as u64
}

pub fn estimate_runtime_bytes(weight_bytes: u64) -> u64 {
    ((weight_bytes as f64) * RUNTIME_KV_FACTOR) as u64 + FRAMEWORK_OVERHEAD_BYTES
}

struct FitPlacement {
    tier: ModelFitTier,
    vram_offload: u64,
    ram_spill: u64,
    swap_spill: u64,
    unplaceable: u64,
}

fn classify_fit(
    runtime_bytes: u64,
    vram_bytes: u64,
    ram_total_bytes: u64,
    swap_bytes: u64,
) -> FitPlacement {
    let usable_ram = ram_total_bytes.saturating_sub(RAM_HEADROOM_BYTES);
    let safe_vram = ((vram_bytes as f64) * VRAM_SAFE_FRACTION) as u64;

    let vram_offload = runtime_bytes.min(vram_bytes);
    let after_vram = runtime_bytes.saturating_sub(vram_offload);
    let ram_spill = after_vram.min(usable_ram);
    let after_ram = after_vram.saturating_sub(ram_spill);
    let swap_spill = after_ram.min(swap_bytes);
    let unplaceable = after_ram.saturating_sub(swap_spill);

    let tier = if vram_bytes > 0 && runtime_bytes <= safe_vram {
        ModelFitTier::Fits
    } else if after_vram <= usable_ram {
        ModelFitTier::Tight
    } else if unplaceable == 0 {
        ModelFitTier::Swap
    } else {
        ModelFitTier::WontRun
    };

    FitPlacement {
        tier,
        vram_offload,
        ram_spill,
        swap_spill,
        unplaceable,
    }
}

pub fn estimate_fit(
    profile: &HardwareProfile,
    model_id: &str,
    parameter_label: &str,
    preset: QuantPreset,
) -> ModelFitEstimate {
    let parameter_count = parse_parameter_count(parameter_label);
    let weight_bytes = parameter_count
        .map(|count| estimate_weight_bytes(count, preset))
        .unwrap_or(0);
    let runtime_bytes = estimate_runtime_bytes(weight_bytes);
    let vram = profile.vram_total_bytes.unwrap_or(0);
    let placement = classify_fit(
        runtime_bytes,
        vram,
        profile.ram_total_bytes,
        profile.swap_total_bytes,
    );

    let (label, speed_hint, warning) = describe(parameter_count, &placement, preset);

    ModelFitEstimate {
        model_id: model_id.to_owned(),
        preset,
        tier: placement.tier,
        label,
        parameter_count,
        estimated_weight_bytes: weight_bytes,
        estimated_runtime_bytes: runtime_bytes,
        vram_offload_bytes: placement.vram_offload,
        ram_spill_bytes: placement.ram_spill,
        swap_spill_bytes: placement.swap_spill,
        unplaceable_bytes: placement.unplaceable,
        speed_hint,
        warning,
    }
}

fn describe(
    parameter_count: Option<u64>,
    placement: &FitPlacement,
    preset: QuantPreset,
) -> (String, String, Option<String>) {
    if parameter_count.is_none() {
        return (
            "Desconhecido".to_owned(),
            "Tamanho do modelo não identificado pelo rótulo.".to_owned(),
            Some("Não foi possível estimar o tamanho deste modelo pelo nome.".to_owned()),
        );
    }
    let spill_gib = (placement.ram_spill as f64 + placement.swap_spill as f64) / GIB;
    match placement.tier {
        ModelFitTier::Fits => (
            "Cabe".to_owned(),
            "Roda na GPU (rápido).".to_owned(),
            None,
        ),
        ModelFitTier::Tight => (
            "Apertado".to_owned(),
            "Parte na GPU, parte na RAM (usável, mais lento).".to_owned(),
            Some(format!(
                "Esse modelo vai usar ~{spill_gib:.1} GB de RAM além da VRAM. Funciona, mas mais devagar."
            )),
        ),
        ModelFitTier::Swap => (
            "Vai pro swap".to_owned(),
            "Excede RAM+VRAM; usa swap (muito lento, abaixo de ~1 token/s).".to_owned(),
            Some(format!(
                "Esse modelo vai rodar lentamente nessa máquina com a quantização {}: ~{:.1} GB caem no swap.",
                quant_label(preset),
                placement.swap_spill as f64 / GIB
            )),
        ),
        ModelFitTier::WontRun => (
            "Não roda".to_owned(),
            "Excede VRAM+RAM+swap disponíveis.".to_owned(),
            Some(format!(
                "Não cabe: faltam ~{:.1} GB mesmo usando swap. Tente uma quantização menor ou um modelo menor.",
                placement.unplaceable as f64 / GIB
            )),
        ),
    }
}

fn quant_label(preset: QuantPreset) -> &'static str {
    match preset {
        QuantPreset::Quality => "Q8_0",
        QuantPreset::Balanced => "Q5_K_M",
        QuantPreset::Speed => "Q4_K_M",
        QuantPreset::Extreme => "Q2_K",
    }
}

/// Parse MemTotal, MemAvailable and SwapTotal from /proc/meminfo into bytes.
pub fn parse_meminfo(content: &str) -> (u64, Option<u64>, u64) {
    let mut total = 0u64;
    let mut available = None;
    let mut swap = 0u64;
    for line in content.lines() {
        let Some((key, rest)) = line.split_once(':') else {
            continue;
        };
        let Some(kb) = rest
            .trim()
            .trim_end_matches("kB")
            .trim()
            .parse::<u64>()
            .ok()
        else {
            continue;
        };
        match key.trim() {
            "MemTotal" => total = kb * 1024,
            "MemAvailable" => available = Some(kb * 1024),
            "SwapTotal" => swap = kb * 1024,
            _ => {}
        }
    }
    (total, available, swap)
}

/// Parse total VRAM bytes from `rocm-smi --showmeminfo vram --json` output.
pub fn parse_rocm_smi_vram(json: &str) -> Option<u64> {
    let needle = "VRAM Total Memory (B)";
    let idx = json.find(needle)?;
    let after = &json[idx + needle.len()..];
    let digits: String = after
        .chars()
        .skip_while(|c| !c.is_ascii_digit())
        .take_while(|c| c.is_ascii_digit())
        .collect();
    digits.parse::<u64>().ok().filter(|value| *value > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    const GIB_U64: u64 = 1024 * 1024 * 1024;

    fn rx7600() -> HardwareProfile {
        HardwareProfile {
            ram_total_bytes: 16 * GIB_U64,
            ram_available_bytes: Some(10 * GIB_U64),
            swap_total_bytes: 8 * GIB_U64,
            vram_total_bytes: Some(8 * GIB_U64),
            gpu_name: Some("AMD RX 7600".to_owned()),
            gpu_source: GpuDetectionSource::RocmSmi,
            cpu_threads: Some(12),
            ram_headroom_bytes: RAM_HEADROOM_BYTES,
            notes: Vec::new(),
            detected_at: "now".to_owned(),
        }
    }

    #[test]
    fn parses_parameter_labels() {
        assert_eq!(parse_parameter_count("70b"), Some(70_000_000_000));
        assert_eq!(parse_parameter_count("7B"), Some(7_000_000_000));
        assert_eq!(parse_parameter_count("1.5b"), Some(1_500_000_000));
        assert_eq!(parse_parameter_count("qwen2.5:14b"), Some(14_000_000_000));
        assert_eq!(parse_parameter_count("mixtral 8x7b"), Some(56_000_000_000));
        assert_eq!(parse_parameter_count("gemma"), None);
    }

    #[test]
    fn weight_size_scales_with_quant() {
        let q8 = estimate_weight_bytes(70_000_000_000, QuantPreset::Quality);
        let q2 = estimate_weight_bytes(70_000_000_000, QuantPreset::Extreme);
        assert!(q8 > q2);
        let q4 = estimate_weight_bytes(70_000_000_000, QuantPreset::Speed) / GIB_U64;
        assert!((39..=45).contains(&q4), "70B Q4 ~42GB, got {q4}GB");
    }

    #[test]
    fn meminfo_parsed() {
        let sample =
            "MemTotal:       16070000 kB\nMemAvailable:   8000000 kB\nSwapTotal:      8000000 kB\n";
        let (total, avail, swap) = parse_meminfo(sample);
        assert_eq!(total, 16_070_000 * 1024);
        assert_eq!(avail, Some(8_000_000 * 1024));
        assert_eq!(swap, 8_000_000 * 1024);
    }

    #[test]
    fn rocm_smi_parsed() {
        let sample = r#"{"card0": {"VRAM Total Memory (B)": "8573157376"}}"#;
        assert_eq!(parse_rocm_smi_vram(sample), Some(8_573_157_376));
        assert_eq!(parse_rocm_smi_vram("{}"), None);
    }

    #[test]
    fn small_model_fits() {
        let fit = estimate_fit(&rx7600(), "llama3:8b", "8b", QuantPreset::Speed);
        assert_eq!(fit.tier, ModelFitTier::Fits);
        assert!(fit.warning.is_none());
    }

    #[test]
    fn mid_model_is_tight() {
        let fit = estimate_fit(&rx7600(), "qwen2.5:14b", "14b", QuantPreset::Speed);
        assert_eq!(fit.tier, ModelFitTier::Tight);
        assert!(fit.ram_spill_bytes > 0);
        assert!(fit.warning.is_some());
    }

    #[test]
    fn heavy_70b_extreme_swaps_or_worse() {
        let fit = estimate_fit(&rx7600(), "llama3:70b", "70b", QuantPreset::Extreme);
        assert!(matches!(
            fit.tier,
            ModelFitTier::Swap | ModelFitTier::WontRun
        ));
    }

    #[test]
    fn heavy_70b_quality_wont_run() {
        let fit = estimate_fit(&rx7600(), "llama3:70b", "70b", QuantPreset::Quality);
        assert_eq!(fit.tier, ModelFitTier::WontRun);
        assert!(fit.unplaceable_bytes > 0);
    }

    #[test]
    fn unknown_label_is_honest() {
        let fit = estimate_fit(&rx7600(), "mystery", "latest", QuantPreset::Speed);
        assert_eq!(fit.parameter_count, None);
        assert!(fit.warning.is_some());
    }

    #[test]
    fn headroom_is_never_consumed() {
        let mut profile = rx7600();
        profile.vram_total_bytes = Some(0);
        profile.ram_total_bytes = RAM_HEADROOM_BYTES;
        profile.swap_total_bytes = 0;
        let fit = estimate_fit(&profile, "x", "13b", QuantPreset::Speed);
        assert_eq!(fit.ram_spill_bytes, 0);
        assert_eq!(fit.tier, ModelFitTier::WontRun);
    }
}
