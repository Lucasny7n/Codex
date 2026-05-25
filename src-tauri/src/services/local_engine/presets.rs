//! Per-model runtime presets, persisted as versioned JSON.
//! Location: ~/.config/ailu/local-engine/runtime-presets.json

use std::path::{Path, PathBuf};

use crate::models::local_engine::{RuntimeBackendId, RuntimePreset};
use crate::models::now_iso;

/// Insert or replace a preset, keyed by (modelId, backendId). Pure: returns the
/// updated list so it can be unit-tested without touching disk.
pub fn upsert(mut presets: Vec<RuntimePreset>, mut preset: RuntimePreset) -> Vec<RuntimePreset> {
    let now = now_iso();
    if preset.created_at.is_none() {
        preset.created_at = Some(now.clone());
    }
    preset.updated_at = Some(now);
    if let Some(existing) = presets
        .iter_mut()
        .find(|item| item.model_id == preset.model_id && item.backend_id == preset.backend_id)
    {
        preset.created_at = existing.created_at.clone().or(preset.created_at.clone());
        *existing = preset;
    } else {
        presets.push(preset);
    }
    presets
}

pub fn remove(
    presets: Vec<RuntimePreset>,
    model_id: &str,
    backend_id: RuntimeBackendId,
) -> Vec<RuntimePreset> {
    presets
        .into_iter()
        .filter(|item| !(item.model_id == model_id && item.backend_id == backend_id))
        .collect()
}

pub struct PresetStore {
    path: PathBuf,
}

impl PresetStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    /// Default location under the user's config dir.
    pub fn default_for_home(home: &Path) -> Self {
        Self::new(home.join(".config/ailu/local-engine/runtime-presets.json"))
    }

    pub fn list(&self) -> Vec<RuntimePreset> {
        match std::fs::read_to_string(&self.path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    }

    fn write_all(&self, presets: &[RuntimePreset]) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|err| format!("falha ao criar diretório de presets: {err}"))?;
        }
        let serialized = serde_json::to_string_pretty(presets)
            .map_err(|err| format!("falha ao serializar presets: {err}"))?;
        std::fs::write(&self.path, serialized)
            .map_err(|err| format!("falha ao salvar presets: {err}"))
    }

    pub fn save(&self, preset: RuntimePreset) -> Result<Vec<RuntimePreset>, String> {
        let updated = upsert(self.list(), preset);
        self.write_all(&updated)?;
        Ok(updated)
    }

    pub fn delete(
        &self,
        model_id: &str,
        backend_id: RuntimeBackendId,
    ) -> Result<Vec<RuntimePreset>, String> {
        let updated = remove(self.list(), model_id, backend_id);
        self.write_all(&updated)?;
        Ok(updated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::local_engine::ExecutionProfile;

    fn preset(model: &str, backend: RuntimeBackendId, ctx: u32) -> RuntimePreset {
        RuntimePreset {
            model_id: model.to_owned(),
            backend_id: backend,
            profile: ExecutionProfile::Balanced,
            context_size: ctx,
            gpu_layers: None,
            threads: None,
            batch_size: None,
            kv_cache_quant: None,
            offload_gpu: false,
            offload_cpu: false,
            offload_ram: false,
            offload_disk: false,
            env: vec![],
            args: vec![],
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn upsert_adds_then_replaces() {
        let list = upsert(vec![], preset("m", RuntimeBackendId::Ollama, 4096));
        assert_eq!(list.len(), 1);
        assert!(list[0].created_at.is_some());

        let list = upsert(list, preset("m", RuntimeBackendId::Ollama, 8192));
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].context_size, 8192);
        // created_at preserved across replace.
        assert!(list[0].created_at.is_some());
    }

    #[test]
    fn upsert_keeps_distinct_backends_separate() {
        let list = upsert(vec![], preset("m", RuntimeBackendId::Ollama, 4096));
        let list = upsert(list, preset("m", RuntimeBackendId::LlamaCppVulkan, 4096));
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn remove_drops_match() {
        let list = upsert(vec![], preset("m", RuntimeBackendId::Ollama, 4096));
        let list = remove(list, "m", RuntimeBackendId::Ollama);
        assert!(list.is_empty());
    }

    #[test]
    fn round_trips_through_disk() {
        let dir = std::env::temp_dir().join(format!("ailu-presets-{}", std::process::id()));
        let store = PresetStore::new(dir.join("runtime-presets.json"));
        let saved = store
            .save(preset("m", RuntimeBackendId::Ollama, 4096))
            .expect("save");
        assert_eq!(saved.len(), 1);
        let reloaded = store.list();
        assert_eq!(reloaded.len(), 1);
        assert_eq!(reloaded[0].model_id, "m");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
