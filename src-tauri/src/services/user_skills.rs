//! Persistent store for user-authored / imported skills (user_skills.json).
//!
//! Mirrors `memory_store`: a single JSON file in the app data dir with simple
//! list/save/delete. Skills here are inert — `dry_run` only describes what a
//! skill WOULD do and flags dangerous tokens; nothing is ever executed from
//! this module. Real execution still requires a runner plus explicit approval.

use std::path::{Path, PathBuf};

use crate::models::{
    now_iso, RiskLevel, UserSkill, UserSkillDryRun, UserSkillInput, UserSkillSource,
};

/// Obviously-destructive command patterns. Presence forces high risk and
/// approval; this is a guardrail for the obvious cases, not a full sandbox.
const DANGEROUS_PATTERNS: &[&str] = &[
    "rm -rf",
    "mkfs",
    "dd if=",
    "dd of=",
    "chmod -r 777",
    "chmod 777 /",
    "chown -r",
    ":(){ :|:& };:",
    "> /dev/sd",
    "mv / ",
];

pub fn detect_dangerous_tokens(content: &str) -> Vec<String> {
    let lower = content.to_lowercase();
    DANGEROUS_PATTERNS
        .iter()
        .filter(|pat| lower.contains(*pat))
        .map(|pat| (*pat).to_owned())
        .collect()
}

fn uses_sudo(content: &str) -> bool {
    content
        .lines()
        .any(|line| line.trim_start().starts_with("sudo ") || line.contains(" sudo "))
}

fn script_has_dry_run(content: &str) -> bool {
    let lower = content.to_lowercase();
    lower.contains("--dry-run") || lower.contains("dry_run")
}

fn slugify(name: &str) -> String {
    let slug: String = name
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let collapsed: Vec<&str> = slug.split('-').filter(|s| !s.is_empty()).collect();
    let base = collapsed.join("-");
    if base.is_empty() {
        "skill".to_owned()
    } else {
        base.chars().take(32).collect()
    }
}

pub struct UserSkillStore {
    path: PathBuf,
}

impl UserSkillStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn default_for_dir(data_dir: &Path) -> Self {
        Self::new(data_dir.join("user_skills.json"))
    }

    pub fn list(&self) -> Vec<UserSkill> {
        match std::fs::read_to_string(&self.path) {
            Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    }

    fn write_all(&self, skills: &[UserSkill]) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|err| format!("falha ao criar diretório: {err}"))?;
        }
        let serialized = serde_json::to_string_pretty(skills)
            .map_err(|err| format!("falha ao serializar skills: {err}"))?;
        std::fs::write(&self.path, serialized)
            .map_err(|err| format!("falha ao salvar skills: {err}"))
    }

    /// Infers a risk level from the content unless the caller pinned one;
    /// dangerous tokens always bump to High.
    fn resolve_risk(input_risk: Option<RiskLevel>, content: &str) -> RiskLevel {
        if !detect_dangerous_tokens(content).is_empty() {
            return RiskLevel::High;
        }
        match input_risk {
            Some(risk) => risk,
            None if uses_sudo(content) => RiskLevel::Medium,
            None => RiskLevel::Low,
        }
    }

    pub fn save(&self, input: UserSkillInput) -> Result<Vec<UserSkill>, String> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err("Informe um nome para a skill.".to_owned());
        }
        let mut skills = self.list();
        let now = now_iso();
        let risk = Self::resolve_risk(input.risk, &input.content);
        let source = input.source.unwrap_or(UserSkillSource::Manual);

        match input.id {
            Some(id) if skills.iter().any(|s| s.id == id) => {
                for skill in skills.iter_mut() {
                    if skill.id == id {
                        skill.name = name.to_owned();
                        skill.description = input.description.trim().to_owned();
                        skill.content = input.content.clone();
                        skill.permissions = input.permissions.clone();
                        skill.risk = risk;
                        skill.source = source;
                        skill.updated_at = now.clone();
                    }
                }
            }
            _ => {
                let id = format!(
                    "local-{}-{}",
                    slugify(name),
                    &now.replace([':', '.', '-'], "")
                );
                skills.insert(
                    0,
                    UserSkill {
                        id,
                        name: name.to_owned(),
                        description: input.description.trim().to_owned(),
                        content: input.content,
                        source,
                        permissions: input.permissions,
                        risk,
                        created_at: now.clone(),
                        updated_at: now,
                    },
                );
            }
        }
        self.write_all(&skills)?;
        Ok(skills)
    }

    pub fn delete(&self, id: &str) -> Result<Vec<UserSkill>, String> {
        let skills: Vec<UserSkill> = self.list().into_iter().filter(|s| s.id != id).collect();
        self.write_all(&skills)?;
        Ok(skills)
    }

    /// Describes what the skill would do without executing anything.
    pub fn dry_run(&self, id: &str) -> Result<UserSkillDryRun, String> {
        let skill = self
            .list()
            .into_iter()
            .find(|s| s.id == id)
            .ok_or_else(|| "Skill não encontrada.".to_owned())?;

        let dangerous = detect_dangerous_tokens(&skill.content);
        let requires_approval = !matches!(skill.risk, RiskLevel::Low) || !dangerous.is_empty();
        let dry_run_note = if script_has_dry_run(&skill.content) {
            "O script declara suporte a --dry-run."
        } else {
            "O script não declara --dry-run; este teste é apenas uma simulação."
        };
        let danger_note = if dangerous.is_empty() {
            "Nenhum comando obviamente destrutivo detectado.".to_owned()
        } else {
            format!(
                "Comandos potencialmente destrutivos: {}.",
                dangerous.join(", ")
            )
        };

        let summary = format!(
            "Simulação de \"{}\". {} {} Nada é executado aqui.",
            skill.name, dry_run_note, danger_note
        );
        let preview = format!(
            "# Dry-run simulado de \"{}\"\n# Risco: {:?} · Aprovação: {}\n# Nada é executado.\n\n{}",
            skill.name,
            skill.risk,
            if requires_approval { "obrigatória" } else { "não obrigatória" },
            skill.content.trim()
        );

        Ok(UserSkillDryRun {
            skill_id: skill.id,
            summary,
            permissions: skill.permissions,
            risk: skill.risk,
            requires_approval,
            dangerous_tokens: dangerous,
            preview,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> UserSkillStore {
        let dir = std::env::temp_dir().join(format!(
            "ailu-userskills-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        UserSkillStore::default_for_dir(&dir)
    }

    fn input(name: &str, content: &str) -> UserSkillInput {
        UserSkillInput {
            id: None,
            name: name.to_owned(),
            description: String::new(),
            content: content.to_owned(),
            source: Some(UserSkillSource::Manual),
            permissions: vec![],
            risk: Some(RiskLevel::Low),
        }
    }

    #[test]
    fn saves_and_lists_and_round_trips_disk() {
        let store = store();
        store.save(input("Minha Skill", "echo oi")).expect("save");
        let again = UserSkillStore::new(store.path.clone()).list();
        assert_eq!(again.len(), 1);
        assert_eq!(again[0].name, "Minha Skill");
    }

    #[test]
    fn rejects_empty_name() {
        let store = store();
        assert!(store.save(input("   ", "echo")).is_err());
    }

    #[test]
    fn dangerous_content_forces_high_risk() {
        let store = store();
        let skills = store
            .save(input("Perigosa", "rm -rf /tmp/x"))
            .expect("save");
        assert_eq!(skills[0].risk, RiskLevel::High);
    }

    #[test]
    fn dry_run_flags_danger_and_approval_without_executing() {
        let store = store();
        let skills = store
            .save(input("Perigosa", "sudo rm -rf /tmp/x"))
            .expect("save");
        let report = store.dry_run(&skills[0].id).expect("dry-run");
        assert!(report.requires_approval);
        assert!(!report.dangerous_tokens.is_empty());
        assert!(report.summary.contains("Nada é executado"));
    }

    #[test]
    fn delete_removes_skill() {
        let store = store();
        let skills = store.save(input("Some", "echo")).expect("save");
        let after = store.delete(&skills[0].id).expect("delete");
        assert!(after.is_empty());
    }

    #[test]
    fn low_risk_skill_does_not_require_approval() {
        let store = store();
        let skills = store
            .save(input("Segura", "echo apenas texto"))
            .expect("save");
        let report = store.dry_run(&skills[0].id).expect("dry-run");
        assert!(!report.requires_approval);
    }
}
