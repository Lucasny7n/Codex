use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct PythonEnvState {
    pub installed: bool,
    pub version: Option<String>,
    pub status: String,
}

#[tauri::command]
pub fn detect_python_env() -> Result<PythonEnvState, String> {
    let output = Command::new("python3")
        .arg("--version")
        .output()
        .map_err(|e| format!("Erro ao executar python3: {}", e))?;

    if output.status.success() {
        let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        
        // Verifica se é Python 3.10+
        let is_valid = version_str.contains("Python 3.10") 
                    || version_str.contains("Python 3.11") 
                    || version_str.contains("Python 3.12");

        if is_valid {
            Ok(PythonEnvState {
                installed: true,
                version: Some(version_str),
                status: "Ready".to_string(),
            })
        } else {
            Ok(PythonEnvState {
                installed: true,
                version: Some(version_str),
                status: "VersionNotSupported".to_string(), // Need 3.10+
            })
        }
    } else {
        Ok(PythonEnvState {
            installed: false,
            version: None,
            status: "NotInstalled".to_string(),
        })
    }
}
