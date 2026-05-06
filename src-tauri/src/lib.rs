mod commands;
mod error;
mod models;
mod services;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new().expect("falha ao inicializar estado da aplicação");

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap_state,
            commands::list_sessions,
            commands::list_pending_permissions,
            commands::create_session,
            commands::append_user_message,
            commands::send_order_to_agent,
            commands::request_execution,
            commands::request_privileged_action,
            commands::test_provider_connection,
            commands::list_provider_credentials,
            commands::save_provider_credential,
            commands::remove_provider_credential,
            commands::get_app_health_check,
            commands::get_local_runtime_state,
            commands::start_local_runtime,
            commands::install_local_runtime,
            commands::install_local_model,
            commands::remove_local_model,
            commands::decide_permission,
            commands::list_privileged_actions,
            commands::open_project_in_vscode,
            commands::open_file_in_vscode,
            commands::open_diff_in_vscode,
            commands::update_settings,
            commands::get_base_prompt,
            commands::update_base_prompt,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar aplicativo");
}
