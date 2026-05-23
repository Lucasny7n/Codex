use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct PackageInfo {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
}

#[tauri::command]
pub fn check_package(name: String) -> Result<PackageInfo, String> {
    let output = Command::new("pacman")
        .args(&["-Qi", &name])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let _stdout = String::from_utf8_lossy(&output.stdout);
        // Simplification: parse version
        Ok(PackageInfo {
            name,
            installed: true,
            version: Some("...".to_string()), // placeholder
        })
    } else {
        Ok(PackageInfo {
            name,
            installed: false,
            version: None,
        })
    }
}
