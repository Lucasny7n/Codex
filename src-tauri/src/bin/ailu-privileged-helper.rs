use std::env;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

use chrono::Utc;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HelperRequest {
    request_id: String,
    session_id: String,
    action_id: String,
    args: Value,
    dry_run: bool,
    user_home: String,
    requested_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HelperResponse {
    success: bool,
    summary: String,
    stdout: Option<String>,
    stderr: Option<String>,
    exit_code: Option<i32>,
    rollback_hint: Option<String>,
}

const ALLOWED_SYSTEMD_SERVICES: &[&str] = &[
    "waydroid-container.service",
    "fstrim.timer",
    "NetworkManager.service",
    "NetworkManager-wait-online.service",
    "cliphist.service",
    "cliphist-text.service",
    "cliphist-image.service",
    "com.system76.Scheduler.service",
    "polkit.service",
];

fn main() {
    let result = run();
    match result {
        Ok(response) => {
            println!(
                "{}",
                serde_json::to_string(&response).unwrap_or_else(|_| {
                    "{\"success\":false,\"summary\":\"serialization error\"}".to_owned()
                })
            );
            if response.success {
                std::process::exit(0);
            }
            std::process::exit(response.exit_code.unwrap_or(1));
        }
        Err(message) => {
            let response = HelperResponse {
                success: false,
                summary: message,
                stdout: None,
                stderr: None,
                exit_code: Some(1),
                rollback_hint: None,
            };
            println!(
                "{}",
                serde_json::to_string(&response).unwrap_or_else(|_| {
                    "{\"success\":false,\"summary\":\"fatal error\"}".to_owned()
                })
            );
            std::process::exit(1);
        }
    }
}

fn run() -> Result<HelperResponse, String> {
    let request_json = parse_request_json_arg()?;
    let request: HelperRequest = serde_json::from_str(&request_json)
        .map_err(|cause| format!("request inválido: {cause}"))?;

    let now = Utc::now().to_rfc3339();
    let mut response = execute_action(&request)?;

    if response.exit_code.is_none() {
        response.exit_code = Some(if response.success { 0 } else { 1 });
    }

    if let Err(cause) = append_log(&request, &response, &now) {
        response.stderr = Some(match response.stderr {
            Some(existing) => format!("{existing}\nlog_error: {cause}"),
            None => format!("log_error: {cause}"),
        });
    }
    Ok(response)
}

fn parse_request_json_arg() -> Result<String, String> {
    let args = env::args().collect::<Vec<_>>();
    let mut i = 0usize;
    while i < args.len() {
        if args[i] == "--request-json" {
            return args
                .get(i + 1)
                .cloned()
                .ok_or_else(|| "faltou payload em --request-json".to_owned());
        }
        i += 1;
    }
    Err("uso: ailu-privileged-helper --request-json '<json>'".to_owned())
}

fn execute_action(request: &HelperRequest) -> Result<HelperResponse, String> {
    if request.action_id.contains("rm") || request.action_id.contains("delete") {
        return Err("Ação bloqueada por política: destrutiva demais".to_owned());
    }

    match request.action_id.as_str() {
        "systemctl_enable_service" => systemctl_action("enable", request),
        "systemctl_disable_service" => systemctl_action("disable", request),
        "systemctl_restart_service" => systemctl_action("restart", request),
        "systemctl_status_service" => systemctl_action("status", request),
        "bootctl_set_default_kernel" => bootctl_set_default(request),
        "chmod_random_seed" => chmod_random_seed(request),
        "backup_file" => backup_file_action(request),
        "restore_file" => restore_file_action(request),
        "pacman_install_packages" => pacman_install(request),
        "paccache_keep_versions" => paccache_keep_versions(request),
        "waydroid_start" => waydroid_service("start", request),
        "waydroid_stop" => waydroid_service("stop", request),
        "waydroid_status" => run_and_wrap(
            request,
            "waydroid",
            &["status"],
            "Status do Waydroid coletado",
        ),
        "hyprland_verify_config" => hyprland_verify_config(request),
        "hyprland_reload_user" => hyprland_reload(request),
        _ => Err(format!("Ação não permitida: {}", request.action_id)),
    }
}

fn systemctl_action(verb: &str, request: &HelperRequest) -> Result<HelperResponse, String> {
    let service = get_required_str(&request.args, "service")?;
    validate_service_name(&service)?;
    ensure_service_allowlisted(&service)?;
    run_and_wrap(
        request,
        "systemctl",
        &[verb, &service],
        &format!("systemctl {verb} {service}"),
    )
}

fn bootctl_set_default(request: &HelperRequest) -> Result<HelperResponse, String> {
    let entry = get_required_str(&request.args, "entry")?;
    let entry_regex = Regex::new(r"^[a-zA-Z0-9._-]+\.conf$").map_err(|e| e.to_string())?;
    if !entry_regex.is_match(&entry) {
        return Err("entry de boot inválida".to_owned());
    }

    let loader_conf = PathBuf::from("/boot/loader/loader.conf");
    let backup_hint = create_backup_if_exists(&loader_conf, request)?;

    if request.dry_run {
        return Ok(HelperResponse {
            success: true,
            summary: format!("dry-run: bootctl set-default {entry}"),
            stdout: None,
            stderr: None,
            exit_code: Some(0),
            rollback_hint: backup_hint,
        });
    }

    let mut response = run_command("bootctl", &["set-default", &entry])?;
    response.rollback_hint = backup_hint;
    Ok(response)
}

fn chmod_random_seed(request: &HelperRequest) -> Result<HelperResponse, String> {
    let seed_path = PathBuf::from("/boot/loader/random-seed");
    let backup_hint = create_backup_if_exists(&seed_path, request)?;

    if request.dry_run {
        return Ok(HelperResponse {
            success: true,
            summary: "dry-run: chmod 600 /boot/loader/random-seed".to_owned(),
            stdout: None,
            stderr: None,
            exit_code: Some(0),
            rollback_hint: backup_hint,
        });
    }

    let mut response = run_command("chmod", &["600", "/boot/loader/random-seed"])?;
    response.rollback_hint = backup_hint;
    Ok(response)
}

fn backup_file_action(request: &HelperRequest) -> Result<HelperResponse, String> {
    let path = get_required_str(&request.args, "path")?;
    let source = validate_safe_path(&path)?;
    if !source.exists() {
        return Err(format!("Arquivo não encontrado: {}", source.display()));
    }

    if request.dry_run {
        return Ok(HelperResponse {
            success: true,
            summary: format!("dry-run: backup {}", source.display()),
            stdout: None,
            stderr: None,
            exit_code: Some(0),
            rollback_hint: None,
        });
    }

    let backup = create_backup(source.as_path(), request)?;
    Ok(HelperResponse {
        success: true,
        summary: format!("Backup criado: {}", backup.display()),
        stdout: None,
        stderr: None,
        exit_code: Some(0),
        rollback_hint: None,
    })
}

fn restore_file_action(request: &HelperRequest) -> Result<HelperResponse, String> {
    let backup_path = get_required_str(&request.args, "backupPath")?;
    let target_path = get_required_str(&request.args, "targetPath")?;

    let backup = PathBuf::from(validate_abs_path(&backup_path)?);
    if !backup.exists() {
        return Err(format!("backupPath não existe: {}", backup.display()));
    }
    let backup_text = backup.to_string_lossy();
    if !backup_text.contains("/.codex/ailu-ai-studio/backups/")
        && !backup_text.contains("/.codex/codex-ui/backups/")
    {
        return Err(
            "restore_file exige backupPath dentro de ~/.codex/ailu-ai-studio/backups".to_owned(),
        );
    }

    let target = validate_safe_path(&target_path)?;
    let backup_hint = if target.exists() {
        create_backup_if_exists(target.as_path(), request)?
    } else {
        None
    };

    if request.dry_run {
        return Ok(HelperResponse {
            success: true,
            summary: format!(
                "dry-run: restore {} -> {}",
                backup.display(),
                target.display()
            ),
            stdout: None,
            stderr: None,
            exit_code: Some(0),
            rollback_hint: backup_hint,
        });
    }

    fs::copy(&backup, &target).map_err(|cause| format!("falha ao restaurar arquivo: {cause}"))?;
    Ok(HelperResponse {
        success: true,
        summary: format!("Arquivo restaurado em {}", target.display()),
        stdout: None,
        stderr: None,
        exit_code: Some(0),
        rollback_hint: backup_hint,
    })
}

fn pacman_install(request: &HelperRequest) -> Result<HelperResponse, String> {
    let packages = request
        .args
        .get("packages")
        .and_then(Value::as_array)
        .ok_or_else(|| "packages é obrigatório".to_owned())?
        .iter()
        .map(|item| item.as_str().unwrap_or(""))
        .map(str::trim)
        .filter(|pkg| !pkg.is_empty())
        .map(validate_package_name)
        .collect::<Result<Vec<_>, _>>()?;

    if packages.is_empty() {
        return Err("lista de pacotes vazia".to_owned());
    }

    let mut args = vec![
        "-S".to_owned(),
        "--needed".to_owned(),
        "--noconfirm".to_owned(),
    ];
    args.extend(packages);
    let refs = args.iter().map(String::as_str).collect::<Vec<_>>();

    run_and_wrap(request, "pacman", &refs, "pacman install")
}

fn paccache_keep_versions(request: &HelperRequest) -> Result<HelperResponse, String> {
    let keep = request
        .args
        .get("keep")
        .and_then(Value::as_u64)
        .ok_or_else(|| "keep é obrigatório".to_owned())?;
    if !(1..=10).contains(&keep) {
        return Err("keep deve estar entre 1 e 10".to_owned());
    }

    let keep_str = keep.to_string();
    run_and_wrap(request, "paccache", &["-rk", &keep_str], "paccache -rk")
}

fn waydroid_service(verb: &str, request: &HelperRequest) -> Result<HelperResponse, String> {
    run_and_wrap(
        request,
        "systemctl",
        &[verb, "waydroid-container.service"],
        &format!("systemctl {verb} waydroid-container.service"),
    )
}

fn hyprland_verify_config(request: &HelperRequest) -> Result<HelperResponse, String> {
    let config_path = request
        .args
        .get("configPath")
        .and_then(Value::as_str)
        .unwrap_or("/home/lucas/.config/hypr/hyprland.conf");

    let safe_config = validate_abs_path(config_path)?;
    if !safe_config.starts_with("/home/") {
        return Err("configPath deve ficar em /home".to_owned());
    }

    let user = infer_user_from_home(&request.user_home)?;
    run_and_wrap(
        request,
        "runuser",
        &[
            "-u",
            &user,
            "--",
            "Hyprland",
            "--verify-config",
            "-c",
            &safe_config,
        ],
        "hyprland verify",
    )
}

fn hyprland_reload(request: &HelperRequest) -> Result<HelperResponse, String> {
    let user = infer_user_from_home(&request.user_home)?;
    run_and_wrap(
        request,
        "runuser",
        &["-u", &user, "--", "hyprctl", "reload"],
        "hyprctl reload",
    )
}

fn run_and_wrap(
    request: &HelperRequest,
    program: &str,
    args: &[&str],
    label: &str,
) -> Result<HelperResponse, String> {
    if request.dry_run {
        return Ok(HelperResponse {
            success: true,
            summary: format!("dry-run: {program} {}", args.join(" ")),
            stdout: None,
            stderr: None,
            exit_code: Some(0),
            rollback_hint: None,
        });
    }

    let response = run_command(program, args)?;
    Ok(HelperResponse {
        summary: format!("{label}: {}", response.summary),
        ..response
    })
}

fn run_command(program: &str, args: &[&str]) -> Result<HelperResponse, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|cause| format!("falha ao executar {program}: {cause}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();

    Ok(HelperResponse {
        success: output.status.success(),
        summary: if output.status.success() {
            "comando executado".to_owned()
        } else {
            "comando falhou".to_owned()
        },
        stdout: if stdout.is_empty() {
            None
        } else {
            Some(stdout)
        },
        stderr: if stderr.is_empty() {
            None
        } else {
            Some(stderr)
        },
        exit_code: output.status.code(),
        rollback_hint: None,
    })
}

fn validate_service_name(service: &str) -> Result<(), String> {
    let service_regex =
        Regex::new(r"^[a-zA-Z0-9@._-]+\.(service|timer)$").map_err(|e| e.to_string())?;
    if service_regex.is_match(service) {
        Ok(())
    } else {
        Err("nome de serviço inválido".to_owned())
    }
}

fn ensure_service_allowlisted(service: &str) -> Result<(), String> {
    if ALLOWED_SYSTEMD_SERVICES.contains(&service) {
        Ok(())
    } else {
        Err(format!("serviço fora da allowlist de segurança: {service}"))
    }
}

fn validate_package_name(pkg: &str) -> Result<String, String> {
    let package_regex = Regex::new(r"^[a-z0-9@+._-]+$").map_err(|e| e.to_string())?;
    if package_regex.is_match(pkg) {
        Ok(pkg.to_owned())
    } else {
        Err(format!("pacote inválido: {pkg}"))
    }
}

fn get_required_str(args: &Value, key: &str) -> Result<String, String> {
    args.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .map(ToOwned::to_owned)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| format!("argumento obrigatório ausente: {key}"))
}

fn validate_abs_path(path: &str) -> Result<String, String> {
    if !path.starts_with('/') {
        return Err("caminho deve ser absoluto".to_owned());
    }
    if path.contains('\0') || path.contains("..") {
        return Err("caminho contém padrão proibido".to_owned());
    }
    Ok(path.to_owned())
}

fn validate_safe_path(path: &str) -> Result<PathBuf, String> {
    let raw = validate_abs_path(path)?;
    let allowed = ["/boot/", "/etc/", "/home/"];
    if !allowed.iter().any(|prefix| raw.starts_with(prefix)) {
        return Err(format!("caminho fora da allowlist: {raw}"));
    }
    Ok(PathBuf::from(raw))
}

fn infer_user_from_home(home: &str) -> Result<String, String> {
    let path = Path::new(home);
    if !path.starts_with("/home/") {
        return Err("user_home inválido para ação de usuário".to_owned());
    }
    path.file_name()
        .and_then(|value| value.to_str())
        .map(ToOwned::to_owned)
        .ok_or_else(|| "não foi possível inferir usuário".to_owned())
}

fn create_backup_if_exists(
    source: &Path,
    request: &HelperRequest,
) -> Result<Option<String>, String> {
    if source.exists() {
        let backup = create_backup(source, request)?;
        Ok(Some(format!("Backup gerado em {}", backup.display())))
    } else {
        Ok(None)
    }
}

fn create_backup(source: &Path, request: &HelperRequest) -> Result<PathBuf, String> {
    let backups_dir = PathBuf::from(&request.user_home)
        .join(".codex")
        .join("ailu-ai-studio")
        .join("backups");
    fs::create_dir_all(&backups_dir)
        .map_err(|cause| format!("falha ao criar diretório de backup: {cause}"))?;

    let ts = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let file_label = source.to_string_lossy().replace('/', "_").replace(' ', "_");
    let backup = backups_dir.join(format!(
        "privileged-helper-{}-{}-{}.bak",
        request.action_id, ts, file_label
    ));

    fs::copy(source, &backup)
        .map_err(|cause| format!("falha ao copiar backup {}: {cause}", source.display()))?;
    Ok(backup)
}

fn append_log(
    request: &HelperRequest,
    response: &HelperResponse,
    finished_at: &str,
) -> Result<(), String> {
    let line = json!({
        "requestId": request.request_id,
        "sessionId": request.session_id,
        "actionId": request.action_id,
        "userHome": request.user_home,
        "dryRun": request.dry_run,
        "requestedAt": request.requested_at,
        "finishedAt": finished_at,
        "success": response.success,
        "summary": response.summary,
        "exitCode": response.exit_code,
    });

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open("/var/log/ailu-privileged-helper.log")
        .or_else(|_| {
            OpenOptions::new()
                .create(true)
                .append(true)
                .open("/tmp/ailu-privileged-helper.log")
        })
        .map_err(|cause| format!("falha ao abrir log do helper: {cause}"))?;
    file.write_all(line.to_string().as_bytes())
        .and_then(|_| file.write_all(b"\n"))
        .map_err(|cause| format!("falha ao escrever log: {cause}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_request(action_id: &str, args: Value) -> HelperRequest {
        HelperRequest {
            request_id: "r1".to_owned(),
            session_id: "s1".to_owned(),
            action_id: action_id.to_owned(),
            args,
            dry_run: true,
            user_home: "/home/lucas".to_owned(),
            requested_at: Utc::now().to_rfc3339(),
        }
    }

    #[test]
    fn rejects_unknown_action() {
        let request = base_request("unknown", json!({}));
        assert!(execute_action(&request).is_err());
    }

    #[test]
    fn rejects_injection_service_name() {
        let request = base_request(
            "systemctl_enable_service",
            json!({ "service": "sshd.service;rm -rf /" }),
        );
        assert!(execute_action(&request).is_err());
    }

    #[test]
    fn rejects_service_outside_allowlist() {
        let request = base_request(
            "systemctl_disable_service",
            json!({ "service": "sshd.service" }),
        );
        assert!(execute_action(&request).is_err());
    }

    #[test]
    fn dry_run_waydroid_status_works() {
        let request = base_request("waydroid_status", json!({}));
        let response = execute_action(&request).expect("dry-run ok");
        assert!(response.success);
        assert!(response.summary.contains("dry-run"));
    }

    #[test]
    fn dry_run_accepts_timer_unit() {
        let request = base_request(
            "systemctl_enable_service",
            json!({ "service": "fstrim.timer" }),
        );
        let response = execute_action(&request).expect("timer em allowlist");
        assert!(response.success);
        assert!(response.summary.contains("dry-run"));
    }
}
