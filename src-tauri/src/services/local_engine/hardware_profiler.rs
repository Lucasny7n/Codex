//! Real hardware detection for the Local Engine.
//!
//! Linux-first, fallback-safe: a missing command never breaks the app, it just
//! yields `Unknown`/partial data plus a note. Composes the proven primitives in
//! `services::hardware` (RAM/VRAM) and adds CPU, disks, accelerators and profile
//! tags tuned for the RX 7600 + Ryzen 5 5500 + 16 GB target.

use std::time::Duration;

use tokio::process::Command;
use tokio::time::timeout;

use crate::models::local_engine::{
    AcceleratorApi, AcceleratorInfo, AcceleratorStatus, CpuInfo, DiskInfo, GpuDevice, GpuVendor,
    HardwareProfileTag, HardwareSnapshot, MemoryInfo, OsInfo,
};
use crate::models::now_iso;
use crate::services::hardware::{parse_meminfo, parse_rocm_smi_vram, RAM_HEADROOM_BYTES};

const GIB: u64 = 1024 * 1024 * 1024;

pub async fn detect() -> HardwareSnapshot {
    let mut notes = Vec::new();

    let (ram_total, ram_available, swap_total) = match std::fs::read_to_string("/proc/meminfo") {
        Ok(content) => parse_meminfo(&content),
        Err(_) => {
            notes.push("Não foi possível ler /proc/meminfo.".to_owned());
            (0, None, 0)
        }
    };
    let memory = MemoryInfo {
        total_bytes: ram_total,
        available_bytes: ram_available,
        swap_total_bytes: swap_total,
        headroom_bytes: RAM_HEADROOM_BYTES,
    };

    let cpu = match std::fs::read_to_string("/proc/cpuinfo") {
        Ok(content) => parse_cpuinfo(&content),
        Err(_) => CpuInfo {
            model: None,
            physical_cores: None,
            logical_threads: std::thread::available_parallelism().ok().map(|n| n.get()),
        },
    };

    let gpus = detect_gpus(&mut notes).await;
    let disks = detect_disks(&mut notes).await;
    let accelerators = detect_accelerators(&gpus).await;

    let os = OsInfo {
        os: std::env::consts::OS.to_owned(),
        kernel: read_trimmed("/proc/sys/kernel/osrelease"),
        distro: detect_distro(),
    };

    let mut snapshot = HardwareSnapshot {
        os,
        cpu,
        memory,
        gpus,
        disks,
        accelerators,
        profile_tags: Vec::new(),
        notes,
        detected_at: now_iso(),
    };
    snapshot.profile_tags = classify_profile_tags(&snapshot);
    snapshot
}

fn read_trimmed(path: &str) -> Option<String> {
    std::fs::read_to_string(path)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn detect_distro() -> Option<String> {
    let content = std::fs::read_to_string("/etc/os-release").ok()?;
    for line in content.lines() {
        if let Some(rest) = line.strip_prefix("PRETTY_NAME=") {
            return Some(rest.trim_matches('"').to_owned());
        }
    }
    None
}

pub fn parse_cpuinfo(content: &str) -> CpuInfo {
    let mut model = None;
    let mut logical = 0usize;
    let mut cores = None;
    for line in content.lines() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        if key == "model name" {
            if model.is_none() {
                model = Some(value.to_owned());
            }
        } else if key == "processor" {
            logical += 1;
        } else if key == "cpu cores" && cores.is_none() {
            cores = value.parse::<usize>().ok();
        }
    }
    CpuInfo {
        model,
        physical_cores: cores,
        logical_threads: if logical > 0 { Some(logical) } else { None },
    }
}

fn vendor_from_id(id: &str) -> GpuVendor {
    match id.trim().to_lowercase().as_str() {
        "0x1002" => GpuVendor::Amd,
        "0x10de" => GpuVendor::Nvidia,
        "0x8086" => GpuVendor::Intel,
        _ => GpuVendor::Other,
    }
}

async fn detect_gpus(notes: &mut Vec<String>) -> Vec<GpuDevice> {
    let mut gpus = Vec::new();
    for card in 0..8 {
        let base = format!("/sys/class/drm/card{card}/device");
        let Some(vendor_id) = read_trimmed(&format!("{base}/vendor")) else {
            continue;
        };
        let vram_total = read_trimmed(&format!("{base}/mem_info_vram_total"))
            .and_then(|value| value.parse::<u64>().ok())
            .filter(|value| *value > 0);
        let vram_used = read_trimmed(&format!("{base}/mem_info_vram_used"))
            .and_then(|value| value.parse::<u64>().ok());
        gpus.push(GpuDevice {
            vendor: vendor_from_id(&vendor_id),
            name: None,
            vram_total_bytes: vram_total,
            vram_used_bytes: vram_used,
            source: "sysfs_drm".to_owned(),
        });
    }

    if gpus.is_empty() {
        notes.push("Nenhuma GPU detectada via /sys/class/drm.".to_owned());
    }

    // Enrich AMD VRAM via rocm-smi when sysfs did not expose it.
    if gpus
        .iter()
        .any(|gpu| gpu.vendor == GpuVendor::Amd && gpu.vram_total_bytes.is_none())
    {
        if let Some(vram) = rocm_smi_vram().await {
            if let Some(gpu) = gpus
                .iter_mut()
                .find(|gpu| gpu.vendor == GpuVendor::Amd && gpu.vram_total_bytes.is_none())
            {
                gpu.vram_total_bytes = Some(vram);
                gpu.source = "rocm_smi".to_owned();
            }
        }
    }

    gpus
}

async fn rocm_smi_vram() -> Option<u64> {
    let output = run_with_timeout("rocm-smi", &["--showmeminfo", "vram", "--json"]).await?;
    parse_rocm_smi_vram(&output)
}

async fn detect_disks(notes: &mut Vec<String>) -> Vec<DiskInfo> {
    match run_with_timeout("df", &["-B1", "--output=target,size,avail"]).await {
        Some(output) => parse_df(&output),
        None => {
            notes.push("df indisponível; disco não detectado.".to_owned());
            Vec::new()
        }
    }
}

pub fn parse_df(content: &str) -> Vec<DiskInfo> {
    let mut disks = Vec::new();
    for line in content.lines().skip(1) {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 3 {
            continue;
        }
        // --output=target,size,avail => [mount, size, avail]
        let mount = fields[0];
        if !mount.starts_with('/')
            || mount.starts_with("/dev")
            || mount.starts_with("/sys")
            || mount.starts_with("/proc")
            || mount.starts_with("/run")
        {
            continue;
        }
        let (Ok(total), Ok(avail)) = (fields[1].parse::<u64>(), fields[2].parse::<u64>()) else {
            continue;
        };
        disks.push(DiskInfo {
            mount: mount.to_owned(),
            total_bytes: total,
            available_bytes: avail,
        });
    }
    disks
}

async fn detect_accelerators(gpus: &[GpuDevice]) -> Vec<AcceleratorInfo> {
    let mut accelerators = vec![AcceleratorInfo {
        api: AcceleratorApi::Cpu,
        status: AcceleratorStatus::Healthy,
        detail: "Inferência em CPU sempre disponível.".to_owned(),
    }];

    let vulkan = if run_with_timeout("vulkaninfo", &["--summary"])
        .await
        .is_some()
    {
        AcceleratorStatus::Present
    } else {
        AcceleratorStatus::Unavailable
    };
    accelerators.push(AcceleratorInfo {
        api: AcceleratorApi::Vulkan,
        status: vulkan,
        detail: "vulkaninfo --summary".to_owned(),
    });

    let rocm = if run_with_timeout("rocm-smi", &[]).await.is_some() {
        AcceleratorStatus::Healthy
    } else {
        AcceleratorStatus::Unavailable
    };
    accelerators.push(AcceleratorInfo {
        api: AcceleratorApi::Rocm,
        status: rocm,
        detail: "rocm-smi".to_owned(),
    });

    let hip = if run_with_timeout("hipconfig", &["--version"])
        .await
        .is_some()
    {
        AcceleratorStatus::Healthy
    } else {
        AcceleratorStatus::Unavailable
    };
    accelerators.push(AcceleratorInfo {
        api: AcceleratorApi::Hip,
        status: hip,
        detail: "hipconfig --version".to_owned(),
    });

    let cuda = if gpus.iter().any(|gpu| gpu.vendor == GpuVendor::Nvidia)
        && run_with_timeout("nvidia-smi", &[]).await.is_some()
    {
        AcceleratorStatus::Healthy
    } else {
        AcceleratorStatus::Unavailable
    };
    accelerators.push(AcceleratorInfo {
        api: AcceleratorApi::Cuda,
        status: cuda,
        detail: "nvidia-smi".to_owned(),
    });

    let sycl = if run_with_timeout("sycl-ls", &[]).await.is_some() {
        AcceleratorStatus::Present
    } else {
        AcceleratorStatus::Unavailable
    };
    accelerators.push(AcceleratorInfo {
        api: AcceleratorApi::Sycl,
        status: sycl,
        detail: "sycl-ls".to_owned(),
    });

    accelerators
}

async fn run_with_timeout(command: &str, args: &[&str]) -> Option<String> {
    let run = timeout(
        Duration::from_secs(4),
        Command::new(command).args(args).output(),
    )
    .await
    .ok()?
    .ok()?;
    if run.status.success() {
        Some(String::from_utf8_lossy(&run.stdout).into_owned())
    } else {
        None
    }
}

/// Conservative tagging. The RX 7600 + Ryzen 5 5500 + 16 GB box must NOT be
/// tagged as a server or high-RAM machine.
pub fn classify_profile_tags(snapshot: &HardwareSnapshot) -> Vec<HardwareProfileTag> {
    let mut tags = Vec::new();
    let ram_gib = snapshot.memory.total_bytes as f64 / GIB as f64;

    if ram_gib >= 64.0 {
        tags.push(HardwareProfileTag::HighRamPc);
        tags.push(HardwareProfileTag::Server);
    } else if ram_gib >= 32.0 {
        tags.push(HardwareProfileTag::HighRamPc);
        tags.push(HardwareProfileTag::MediumPc);
    } else if ram_gib >= 12.0 {
        tags.push(HardwareProfileTag::MediumPc);
        tags.push(HardwareProfileTag::LowRamPc);
    } else {
        tags.push(HardwareProfileTag::WeakPc);
        tags.push(HardwareProfileTag::LowRamPc);
    }

    let vendor = snapshot.gpus.first().map(|gpu| gpu.vendor);
    match vendor {
        Some(GpuVendor::Amd) => {
            tags.push(HardwareProfileTag::AmdPc);
            let vulkan = snapshot.accelerators.iter().any(|a| {
                a.api == AcceleratorApi::Vulkan
                    && matches!(
                        a.status,
                        AcceleratorStatus::Healthy | AcceleratorStatus::Present
                    )
            });
            let rocm = snapshot.accelerators.iter().any(|a| {
                matches!(a.api, AcceleratorApi::Rocm | AcceleratorApi::Hip)
                    && a.status == AcceleratorStatus::Healthy
            });
            if vulkan {
                tags.push(HardwareProfileTag::AmdVulkanPc);
            }
            if rocm {
                tags.push(HardwareProfileTag::AmdRocmPc);
            }
        }
        Some(GpuVendor::Nvidia) => tags.push(HardwareProfileTag::NvidiaPc),
        Some(GpuVendor::Intel) => tags.push(HardwareProfileTag::IntelArcPc),
        _ => {}
    }

    tags
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_cpuinfo() {
        let sample = "processor\t: 0\nmodel name\t: AMD Ryzen 5 5500\ncpu cores\t: 6\nprocessor\t: 1\nmodel name\t: AMD Ryzen 5 5500\n";
        let cpu = parse_cpuinfo(sample);
        assert_eq!(cpu.model.as_deref(), Some("AMD Ryzen 5 5500"));
        assert_eq!(cpu.physical_cores, Some(6));
        assert_eq!(cpu.logical_threads, Some(2));
    }

    #[test]
    fn parses_df_and_filters_pseudo_fs() {
        let sample = "Mounted on 1B-blocks Available\n/ 500000000000 200000000000\n/run 8000000000 7000000000\n/home 1000000000000 600000000000\n";
        let disks = parse_df(sample);
        let mounts: Vec<&str> = disks.iter().map(|d| d.mount.as_str()).collect();
        assert!(mounts.contains(&"/"));
        assert!(mounts.contains(&"/home"));
        assert!(!mounts.contains(&"/run"));
    }

    #[test]
    fn vendor_ids_mapped() {
        assert_eq!(vendor_from_id("0x1002"), GpuVendor::Amd);
        assert_eq!(vendor_from_id("0x10de"), GpuVendor::Nvidia);
        assert_eq!(vendor_from_id("0x8086"), GpuVendor::Intel);
    }

    fn snapshot_16gb_amd(vulkan: AcceleratorStatus, rocm: AcceleratorStatus) -> HardwareSnapshot {
        HardwareSnapshot {
            os: OsInfo {
                os: "linux".to_owned(),
                kernel: None,
                distro: None,
            },
            cpu: CpuInfo {
                model: Some("Ryzen 5 5500".to_owned()),
                physical_cores: Some(6),
                logical_threads: Some(12),
            },
            memory: MemoryInfo {
                total_bytes: 16 * GIB,
                available_bytes: Some(11 * GIB),
                swap_total_bytes: 8 * GIB,
                headroom_bytes: RAM_HEADROOM_BYTES,
            },
            gpus: vec![GpuDevice {
                vendor: GpuVendor::Amd,
                name: Some("RX 7600".to_owned()),
                vram_total_bytes: Some(8 * GIB),
                vram_used_bytes: None,
                source: "test".to_owned(),
            }],
            disks: vec![],
            accelerators: vec![
                AcceleratorInfo {
                    api: AcceleratorApi::Vulkan,
                    status: vulkan,
                    detail: String::new(),
                },
                AcceleratorInfo {
                    api: AcceleratorApi::Rocm,
                    status: rocm,
                    detail: String::new(),
                },
            ],
            profile_tags: vec![],
            notes: vec![],
            detected_at: "now".to_owned(),
        }
    }

    #[test]
    fn tags_16gb_amd_as_medium_lowram_amd_not_server() {
        let snap = snapshot_16gb_amd(AcceleratorStatus::Present, AcceleratorStatus::Unavailable);
        let tags = classify_profile_tags(&snap);
        assert!(tags.contains(&HardwareProfileTag::MediumPc));
        assert!(tags.contains(&HardwareProfileTag::LowRamPc));
        assert!(tags.contains(&HardwareProfileTag::AmdPc));
        assert!(tags.contains(&HardwareProfileTag::AmdVulkanPc));
        assert!(!tags.contains(&HardwareProfileTag::Server));
        assert!(!tags.contains(&HardwareProfileTag::HighRamPc));
        assert!(!tags.contains(&HardwareProfileTag::AmdRocmPc));
    }

    #[test]
    fn tags_amd_rocm_only_when_healthy() {
        let snap = snapshot_16gb_amd(AcceleratorStatus::Present, AcceleratorStatus::Healthy);
        let tags = classify_profile_tags(&snap);
        assert!(tags.contains(&HardwareProfileTag::AmdRocmPc));
    }
}
