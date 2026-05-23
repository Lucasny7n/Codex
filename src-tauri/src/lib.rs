mod commands;
mod error;
mod models;
mod services;
mod state;
mod runtime;
mod executor;
mod plugins;
mod diagnostics;
pub mod memory;
pub mod voice;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new().expect("falha ao inicializar estado da aplicação");
    let db_conn = memory::init_db().expect("falha ao inicializar banco SQLite");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .manage(memory::DbState { conn: std::sync::Mutex::new(db_conn) })
        .setup(|app| {
            if let (Some(window), Some(icon)) = (
                app.get_webview_window("main"),
                app.default_window_icon().cloned(),
            ) {
                let _ = window.set_icon(icon);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap_state,
            commands::list_sessions,
            commands::list_pending_permissions,
            commands::create_session,
            commands::rename_session,
            commands::delete_session,
            commands::archive_session,
            commands::restore_session,
            commands::list_archived_sessions,
            commands::archive_all_sessions,
            commands::delete_all_sessions,
            commands::duplicate_session,
            commands::export_session,
            commands::export_all_conversations,
            commands::import_conversations,
            commands::update_session_environment,
            commands::apply_environment_to_all_sessions,
            commands::append_user_message,
            commands::send_order_to_agent,
            commands::send_temporary_order_to_agent,
            commands::compare_models,
            commands::list_file_directory,
            commands::get_file_attachment,
            commands::get_stt_config_state,
            commands::transcribe_audio,
            commands::record_and_transcribe_short_test,
            commands::request_execution,
            commands::request_privileged_action,
            commands::test_provider_connection,
            commands::list_provider_credentials,
            commands::list_provider_profiles,
            commands::save_provider_credential,
            commands::save_provider_profile_credential,
            commands::save_credential,
            commands::remove_provider_credential,
            commands::remove_provider_profile,
            commands::set_default_provider_profile,
            commands::rename_provider_profile,
            commands::get_app_health_check,
            commands::get_local_runtime_state,
            commands::start_local_runtime,
            commands::install_local_runtime,
            commands::install_local_model,
            commands::remove_local_model,
            commands::show_local_model,
            commands::search_ollama_library,
            commands::test_local_model,
            commands::decide_permission,
            commands::list_privileged_actions,
            commands::open_project_in_vscode,
            commands::open_file_in_vscode,
            commands::open_diff_in_vscode,
            commands::update_settings,
            commands::get_base_prompt,
            commands::update_base_prompt,
            runtime::python_sidecar::detect_python_env,
            runtime::airllm::detect_airllm,
            runtime::airllm::get_runtime_status,
            executor::execute_safe_command,
            executor::backup_file_for_rollback,
            plugins::pacman::check_package,
            diagnostics::hardware::get_system_hardware,
            memory::create_memory,
            memory::list_memories,
            memory::delete_memory,
            memory::search_memories,
            voice::detect_voice_backends,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar aplicativo");
}
