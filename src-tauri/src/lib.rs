mod commands;
mod error;
mod models;
mod services;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new().expect("falha ao inicializar estado da aplicação");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
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
            commands::detect_hardware,
            commands::list_quant_presets,
            commands::estimate_model_fits,
            commands::detect_local_hardware,
            commands::list_runtime_backends,
            commands::estimate_model_runtime,
            commands::recommend_model_runtime,
            commands::list_runtime_presets,
            commands::save_runtime_preset,
            commands::delete_runtime_preset,
            commands::test_model_runtime,
            commands::benchmark_model_runtime,
            commands::list_skills,
            commands::plan_skill,
            commands::mark_skill_trusted,
            commands::test_skill_in_vm,
            commands::list_user_skills,
            commands::save_user_skill,
            commands::delete_user_skill,
            commands::dry_run_user_skill,
            commands::list_memory_entries,
            commands::save_memory_entry,
            commands::delete_memory_entry,
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
            commands::list_running_processes,
            commands::get_tts_status,
            commands::speak_text,
            commands::stop_speech,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar aplicativo");
}
