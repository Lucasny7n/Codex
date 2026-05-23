use std::process::Command;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize, Clone)]
pub struct ExecutionResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

const WHITELISTED_COMMANDS: &[&str] = &[
    "pacman", "yay", "flatpak", "systemctl", "wpctl", "journalctl", 
    "aplay", "arecord", "bluetoothctl", "rfkill", "ping", "ip", "nmcli", "resolvectl"
];

#[tauri::command]
pub fn execute_safe_command(command: String, args: Vec<String>) -> Result<ExecutionResult, String> {
    if !WHITELISTED_COMMANDS.contains(&command.as_str()) {
        return Err(format!("Bloqueado: Comando '{}' não está na whitelist de segurança.", command));
    }

    let output = Command::new(&command)
        .args(&args)
        .output()
        .map_err(|e| format!("Falha ao executar comando: {}", e))?;

    let success = output.status.success();
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    // Log básico de segurança (Poderia ir para SQLite no futuro)
    println!("[EXECUTOR] [{}] {} {:?} -> {}", if success { "OK" } else { "FAIL" }, command, args, output.status);

    Ok(ExecutionResult {
        success,
        stdout,
        stderr,
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[tauri::command]
pub fn backup_file_for_rollback(filepath: String) -> Result<String, String> {
    let backup_path = format!("{}.bak", filepath);
    fs::copy(&filepath, &backup_path).map_err(|e| format!("Falha no rollback (backup): {}", e))?;
    Ok(backup_path)
}
