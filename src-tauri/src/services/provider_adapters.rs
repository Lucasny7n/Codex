use std::sync::Arc;

use crate::models::{ModelDescriptor, ProviderDescriptor};

pub trait ProviderAdapter: Send + Sync {
    fn descriptor(&self) -> ProviderDescriptor;
    fn is_configured(&self) -> bool;
}

#[derive(Debug)]
pub struct OpenAiAdapter;

impl ProviderAdapter for OpenAiAdapter {
    fn descriptor(&self) -> ProviderDescriptor {
        ProviderDescriptor {
            id: "openai".to_owned(),
            label: "OpenAI".to_owned(),
            configurable: true,
            enabled: true,
            models: vec![
                ModelDescriptor {
                    id: "gpt-5.5".to_owned(),
                    label: "GPT-5.5".to_owned(),
                    provider_id: "openai".to_owned(),
                    context_window: Some(256_000),
                    supports_tools: true,
                },
                ModelDescriptor {
                    id: "gpt-5.4".to_owned(),
                    label: "GPT-5.4".to_owned(),
                    provider_id: "openai".to_owned(),
                    context_window: Some(128_000),
                    supports_tools: true,
                },
                ModelDescriptor {
                    id: "gpt-5.4-mini".to_owned(),
                    label: "GPT-5.4 Mini".to_owned(),
                    provider_id: "openai".to_owned(),
                    context_window: Some(128_000),
                    supports_tools: true,
                },
            ],
        }
    }

    fn is_configured(&self) -> bool {
        std::env::var("OPENAI_API_KEY").is_ok() || std::env::var("OPENAI_API_KEY_FILE").is_ok()
    }
}

#[derive(Debug)]
pub struct AnthropicAdapter;

impl ProviderAdapter for AnthropicAdapter {
    fn descriptor(&self) -> ProviderDescriptor {
        ProviderDescriptor {
            id: "anthropic".to_owned(),
            label: "Anthropic".to_owned(),
            configurable: true,
            enabled: false,
            models: vec![ModelDescriptor {
                id: "claude-sonnet".to_owned(),
                label: "Claude Sonnet (adapter)".to_owned(),
                provider_id: "anthropic".to_owned(),
                context_window: Some(200_000),
                supports_tools: true,
            }],
        }
    }

    fn is_configured(&self) -> bool {
        std::env::var("ANTHROPIC_API_KEY").is_ok()
    }
}

#[derive(Debug)]
pub struct LocalOllamaAdapter;

impl ProviderAdapter for LocalOllamaAdapter {
    fn descriptor(&self) -> ProviderDescriptor {
        ProviderDescriptor {
            id: "local-ollama".to_owned(),
            label: "Local Ollama".to_owned(),
            configurable: true,
            enabled: false,
            models: vec![ModelDescriptor {
                id: "qwen2.5-coder".to_owned(),
                label: "Qwen2.5 Coder (local)".to_owned(),
                provider_id: "local-ollama".to_owned(),
                context_window: Some(32_000),
                supports_tools: false,
            }],
        }
    }

    fn is_configured(&self) -> bool {
        true
    }
}

#[derive(Default)]
pub struct ProviderAdapterRegistry {
    adapters: Vec<Arc<dyn ProviderAdapter>>,
}

impl ProviderAdapterRegistry {
    pub fn new() -> Self {
        Self {
            adapters: vec![
                Arc::new(OpenAiAdapter),
                Arc::new(AnthropicAdapter),
                Arc::new(LocalOllamaAdapter),
            ],
        }
    }

    pub fn descriptors(&self) -> Vec<ProviderDescriptor> {
        self.adapters
            .iter()
            .map(|adapter| {
                let mut descriptor = adapter.descriptor();
                descriptor.enabled = adapter.is_configured();
                descriptor
            })
            .collect()
    }
}
