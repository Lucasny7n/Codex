use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Serialize, Deserialize, Clone)]
pub struct AirLLMState {
    pub venv_exists: bool,
    pub installed: bool,
    pub status: String,
}

#[tauri::command]
pub fn detect_airllm() -> Result<AirLLMState, String> {
    let home = dirs::home_dir().ok_or("Não foi possível encontrar diretório home")?;
    let venv_path = home.join(".local/share/ailu/airllm-venv");
    
    let venv_exists = venv_path.exists() && venv_path.is_dir();
    
    if !venv_exists {
        return Ok(AirLLMState {
            venv_exists: false,
            installed: false,
            status: "VenvNotFound".to_string(),
        });
    }

    let pip_path = venv_path.join("bin/pip");
    
    if !pip_path.exists() {
        return Ok(AirLLMState {
            venv_exists: true,
            installed: false,
            status: "PipNotFound".to_string(),
        });
    }

    let output = Command::new(&pip_path)
        .arg("show")
        .arg("airllm")
        .output()
        .unwrap_or_else(|_| std::process::Output {
            status: std::os::unix::process::ExitStatusExt::from_raw(1),
            stdout: vec![],
            stderr: vec![],
        });

    if output.status.success() {
        Ok(AirLLMState {
            venv_exists: true,
            installed: true,
            status: "Ready".to_string(),
        })
    } else {
        Ok(AirLLMState {
            venv_exists: true,
            installed: false,
            status: "NotInstalled".to_string(),
        })
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RuntimeStatus {
    pub python: super::python_sidecar::PythonEnvState,
    pub airllm: AirLLMState,
}

#[tauri::command]
pub fn get_runtime_status() -> Result<RuntimeStatus, String> {
    let python = super::python_sidecar::detect_python_env()?;
    let airllm = detect_airllm()?;
    
    Ok(RuntimeStatus {
        python,
        airllm,
    })
}
