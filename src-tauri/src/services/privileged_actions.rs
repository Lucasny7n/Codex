use regex::Regex;
use serde_json::{json, Value};

use crate::error::{AppError, AppResult};
use crate::models::{
    PermissionCategory, PermissionRequest, PermissionRequestStatus, PrivilegedActionRequestInput,
    PrivilegedActionSpec, RiskLevel,
};

#[derive(Debug, Clone)]
pub struct PreparedPrivilegedAction {
    pub spec: PrivilegedActionSpec,
    pub command_preview: String,
    pub target: String,
    pub rollback: Option<String>,
    pub args: Value,
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

pub fn catalog() -> Vec<PrivilegedActionSpec> {
    vec![
        action(
            "systemctl_enable_service",
            "Ativar serviço",
            "Ativa serviço systemd do sistema.",
            PermissionCategory::Privileged,
            RiskLevel::High,
            "<unit>.service|timer",
            None,
            true,
        ),
        action(
            "systemctl_disable_service",
            "Desativar serviço",
            "Desativa serviço systemd do sistema.",
            PermissionCategory::Privileged,
            RiskLevel::High,
            "<unit>.service|timer",
            Some("systemctl enable <unit>.service|timer"),
            true,
        ),
        action(
            "systemctl_restart_service",
            "Reiniciar serviço",
            "Reinicia serviço systemd do sistema.",
            PermissionCategory::Privileged,
            RiskLevel::Medium,
            "<unit>.service|timer",
            None,
            false,
        ),
        action(
            "systemctl_status_service",
            "Status do serviço",
            "Consulta status detalhado de um serviço systemd.",
            PermissionCategory::Privileged,
            RiskLevel::Low,
            "<unit>.service|timer",
            None,
            false,
        ),
        action(
            "bootctl_set_default_kernel",
            "Definir kernel padrão",
            "Define a entry padrão do bootloader via bootctl.",
            PermissionCategory::CriticalSystem,
            RiskLevel::Critical,
            "/boot/loader/entries/<entry>.conf",
            Some("Restaurar backup de /boot/loader/loader.conf"),
            true,
        ),
        action(
            "chmod_random_seed",
            "Corrigir permissão random-seed",
            "Ajusta permissão de /boot/loader/random-seed.",
            PermissionCategory::CriticalSystem,
            RiskLevel::High,
            "/boot/loader/random-seed",
            Some("Restaurar modo anterior a partir do backup"),
            true,
        ),
        action(
            "backup_file",
            "Backup de arquivo",
            "Cria backup versionado de arquivo crítico.",
            PermissionCategory::CriticalSystem,
            RiskLevel::Medium,
            "arquivo absoluto",
            None,
            false,
        ),
        action(
            "restore_file",
            "Restaurar arquivo",
            "Restaura arquivo a partir de backup aprovado.",
            PermissionCategory::CriticalSystem,
            RiskLevel::Critical,
            "targetPath absoluto",
            Some("Ação faz backup do destino antes da restauração"),
            true,
        ),
        action(
            "pacman_install_packages",
            "Instalar pacotes",
            "Instala pacotes via pacman com allowlist de nomes.",
            PermissionCategory::PackageInstall,
            RiskLevel::Critical,
            "lista de pacotes",
            Some("Pacman -R manual se necessário"),
            true,
        ),
        action(
            "paccache_keep_versions",
            "Limpar cache pacman",
            "Mantém N versões de pacotes no cache.",
            PermissionCategory::CriticalSystem,
            RiskLevel::High,
            "keep=<n>",
            Some("Não reversível automaticamente"),
            true,
        ),
        action(
            "waydroid_start",
            "Iniciar Waydroid",
            "Inicia o container do Waydroid.",
            PermissionCategory::Privileged,
            RiskLevel::Medium,
            "waydroid-container.service",
            Some("waydroid_stop"),
            false,
        ),
        action(
            "waydroid_stop",
            "Parar Waydroid",
            "Para o container do Waydroid.",
            PermissionCategory::Privileged,
            RiskLevel::Medium,
            "waydroid-container.service",
            Some("waydroid_start"),
            false,
        ),
        action(
            "waydroid_status",
            "Status Waydroid",
            "Consulta status do Waydroid.",
            PermissionCategory::Privileged,
            RiskLevel::Low,
            "waydroid status",
            None,
            false,
        ),
        action(
            "hyprland_verify_config",
            "Verificar config Hyprland",
            "Executa validação de configuração do Hyprland como usuário.",
            PermissionCategory::Privileged,
            RiskLevel::Low,
            "~/.config/hypr/hyprland.conf",
            None,
            false,
        ),
        action(
            "hyprland_reload_user",
            "Recarregar Hyprland",
            "Executa hyprctl reload como usuário.",
            PermissionCategory::Privileged,
            RiskLevel::Medium,
            "sessão Hyprland do usuário",
            None,
            false,
        ),
    ]
}

fn action(
    id: &str,
    title: &str,
    description: &str,
    category: PermissionCategory,
    risk_level: RiskLevel,
    target_hint: &str,
    rollback_hint: Option<&str>,
    requires_high_confirmation: bool,
) -> PrivilegedActionSpec {
    PrivilegedActionSpec {
        id: id.to_owned(),
        title: title.to_owned(),
        description: description.to_owned(),
        category,
        risk_level,
        target_hint: target_hint.to_owned(),
        rollback_hint: rollback_hint.map(ToOwned::to_owned),
        requires_high_confirmation,
    }
}

pub fn prepare(input: &PrivilegedActionRequestInput) -> AppResult<PreparedPrivilegedAction> {
    let spec = catalog()
        .into_iter()
        .find(|item| item.id == input.action_id)
        .ok_or_else(|| {
            AppError::Message(format!(
                "Ação privilegiada desconhecida: {}",
                input.action_id
            ))
        })?;

    let prepared = match spec.id.as_str() {
        "systemctl_enable_service"
        | "systemctl_disable_service"
        | "systemctl_restart_service"
        | "systemctl_status_service" => prepare_systemctl_action(spec, &input.args)?,
        "bootctl_set_default_kernel" => prepare_bootctl_action(spec, &input.args)?,
        "chmod_random_seed" => PreparedPrivilegedAction {
            spec,
            command_preview: "chmod 600 /boot/loader/random-seed".to_owned(),
            target: "/boot/loader/random-seed".to_owned(),
            rollback: Some("Restaurar modo anterior a partir do backup automático".to_owned()),
            args: json!({}),
        },
        "backup_file" => prepare_backup_file_action(spec, &input.args)?,
        "restore_file" => prepare_restore_file_action(spec, &input.args)?,
        "pacman_install_packages" => prepare_pacman_install(spec, &input.args)?,
        "paccache_keep_versions" => prepare_paccache(spec, &input.args)?,
        "waydroid_start" | "waydroid_stop" | "waydroid_status" => prepare_waydroid_action(spec)?,
        "hyprland_verify_config" => prepare_hyprland_verify(spec, &input.args)?,
        "hyprland_reload_user" => PreparedPrivilegedAction {
            spec,
            command_preview: "runuser -u <user> -- hyprctl reload".to_owned(),
            target: "sessão Hyprland do usuário".to_owned(),
            rollback: None,
            args: json!({}),
        },
        _ => {
            return Err(AppError::Message(
                "Ação privilegiada ainda não implementada no preparador".to_owned(),
            ));
        }
    };

    Ok(prepared)
}

pub fn build_permission_request(
    request_id: String,
    input: &PrivilegedActionRequestInput,
    cwd: String,
    prepared: &PreparedPrivilegedAction,
) -> PermissionRequest {
    PermissionRequest {
        id: request_id,
        title: prepared.spec.title.clone(),
        description: prepared.spec.description.clone(),
        session_id: input.session_id.clone(),
        command: prepared.command_preview.clone(),
        action_id: Some(input.action_id.clone()),
        dry_run: input.dry_run,
        cwd,
        category: prepared.spec.category.clone(),
        risk: risk_label(&prepared.spec.risk_level).to_owned(),
        risk_level: prepared.spec.risk_level.clone(),
        requires_high_confirmation: prepared.spec.requires_high_confirmation,
        target: prepared.target.clone(),
        rollback: prepared
            .rollback
            .clone()
            .or(prepared.spec.rollback_hint.clone()),
        reason: input.reason.clone(),
        requested_at: crate::models::now_iso(),
        status: PermissionRequestStatus::Pending,
    }
}

fn risk_label(level: &RiskLevel) -> &'static str {
    match level {
        RiskLevel::Low => "baixo",
        RiskLevel::Medium => "médio",
        RiskLevel::High => "alto",
        RiskLevel::Critical => "crítico",
    }
}

fn sanitize_simple_token(raw: &str, field: &str, regex: &Regex) -> AppResult<String> {
    if !regex.is_match(raw) {
        return Err(AppError::Message(format!(
            "Campo {field} inválido para ação privilegiada"
        )));
    }
    Ok(raw.to_owned())
}

fn get_str(args: &Value, key: &str) -> AppResult<String> {
    args.get(key)
        .and_then(Value::as_str)
        .map(|v| v.trim().to_owned())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| AppError::Message(format!("Argumento obrigatório ausente: {key}")))
}

fn validate_abs_path(path: &str, field: &str) -> AppResult<String> {
    if !path.starts_with('/') {
        return Err(AppError::Message(format!(
            "{field} deve ser caminho absoluto"
        )));
    }
    if path.contains('\0') || path.contains("..") {
        return Err(AppError::Message(format!("{field} contém padrão proibido")));
    }
    Ok(path.to_owned())
}

fn ensure_safe_system_path(path: &str, field: &str) -> AppResult<String> {
    let value = validate_abs_path(path, field)?;
    let allowed_prefixes = ["/boot/", "/etc/", "/home/"];
    if !allowed_prefixes
        .iter()
        .any(|prefix| value.starts_with(prefix))
    {
        return Err(AppError::Message(format!(
            "{field} fora das áreas permitidas: {}",
            value
        )));
    }
    Ok(value)
}

fn prepare_systemctl_action(
    spec: PrivilegedActionSpec,
    args: &Value,
) -> AppResult<PreparedPrivilegedAction> {
    let service_regex = Regex::new(r"^[a-zA-Z0-9@._-]+\.(service|timer)$").expect("regex");
    let service = sanitize_simple_token(&get_str(args, "service")?, "service", &service_regex)?;
    ensure_service_allowlisted(&service)?;
    let verb = match spec.id.as_str() {
        "systemctl_enable_service" => "enable",
        "systemctl_disable_service" => "disable",
        "systemctl_restart_service" => "restart",
        "systemctl_status_service" => "status",
        _ => unreachable!(),
    };

    Ok(PreparedPrivilegedAction {
        spec,
        command_preview: format!("systemctl {verb} {service}"),
        target: service.clone(),
        rollback: None,
        args: json!({ "service": service }),
    })
}

fn ensure_service_allowlisted(service: &str) -> AppResult<()> {
    if ALLOWED_SYSTEMD_SERVICES.contains(&service) {
        Ok(())
    } else {
        Err(AppError::Message(format!(
            "Serviço fora da allowlist de segurança: {service}"
        )))
    }
}

fn prepare_bootctl_action(
    spec: PrivilegedActionSpec,
    args: &Value,
) -> AppResult<PreparedPrivilegedAction> {
    let entry_regex = Regex::new(r"^[a-zA-Z0-9._-]+\.conf$").expect("regex");
    let entry = sanitize_simple_token(&get_str(args, "entry")?, "entry", &entry_regex)?;

    Ok(PreparedPrivilegedAction {
        spec,
        command_preview: format!("bootctl set-default {entry}"),
        target: format!("/boot/loader/entries/{entry}"),
        rollback: Some("Restaurar /boot/loader/loader.conf do backup automático".to_owned()),
        args: json!({ "entry": entry }),
    })
}

fn prepare_backup_file_action(
    spec: PrivilegedActionSpec,
    args: &Value,
) -> AppResult<PreparedPrivilegedAction> {
    let path = ensure_safe_system_path(&get_str(args, "path")?, "path")?;
    Ok(PreparedPrivilegedAction {
        spec,
        command_preview: format!("backup_file {path}"),
        target: path.clone(),
        rollback: None,
        args: json!({ "path": path }),
    })
}

fn prepare_restore_file_action(
    spec: PrivilegedActionSpec,
    args: &Value,
) -> AppResult<PreparedPrivilegedAction> {
    let backup_path = validate_abs_path(&get_str(args, "backupPath")?, "backupPath")?;
    if !backup_path.contains("/.codex/codex-ui/backups/") {
        return Err(AppError::Message(
            "restore_file exige backupPath dentro de ~/.codex/codex-ui/backups".to_owned(),
        ));
    }
    let target_path = ensure_safe_system_path(&get_str(args, "targetPath")?, "targetPath")?;
    Ok(PreparedPrivilegedAction {
        spec,
        command_preview: format!("restore_file {backup_path} -> {target_path}"),
        target: target_path.clone(),
        rollback: Some("Destino será salvo em backup antes da restauração".to_owned()),
        args: json!({ "backupPath": backup_path, "targetPath": target_path }),
    })
}

fn prepare_pacman_install(
    spec: PrivilegedActionSpec,
    args: &Value,
) -> AppResult<PreparedPrivilegedAction> {
    let package_regex = Regex::new(r"^[a-z0-9@+._-]+$").expect("regex");
    let packages = args
        .get("packages")
        .and_then(Value::as_array)
        .ok_or_else(|| AppError::Message("Argumento packages é obrigatório".to_owned()))?
        .iter()
        .filter_map(Value::as_str)
        .map(str::trim)
        .map(|pkg| sanitize_simple_token(pkg, "packages", &package_regex))
        .collect::<AppResult<Vec<_>>>()?;

    if packages.is_empty() {
        return Err(AppError::Message(
            "É necessário informar ao menos 1 pacote para instalação".to_owned(),
        ));
    }
    if packages.len() > 30 {
        return Err(AppError::Message(
            "Limite de 30 pacotes por ação privilegiada".to_owned(),
        ));
    }

    Ok(PreparedPrivilegedAction {
        spec,
        command_preview: format!("pacman -S --needed --noconfirm {}", packages.join(" ")),
        target: "pacotes do sistema".to_owned(),
        rollback: Some("Remoção manual dos pacotes pode ser necessária".to_owned()),
        args: json!({ "packages": packages }),
    })
}

fn prepare_paccache(
    spec: PrivilegedActionSpec,
    args: &Value,
) -> AppResult<PreparedPrivilegedAction> {
    let keep = args
        .get("keep")
        .and_then(Value::as_u64)
        .ok_or_else(|| AppError::Message("Argumento keep é obrigatório".to_owned()))?;
    if !(1..=10).contains(&keep) {
        return Err(AppError::Message("keep deve estar entre 1 e 10".to_owned()));
    }

    Ok(PreparedPrivilegedAction {
        spec,
        command_preview: format!("paccache -rk {keep}"),
        target: "/var/cache/pacman/pkg".to_owned(),
        rollback: Some("Ação sem rollback automático".to_owned()),
        args: json!({ "keep": keep }),
    })
}

fn prepare_waydroid_action(spec: PrivilegedActionSpec) -> AppResult<PreparedPrivilegedAction> {
    let cmd = match spec.id.as_str() {
        "waydroid_start" => "systemctl start waydroid-container.service",
        "waydroid_stop" => "systemctl stop waydroid-container.service",
        "waydroid_status" => "waydroid status",
        _ => unreachable!(),
    };

    Ok(PreparedPrivilegedAction {
        spec,
        command_preview: cmd.to_owned(),
        target: "waydroid-container.service".to_owned(),
        rollback: None,
        args: json!({}),
    })
}

fn prepare_hyprland_verify(
    spec: PrivilegedActionSpec,
    args: &Value,
) -> AppResult<PreparedPrivilegedAction> {
    let path = args
        .get("configPath")
        .and_then(Value::as_str)
        .unwrap_or("/home/lucas/.config/hypr/hyprland.conf");
    let safe_path = validate_abs_path(path, "configPath")?;
    if !safe_path.starts_with("/home/") {
        return Err(AppError::Message(
            "hyprland_verify_config só permite caminhos em /home".to_owned(),
        ));
    }

    Ok(PreparedPrivilegedAction {
        spec,
        command_preview: format!("Hyprland --verify-config -c {safe_path}"),
        target: safe_path.clone(),
        rollback: None,
        args: json!({ "configPath": safe_path }),
    })
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    fn base_input(action_id: &str, args: Value) -> PrivilegedActionRequestInput {
        PrivilegedActionRequestInput {
            session_id: "session-1".to_owned(),
            action_id: action_id.to_owned(),
            args,
            reason: "teste".to_owned(),
            dry_run: true,
        }
    }

    #[test]
    fn allowlist_accepts_valid_action() {
        let input = base_input(
            "systemctl_restart_service",
            json!({ "service": "NetworkManager.service" }),
        );
        let prepared = prepare(&input).expect("deveria aceitar ação válida");
        assert!(prepared.command_preview.contains("systemctl restart"));
    }

    #[test]
    fn allowlist_accepts_timer_unit() {
        let input = base_input(
            "systemctl_enable_service",
            json!({ "service": "fstrim.timer" }),
        );
        let prepared = prepare(&input).expect("deveria aceitar timer em allowlist");
        assert!(prepared.command_preview.contains("fstrim.timer"));
    }

    #[test]
    fn allowlist_rejects_unknown_action() {
        let input = base_input("rm_root", json!({}));
        assert!(prepare(&input).is_err());
    }

    #[test]
    fn blocks_shell_injection_like_service_name() {
        let input = base_input(
            "systemctl_enable_service",
            json!({ "service": "sshd.service;rm -rf /" }),
        );
        assert!(prepare(&input).is_err());
    }

    #[test]
    fn blocks_invalid_restore_path() {
        let input = base_input(
            "restore_file",
            json!({
                "backupPath": "/tmp/evil.bak",
                "targetPath": "/etc/pacman.conf"
            }),
        );
        assert!(prepare(&input).is_err());
    }

    #[test]
    fn blocks_service_outside_allowlist() {
        let input = base_input(
            "systemctl_restart_service",
            json!({ "service": "sshd.service" }),
        );
        assert!(prepare(&input).is_err());
    }

    #[test]
    fn accepts_dry_run_for_pacman_install() {
        let input = base_input(
            "pacman_install_packages",
            json!({ "packages": ["jq", "ripgrep"] }),
        );
        let prepared = prepare(&input).expect("pacman válido");
        assert!(prepared.command_preview.contains("pacman -S"));
    }

    #[test]
    fn rollback_scripts_exist_in_workspace() {
        let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("project root")
            .to_path_buf();
        assert!(project_root
            .join("scripts/install-privileged-helper.sh")
            .exists());
        assert!(project_root
            .join("scripts/uninstall-privileged-helper.sh")
            .exists());
    }
}
