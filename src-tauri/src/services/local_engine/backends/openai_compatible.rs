//! Generic OpenAI-compatible local server adapter (LM Studio, KoboldCPP,
//! llama.cpp server, Ollama /v1, etc). Descriptor + config contract for now.

use crate::models::local_engine::{BackendAvailability, BackendStatus, RuntimeBackendId};

pub fn descriptor() -> BackendStatus {
    BackendStatus {
        id: RuntimeBackendId::OpenAiCompatible,
        label: "Servidor OpenAI-compatible".to_owned(),
        availability: BackendAvailability::NotInstalled,
        version: None,
        detail: "Conecta a qualquer servidor local compatível (LM Studio, KoboldCPP, llama.cpp server, Ollama /v1) via baseUrl."
            .to_owned(),
        experimental: false,
        install_plan: Some(
            "Configurar baseUrl (ex: http://127.0.0.1:1234/v1), opcionalmente apiKey, e testar /v1/models."
                .to_owned(),
        ),
    }
}
