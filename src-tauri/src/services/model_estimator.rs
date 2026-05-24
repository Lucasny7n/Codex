use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuantPreset {
    Q2K,
    Q3KM,
    Q4KM,
    Q5KM,
    Q6K,
    Q8_0,
}

impl QuantPreset {
    pub fn bits_per_weight(self) -> f64 {
        match self {
            Self::Q2K => 2.6,
            Self::Q3KM => 3.5,
            Self::Q4KM => 4.5,
            Self::Q5KM => 5.5,
            Self::Q6K => 6.5,
            Self::Q8_0 => 8.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelFitLabel {
    FitsInGpu,
    TightPartialOffload,
    SlowHeavyMode,
    WontRun,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelEstimateInput {
    pub params_billions: f64,
    pub quant: QuantPreset,
    pub context_length: Option<u32>,
    pub free_vram_bytes: u64,
    pub available_ram_bytes: u64,
    pub free_swap_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelEstimateOutput {
    pub required_bytes: u64,
    pub weight_bytes: u64,
    pub kv_cache_bytes: u64,
    pub overhead_bytes: u64,
    pub os_reserve_bytes: u64,
    pub fit_label: ModelFitLabel,
}

pub fn estimate(input: &ModelEstimateInput) -> ModelEstimateOutput {
    let weight_gb = input.params_billions * input.quant.bits_per_weight() / 8.0;
    let weight_bytes = (weight_gb * 1024.0 * 1024.0 * 1024.0) as u64;
    let kv_cache_bytes = (input.context_length.unwrap_or(4096) as u64) * 256 * 1024;
    let overhead_bytes = 768 * 1024 * 1024;
    let os_reserve_bytes = (1.5 * 1024.0 * 1024.0 * 1024.0) as u64;
    let required_bytes = weight_bytes + kv_cache_bytes + overhead_bytes + os_reserve_bytes;

    let gpu_limit = (input.free_vram_bytes as f64 * 0.85) as u64;
    let tight_limit = input.free_vram_bytes + (input.available_ram_bytes as f64 * 0.70) as u64;
    let heavy_limit = input.free_vram_bytes + input.available_ram_bytes + input.free_swap_bytes;

    let fit_label = if required_bytes <= gpu_limit {
        ModelFitLabel::FitsInGpu
    } else if required_bytes <= tight_limit {
        ModelFitLabel::TightPartialOffload
    } else if required_bytes <= heavy_limit {
        ModelFitLabel::SlowHeavyMode
    } else {
        ModelFitLabel::WontRun
    };

    ModelEstimateOutput {
        required_bytes,
        weight_bytes,
        kv_cache_bytes,
        overhead_bytes,
        os_reserve_bytes,
        fit_label,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fit_in_gpu_for_small_model() {
        let out = estimate(&ModelEstimateInput {
            params_billions: 7.0,
            quant: QuantPreset::Q4KM,
            context_length: Some(4096),
            free_vram_bytes: 8 * 1024 * 1024 * 1024,
            available_ram_bytes: 8 * 1024 * 1024 * 1024,
            free_swap_bytes: 16 * 1024 * 1024 * 1024,
        });
        assert!(matches!(
            out.fit_label,
            ModelFitLabel::FitsInGpu | ModelFitLabel::TightPartialOffload
        ));
    }

    #[test]
    fn heavy_or_wont_run_for_70b_q8() {
        let out = estimate(&ModelEstimateInput {
            params_billions: 70.0,
            quant: QuantPreset::Q8_0,
            context_length: Some(4096),
            free_vram_bytes: 6 * 1024 * 1024 * 1024,
            available_ram_bytes: 10 * 1024 * 1024 * 1024,
            free_swap_bytes: 20 * 1024 * 1024 * 1024,
        });
        assert!(matches!(
            out.fit_label,
            ModelFitLabel::SlowHeavyMode | ModelFitLabel::WontRun
        ));
    }
}
