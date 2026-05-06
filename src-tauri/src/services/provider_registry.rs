use crate::models::{AgentMode, AgentProfile, ProviderDescriptor};
use crate::services::provider_adapters::ProviderAdapterRegistry;

#[derive(Default)]
pub struct ProviderRegistry {
    adapters: ProviderAdapterRegistry,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self {
            adapters: ProviderAdapterRegistry::new(),
        }
    }

    pub fn providers(&self) -> Vec<ProviderDescriptor> {
        self.adapters.descriptors()
    }

    pub fn agent_profiles(&self) -> Vec<AgentProfile> {
        vec![
            AgentProfile {
                id: "rapido".to_owned(),
                label: "Rápido".to_owned(),
                description: "Foco em latência e passos curtos.".to_owned(),
                mode: AgentMode::Rapido,
            },
            AgentProfile {
                id: "equilibrado".to_owned(),
                label: "Equilibrado".to_owned(),
                description: "Diagnóstico sólido com execução pragmática.".to_owned(),
                mode: AgentMode::Equilibrado,
            },
            AgentProfile {
                id: "profundo".to_owned(),
                label: "Profundo".to_owned(),
                description: "Análise mais rigorosa para mudanças complexas.".to_owned(),
                mode: AgentMode::Profundo,
            },
            AgentProfile {
                id: "agressivo".to_owned(),
                label: "Agressivo".to_owned(),
                description: "Avança rápido com maior tolerância a mudanças.".to_owned(),
                mode: AgentMode::Agressivo,
            },
            AgentProfile {
                id: "seguro".to_owned(),
                label: "Seguro".to_owned(),
                description: "Prioriza previsibilidade, backup e rollback.".to_owned(),
                mode: AgentMode::Seguro,
            },
        ]
    }
}
