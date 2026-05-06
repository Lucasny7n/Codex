use std::process::Stdio;
use std::sync::Arc;

use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{
    now_iso, AppSettings, CommandLogChunk, ExecutionRequestInput, LogStream, SessionStatus,
    StatusKind, TaskStatus,
};
use crate::services::session_manager::SessionManager;

#[derive(Debug, Default)]
pub struct CommandExecutor;

impl CommandExecutor {
    pub async fn execute(
        &self,
        app: AppHandle,
        settings: AppSettings,
        session_manager: Arc<SessionManager>,
        input: ExecutionRequestInput,
    ) -> AppResult<String> {
        let execution_id = Uuid::new_v4().to_string();
        let shell = if settings.preferred_shell.trim().is_empty() {
            "/usr/bin/bash".to_owned()
        } else {
            settings.preferred_shell.clone()
        };
        let command_text = input.command.trim().to_owned();
        enforce_privileged_policy(&command_text).await?;
        let cwd = input
            .cwd
            .clone()
            .unwrap_or_else(|| settings.workspace_root.clone());

        if let Some(session) = session_manager.update_status(
            &input.session_id,
            SessionStatus::Executing,
            Some("Executar comando"),
            Some(TaskStatus::Running),
            Some(format!("shell: {shell} | cwd: {cwd}")),
        )? {
            let _ = app.emit("session-changed", session);
        }

        let note = session_manager.make_status_note(
            &input.session_id,
            StatusKind::Info,
            "Execução iniciada",
            &format!("Comando: {}", command_text),
        );
        let _ = app.emit("status-note", note);

        let mut command = Command::new(&shell);
        command
            .arg("-lc")
            .arg(&command_text)
            .current_dir(&cwd)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command.spawn().map_err(|cause| {
            AppError::Message(format!(
                "Falha ao iniciar comando com shell {}: {}",
                shell, cause
            ))
        })?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| AppError::Message("stdout indisponível".to_owned()))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| AppError::Message("stderr indisponível".to_owned()))?;

        let session_id = input.session_id.clone();
        let session_id_stderr = session_id.clone();
        let session_id_wait = session_id.clone();
        let exec_stdout = execution_id.clone();
        let exec_stderr = execution_id.clone();
        let exec_wait = execution_id.clone();
        let app_stdout = app.clone();
        let app_stderr = app.clone();
        let app_wait = app.clone();
        let sessions_wait = session_manager.clone();

        let stdout_handle = tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let chunk = CommandLogChunk {
                    execution_id: exec_stdout.clone(),
                    session_id: session_id.clone(),
                    stream: LogStream::Stdout,
                    line,
                    at: now_iso(),
                };
                let _ = app_stdout.emit("command-log", chunk);
            }
        });

        let stderr_handle = tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let chunk = CommandLogChunk {
                    execution_id: exec_stderr.clone(),
                    session_id: session_id_stderr.clone(),
                    stream: LogStream::Stderr,
                    line,
                    at: now_iso(),
                };
                let _ = app_stderr.emit("command-log", chunk);
            }
        });

        tokio::spawn(async move {
            let status = child.wait().await;
            let _ = stdout_handle.await;
            let _ = stderr_handle.await;

            match status {
                Ok(exit_status) => {
                    let _ = app_wait.emit(
                        "command-log",
                        CommandLogChunk {
                            execution_id: exec_wait,
                            session_id: session_id_wait.clone(),
                            stream: LogStream::Meta,
                            line: format!(
                                "processo finalizado com código {:?}",
                                exit_status.code()
                            ),
                            at: now_iso(),
                        },
                    );

                    let (kind, status, task_status, message, summary) = if exit_status.success() {
                        (
                            StatusKind::Success,
                            SessionStatus::Idle,
                            TaskStatus::Done,
                            "Comando concluído com sucesso.",
                            Some("Execução finalizada sem erro crítico.".to_owned()),
                        )
                    } else {
                        (
                            StatusKind::Error,
                            SessionStatus::Error,
                            TaskStatus::Error,
                            "Comando finalizado com erro.",
                            Some(
                                "Recomendado revisar logs e ajustar tentativa seguinte.".to_owned(),
                            ),
                        )
                    };

                    let _ = app_wait.emit(
                        "status-note",
                        sessions_wait.make_status_note(
                            &session_id_wait,
                            kind,
                            "Resultado da execução",
                            message,
                        ),
                    );

                    if let Ok(Some(session)) = sessions_wait.update_status(
                        &session_id_wait,
                        status.clone(),
                        Some("Resultado da execução"),
                        Some(task_status),
                        Some(message.to_owned()),
                    ) {
                        let _ = app_wait.emit("session-changed", session);
                    }

                    if let Ok(Some(session)) = sessions_wait.append_assistant_message(
                        &session_id_wait,
                        message,
                        summary,
                        status,
                    ) {
                        let _ = app_wait.emit("session-changed", session);
                    }
                }
                Err(cause) => {
                    let _ = app_wait.emit(
                        "status-note",
                        sessions_wait.make_status_note(
                            &session_id_wait,
                            StatusKind::Error,
                            "Falha ao aguardar processo",
                            &cause.to_string(),
                        ),
                    );
                }
            }
        });

        Ok(execution_id)
    }
}

async fn enforce_privileged_policy(command: &str) -> AppResult<()> {
    let trimmed = command.trim();

    if trimmed.starts_with("pkexec ") || trimmed.starts_with("doas ") {
        return Err(AppError::Message(
            "Comandos privilegiados diretos são bloqueados. Use a camada de ações privilegiadas com aprovação Sim/Não.".to_owned(),
        ));
    }

    if trimmed.starts_with("sudo ") {
        if !trimmed.starts_with("sudo -n ") {
            return Err(AppError::Message(
                "Política de segurança: comandos sudo devem usar `sudo -n` (sem prompt)."
                    .to_owned(),
            ));
        }

        let status = Command::new("/usr/bin/bash")
            .arg("-lc")
            .arg("sudo -n true")
            .status()
            .await
            .map_err(|cause| AppError::Message(format!("Falha ao validar sudo -n: {cause}")))?;

        if !status.success() {
            return Err(AppError::Message(
                "Infra de privilégio não pronta: `sudo -n` não está liberado neste host. Use helper pkexec ou configure política NOPASSWD.".to_owned(),
            ));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::enforce_privileged_policy;

    #[tokio::test]
    async fn blocks_pkexec_direct_call() {
        let result = enforce_privileged_policy("pkexec /usr/bin/id").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn blocks_doas_direct_call() {
        let result = enforce_privileged_policy("doas id").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn blocks_sudo_without_noninteractive_flag() {
        let result = enforce_privileged_policy("sudo pacman -Syu").await;
        assert!(result.is_err());
    }
}
