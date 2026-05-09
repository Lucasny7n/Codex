use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{
    now_iso, ProviderAccountProfile, ProviderAccountStatus, ProviderAuthType,
    ProviderCredentialStatus, ProviderDescriptor, ProviderRuntimeStatus, ProviderStatusState,
};

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CredentialFile {
    #[serde(default)]
    providers: BTreeMap<String, String>,
    #[serde(default)]
    profiles: BTreeMap<String, StoredProviderProfile>,
    #[serde(default)]
    default_profiles: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredProviderProfile {
    id: String,
    provider_id: String,
    name: String,
    auth_type: ProviderAuthType,
    credential: Option<String>,
    default_model_id: Option<String>,
    last_tested_at: Option<String>,
    last_status: Option<ProviderAccountStatus>,
    limits_hint: Option<String>,
}

/// File-backed fallback until a platform keyring is wired.
/// Callers only receive masked values; raw keys stay inside backend operations.
#[derive(Debug)]
pub struct CredentialStore {
    path: PathBuf,
    cache: RwLock<CredentialFile>,
}

impl CredentialStore {
    pub fn new(path: PathBuf) -> AppResult<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let cache = if path.exists() {
            let raw = fs::read_to_string(&path)?;
            serde_json::from_str::<CredentialFile>(&raw).unwrap_or_default()
        } else {
            CredentialFile::default()
        };

        Ok(Self {
            path,
            cache: RwLock::new(cache),
        })
    }

    pub fn save(&self, provider_id: &str, key: &str) -> AppResult<ProviderCredentialStatus> {
        self.save_profile(provider_id, None, "Padrão", key, true)?;
        Ok(self.status(provider_id))
    }

    pub fn save_profile(
        &self,
        provider_id: &str,
        profile_id: Option<&str>,
        name: &str,
        key: &str,
        make_default: bool,
    ) -> AppResult<ProviderAccountProfile> {
        let normalized = key.trim();
        if normalized.is_empty() {
            return Err(AppError::Message("API key vazia.".to_owned()));
        }

        let profile_id = profile_id
            .filter(|value| !value.trim().is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| {
                format!(
                    "{provider_id}:{}-{}",
                    safe_profile_id(name),
                    Uuid::new_v4().simple()
                )
            });
        let name = normalize_profile_name(name);
        let mut cache = self.cache.write();
        cache.profiles.insert(
            profile_id.clone(),
            StoredProviderProfile {
                id: profile_id.clone(),
                provider_id: provider_id.to_owned(),
                name: name.clone(),
                auth_type: ProviderAuthType::ApiKey,
                credential: Some(normalized.to_owned()),
                default_model_id: None,
                last_tested_at: None,
                last_status: None,
                limits_hint: None,
            },
        );
        let will_be_default = make_default || !cache.default_profiles.contains_key(provider_id);
        if will_be_default {
            cache
                .default_profiles
                .insert(provider_id.to_owned(), profile_id.clone());
        }
        drop(cache);
        self.flush()?;

        Ok(ProviderAccountProfile {
            id: profile_id,
            provider_id: provider_id.to_owned(),
            provider_label: provider_id.to_owned(),
            name,
            auth_type: ProviderAuthType::ApiKey,
            status: ProviderAccountStatus::Testing,
            masked_credential: Some(mask_secret(normalized)),
            source: Some("config_file".to_owned()),
            last_tested_at: None,
            default_model_id: None,
            is_default: will_be_default,
            message: "Credencial salva; teste conexão antes de usar como ready.".to_owned(),
            limits_hint: None,
        })
    }

    pub fn remove(&self, provider_id: &str) -> AppResult<ProviderCredentialStatus> {
        let mut cache = self.cache.write();
        cache.providers.remove(provider_id);
        let profile_ids = cache
            .profiles
            .values()
            .filter(|profile| profile.provider_id == provider_id)
            .map(|profile| profile.id.clone())
            .collect::<Vec<_>>();
        for profile_id in profile_ids {
            cache.profiles.remove(&profile_id);
        }
        cache.default_profiles.remove(provider_id);
        drop(cache);
        self.flush()?;
        Ok(self.status(provider_id))
    }

    pub fn remove_profile(&self, profile_id: &str) -> AppResult<()> {
        let mut cache = self.cache.write();
        let removed = cache.profiles.remove(profile_id);
        if let Some(profile) = removed {
            let replacement = cache
                .profiles
                .values()
                .find(|candidate| candidate.provider_id == profile.provider_id)
                .map(|candidate| candidate.id.clone());
            match replacement {
                Some(next_id) => {
                    cache.default_profiles.insert(profile.provider_id, next_id);
                }
                None => {
                    cache.default_profiles.remove(&profile.provider_id);
                }
            }
        }
        drop(cache);
        self.flush()
    }

    pub fn set_default_profile(&self, provider_id: &str, profile_id: &str) -> AppResult<()> {
        let mut cache = self.cache.write();
        let Some(profile) = cache.profiles.get(profile_id) else {
            return Err(AppError::Message("Profile não encontrado.".to_owned()));
        };
        if profile.provider_id != provider_id {
            return Err(AppError::Message(
                "Profile não pertence ao provider informado.".to_owned(),
            ));
        }
        cache
            .default_profiles
            .insert(provider_id.to_owned(), profile_id.to_owned());
        drop(cache);
        self.flush()
    }

    pub fn rename_profile(&self, profile_id: &str, name: &str) -> AppResult<()> {
        let mut cache = self.cache.write();
        let Some(profile) = cache.profiles.get_mut(profile_id) else {
            return Err(AppError::Message("Profile não encontrado.".to_owned()));
        };
        profile.name = normalize_profile_name(name);
        drop(cache);
        self.flush()
    }

    pub fn get(&self, provider_id: &str) -> Option<String> {
        self.get_for_profile(provider_id, None)
    }

    pub fn get_for_profile(&self, provider_id: &str, profile_id: Option<&str>) -> Option<String> {
        let cache = self.cache.read();
        if let Some(profile_id) = profile_id.filter(|value| !value.trim().is_empty()) {
            if profile_id == format!("{provider_id}:environment") {
                drop(cache);
                return env_credential(provider_id);
            }

            if profile_id != format!("{provider_id}:default") {
                return cache
                    .profiles
                    .get(profile_id)
                    .filter(|profile| profile.provider_id == provider_id)
                    .and_then(|profile| profile.credential.as_ref())
                    .filter(|value| !value.trim().is_empty())
                    .cloned();
            }
        }

        if let Some(default_profile_id) = cache.default_profiles.get(provider_id) {
            if let Some(value) = cache
                .profiles
                .get(default_profile_id)
                .and_then(|profile| profile.credential.as_ref())
            {
                if !value.trim().is_empty() {
                    return Some(value.clone());
                }
            }
        }

        if let Some(value) = cache.providers.get(provider_id) {
            if !value.trim().is_empty() {
                return Some(value.clone());
            }
        }
        drop(cache);

        env_credential(provider_id)
    }

    pub fn provider_has_ready_profile(&self, provider_id: &str) -> bool {
        let cache = self.cache.read();
        cache
            .default_profiles
            .get(provider_id)
            .and_then(|profile_id| cache.profiles.get(profile_id))
            .is_some_and(|profile| {
                profile
                    .last_status
                    .as_ref()
                    .is_some_and(|status| matches!(status, ProviderAccountStatus::Ready))
                    && profile
                        .credential
                        .as_ref()
                        .is_some_and(|value| !value.trim().is_empty())
            })
    }

    pub fn mark_provider_test_result(
        &self,
        provider_id: &str,
        status: &ProviderRuntimeStatus,
    ) -> AppResult<()> {
        let mut cache = self.cache.write();
        let Some(profile_id) = cache.default_profiles.get(provider_id).cloned() else {
            return Ok(());
        };
        let Some(profile) = cache.profiles.get_mut(&profile_id) else {
            return Ok(());
        };
        let has_credential = profile
            .credential
            .as_ref()
            .is_some_and(|value| !value.trim().is_empty());
        profile.last_tested_at = Some(status.checked_at.clone());
        profile.last_status = Some(account_status(status.state.clone(), has_credential));
        drop(cache);
        self.flush()
    }

    pub fn exists(&self, provider_id: &str) -> bool {
        self.get(provider_id).is_some()
    }

    pub fn status(&self, provider_id: &str) -> ProviderCredentialStatus {
        let cache = self.cache.read();
        let saved_profile = cache
            .default_profiles
            .get(provider_id)
            .and_then(|profile_id| cache.profiles.get(profile_id))
            .and_then(|profile| profile.credential.clone());
        let saved = saved_profile.or_else(|| cache.providers.get(provider_id).cloned());
        drop(cache);
        let env = env_credential(provider_id);
        let raw = saved.as_ref().or(env.as_ref());
        let source = if saved.is_some() {
            Some("config_file".to_owned())
        } else if env.is_some() {
            Some("environment".to_owned())
        } else {
            None
        };

        ProviderCredentialStatus {
            provider_id: provider_id.to_owned(),
            has_credential: raw.is_some(),
            masked_key: raw.map(|value| mask_secret(value)),
            source,
            checked_at: now_iso(),
        }
    }

    pub fn statuses(&self, provider_ids: &[String]) -> Vec<ProviderCredentialStatus> {
        provider_ids.iter().map(|id| self.status(id)).collect()
    }

    pub fn account_profiles(
        &self,
        providers: &[ProviderDescriptor],
    ) -> Vec<ProviderAccountProfile> {
        let cache = self.cache.read();
        providers
            .iter()
            .flat_map(|provider| {
                let mut profiles = cache
                    .profiles
                    .values()
                    .filter(|profile| profile.provider_id == provider.id)
                    .map(|profile| {
                        self.render_profile(
                            profile,
                            provider,
                            cache.default_profiles.get(&provider.id).map(String::as_str),
                        )
                    })
                    .collect::<Vec<_>>();

                if profiles.is_empty() {
                    profiles.push(fallback_profile(
                        provider,
                        cache.providers.get(&provider.id).map(String::as_str),
                        cache.default_profiles.get(&provider.id).map(String::as_str),
                    ));
                }

                if let Some(env) = env_credential(&provider.id) {
                    profiles.push(env_profile(provider, &env));
                }

                profiles
            })
            .collect()
    }

    fn render_profile(
        &self,
        profile: &StoredProviderProfile,
        provider: &ProviderDescriptor,
        default_profile_id: Option<&str>,
    ) -> ProviderAccountProfile {
        let has_credential = profile
            .credential
            .as_ref()
            .is_some_and(|value| !value.trim().is_empty());
        ProviderAccountProfile {
            id: profile.id.clone(),
            provider_id: profile.provider_id.clone(),
            provider_label: provider.label.clone(),
            name: profile.name.clone(),
            auth_type: profile.auth_type.clone(),
            status: profile
                .last_status
                .clone()
                .unwrap_or_else(|| account_status(provider.status.state.clone(), has_credential)),
            masked_credential: profile.credential.as_deref().map(mask_secret),
            source: Some("config_file".to_owned()),
            last_tested_at: profile
                .last_tested_at
                .clone()
                .or_else(|| Some(provider.status.checked_at.clone())),
            default_model_id: profile
                .default_model_id
                .clone()
                .or_else(|| provider.models.first().map(|model| model.id.clone())),
            is_default: default_profile_id == Some(profile.id.as_str()),
            message: profile_message(&provider.status, has_credential),
            limits_hint: profile.limits_hint.clone(),
        }
    }

    fn flush(&self) -> AppResult<()> {
        let body = serde_json::to_string_pretty(&*self.cache.read())?;
        fs::write(&self.path, body)?;
        Ok(())
    }
}

fn fallback_profile(
    provider: &ProviderDescriptor,
    legacy_key: Option<&str>,
    default_profile_id: Option<&str>,
) -> ProviderAccountProfile {
    let profile_id = format!("{}:default", provider.id);
    let auth_type = auth_type_for_provider(provider);
    let has_credential = legacy_key.is_some_and(|value| !value.trim().is_empty())
        || matches!(auth_type, ProviderAuthType::Local | ProviderAuthType::None);
    ProviderAccountProfile {
        id: profile_id.clone(),
        provider_id: provider.id.clone(),
        provider_label: provider.label.clone(),
        name: if legacy_key.is_some() {
            "Padrão legado".to_owned()
        } else {
            "Padrão".to_owned()
        },
        auth_type,
        status: account_status(provider.status.state.clone(), has_credential),
        masked_credential: legacy_key.map(mask_secret),
        source: legacy_key.map(|_| "config_file".to_owned()),
        last_tested_at: Some(provider.status.checked_at.clone()),
        default_model_id: provider.models.first().map(|model| model.id.clone()),
        is_default: default_profile_id.map_or(true, |id| id == profile_id),
        message: profile_message(&provider.status, has_credential),
        limits_hint: None,
    }
}

fn env_profile(provider: &ProviderDescriptor, value: &str) -> ProviderAccountProfile {
    ProviderAccountProfile {
        id: format!("{}:environment", provider.id),
        provider_id: provider.id.clone(),
        provider_label: provider.label.clone(),
        name: "Ambiente".to_owned(),
        auth_type: auth_type_for_provider(provider),
        status: account_status(provider.status.state.clone(), true),
        masked_credential: Some(mask_secret(value)),
        source: Some("environment".to_owned()),
        last_tested_at: Some(provider.status.checked_at.clone()),
        default_model_id: provider.models.first().map(|model| model.id.clone()),
        is_default: false,
        message: "Credencial vinda do ambiente; não é editável pelo app.".to_owned(),
        limits_hint: None,
    }
}

fn auth_type_for_provider(provider: &ProviderDescriptor) -> ProviderAuthType {
    match provider.id.as_str() {
        "local-ollama" => ProviderAuthType::Local,
        "codex-cli" | "gemini-cli" => ProviderAuthType::CliAuth,
        "opencode-zen" => ProviderAuthType::Login,
        _ if provider.configurable => ProviderAuthType::ApiKey,
        _ => ProviderAuthType::None,
    }
}

fn account_status(state: ProviderStatusState, has_credential: bool) -> ProviderAccountStatus {
    match state {
        ProviderStatusState::Ready => ProviderAccountStatus::Ready,
        ProviderStatusState::RequiresApiKey if !has_credential => {
            ProviderAccountStatus::RequiresApiKey
        }
        ProviderStatusState::InvalidApiKey => ProviderAccountStatus::InvalidApiKey,
        ProviderStatusState::Forbidden => ProviderAccountStatus::Forbidden,
        ProviderStatusState::RequiresLogin => ProviderAccountStatus::RequiresLogin,
        ProviderStatusState::RequiresOauth => ProviderAccountStatus::RequiresOauth,
        ProviderStatusState::RequiresCliAuth => ProviderAccountStatus::RequiresCliAuth,
        ProviderStatusState::Running | ProviderStatusState::Testing => {
            ProviderAccountStatus::Testing
        }
        ProviderStatusState::QuotaExceeded => ProviderAccountStatus::QuotaExceeded,
        ProviderStatusState::RateLimited => ProviderAccountStatus::RateLimited,
        ProviderStatusState::ProviderUnavailable => ProviderAccountStatus::ProviderUnavailable,
        ProviderStatusState::Mock | ProviderStatusState::Experimental => {
            ProviderAccountStatus::Experimental
        }
        ProviderStatusState::NotConfigured | ProviderStatusState::Misconfigured => {
            ProviderAccountStatus::Misconfigured
        }
        ProviderStatusState::RequiresApiKey => ProviderAccountStatus::Testing,
        _ => ProviderAccountStatus::Unavailable,
    }
}

fn profile_message(status: &ProviderRuntimeStatus, has_credential: bool) -> String {
    if !has_credential && matches!(status.state, ProviderStatusState::RequiresApiKey) {
        return "API key ausente para este profile.".to_owned();
    }
    status.message.clone()
}

fn normalize_profile_name(name: &str) -> String {
    let value = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() {
        "Conta".to_owned()
    } else {
        value.chars().take(48).collect()
    }
}

fn safe_profile_id(name: &str) -> String {
    let normalized = normalize_profile_name(name);
    let id = normalized
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if id.is_empty() {
        "conta".to_owned()
    } else {
        id
    }
}

fn env_credential(provider_id: &str) -> Option<String> {
    let keys: &[&str] = match provider_id {
        "openai-api" => &["OPENAI_API_KEY"],
        "openrouter-api" => &["OPENROUTER_API_KEY"],
        "anthropic-api" => &["ANTHROPIC_API_KEY"],
        "gemini-api" | "gemini-cli" => &["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        "mistral-api" => &["MISTRAL_API_KEY"],
        "groq-api" => &["GROQ_API_KEY"],
        "together-api" => &["TOGETHER_API_KEY"],
        "fireworks-api" => &["FIREWORKS_API_KEY"],
        "cohere-api" => &["COHERE_API_KEY"],
        "deepseek-api" => &["DEEPSEEK_API_KEY"],
        "xai-api" => &["XAI_API_KEY"],
        "perplexity-api" => &["PERPLEXITY_API_KEY"],
        "opencode-zen" => &["OPENCODE_ZEN_API_KEY", "ZEN_API_KEY"],
        _ => &[],
    };

    keys.iter()
        .find_map(|key| std::env::var(key).ok())
        .filter(|value| !value.trim().is_empty())
}

pub fn mask_secret(value: &str) -> String {
    let trimmed = value.trim();
    let char_count = trimmed.chars().count();
    if char_count <= 8 {
        return "****".to_owned();
    }

    let prefix = trimmed.chars().take(4).collect::<String>();
    let suffix = trimmed
        .chars()
        .rev()
        .take(4)
        .collect::<String>()
        .chars()
        .rev()
        .collect::<String>();
    format!("{prefix}****{suffix}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ModelDescriptor;

    fn temp_store() -> CredentialStore {
        let path = std::env::temp_dir().join(format!(
            "codex-credential-store-test-{}.json",
            uuid::Uuid::new_v4()
        ));
        CredentialStore::new(path).expect("credential store de teste deve iniciar")
    }

    fn provider_descriptor(provider_id: &str) -> ProviderDescriptor {
        ProviderDescriptor {
            id: provider_id.to_owned(),
            label: "OpenAI API".to_owned(),
            configurable: true,
            enabled: true,
            status: ProviderRuntimeStatus {
                state: ProviderStatusState::Ready,
                message: "Provider testado.".to_owned(),
                command: None,
                version: None,
                checked_at: now_iso(),
            },
            models: vec![ModelDescriptor {
                id: "gpt-5.4-mini".to_owned(),
                label: "GPT-5.4 Mini".to_owned(),
                provider_id: provider_id.to_owned(),
                context_window: None,
                supports_tools: false,
            }],
        }
    }

    #[test]
    fn masks_without_exposing_full_key() {
        let masked = mask_secret("sk-test-123456789");
        assert!(masked.starts_with("sk-t"));
        assert!(masked.ends_with("6789"));
        assert!(!masked.contains("12345"));
    }

    #[test]
    fn stores_multiple_profiles_without_mixing_credentials() {
        let store = temp_store();
        let first = store
            .save_profile("openai-api", None, "Trabalho", "sk-work-123456789", true)
            .expect("primeiro profile deve salvar");
        let second = store
            .save_profile(
                "openai-api",
                None,
                "Pessoal",
                "sk-personal-987654321",
                false,
            )
            .expect("segundo profile deve salvar");

        store
            .set_default_profile("openai-api", &second.id)
            .expect("default deve trocar para segundo profile");

        let profiles = store.account_profiles(&[provider_descriptor("openai-api")]);

        assert_eq!(
            profiles
                .iter()
                .filter(|profile| profile.provider_id == "openai-api")
                .count(),
            2
        );
        assert!(profiles.iter().any(|profile| profile.id == first.id));
        assert!(profiles
            .iter()
            .any(|profile| profile.id == second.id && profile.is_default));
        assert_eq!(
            store.get("openai-api").as_deref(),
            Some("sk-personal-987654321")
        );
        assert!(profiles.iter().all(|profile| {
            profile.masked_credential.as_deref().map_or(true, |masked| {
                !masked.contains("123456") && !masked.contains("987654")
            })
        }));
    }

    #[test]
    fn resolves_explicit_profile_credential() {
        let store = temp_store();
        let first = store
            .save_profile("openai-api", None, "Trabalho", "sk-work-123456789", true)
            .expect("primeiro profile deve salvar");
        let second = store
            .save_profile(
                "openai-api",
                None,
                "Pessoal",
                "sk-personal-987654321",
                false,
            )
            .expect("segundo profile deve salvar");

        assert_eq!(
            store
                .get_for_profile("openai-api", Some(&first.id))
                .as_deref(),
            Some("sk-work-123456789")
        );
        assert_eq!(
            store
                .get_for_profile("openai-api", Some(&second.id))
                .as_deref(),
            Some("sk-personal-987654321")
        );
    }

    #[test]
    fn test_result_marks_default_profile_ready_without_exposing_key() {
        let store = temp_store();
        store
            .save_profile("openai-api", None, "Trabalho", "sk-work-123456789", true)
            .expect("profile deve salvar");

        let status = ProviderRuntimeStatus {
            state: ProviderStatusState::Ready,
            message: "OpenAI respondeu.".to_owned(),
            command: None,
            version: None,
            checked_at: now_iso(),
        };
        store
            .mark_provider_test_result("openai-api", &status)
            .expect("resultado deve persistir");

        assert!(store.provider_has_ready_profile("openai-api"));
        let profiles = store.account_profiles(&[provider_descriptor("openai-api")]);
        assert!(profiles.iter().any(|profile| {
            profile.status == ProviderAccountStatus::Ready
                && profile.masked_credential.as_deref() == Some("sk-w****6789")
        }));
    }
}
