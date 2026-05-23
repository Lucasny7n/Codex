use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Serialize, Deserialize, Clone)]
pub struct HardwareProfile {
    pub cpu_name: String,
    pub total_ram_gb: f64,
    pub free_ram_gb: f64,
    pub swap_total_gb: f64,
    pub zram_detected: bool, // Simplificação
    pub os_name: String,
    pub kernel_version: String,
    pub wayland_detected: bool,
}

#[tauri::command]
pub fn get_system_hardware() -> Result<HardwareProfile, String> {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    let total_ram_gb = sys.total_memory() as f64 / 1_073_741_824.0;
    let free_ram_gb = sys.free_memory() as f64 / 1_073_741_824.0;
    let swap_total_gb = sys.total_swap() as f64 / 1_073_741_824.0;

    // Detectar CPU Name
    let cpus = sys.cpus();
    let cpu_name = if !cpus.is_empty() {
        cpus[0].brand().to_string()
    } else {
        "Unknown CPU".to_string()
    };

    let os_name = System::name().unwrap_or_else(|| "Unknown OS".to_string());
    let kernel_version = System::kernel_version().unwrap_or_else(|| "Unknown Kernel".to_string());

    // Detect Wayland via env
    let wayland_detected = std::env::var("WAYLAND_DISPLAY").is_ok();
    
    // Check if any swap device contains 'zram' (simplificado para MVP)
    let zram_detected = swap_total_gb > 0.0 && std::path::Path::new("/dev/zram0").exists();

    Ok(HardwareProfile {
        cpu_name,
        total_ram_gb,
        free_ram_gb,
        swap_total_gb,
        zram_detected,
        os_name,
        kernel_version,
        wayland_detected,
    })
}
