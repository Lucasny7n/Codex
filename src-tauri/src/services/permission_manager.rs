use std::collections::HashMap;

use parking_lot::RwLock;
use regex::Regex;
use uuid::Uuid;

use crate::models::{
    now_iso, AppSettings, CommandRunIntent, ExecutionRequestInput, PendingIntentKind,
    PermissionCategory, PermissionDecision, PermissionRequest, PermissionRequestStatus,
    PrivilegedActionRequestInput, RiskLevel,
};

#[derive(Debug)]
pub struct PermissionManager {
    pending: RwLock<HashMap<String, CommandRunIntent>>,
    install_regex: Regex,
    network_regex: Regex,
    read_only_regex: Regex,
}

#[derive(Debug, Clone)]
pub struct Assessment {
    pub request: PermissionRequest,
    pub requires_approval: bool,
}

impl PermissionManager {
    pub fn new() -> Self {
        Self {
            pending: RwLock::new(HashMap::new()),
            install_regex: Regex::new(r"(^|\s)(pacman|yay|paru|apt|dnf|zypper)\s+(-S|install)")
                .expect("regex inválido"),
            network_regex: Regex::new(r"(^|\s)(curl|wget|git\s+clone|npm\s+install|pnpm\s+add|cargo\s+install)")
                .expect("regex inválido"),
            read_only_regex: Regex::new(r"^(ls|cat|rg|grep|find|pwd|whoami|uname|git\s+status|git\s+show|head|tail|journalctl\s+-n)")
                .expect("regex inválido"),
        }
    }

    pub fn assess(&self, input: &ExecutionRequestInput, settings: &AppSettings) -> Assessment {
        let command = input.command.trim();
        let lower = command.to_lowercase();
        let cwd = input
            .cwd
            .as_ref()
            .cloned()
            .unwrap_or_else(|| settings.workspace_root.clone());

        let mut category = PermissionCategory::WorkspaceWrite;
        let mut risk = "Comando pode alterar arquivos do workspace.".to_owned();
        let mut requires_approval = true;

        if lower.starts_with("sudo ") || lower.starts_with("pkexec ") || lower.starts_with("doas ")
        {
            category = PermissionCategory::Privileged;
            risk = "Execução privilegiada com potencial alto de impacto no sistema.".to_owned();
        } else if lower.contains("/boot")
            || lower.contains("/etc")
            || lower.contains("mkfs")
            || lower.contains("dd if=")
            || lower.contains("mount ")
            || lower.contains("umount ")
            || lower.contains("bootctl")
            || lower.contains("systemctl")
            || lower.contains("grub")
        {
            category = PermissionCategory::CriticalSystem;
            risk = "Alvo de sistema crítico (boot, serviços ou filesystem base).".to_owned();
        } else if self.install_regex.is_match(&lower) {
            category = PermissionCategory::PackageInstall;
            risk = "Instalação/remoção de pacotes altera o estado global do sistema.".to_owned();
        } else if self.network_regex.is_match(&lower) {
            category = PermissionCategory::Network;
            risk = "Comando acessa rede/download com impacto externo.".to_owned();
        } else if self.read_only_regex.is_match(&lower)
            && !lower.contains('>')
            && !lower.contains("tee")
            && !lower.contains("-i")
        {
            category = PermissionCategory::SafeRead;
            risk = "Leitura de dados sem escrita direta.".to_owned();
            requires_approval = !settings.auto_approve_safe_read;
        } else if !cwd.starts_with(&settings.workspace_root) {
            category = PermissionCategory::ExternalWrite;
            risk = "Escrita fora do workspace declarado.".to_owned();
        }

        let risk_level = risk_level_for_category(&category);
        let requires_high_confirmation = matches!(
            category,
            PermissionCategory::PackageInstall | PermissionCategory::CriticalSystem
        );
        let request = PermissionRequest {
            id: Uuid::new_v4().to_string(),
            title: "Execução de comando".to_owned(),
            description: "Comando solicitado na central para execução controlada.".to_owned(),
            session_id: input.session_id.clone(),
            command: input.command.clone(),
            action_id: None,
            dry_run: false,
            cwd: cwd.clone(),
            category,
            risk,
            risk_level,
            requires_high_confirmation,
            target: cwd,
            rollback: None,
            reason: input.reason.clone(),
            requested_at: now_iso(),
            status: PermissionRequestStatus::Pending,
        };

        Assessment {
            request,
            requires_approval,
        }
    }

    pub fn store_pending_command(&self, request: PermissionRequest, input: ExecutionRequestInput) {
        self.pending.write().insert(
            request.id.clone(),
            CommandRunIntent {
                request,
                kind: PendingIntentKind::Command(input),
            },
        );
    }

    pub fn store_pending_privileged(
        &self,
        request: PermissionRequest,
        input: PrivilegedActionRequestInput,
    ) {
        self.pending.write().insert(
            request.id.clone(),
            CommandRunIntent {
                request,
                kind: PendingIntentKind::Privileged(input),
            },
        );
    }

    pub fn list_pending(&self) -> Vec<PermissionRequest> {
        let mut entries = self
            .pending
            .read()
            .values()
            .map(|entry| entry.request.clone())
            .collect::<Vec<_>>();
        entries.sort_by(|a, b| b.requested_at.cmp(&a.requested_at));
        entries
    }

    pub fn resolve(
        &self,
        request_id: &str,
        decision: PermissionDecision,
    ) -> Option<CommandRunIntent> {
        match decision {
            PermissionDecision::AllowOnce => self.pending.write().remove(request_id),
            PermissionDecision::DenyOnce => {
                self.pending.write().remove(request_id);
                None
            }
        }
    }
}

fn risk_level_for_category(category: &PermissionCategory) -> RiskLevel {
    match category {
        PermissionCategory::SafeRead => RiskLevel::Low,
        PermissionCategory::WorkspaceWrite => RiskLevel::Medium,
        PermissionCategory::ExternalWrite => RiskLevel::High,
        PermissionCategory::Network => RiskLevel::High,
        PermissionCategory::Privileged => RiskLevel::High,
        PermissionCategory::PackageInstall => RiskLevel::Critical,
        PermissionCategory::CriticalSystem => RiskLevel::Critical,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings() -> AppSettings {
        AppSettings {
            workspace_root: "/tmp/codex-workspace".to_owned(),
            codex_root: "/tmp/codex-root".to_owned(),
            selected_provider_id: "openai".to_owned(),
            selected_model_id: "gpt-5.5".to_owned(),
            selected_agent_id: "equilibrado".to_owned(),
            selected_provider_profile_id: Some("openai:default".to_owned()),
            preferred_shell: "/usr/bin/bash".to_owned(),
            auto_approve_safe_read: true,
            execution_mode: crate::models::ExecutionMode::Cloud,
            selected_local_model_id: None,
            model_selection_history: Vec::new(),
            local_models_root: "/tmp/.codex/models".to_owned(),
            theme_preference: crate::models::ThemePreference::Dark,
            ai_response_language: "pt-BR".to_owned(),
            auto_generate_titles: true,
            auto_copy_responses: false,
            paste_large_text_as_file: true,
            personalization: crate::models::AppPersonalizationSettings::default(),
        }
    }

    fn input(command: &str) -> ExecutionRequestInput {
        ExecutionRequestInput {
            session_id: "s1".to_owned(),
            command: command.to_owned(),
            cwd: Some("/tmp/codex-workspace".to_owned()),
            reason: "teste".to_owned(),
        }
    }

    #[test]
    fn classify_safe_read() {
        let manager = PermissionManager::new();
        let assessment = manager.assess(&input("ls -la"), &settings());
        assert!(matches!(
            assessment.request.category,
            PermissionCategory::SafeRead
        ));
        assert!(!assessment.requires_approval);
    }

    #[test]
    fn classify_privileged() {
        let manager = PermissionManager::new();
        let assessment = manager.assess(&input("sudo pacman -Syu"), &settings());
        assert!(matches!(
            assessment.request.category,
            PermissionCategory::Privileged
        ));
        assert!(assessment.requires_approval);
    }
}
