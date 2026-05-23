use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ExecutionResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[tauri::command]
pub fn execute_safe_command(command: String, args: Vec<String>) -> Result<ExecutionResult, String> {
    // Basic protection against shell injections: using strict Command instead of sh -c
    // Note: A full skill whitelist check will wrap this in production.
    let output = Command::new(&command)
        .args(&args)
        .output()
        .map_err(|e| format!("Falha ao executar comando: {}", e))?;

    Ok(ExecutionResult {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
