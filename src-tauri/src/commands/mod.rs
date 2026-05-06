use std::{fs, path::Path, process::Command};

use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::error::{AppError, ErrorPayload};
use crate::models::{
    BootstrapPayload, ExecutionRequestInput, ExecutionResponse, PendingIntentKind,
    PermissionDecision, PermissionOutcome, PermissionOutcomeStatus, PermissionRequest,
    PrivilegedActionRequestInput, PrivilegedActionSpec, SessionStatus, StatusKind, TaskStatus,
    WorkspaceMeta,
};
use crate::services::privileged_actions;
use crate::services::privileged_helper_client::HelperRequest;
use crate::state::AppState;

fn map_err(error: AppError) -> ErrorPayload {
    error.into()
}

#[tauri::command]
pub fn bootstrap_state(
    app: AppHandle,
    state: State<AppState>,
) -> Result<BootstrapPayload, ErrorPayload> {
    let settings = state.settings();

    if state.file_watcher.lock().is_none() {
        if let Ok(watcher) = state
            .file_watcher_service
            .start(app.clone(), &settings.workspace_root)
        {
            *state.file_watcher.lock() = Some(watcher);
        }
    }

    let memory = state.memory_manager.load_snapshot().map_err(map_err)?;
    let payload = BootstrapPayload {
        workspace_meta: load_workspace_meta(&settings.workspace_root),
        settings,
        sessions: state.session_manager.list_sessions(),
        pending_permissions: state.permission_manager.list_pending(),
        providers: state.provider_registry.providers(),
        agent_profiles: state.provider_registry.agent_profiles(),
        memory,
        theme: state.load_system_theme(),
    };

    Ok(payload)
}

fn load_workspace_meta(root: &str) -> WorkspaceMeta {
    let repo_name = Path::new(root)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("workspace")
        .to_owned();

    WorkspaceMeta {
        root: root.to_owned(),
        repo_name,
        branch: git_output(root, ["branch", "--show-current"]).filter(|value| !value.is_empty()),
        head_short: git_output(root, ["rev-parse", "--short", "HEAD"])
            .filter(|value| !value.is_empty()),
        dirty: git_output(root, ["status", "--short"]).is_some_and(|value| !value.is_empty()),
    }
}

fn git_output<const N: usize>(root: &str, args: [&str; N]) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    Some(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

#[tauri::command]
pub fn list_sessions(
    state: State<AppState>,
) -> Result<Vec<crate::models::AgentSession>, ErrorPayload> {
    Ok(state.session_manager.list_sessions())
}

#[tauri::command]
pub fn list_pending_permissions(
    state: State<AppState>,
) -> Result<Vec<crate::models::PermissionRequest>, ErrorPayload> {
    Ok(state.permission_manager.list_pending())
}

#[tauri::command]
pub fn list_privileged_actions() -> Result<Vec<PrivilegedActionSpec>, ErrorPayload> {
    Ok(privileged_actions::catalog())
}

#[tauri::command]
pub fn create_session(
    app: AppHandle,
    state: State<AppState>,
    title: String,
) -> Result<crate::models::AgentSession, ErrorPayload> {
    let session = state
        .session_manager
        .create_session(&title)
        .map_err(map_err)?;
    let _ = app.emit("session-changed", session.clone());
    Ok(session)
}

#[tauri::command]
pub fn append_user_message(
    app: AppHandle,
    state: State<AppState>,
    session_id: String,
    content: String,
) -> Result<crate::models::AgentSession, ErrorPayload> {
    let session = state
        .session_manager
        .append_user_message(&session_id, &content)
        .map_err(map_err)?;
    let _ = app.emit("session-changed", session.clone());
    Ok(session)
}

#[tauri::command]
pub fn request_privileged_action(
    app: AppHandle,
    state: State<AppState>,
    input: PrivilegedActionRequestInput,
) -> Result<PermissionRequest, ErrorPayload> {
    let settings = state.settings();
    let prepared = privileged_actions::prepare(&input).map_err(map_err)?;

    let request_id = Uuid::new_v4().to_string();
    let request = privileged_actions::build_permission_request(
        request_id,
        &input,
        settings.workspace_root,
        &prepared,
    );

    state
        .permission_manager
        .store_pending_privileged(request.clone(), input.clone());

    if let Ok(Some(session)) = state.session_manager.update_status(
        &request.session_id,
        SessionStatus::WaitingApproval,
        Some("Aguardando aprovação de ação privilegiada"),
        Some(TaskStatus::Pending),
        Some(format!("{} [{}]", request.command, request.risk)),
    ) {
        let _ = app.emit("session-changed", session);
    }

    let note = state.session_manager.make_status_note(
        &request.session_id,
        StatusKind::Warn,
        "Ação privilegiada pendente",
        &format!("{} ({})", request.title, request.command),
    );
    let _ = app.emit("status-note", note);
    let _ = app.emit("permission-raised", request.clone());

    Ok(request)
}

#[tauri::command]
pub async fn request_execution(
    app: AppHandle,
    state: State<'_, AppState>,
    input: ExecutionRequestInput,
) -> Result<ExecutionResponse, ErrorPayload> {
    let settings = state.settings();
    let assessment = state.permission_manager.assess(&input, &settings);

    if assessment.requires_approval {
        state
            .permission_manager
            .store_pending_command(assessment.request.clone(), input.clone());

        if let Ok(Some(session)) = state.session_manager.update_status(
            &input.session_id,
            SessionStatus::WaitingApproval,
            Some("Aguardando aprovação"),
            Some(TaskStatus::Pending),
            Some(format!("{}", assessment.request.command)),
        ) {
            let _ = app.emit("session-changed", session);
        }

        let note = state.session_manager.make_status_note(
            &input.session_id,
            StatusKind::Warn,
            "Ação sensível aguardando aprovação",
            &format!(
                "{} [{}]",
                assessment.request.command, assessment.request.risk
            ),
        );
        let _ = app.emit("status-note", note);
        let _ = app.emit("permission-raised", assessment.request.clone());

        return Ok(ExecutionResponse {
            execution_id: None,
            approval_required: true,
            permission_request: Some(assessment.request),
        });
    }

    let execution_id = state
        .command_executor
        .execute(app.clone(), settings, state.session_manager.clone(), input)
        .await;

    let execution_id = match execution_id {
        Ok(id) => id,
        Err(cause) => {
            let _ = app.emit(
                "status-note",
                state.session_manager.make_status_note(
                    &assessment.request.session_id,
                    StatusKind::Error,
                    "Execução bloqueada por política",
                    &cause.to_string(),
                ),
            );
            if let Ok(Some(session)) = state.session_manager.update_status(
                &assessment.request.session_id,
                SessionStatus::Error,
                Some("Execução bloqueada por política"),
                Some(TaskStatus::Error),
                Some(cause.to_string()),
            ) {
                let _ = app.emit("session-changed", session);
            }
            return Ok(ExecutionResponse {
                execution_id: None,
                approval_required: false,
                permission_request: None,
            });
        }
    };

    Ok(ExecutionResponse {
        execution_id: Some(execution_id),
        approval_required: false,
        permission_request: None,
    })
}

#[tauri::command]
pub async fn decide_permission(
    app: AppHandle,
    state: State<'_, AppState>,
    request_id: String,
    decision: PermissionDecision,
) -> Result<(), ErrorPayload> {
    let intent = state
        .permission_manager
        .resolve(&request_id, decision.clone());
    let _ = app.emit("permission-resolved", request_id.clone());

    match (decision, intent) {
        (PermissionDecision::AllowOnce, Some(intent)) => match intent.kind {
            PendingIntentKind::Command(input) => {
                let settings = state.settings();
                if let Err(cause) = state
                    .command_executor
                    .execute(app.clone(), settings, state.session_manager.clone(), input)
                    .await
                {
                    let _ = app.emit(
                        "status-note",
                        state.session_manager.make_status_note(
                            &intent.request.session_id,
                            StatusKind::Error,
                            "Execução bloqueada por política",
                            &cause.to_string(),
                        ),
                    );
                    if let Ok(Some(session)) = state.session_manager.update_status(
                        &intent.request.session_id,
                        SessionStatus::Error,
                        Some("Execução bloqueada por política"),
                        Some(TaskStatus::Error),
                        Some(cause.to_string()),
                    ) {
                        let _ = app.emit("session-changed", session);
                    }
                    emit_permission_outcome(
                        &app,
                        PermissionOutcome {
                            request_id: intent.request.id,
                            session_id: intent.request.session_id,
                            status: PermissionOutcomeStatus::Blocked,
                            summary: cause.to_string(),
                            stdout: None,
                            stderr: None,
                            exit_code: None,
                            at: crate::models::now_iso(),
                        },
                    );
                }
            }
            PendingIntentKind::Privileged(input) => {
                let outcome = run_privileged_action(&state, &intent.request, &input).await;
                match outcome {
                    Ok(outcome) => {
                        let status_kind = match outcome.status {
                            PermissionOutcomeStatus::Success => StatusKind::Success,
                            _ => StatusKind::Error,
                        };
                        let _ = app.emit(
                            "status-note",
                            state.session_manager.make_status_note(
                                &outcome.session_id,
                                status_kind,
                                "Resultado da ação privilegiada",
                                &outcome.summary,
                            ),
                        );
                        let _ = state.session_manager.update_status(
                            &outcome.session_id,
                            if matches!(outcome.status, PermissionOutcomeStatus::Success) {
                                SessionStatus::Idle
                            } else {
                                SessionStatus::Error
                            },
                            Some("Ação privilegiada executada"),
                            Some(
                                if matches!(outcome.status, PermissionOutcomeStatus::Success) {
                                    TaskStatus::Done
                                } else {
                                    TaskStatus::Error
                                },
                            ),
                            Some(outcome.summary.clone()),
                        );
                        emit_permission_outcome(&app, outcome);
                    }
                    Err(cause) => {
                        let outcome = PermissionOutcome {
                            request_id: intent.request.id,
                            session_id: intent.request.session_id.clone(),
                            status: PermissionOutcomeStatus::Blocked,
                            summary: cause.to_string(),
                            stdout: None,
                            stderr: None,
                            exit_code: None,
                            at: crate::models::now_iso(),
                        };
                        let _ = app.emit(
                            "status-note",
                            state.session_manager.make_status_note(
                                &intent.request.session_id,
                                StatusKind::Error,
                                "Ação privilegiada bloqueada",
                                &cause.to_string(),
                            ),
                        );
                        let _ = state.session_manager.update_status(
                            &intent.request.session_id,
                            SessionStatus::Error,
                            Some("Ação privilegiada bloqueada"),
                            Some(TaskStatus::Error),
                            Some(cause.to_string()),
                        );
                        emit_permission_outcome(&app, outcome);
                    }
                }
            }
        },
        (PermissionDecision::DenyOnce, Some(intent)) => {
            let note = state.session_manager.make_status_note(
                &intent.request.session_id,
                StatusKind::Warn,
                "Permissão negada",
                &format!("Ação/comando bloqueado: {}", intent.request.command),
            );
            let _ = app.emit("status-note", note);
            if let Ok(Some(session)) = state.session_manager.update_status(
                &intent.request.session_id,
                SessionStatus::Idle,
                Some("Permissão negada"),
                Some(TaskStatus::Done),
                Some("Usuário negou a ação sensível.".to_owned()),
            ) {
                let _ = app.emit("session-changed", session);
            }

            emit_permission_outcome(
                &app,
                PermissionOutcome {
                    request_id: intent.request.id,
                    session_id: intent.request.session_id,
                    status: PermissionOutcomeStatus::Denied,
                    summary: "Usuário negou a ação sensível".to_owned(),
                    stdout: None,
                    stderr: None,
                    exit_code: None,
                    at: crate::models::now_iso(),
                },
            );
        }
        _ => {}
    }

    Ok(())
}

async fn run_privileged_action(
    state: &State<'_, AppState>,
    request: &PermissionRequest,
    input: &PrivilegedActionRequestInput,
) -> Result<PermissionOutcome, AppError> {
    let prepared = privileged_actions::prepare(input)?;
    let helper_request = HelperRequest {
        request_id: request.id.clone(),
        session_id: request.session_id.clone(),
        action_id: input.action_id.clone(),
        args: prepared.args,
        dry_run: input.dry_run,
        user_home: state
            .config_manager
            .home_dir()
            .to_string_lossy()
            .to_string(),
        requested_at: crate::models::now_iso(),
    };

    state
        .privileged_helper_client
        .execute_with_pkexec(&helper_request)
        .await
}

fn emit_permission_outcome(app: &AppHandle, outcome: PermissionOutcome) {
    let _ = app.emit("permission-outcome", outcome);
}

#[tauri::command]
pub async fn open_project_in_vscode(
    state: State<'_, AppState>,
    path: String,
) -> Result<(), ErrorPayload> {
    state
        .vscode_bridge
        .open_project(&path)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn open_file_in_vscode(
    state: State<'_, AppState>,
    path: String,
    line: Option<u32>,
) -> Result<(), ErrorPayload> {
    state
        .vscode_bridge
        .open_file(&path, line)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn open_diff_in_vscode(
    state: State<'_, AppState>,
    left_path: String,
    right_path: String,
) -> Result<(), ErrorPayload> {
    state
        .vscode_bridge
        .open_diff(&left_path, &right_path)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub fn update_settings(
    state: State<AppState>,
    settings: crate::models::AppSettings,
) -> Result<crate::models::AppSettings, ErrorPayload> {
    let saved = state
        .config_manager
        .update_settings(settings)
        .map_err(map_err)?;
    state.set_settings(saved.clone());
    Ok(saved)
}

#[tauri::command]
pub fn get_base_prompt(state: State<AppState>) -> Result<String, ErrorPayload> {
    let path = state.config_manager.codex_root().join("AGENTS.md");
    let content = fs::read_to_string(path)
        .map_err(AppError::from)
        .map_err(map_err)?;
    Ok(content)
}

#[tauri::command]
pub fn update_base_prompt(state: State<AppState>, content: String) -> Result<(), ErrorPayload> {
    let path = state.config_manager.codex_root().join("AGENTS.md");
    let _ = state
        .config_manager
        .make_backup(&path, "agents-md")
        .map_err(map_err)?;
    fs::write(path, content)
        .map_err(AppError::from)
        .map_err(map_err)
}
