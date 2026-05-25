//! Runtime backend descriptors and detection.
//!
//! This cycle implements real detection for the useful backends (Ollama,
//! llama.cpp, OpenAI-compatible) and honest descriptors for everything else.
//! Nothing is reported "ready" without a real probe; experimental backends are
//! clearly flagged and never auto-installed.

pub mod experimental;
pub mod llama_cpp;
pub mod ollama;
pub mod openai_compatible;

use std::path::PathBuf;

use crate::models::local_engine::{
    BackendAvailability, BackendStatus, HardwareSnapshot, RuntimeBackendId,
};

pub async fn detect_backends(snapshot: &HardwareSnapshot) -> Vec<BackendStatus> {
    let mut list = Vec::new();
    list.push(ollama::detect().await);
    list.extend(llama_cpp::detect(snapshot));
    list.push(openai_compatible::descriptor());
    list.push(cloud_fallback());
    list.extend(experimental::descriptors());
    list
}

fn cloud_fallback() -> BackendStatus {
    BackendStatus {
        id: RuntimeBackendId::CloudFallback,
        label: "Cloud (fallback)".to_owned(),
        availability: BackendAvailability::Ready,
        version: None,
        detail: "Usa provedores cloud configurados quando o local não compensa.".to_owned(),
        experimental: false,
        install_plan: None,
    }
}

/// Locate an executable in `$PATH` without spawning it.
pub fn binary_in_path(name: &str) -> Option<PathBuf> {
    let paths = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&paths) {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}
