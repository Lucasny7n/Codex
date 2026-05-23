use std::process::Command;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SkillStep {
    pub order: u32,
    pub description: String,
    pub command: String,
    pub args: Vec<String>,
    pub risk_level: String,
    pub requires_sudo: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ApprovedExecutionPlan {
    pub id: String,
    pub skill_id: String,
    pub summary: String,
    pub reason: String,
    pub total_risk: String,
    pub requires_sudo: bool,
    pub requires_internet: Option<bool>,
    pub modifies_files: Option<bool>,
    pub modifies_services: Option<bool>,
    pub backup_required: Option<bool>,
    pub status: String,
    pub steps: Vec<SkillStep>,
    pub rollback_plan: Option<String>,
    pub created_at: String,
    pub approved_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExecutionResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

const GLOBAL_WHITELIST: &[&str] = &[
    "pacman", "yay", "flatpak", "systemctl", "wpctl", "journalctl", 
    "aplay", "arecord", "bluetoothctl", "rfkill", "ping", "ip", "nmcli", "resolvectl",
    "python", "pip", "~/.local/share/ailu/airllm-venv/bin/pip", "sudo"
];

#[tauri::command]
pub fn execute_approved_plan(plan: ApprovedExecutionPlan) -> Result<ExecutionResult, String> {
    if plan.status != "approved" {
        return Err(format!("Plano {} bloqueado: Status não é 'approved'.", plan.id));
    }

    if plan.requires_sudo {
        // Mock validation for now, since we don't have a sudo backend agent yet.
        return Err(format!("Este plano exige sudo e ainda não há executor privilegiado configurado. Copie os comandos e execute manualmente se confiar."));
    }

    let mut full_stdout = String::new();
    let mut full_stderr = String::new();
    let mut final_exit_code = 0;

    for step in plan.steps {
        if !GLOBAL_WHITELIST.contains(&step.command.as_str()) {
            return Err(format!("Plano bloqueado: Comando '{}' não está na whitelist.", step.command));
        }

        if step.command == "sudo" {
            return Err("Execução direta de sudo pelo motor básico não permitida.".into());
        }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_execute_approved_plan_requires_approved_status() {
        let plan = ApprovedExecutionPlan {
            id: "1".into(),
            skill_id: "test".into(),
            summary: "test".into(),
            reason: "test".into(),
            total_risk: "Seguro".into(),
            requires_sudo: false,
            requires_internet: None,
            modifies_files: None,
            modifies_services: None,
            backup_required: None,
            status: "pending".into(),
            steps: vec![],
            rollback_plan: None,
            created_at: "now".into(),
            approved_at: None,
        };
        let res = execute_approved_plan(plan);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Status não é 'approved'"));
    }

    #[test]
    fn test_execute_approved_plan_blocks_sudo() {
        let plan = ApprovedExecutionPlan {
            id: "1".into(),
            skill_id: "test".into(),
            summary: "test".into(),
            reason: "test".into(),
            total_risk: "Seguro".into(),
            requires_sudo: true,
            requires_internet: None,
            modifies_files: None,
            modifies_services: None,
            backup_required: None,
            status: "approved".into(),
            steps: vec![],
            rollback_plan: None,
            created_at: "now".into(),
            approved_at: None,
        };
        let res = execute_approved_plan(plan);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Este plano exige sudo"));
    }
}

        if step.command == "sh" && step.args.contains(&"-c".to_string()) {
             return Err("Execução arbitrária de shell (sh -c) não permitida por segurança.".into());
        }

        println!("[EXECUTOR] Executando Passo {}: {} {:?}", step.order, step.command, step.args);
        
        let mut cmd = Command::new(&step.command);
        cmd.args(&step.args);

        let output = cmd.output().map_err(|e| format!("Falha ao iniciar comando: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        full_stdout.push_str(&stdout);
        full_stderr.push_str(&stderr);

        if !output.status.success() {
            return Err(format!("Passo {} falhou: {}", step.order, stderr));
        }
    }

    Ok(ExecutionResult {
        success: true,
        stdout: full_stdout,
        stderr: full_stderr,
        exit_code: final_exit_code,
    })
}

#[tauri::command]
pub fn backup_file_for_rollback(filepath: String) -> Result<String, String> {
    let backup_path = format!("{}.bak", filepath);
    fs::copy(&filepath, &backup_path).map_err(|e| format!("Falha no rollback (backup): {}", e))?;
    Ok(backup_path)
}
