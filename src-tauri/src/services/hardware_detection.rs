use crate::models::HardwareSnapshot;
use std::fs;
use std::path::Path;

pub fn detect(model_store_path: &str) -> HardwareSnapshot {
    let (total_ram_bytes, available_ram_bytes, total_swap_bytes, free_swap_bytes) = meminfo();
    let (gpu_name, gpu_vendor, amd_vram_total_bytes, amd_vram_used_bytes) = gpu_info();
    let disk_free_bytes = disk_free_bytes(model_store_path);
    let filesystem = filesystem_type(model_store_path);
    let btrfs_detected = filesystem.as_deref() == Some("btrfs");
    let avx2_supported = avx2_supported();

    let mut warnings = vec!["Heavy models may use swap and become extremely slow.".to_owned()];
    if btrfs_detected {
        warnings.push("btrfs swap may be slower if not configured with nodatacow.".to_owned());
    }
    if gpu_vendor
        .as_deref()
        .unwrap_or("")
        .to_lowercase()
        .contains("amd")
    {
        warnings.push(
            "ROCm support for this AMD GPU may be unstable; Vulkan is recommended.".to_owned(),
        );
    }

    HardwareSnapshot {
        total_ram_bytes,
        available_ram_bytes,
        total_swap_bytes,
        free_swap_bytes,
        gpu_name,
        gpu_vendor,
        amd_vram_total_bytes,
        amd_vram_used_bytes,
        disk_free_bytes,
        model_store_path: model_store_path.to_owned(),
        filesystem,
        btrfs_detected,
        avx2_supported,
        warnings,
    }
}

fn meminfo() -> (u64, u64, u64, u64) {
    let mut total = 0;
    let mut avail = 0;
    let mut swap_total = 0;
    let mut swap_free = 0;
    if let Ok(text) = fs::read_to_string("/proc/meminfo") {
        for line in text.lines() {
            if let Some(v) = line.strip_prefix("MemTotal:") {
                total = parse_kib(v);
            }
            if let Some(v) = line.strip_prefix("MemAvailable:") {
                avail = parse_kib(v);
            }
            if let Some(v) = line.strip_prefix("SwapTotal:") {
                swap_total = parse_kib(v);
            }
            if let Some(v) = line.strip_prefix("SwapFree:") {
                swap_free = parse_kib(v);
            }
        }
    }
    (total, avail, swap_total, swap_free)
}

fn parse_kib(raw: &str) -> u64 {
    raw.split_whitespace()
        .next()
        .and_then(|x| x.parse::<u64>().ok())
        .unwrap_or(0)
        * 1024
}

fn gpu_info() -> (Option<String>, Option<String>, Option<u64>, Option<u64>) {
    let base = Path::new("/sys/class/drm");
    if let Ok(entries) = fs::read_dir(base) {
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if !name.starts_with("card") || name.contains('-') {
                continue;
            }
            let device = path.join("device");
            let vendor_id = fs::read_to_string(device.join("vendor"))
                .ok()
                .map(|s| s.trim().to_owned());
            let vendor = vendor_id.as_deref().map(|v| {
                if v == "0x1002" {
                    "AMD".to_owned()
                } else if v == "0x10de" {
                    "NVIDIA".to_owned()
                } else if v == "0x8086" {
                    "Intel".to_owned()
                } else {
                    v.to_owned()
                }
            });
            let gpu_name = fs::read_to_string(device.join("product_name"))
                .ok()
                .map(|s| s.trim().to_owned());
            let total = fs::read_to_string(device.join("mem_info_vram_total"))
                .ok()
                .and_then(|v| v.trim().parse::<u64>().ok());
            let used = fs::read_to_string(device.join("mem_info_vram_used"))
                .ok()
                .and_then(|v| v.trim().parse::<u64>().ok());
            return (gpu_name, vendor, total, used);
        }
    }
    (None, None, None, None)
}

fn disk_free_bytes(path: &str) -> u64 {
    use std::process::Command;
    let output = Command::new("df").args(["-B1", path]).output();
    if let Ok(out) = output {
        if out.status.success() {
            let txt = String::from_utf8_lossy(&out.stdout);
            if let Some(line) = txt.lines().nth(1) {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    return parts[3].parse::<u64>().unwrap_or(0);
                }
            }
        }
    }
    0
}

fn filesystem_type(path: &str) -> Option<String> {
    use std::process::Command;
    let output = Command::new("stat")
        .args(["-f", "-c", "%T", path])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn avx2_supported() -> bool {
    if let Ok(cpuinfo) = fs::read_to_string("/proc/cpuinfo") {
        return cpuinfo
            .lines()
            .any(|l| l.starts_with("flags") && l.contains(" avx2"));
    }
    false
}
