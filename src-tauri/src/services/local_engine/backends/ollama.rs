//! Ollama backend detection. Reuses PATH discovery and a light API probe.
//! Never downloads a model; presence + API reachability only.

use std::time::Duration;

use crate::models::local_engine::{BackendAvailability, BackendStatus, RuntimeBackendId};

use super::binary_in_path;

const API_TAGS: &str = "http://127.0.0.1:11434/api/tags";

pub async fn detect() -> BackendStatus {
    let installed = binary_in_path("ollama").is_some();
    let api_ok = api_reachable().await;

    let (availability, detail) = if api_ok {
        (
            BackendAvailability::Ready,
            "Ollama instalado e API local respondendo.".to_owned(),
        )
    } else if installed {
        (
            BackendAvailability::Installed,
            "Ollama instalado, mas a API local não respondeu. Inicie o serviço.".to_owned(),
        )
    } else {
        (
            BackendAvailability::NotInstalled,
            "Ollama não encontrado no PATH.".to_owned(),
        )
    };

    BackendStatus {
        id: RuntimeBackendId::Ollama,
        label: "Ollama".to_owned(),
        availability,
        version: None,
        detail,
        experimental: false,
        install_plan: if installed {
            None
        } else {
            Some("Instalar Ollama exige confirmação manual (ex: pacman -S ollama).".to_owned())
        },
    }
}

async fn api_reachable() -> bool {
    let Ok(client) = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    else {
        return false;
    };
    client
        .get(API_TAGS)
        .send()
        .await
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}
