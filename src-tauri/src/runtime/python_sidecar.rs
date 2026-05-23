use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RuntimeState {
    pub installed: bool,
    pub status: String,
}

#[tauri::command]
pub fn detect_python_env() -> Result<RuntimeState, String> {
    let output = Command::new("python3")
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(RuntimeState {
            installed: true,
            status: "Installed".to_string(),
        })
    } else {
        Ok(RuntimeState {
            installed: false,
            status: "NotInstalled".to_string(),
        })
    }
}
