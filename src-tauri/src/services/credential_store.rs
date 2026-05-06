use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::models::{now_iso, ProviderCredentialStatus};

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CredentialFile {
    providers: BTreeMap<String, String>,
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
        let normalized = key.trim();
        if normalized.is_empty() {
            return Err(AppError::Message("API key vazia.".to_owned()));
        }

        self.cache
            .write()
            .providers
            .insert(provider_id.to_owned(), normalized.to_owned());
        self.flush()?;
        Ok(self.status(provider_id))
    }

    pub fn remove(&self, provider_id: &str) -> AppResult<ProviderCredentialStatus> {
        self.cache.write().providers.remove(provider_id);
        self.flush()?;
        Ok(self.status(provider_id))
    }

    pub fn get(&self, provider_id: &str) -> Option<String> {
        if let Some(value) = self.cache.read().providers.get(provider_id) {
            if !value.trim().is_empty() {
                return Some(value.clone());
            }
        }

        env_credential(provider_id)
    }

    pub fn exists(&self, provider_id: &str) -> bool {
        self.get(provider_id).is_some()
    }

    pub fn status(&self, provider_id: &str) -> ProviderCredentialStatus {
        let saved = self.cache.read().providers.get(provider_id).cloned();
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

    fn flush(&self) -> AppResult<()> {
        let body = serde_json::to_string_pretty(&*self.cache.read())?;
        fs::write(&self.path, body)?;
        Ok(())
    }
}

fn env_credential(provider_id: &str) -> Option<String> {
    let keys: &[&str] = match provider_id {
        "openai-api" => &["OPENAI_API_KEY"],
        "openrouter-api" => &["OPENROUTER_API_KEY"],
        "anthropic-api" => &["ANTHROPIC_API_KEY"],
        "gemini-api" | "gemini-cli" => &["GEMINI_API_KEY", "GOOGLE_API_KEY"],
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

    #[test]
    fn masks_without_exposing_full_key() {
        let masked = mask_secret("sk-test-123456789");
        assert!(masked.starts_with("sk-t"));
        assert!(masked.ends_with("6789"));
        assert!(!masked.contains("12345"));
    }
}
