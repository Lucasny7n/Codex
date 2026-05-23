use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct AirLLMState {
    pub installed: bool,
    pub status: String,
}

#[tauri::command]
pub fn detect_airllm() -> Result<AirLLMState, String> {
    // Placeholder for actual detection logic inside the python venv
    Ok(AirLLMState {
        installed: false,
        status: "NotInstalled".to_string(),
    })
}
