//! Structured, versioned memory entries persisted as JSON on the local disk.
//! Location: `{memory_dir}/entries.json`.
//!
//! This is the unified store behind global + per-project memory. Pure helpers
//! (`upsert`, `remove`, `recall`) are testable without touching disk; the
//! `MemoryEntryStore` wraps them with file I/O. Nothing is opaque: every entry
//! carries scope, project, origin, confidence and timestamps.

use std::path::{Path, PathBuf};

use crate::models::{now_iso, MemoryEntry, MemoryRecallMode, MemoryScope};

/// Insert or replace an entry, keyed by `id`. Pure: returns the updated list.
pub fn upsert(mut entries: Vec<MemoryEntry>, mut entry: MemoryEntry) -> Vec<MemoryEntry> {
    let now = now_iso();
    if entry.created_at.is_empty() {
        entry.created_at = now.clone();
    }
    entry.updated_at = Some(now);
    // Project memories must carry a project; global memories must not.
    if entry.scope == MemoryScope::Global {
        entry.project = None;
    }
    if let Some(existing) = entries.iter_mut().find(|item| item.id == entry.id) {
        entry.created_at = if existing.created_at.is_empty() {
            entry.created_at.clone()
        } else {
            existing.created_at.clone()
        };
        *existing = entry;
    } else {
        entries.push(entry);
    }
    entries
}

pub fn remove(entries: Vec<MemoryEntry>, id: &str) -> Vec<MemoryEntry> {
    entries.into_iter().filter(|item| item.id != id).collect()
}

/// The memories that should be recalled into context for a turn.
/// `Default` = global + the active project's memories; `ProjectOnly` isolates
/// to the active project. A `None` project yields only global (Default) or
/// nothing (ProjectOnly).
pub fn recall(
    entries: &[MemoryEntry],
    mode: MemoryRecallMode,
    project: Option<&str>,
) -> Vec<MemoryEntry> {
    entries
        .iter()
        .filter(|entry| match (entry.scope, mode) {
            (MemoryScope::Global, MemoryRecallMode::Default) => true,
            (MemoryScope::Global, MemoryRecallMode::ProjectOnly) => false,
            (MemoryScope::Project, _) => project.is_some() && entry.project.as_deref() == project,
        })
        .cloned()
        .collect()
}

pub struct MemoryEntryStore {
    path: PathBuf,
}

impl MemoryEntryStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    /// Default location next to the other memory files.
    pub fn default_for_dir(memory_dir: &Path) -> Self {
        Self::new(memory_dir.join("entries.json"))
    }

    pub fn list(&self) -> Vec<MemoryEntry> {
        match std::fs::read_to_string(&self.path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    }

    fn write_all(&self, entries: &[MemoryEntry]) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|err| format!("falha ao criar diretório de memórias: {err}"))?;
        }
        let serialized = serde_json::to_string_pretty(entries)
            .map_err(|err| format!("falha ao serializar memórias: {err}"))?;
        std::fs::write(&self.path, serialized)
            .map_err(|err| format!("falha ao salvar memórias: {err}"))
    }

    pub fn save(&self, entry: MemoryEntry) -> Result<Vec<MemoryEntry>, String> {
        let updated = upsert(self.list(), entry);
        self.write_all(&updated)?;
        Ok(updated)
    }

    pub fn delete(&self, id: &str) -> Result<Vec<MemoryEntry>, String> {
        let updated = remove(self.list(), id);
        self.write_all(&updated)?;
        Ok(updated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{MemoryEntryKind, MemoryOrigin};

    fn entry(id: &str, scope: MemoryScope, project: Option<&str>) -> MemoryEntry {
        MemoryEntry {
            id: id.to_owned(),
            content: format!("conteúdo {id}"),
            kind: MemoryEntryKind::Note,
            scope,
            project: project.map(ToOwned::to_owned),
            origin: MemoryOrigin::User,
            confidence: 1.0,
            manual: true,
            created_at: String::new(),
            updated_at: None,
        }
    }

    #[test]
    fn upsert_adds_then_replaces_and_keeps_created_at() {
        let list = upsert(vec![], entry("a", MemoryScope::Global, None));
        assert_eq!(list.len(), 1);
        assert!(!list[0].created_at.is_empty());
        let created = list[0].created_at.clone();

        let mut changed = entry("a", MemoryScope::Global, None);
        changed.content = "novo".to_owned();
        let list = upsert(list, changed);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].content, "novo");
        assert_eq!(list[0].created_at, created, "created_at preservado");
    }

    #[test]
    fn global_scope_drops_project() {
        let mut e = entry("g", MemoryScope::Global, Some("ailu"));
        e.scope = MemoryScope::Global;
        let list = upsert(vec![], e);
        assert!(list[0].project.is_none(), "global não carrega projeto");
    }

    #[test]
    fn remove_drops_match() {
        let list = upsert(vec![], entry("a", MemoryScope::Global, None));
        let list = remove(list, "a");
        assert!(list.is_empty());
    }

    #[test]
    fn recall_default_includes_global_and_active_project() {
        let entries = vec![
            entry("g", MemoryScope::Global, None),
            entry("p1", MemoryScope::Project, Some("ailu")),
            entry("p2", MemoryScope::Project, Some("outro")),
        ];
        let got = recall(&entries, MemoryRecallMode::Default, Some("ailu"));
        let ids: Vec<&str> = got.iter().map(|e| e.id.as_str()).collect();
        assert!(ids.contains(&"g"));
        assert!(ids.contains(&"p1"));
        assert!(!ids.contains(&"p2"), "projeto diferente não entra");
    }

    #[test]
    fn recall_project_only_isolates() {
        let entries = vec![
            entry("g", MemoryScope::Global, None),
            entry("p1", MemoryScope::Project, Some("ailu")),
        ];
        let got = recall(&entries, MemoryRecallMode::ProjectOnly, Some("ailu"));
        let ids: Vec<&str> = got.iter().map(|e| e.id.as_str()).collect();
        assert_eq!(ids, vec!["p1"], "apenas projeto, sem global");
    }

    #[test]
    fn recall_default_without_project_is_global_only() {
        let entries = vec![
            entry("g", MemoryScope::Global, None),
            entry("p1", MemoryScope::Project, Some("ailu")),
        ];
        let got = recall(&entries, MemoryRecallMode::Default, None);
        let ids: Vec<&str> = got.iter().map(|e| e.id.as_str()).collect();
        assert_eq!(ids, vec!["g"]);
    }

    #[test]
    fn round_trips_through_disk() {
        let dir = std::env::temp_dir().join(format!("ailu-mem-{}", std::process::id()));
        let store = MemoryEntryStore::default_for_dir(&dir);
        let saved = store
            .save(entry("a", MemoryScope::Global, None))
            .expect("save");
        assert_eq!(saved.len(), 1);
        let reloaded = store.list();
        assert_eq!(reloaded.len(), 1);
        assert_eq!(reloaded[0].id, "a");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
