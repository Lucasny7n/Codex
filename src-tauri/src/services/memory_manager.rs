use std::fs;
use std::path::{Path, PathBuf};

use crate::error::AppResult;
use crate::models::MemorySnapshot;

#[derive(Debug, Clone)]
pub struct MemoryManager {
    codex_root: PathBuf,
    memory_dir: PathBuf,
}

impl MemoryManager {
    pub fn new(codex_root: &Path, memory_dir: &Path) -> AppResult<Self> {
        fs::create_dir_all(memory_dir)?;
        Ok(Self {
            codex_root: codex_root.to_path_buf(),
            memory_dir: memory_dir.to_path_buf(),
        })
    }

    pub fn load_snapshot(&self) -> AppResult<MemorySnapshot> {
        let summary_source = self.codex_root.join("memories").join("memory_summary.md");

        let source = fs::read_to_string(summary_source).unwrap_or_default();

        let profile_summary = self.ensure_text_file(
            "profile_summary.md",
            &extract_profile_summary(&source).unwrap_or_else(|| {
                "Perfil operacional carregado do ecossistema ~/.codex com foco em segurança, diagnóstico e execução em etapas.".to_owned()
            }),
        )?;

        let user_preferences = self.ensure_list_file(
            "user_preferences.md",
            extract_section_bullets(&source, "## User preferences"),
        )?;

        let active_projects = self.ensure_list_file(
            "active_projects.md",
            vec![
                "/home/lucas/Codex (workspace principal)".to_owned(),
                "~/.codex (config, memórias e runtime)".to_owned(),
            ],
        )?;

        let important_fix_history = self.ensure_list_file(
            "important_fixes.md",
            extract_section_bullets(&source, "### /home/lucas"),
        )?;

        let operational_policies = self.ensure_list_file(
            "operational_policies.md",
            vec![
                "Diagnosticar antes de alterar".to_owned(),
                "Backup com timestamp antes de arquivos críticos".to_owned(),
                "Executar em etapas pequenas com validação".to_owned(),
                "Sem sudo -S e sem armazenamento de senha".to_owned(),
            ],
        )?;

        Ok(MemorySnapshot {
            profile_summary,
            user_preferences,
            active_projects,
            important_fix_history,
            operational_policies,
        })
    }

    fn ensure_text_file(&self, name: &str, fallback: &str) -> AppResult<String> {
        let path = self.memory_dir.join(name);
        if path.exists() {
            let content = fs::read_to_string(&path)?;
            if !content.trim().is_empty() {
                return Ok(content.trim().to_owned());
            }
        }

        fs::write(&path, fallback)?;
        Ok(fallback.to_owned())
    }

    fn ensure_list_file(&self, name: &str, fallback: Vec<String>) -> AppResult<Vec<String>> {
        let path = self.memory_dir.join(name);

        if path.exists() {
            let content = fs::read_to_string(&path)?;
            let parsed = content
                .lines()
                .filter_map(|line| line.strip_prefix("- ").map(ToOwned::to_owned))
                .collect::<Vec<_>>();
            if !parsed.is_empty() {
                return Ok(parsed);
            }
        }

        let lines = if fallback.is_empty() {
            vec!["Sem dados ainda.".to_owned()]
        } else {
            fallback
        };
        let body = lines
            .iter()
            .map(|line| format!("- {line}"))
            .collect::<Vec<_>>()
            .join("\n");
        fs::write(path, body)?;
        Ok(lines)
    }
}

fn extract_profile_summary(source: &str) -> Option<String> {
    let marker = "## User Profile";
    let start = source.find(marker)?;
    let after = &source[start + marker.len()..];
    let mut lines = Vec::new();

    for line in after.lines().skip(1) {
        if line.starts_with("## ") {
            break;
        }
        if !line.trim().is_empty() {
            lines.push(line.trim().to_owned());
            if lines.len() >= 3 {
                break;
            }
        }
    }

    if lines.is_empty() {
        None
    } else {
        Some(lines.join(" "))
    }
}

fn extract_section_bullets(source: &str, section_title: &str) -> Vec<String> {
    let Some(start) = source.find(section_title) else {
        return Vec::new();
    };

    let after = &source[start + section_title.len()..];
    let mut collected = Vec::new();

    for line in after.lines().skip(1) {
        let trimmed = line.trim();
        if trimmed.starts_with("## ") || trimmed.starts_with("### ") {
            if !collected.is_empty() {
                break;
            }
            continue;
        }
        if let Some(value) = trimmed.strip_prefix("- ") {
            collected.push(value.to_owned());
        }
    }

    collected
}
