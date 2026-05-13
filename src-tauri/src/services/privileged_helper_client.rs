use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::process::Command;

use crate::error::{AppError, AppResult};
use crate::models::{now_iso, PermissionOutcome, PermissionOutcomeStatus};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelperRequest {
    pub request_id: String,
    pub session_id: String,
    pub action_id: String,
    pub args: Value,
    pub dry_run: bool,
    pub user_home: String,
    pub requested_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelperResponse {
    pub success: bool,
    pub summary: String,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
    pub rollback_hint: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PrivilegedHelperClient {
    pub data_root: PathBuf,
    pub workspace_root: PathBuf,
}

impl PrivilegedHelperClient {
    pub fn new(data_root: &Path, workspace_root: &Path) -> Self {
        Self {
            data_root: data_root.to_path_buf(),
            workspace_root: workspace_root.to_path_buf(),
        }
    }

    pub async fn execute_with_pkexec(
        &self,
        request: &HelperRequest,
    ) -> AppResult<PermissionOutcome> {
        let helper_path = self.resolve_helper_path()?;

        let payload = serde_json::to_string(request)?;

        let output = Command::new("pkexec")
            .arg(&helper_path)
            .arg("--request-json")
            .arg(payload)
            .output()
            .await
            .map_err(|cause| {
                AppError::Message(format!("Falha ao executar pkexec/helper: {cause}"))
            })?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        let parsed = serde_json::from_str::<HelperResponse>(&stdout).unwrap_or(HelperResponse {
            success: output.status.success(),
            summary: if output.status.success() {
                "Helper executado com sucesso.".to_owned()
            } else {
                "Helper retornou falha.".to_owned()
            },
            stdout: if stdout.trim().is_empty() {
                None
            } else {
                Some(stdout.clone())
            },
            stderr: if stderr.trim().is_empty() {
                None
            } else {
                Some(stderr.clone())
            },
            exit_code: output.status.code(),
            rollback_hint: None,
        });

        let status = if parsed.success {
            PermissionOutcomeStatus::Success
        } else {
            PermissionOutcomeStatus::Failed
        };

        let outcome = PermissionOutcome {
            request_id: request.request_id.clone(),
            session_id: request.session_id.clone(),
            status,
            summary: parsed.summary,
            stdout: parsed.stdout,
            stderr: parsed.stderr,
            exit_code: parsed.exit_code,
            at: now_iso(),
        };

        self.append_privileged_log(&outcome)?;
        Ok(outcome)
    }

    fn resolve_helper_path(&self) -> AppResult<String> {
        if let Ok(path) = std::env::var("AILU_PRIVILEGED_HELPER_PATH") {
            if PathBuf::from(&path).exists() {
                return Ok(path);
            }
        }

        if let Ok(path) = std::env::var("CODEX_PRIVILEGED_HELPER_PATH") {
            if PathBuf::from(&path).exists() {
                return Ok(path);
            }
        }

        let installed = PathBuf::from("/usr/local/libexec/ailu-privileged-helper");
        if installed.exists() {
            return Ok(installed.to_string_lossy().to_string());
        }

        let legacy_installed = PathBuf::from("/usr/local/libexec/codex-privileged-helper");
        if legacy_installed.exists() {
            return Ok(legacy_installed.to_string_lossy().to_string());
        }

        let local_debug = self
            .workspace_root
            .join("src-tauri")
            .join("target")
            .join("debug")
            .join("ailu-privileged-helper");

        if local_debug.exists() {
            return Ok(local_debug.to_string_lossy().to_string());
        }

        let legacy_local_debug = self
            .workspace_root
            .join("src-tauri")
            .join("target")
            .join("debug")
            .join("codex-privileged-helper");

        if legacy_local_debug.exists() {
            return Ok(legacy_local_debug.to_string_lossy().to_string());
        }

        Err(AppError::Message(
            "Helper privilegiado não encontrado. Rode o script de instalação ou build do binário dedicado.".to_owned(),
        ))
    }

    fn append_privileged_log(&self, outcome: &PermissionOutcome) -> AppResult<()> {
        let logs_dir = self.data_root.join("logs");
        fs::create_dir_all(&logs_dir)?;
        let log_path = logs_dir.join("privileged-actions.log");

        let line = serde_json::to_string(outcome)?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)?;
        file.write_all(line.as_bytes())?;
        file.write_all(b"\n")?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    #[test]
    fn writes_privileged_log() {
        let root = unique_temp_path("ailu-helper-client-test");
        std::fs::create_dir_all(&root).expect("tmp root");
        let client = PrivilegedHelperClient::new(&root, &root);
        let outcome = PermissionOutcome {
            request_id: "r1".to_owned(),
            session_id: "s1".to_owned(),
            status: PermissionOutcomeStatus::Success,
            summary: "ok".to_owned(),
            stdout: Some("a".to_owned()),
            stderr: None,
            exit_code: Some(0),
            at: now_iso(),
        };

        client.append_privileged_log(&outcome).expect("log");
        let data = fs::read_to_string(root.join("logs/privileged-actions.log")).expect("file");
        assert!(data.contains("\"requestId\":\"r1\""));
        let _ = std::fs::remove_dir_all(root);
    }

    fn unique_temp_path(prefix: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        std::env::temp_dir().join(format!("{prefix}-{nanos}"))
    }
}
