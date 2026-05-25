//! Experimental / future backends. Descriptors only this cycle.
//!
//! If the tooling happens to be present we surface it as Experimental; otherwise
//! FutureAvailable. On a 16 GB machine AirLLM / FlexGen / disk offload are
//! flagged slow and not recommended by default.

use crate::models::local_engine::{BackendAvailability, BackendStatus, RuntimeBackendId};

use super::binary_in_path;

struct Descriptor {
    id: RuntimeBackendId,
    label: &'static str,
    probe: &'static str,
    detail: &'static str,
}

const DESCRIPTORS: &[Descriptor] = &[
    Descriptor {
        id: RuntimeBackendId::AirLlm,
        label: "AirLLM",
        probe: "airllm",
        detail: "Pesquisa: disk offload em camadas. Lentíssimo em GPUs pequenas; não recomendado por padrão.",
    },
    Descriptor {
        id: RuntimeBackendId::Vllm,
        label: "vLLM",
        probe: "vllm",
        detail: "Servidor de alta vazão; voltado a GPUs com bastante VRAM. Não recomendado para RX 7600.",
    },
    Descriptor {
        id: RuntimeBackendId::ExLlamaV2,
        label: "ExLlamaV2 / TabbyAPI",
        probe: "tabby",
        detail: "Inferência rápida de EXL2; foco em NVIDIA. Futuro.",
    },
    Descriptor {
        id: RuntimeBackendId::MlcLlm,
        label: "MLC LLM",
        probe: "mlc_llm",
        detail: "Compilação via TVM (Vulkan possível). Experimental.",
    },
    Descriptor {
        id: RuntimeBackendId::TensorRtLlm,
        label: "TensorRT-LLM",
        probe: "trtllm-build",
        detail: "Exclusivo NVIDIA. Fora de escopo para AMD.",
    },
    Descriptor {
        id: RuntimeBackendId::SgLang,
        label: "SGLang",
        probe: "sglang",
        detail: "Servidor de inferência avançado. Futuro.",
    },
    Descriptor {
        id: RuntimeBackendId::FlexGen,
        label: "FlexGen",
        probe: "flexgen",
        detail: "Offload agressivo para RAM/disco. Muito lento; não recomendado por padrão.",
    },
    Descriptor {
        id: RuntimeBackendId::TransformersAccelerate,
        label: "Transformers + Accelerate",
        probe: "accelerate",
        detail: "Pipeline HF genérico. Pesado em VRAM/RAM. Experimental.",
    },
];

pub fn descriptors() -> Vec<BackendStatus> {
    DESCRIPTORS
        .iter()
        .map(|descriptor| {
            let present = binary_in_path(descriptor.probe).is_some();
            BackendStatus {
                id: descriptor.id,
                label: descriptor.label.to_owned(),
                availability: if present {
                    BackendAvailability::Experimental
                } else {
                    BackendAvailability::FutureAvailable
                },
                version: None,
                detail: descriptor.detail.to_owned(),
                experimental: true,
                install_plan: None,
            }
        })
        .collect()
}
