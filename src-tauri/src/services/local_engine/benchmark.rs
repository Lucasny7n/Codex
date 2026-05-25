//! Quick benchmarks. Honest metrics only: when we cannot measure RAM/VRAM we
//! return `None` instead of inventing numbers. Implemented for Ollama this
//! cycle; other backends return an honest "not measured yet" result.

use std::time::Duration;

use serde_json::json;

use crate::models::local_engine::{BenchmarkKind, BenchmarkResult, RuntimeBackendId};
use crate::models::now_iso;

const API_GENERATE: &str = "http://127.0.0.1:11434/api/generate";

/// tokens/s from Ollama's `eval_count` and `eval_duration` (nanoseconds).
pub fn tokens_per_second(eval_count: u64, eval_duration_ns: u64) -> Option<f64> {
    if eval_count == 0 || eval_duration_ns == 0 {
        return None;
    }
    let seconds = eval_duration_ns as f64 / 1_000_000_000.0;
    Some(eval_count as f64 / seconds)
}

pub fn bottleneck_hint(tps: Option<f64>) -> Option<String> {
    let tps = tps?;
    if tps < 1.0 {
        Some("Muito lento: provável swap/offload de RAM nesta máquina.".to_owned())
    } else if tps < 8.0 {
        Some("Lento: offload parcial ou CPU como gargalo.".to_owned())
    } else {
        None
    }
}

fn num_predict(kind: BenchmarkKind) -> u32 {
    match kind {
        BenchmarkKind::Smoke => 16,
        BenchmarkKind::Quick => 128,
    }
}

fn prompt(kind: BenchmarkKind) -> &'static str {
    match kind {
        BenchmarkKind::Smoke => "Responda apenas: ok.",
        BenchmarkKind::Quick => "Explique em um parágrafo curto o que é quantização de modelos.",
    }
}

pub async fn run_ollama_benchmark(model_id: &str, kind: BenchmarkKind) -> BenchmarkResult {
    let mut result = BenchmarkResult {
        model_id: model_id.to_owned(),
        backend_id: RuntimeBackendId::Ollama,
        kind,
        ok: false,
        tokens_per_second: None,
        time_to_first_token_ms: None,
        ram_peak_bytes: None,
        vram_peak_bytes: None,
        bottleneck: None,
        detail: String::new(),
        at: now_iso(),
    };

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
    {
        Ok(client) => client,
        Err(err) => {
            result.detail = format!("Falha ao criar cliente HTTP: {err}");
            return result;
        }
    };

    let body = json!({
        "model": model_id,
        "prompt": prompt(kind),
        "stream": false,
        "options": { "num_predict": num_predict(kind) }
    });

    let response = match client.post(API_GENERATE).json(&body).send().await {
        Ok(response) => response,
        Err(err) => {
            result.detail = format!("Ollama não respondeu: {err}");
            return result;
        }
    };
    if !response.status().is_success() {
        result.detail = format!("Ollama retornou status {}.", response.status());
        return result;
    }
    let payload: serde_json::Value = match response.json().await {
        Ok(value) => value,
        Err(err) => {
            result.detail = format!("Resposta inválida do Ollama: {err}");
            return result;
        }
    };

    let eval_count = payload
        .get("eval_count")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let eval_duration = payload
        .get("eval_duration")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let prompt_eval_duration = payload.get("prompt_eval_duration").and_then(|v| v.as_u64());

    result.ok = true;
    result.tokens_per_second = tokens_per_second(eval_count, eval_duration);
    result.time_to_first_token_ms = prompt_eval_duration.map(|ns| ns / 1_000_000);
    result.bottleneck = bottleneck_hint(result.tokens_per_second);
    result.detail =
        "Benchmark Ollama concluído. RAM/VRAM de pico não medidos neste ciclo.".to_owned();
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tps_computed() {
        // 100 tokens in 2s -> 50 tok/s
        assert_eq!(tokens_per_second(100, 2_000_000_000), Some(50.0));
        assert_eq!(tokens_per_second(0, 2_000_000_000), None);
        assert_eq!(tokens_per_second(100, 0), None);
    }

    #[test]
    fn bottleneck_thresholds() {
        assert!(bottleneck_hint(Some(0.5)).unwrap().contains("swap"));
        assert!(bottleneck_hint(Some(5.0)).is_some());
        assert!(bottleneck_hint(Some(40.0)).is_none());
        assert!(bottleneck_hint(None).is_none());
    }
}
