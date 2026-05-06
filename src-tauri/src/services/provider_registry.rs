use std::sync::Arc;

use crate::error::AppResult;
use crate::models::{
    AgentMode, AgentProfile, ProviderDescriptor, ProviderGenerateRequest, ProviderRunResult,
    ProviderRuntimeStatus,
};
use crate::services::credential_store::CredentialStore;
use crate::services::provider_adapters::ProviderAdapterRegistry;

pub struct ProviderRegistry {
    adapters: ProviderAdapterRegistry,
}

impl ProviderRegistry {
    pub fn new(credential_store: Arc<CredentialStore>) -> Self {
        Self {
            adapters: ProviderAdapterRegistry::new(credential_store, false),
        }
    }

    #[cfg(test)]
    pub fn new_with_mock_for_tests() -> Self {
        let path = std::env::temp_dir().join(format!(
            "codex-credentials-test-{}.json",
            uuid::Uuid::new_v4()
        ));
        let credential_store =
            Arc::new(CredentialStore::new(path).expect("credential store de teste deve iniciar"));
        Self {
            adapters: ProviderAdapterRegistry::new(credential_store, true),
        }
    }

    pub fn providers(&self) -> Vec<ProviderDescriptor> {
        self.adapters.descriptors()
    }

    pub fn provider_status(&self, provider_id: &str) -> Option<ProviderRuntimeStatus> {
        self.adapters.status(provider_id)
    }

    pub async fn test_connection(&self, provider_id: &str) -> AppResult<ProviderRuntimeStatus> {
        self.adapters.test_connection(provider_id).await
    }

    pub async fn generate_response(
        &self,
        request: ProviderGenerateRequest,
    ) -> AppResult<ProviderRunResult> {
        self.adapters.generate_response(request).await
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
