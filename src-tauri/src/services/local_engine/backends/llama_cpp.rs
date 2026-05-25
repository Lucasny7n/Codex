//! llama.cpp backend detection.
//!
//! Detects `llama-server` / `llama-cli` in PATH and derives candidate GPU
//! variants from detected accelerators. We never know how a binary was built,
//! so GPU variants are reported "Installed" (capability unconfirmed), never
//! "Ready", and never auto-compiled. CPU is Ready whenever a binary exists.

use crate::models::local_engine::{
    AcceleratorApi, AcceleratorStatus, BackendAvailability, BackendStatus, HardwareSnapshot,
    RuntimeBackendId,
};

use super::binary_in_path;

const BUILD_PLAN: &str =
    "Instalar/compilar llama.cpp exige confirmação. Plano: clonar, compilar com o backend desejado (Vulkan/HIP), e adicionar llama-server/llama-cli ao PATH.";

pub fn detect(snapshot: &HardwareSnapshot) -> Vec<BackendStatus> {
    let server = binary_in_path("llama-server");
    let cli = binary_in_path("llama-cli");
    let has_binary = server.is_some() || cli.is_some();

    let mut list = Vec::new();

    // CPU variant: ready when any binary exists.
    list.push(status(
        RuntimeBackendId::LlamaCppCpu,
        "llama.cpp (CPU)",
        if has_binary {
            BackendAvailability::Ready
        } else {
            BackendAvailability::NotInstalled
        },
        if has_binary {
            "Binário llama.cpp encontrado; inferência em CPU disponível.".to_owned()
        } else {
            "llama.cpp não encontrado no PATH.".to_owned()
        },
        false,
        if has_binary {
            None
        } else {
            Some(BUILD_PLAN.to_owned())
        },
    ));

    // Server variant.
    list.push(status(
        RuntimeBackendId::LlamaCppServer,
        "llama.cpp server",
        if server.is_some() {
            BackendAvailability::Ready
        } else {
            BackendAvailability::NotInstalled
        },
        if server.is_some() {
            "llama-server disponível (endpoint OpenAI-compatible gerenciável).".to_owned()
        } else {
            "llama-server não encontrado.".to_owned()
        },
        false,
        if server.is_some() {
            None
        } else {
            Some(BUILD_PLAN.to_owned())
        },
    ));

    // GPU variants gated by detected accelerators; capability unconfirmed.
    if accel_available(snapshot, AcceleratorApi::Vulkan) {
        list.push(gpu_variant(
            RuntimeBackendId::LlamaCppVulkan,
            "llama.cpp (Vulkan)",
            has_binary,
            "Vulkan detectado. Variante recomendada para AMD RX 7600 se o binário tiver suporte Vulkan.",
        ));
    }
    if accel_healthy(snapshot, AcceleratorApi::Rocm) {
        list.push(gpu_variant(
            RuntimeBackendId::LlamaCppRocm,
            "llama.cpp (ROCm)",
            has_binary,
            "ROCm saudável. Use somente se o binário tiver suporte HIP/ROCm.",
        ));
    }
    if accel_healthy(snapshot, AcceleratorApi::Hip) {
        list.push(gpu_variant(
            RuntimeBackendId::LlamaCppHip,
            "llama.cpp (HIP)",
            has_binary,
            "HIP detectado. Use somente se o binário tiver suporte HIP.",
        ));
    }
    if accel_available(snapshot, AcceleratorApi::Cuda) {
        list.push(gpu_variant(
            RuntimeBackendId::LlamaCppCuda,
            "llama.cpp (CUDA)",
            has_binary,
            "CUDA detectado.",
        ));
    }
    if accel_available(snapshot, AcceleratorApi::Sycl) {
        list.push(gpu_variant(
            RuntimeBackendId::LlamaCppSycl,
            "llama.cpp (SYCL)",
            has_binary,
            "SYCL detectado (Intel). Experimental.",
        ));
    }

    list
}

fn gpu_variant(id: RuntimeBackendId, label: &str, has_binary: bool, detail: &str) -> BackendStatus {
    status(
        id,
        label,
        if has_binary {
            // Binary exists but we can't confirm it was built with this backend.
            BackendAvailability::Installed
        } else {
            BackendAvailability::NotInstalled
        },
        detail.to_owned(),
        false,
        if has_binary {
            None
        } else {
            Some(BUILD_PLAN.to_owned())
        },
    )
}

fn status(
    id: RuntimeBackendId,
    label: &str,
    availability: BackendAvailability,
    detail: String,
    experimental: bool,
    install_plan: Option<String>,
) -> BackendStatus {
    BackendStatus {
        id,
        label: label.to_owned(),
        availability,
        version: None,
        detail,
        experimental,
        install_plan,
    }
}

fn accel_available(snapshot: &HardwareSnapshot, api: AcceleratorApi) -> bool {
    snapshot.accelerators.iter().any(|info| {
        info.api == api
            && matches!(
                info.status,
                AcceleratorStatus::Healthy | AcceleratorStatus::Present
            )
    })
}

fn accel_healthy(snapshot: &HardwareSnapshot, api: AcceleratorApi) -> bool {
    snapshot
        .accelerators
        .iter()
        .any(|info| info.api == api && info.status == AcceleratorStatus::Healthy)
}
