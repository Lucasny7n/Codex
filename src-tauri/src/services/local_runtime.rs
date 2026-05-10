use std::env;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use tokio::time::sleep;

use crate::error::{AppError, AppResult};
use crate::models::{
    now_iso, AppSettings, LocalInstalledModel, LocalModelInstallProgress, LocalModelInstallState,
    LocalRuntimeSnapshot, LocalRuntimeState,
};

#[derive(Default)]
pub struct LocalRuntimeService;

impl LocalRuntimeService {
    pub fn new() -> Self {
        Self
    }

    pub async fn snapshot(&self, settings: &AppSettings) -> LocalRuntimeSnapshot {
        let Some(path) = self.ollama_path() else {
            return unavailable_snapshot(settings, "Ollama não instalado ou fora do PATH.");
        };

        let version_output = Command::new(&path).arg("--version").output().await;
        let version = version_output
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_owned())
            .filter(|line| !line.is_empty());

        let api_url = "http://127.0.0.1:11434".to_owned();
        let service_active = systemctl_is_active().await;
        let api_result = fetch_ollama_tags(&api_url).await;
        let mut problems = Vec::new();
        let mut repair_actions = Vec::new();
        let (api_reachable, mut installed_models, api_error) = match api_result {
            Ok(models) => (true, models, None),
            Err(cause) => (false, Vec::new(), Some(cause)),
        };

        if !api_reachable {
            if let Ok(output) = Command::new(&path).arg("list").output().await {
                if output.status.success() {
                    installed_models = parse_ollama_list(&String::from_utf8_lossy(&output.stdout));
                }
            }
        }

        if !service_active {
            problems.push("ollama_service_offline".to_owned());
            repair_actions.push("sudo systemctl enable --now ollama".to_owned());
            repair_actions.push("ollama serve".to_owned());
        }
        if !api_reachable {
            problems.push("ollama_api_unreachable".to_owned());
            repair_actions.push("Iniciar serviço Ollama ou executar `ollama serve`.".to_owned());
        }
        if installed_models.is_empty() {
            problems.push("no_models_installed".to_owned());
            repair_actions.push("Instalar um modelo local pelo seletor IA.".to_owned());
        }
        if !command_exists("pkexec") {
            problems.push("pkexec_missing".to_owned());
        }
        if !command_exists("sudo") {
            problems.push("sudo_missing".to_owned());
        }

        let state = if api_reachable {
            LocalRuntimeState::Ready
        } else if !service_active {
            LocalRuntimeState::ServiceOffline
        } else {
            LocalRuntimeState::ApiUnreachable
        };

        let message = if api_reachable {
            if installed_models.is_empty() {
                "Ollama responde na API local, mas nenhum modelo está instalado.".to_owned()
            } else {
                format!(
                    "Ollama pronto na API local com {} modelo(s) instalado(s).",
                    installed_models.len()
                )
            }
        } else if let Some(cause) = api_error {
            format!("Ollama instalado, mas API local inacessível: {cause}")
        } else {
            "Ollama instalado, mas API local inacessível.".to_owned()
        };

        LocalRuntimeSnapshot {
            state,
            message,
            command: Some("GET http://127.0.0.1:11434/api/tags".to_owned()),
            version,
            runtime_path: Some(path.to_string_lossy().to_string()),
            install_command: Some(install_hint()),
            models_dir: settings.local_models_root.clone(),
            installed_models,
            active_model_id: settings.selected_local_model_id.clone(),
            installed: true,
            service_active,
            api_reachable,
            api_url,
            can_use_pacman: command_exists("pacman"),
            has_pkexec: command_exists("pkexec"),
            has_sudo: command_exists("sudo"),
            disk_ok: disk_ok(&settings.local_models_root).await,
            problems,
            repair_actions,
            at: now_iso(),
        }
    }

    pub async fn install_runtime(&self, settings: &AppSettings) -> AppResult<LocalRuntimeSnapshot> {
        if self.ollama_path().is_some() {
            return Ok(self.snapshot(settings).await);
        }

        let (program, args): (&str, Vec<&str>) = if command_exists("pkexec") {
            ("pkexec", vec!["pacman", "-S", "--needed", "ollama"])
        } else {
            return Err(AppError::Message(
                "Instalação automática exige pkexec. Fallback manual: `sudo pacman -S --needed ollama`."
                    .to_owned(),
            ));
        };

        let output = Command::new(program)
            .args(args)
            .output()
            .await
            .map_err(|cause| {
                AppError::Message(format!("Falha ao iniciar instalação do runtime: {cause}"))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_owned();
            let detail = if stderr.is_empty() { stdout } else { stderr };
            return Err(AppError::Message(format!(
                "Instalação do runtime falhou. {}",
                if detail.is_empty() {
                    "Sem diagnóstico adicional do gerenciador de pacotes.".to_owned()
                } else {
                    detail
                }
            )));
        }

        let _ = self.start_runtime(settings).await;
        Ok(self.snapshot(settings).await)
    }

    pub async fn start_runtime(&self, settings: &AppSettings) -> AppResult<LocalRuntimeSnapshot> {
        if self.ollama_path().is_none() {
            return Err(AppError::Message(
                "Ollama não instalado. Instale o runtime antes de iniciar serviço.".to_owned(),
            ));
        }

        if command_exists("pkexec") {
            let output = Command::new("pkexec")
                .args(["systemctl", "enable", "--now", "ollama"])
                .output()
                .await;
            if let Ok(output) = output {
                if output.status.success() {
                    return Ok(self.snapshot(settings).await);
                }
            }
        }

        let Some(path) = self.ollama_path() else {
            return Err(AppError::Message(
                "Ollama não encontrado no PATH.".to_owned(),
            ));
        };

        Command::new(path)
            .arg("serve")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|cause| {
                AppError::Message(format!("Falha ao iniciar `ollama serve`: {cause}"))
            })?;
        sleep(Duration::from_secs(2)).await;
        Ok(self.snapshot(settings).await)
    }

    pub async fn install_model<F>(
        &self,
        settings: &AppSettings,
        model_id: &str,
        mut emit_progress: F,
    ) -> AppResult<LocalRuntimeSnapshot>
    where
        F: FnMut(LocalModelInstallProgress),
    {
        let Some(path) = self.ollama_path() else {
            return Err(AppError::Message(
                "Runtime local indisponível. Instale o Ollama antes de baixar modelos.".to_owned(),
            ));
        };

        let mut command = Command::new(path);
        command
            .arg("pull")
            .arg(model_id)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        let mut child = command.spawn().map_err(|cause| {
            AppError::Message(format!("Falha ao iniciar download do modelo: {cause}"))
        })?;

        emit_progress(LocalModelInstallProgress {
            model_id: model_id.to_owned(),
            state: LocalModelInstallState::Running,
            progress_percent: Some(0),
            downloaded: None,
            total: None,
            speed: None,
            message: "Iniciando download do modelo local...".to_owned(),
            at: now_iso(),
        });

        let (tx, mut rx) = mpsc::unbounded_channel::<String>();

        if let Some(stdout) = child.stdout.take() {
            let tx_stdout = tx.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = tx_stdout.send(line);
                }
            });
        }

        if let Some(stderr) = child.stderr.take() {
            let tx_stderr = tx.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = tx_stderr.send(line);
                }
            });
        }

        drop(tx);

        while let Some(line) = rx.recv().await {
            let progress = parse_progress_percent(&line);
            let transfer = parse_transfer_details(&line);
            emit_progress(LocalModelInstallProgress {
                model_id: model_id.to_owned(),
                state: LocalModelInstallState::Running,
                progress_percent: progress,
                downloaded: transfer.downloaded,
                total: transfer.total,
                speed: transfer.speed,
                message: line,
                at: now_iso(),
            });
        }

        let status = child.wait().await.map_err(|cause| {
            AppError::Message(format!("Falha ao aguardar instalação do modelo: {cause}"))
        })?;

        if !status.success() {
            emit_progress(LocalModelInstallProgress {
                model_id: model_id.to_owned(),
                state: LocalModelInstallState::Error,
                progress_percent: None,
                downloaded: None,
                total: None,
                speed: None,
                message: "O runtime retornou erro ao baixar o modelo.".to_owned(),
                at: now_iso(),
            });
            return Err(AppError::Message(
                "Instalação do modelo falhou no runtime local. Confira os logs de progresso no inspector.".to_owned(),
            ));
        }

        emit_progress(LocalModelInstallProgress {
            model_id: model_id.to_owned(),
            state: LocalModelInstallState::Completed,
            progress_percent: Some(100),
            downloaded: None,
            total: None,
            speed: None,
            message: "Modelo instalado com sucesso.".to_owned(),
            at: now_iso(),
        });

        test_generate(model_id).await.map_err(|cause| {
            AppError::Message(format!(
                "Modelo baixado, mas teste curto de geração falhou: {cause}"
            ))
        })?;

        Ok(self.snapshot(settings).await)
    }

    pub async fn remove_model(
        &self,
        settings: &AppSettings,
        model_id: &str,
    ) -> AppResult<LocalRuntimeSnapshot> {
        let Some(path) = self.ollama_path() else {
            return Err(AppError::Message(
                "Runtime local indisponível. Não há como remover modelo sem Ollama instalado."
                    .to_owned(),
            ));
        };

        let output = Command::new(path)
            .arg("rm")
            .arg(model_id)
            .output()
            .await
            .map_err(|cause| {
                AppError::Message(format!("Falha ao remover modelo local: {cause}"))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_owned();
            let detail = if stderr.is_empty() { stdout } else { stderr };
            return Err(AppError::Message(format!(
                "Remoção do modelo falhou: {}",
                if detail.is_empty() {
                    "runtime não retornou detalhes".to_owned()
                } else {
                    detail
                }
            )));
        }

        Ok(self.snapshot(settings).await)
    }

    pub fn ollama_path(&self) -> Option<PathBuf> {
        find_command_in_path("ollama")
    }
}

fn unavailable_snapshot(settings: &AppSettings, reason: &str) -> LocalRuntimeSnapshot {
    let mut problems = vec!["ollama_missing".to_owned()];
    if !command_exists("pacman") {
        problems.push("pacman_missing".to_owned());
    }
    if !command_exists("pkexec") {
        problems.push("pkexec_missing".to_owned());
    }
    if !command_exists("sudo") {
        problems.push("sudo_missing".to_owned());
    }

    LocalRuntimeSnapshot {
        state: LocalRuntimeState::Unavailable,
        message: reason.to_owned(),
        command: Some("which ollama".to_owned()),
        version: None,
        runtime_path: None,
        install_command: Some(install_hint()),
        models_dir: settings.local_models_root.clone(),
        installed_models: Vec::new(),
        active_model_id: settings.selected_local_model_id.clone(),
        installed: false,
        service_active: false,
        api_reachable: false,
        api_url: "http://127.0.0.1:11434".to_owned(),
        can_use_pacman: command_exists("pacman"),
        has_pkexec: command_exists("pkexec"),
        has_sudo: command_exists("sudo"),
        disk_ok: None,
        problems,
        repair_actions: vec![
            "sudo pacman -S --needed ollama".to_owned(),
            "sudo systemctl enable --now ollama".to_owned(),
        ],
        at: now_iso(),
    }
}

fn find_command_in_path(name: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    env::split_paths(&path)
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.is_file())
}

fn command_exists(name: &str) -> bool {
    find_command_in_path(name).is_some()
}

fn install_hint() -> String {
    "pkexec pacman -S --needed ollama".to_owned()
}

async fn systemctl_is_active() -> bool {
    Command::new("systemctl")
        .args(["is-active", "ollama"])
        .output()
        .await
        .ok()
        .is_some_and(|output| output.status.success())
}

async fn fetch_ollama_tags(api_url: &str) -> Result<Vec<LocalInstalledModel>, String> {
    let url = format!("{api_url}/api/tags");
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|cause| cause.to_string())?
        .get(url)
        .send()
        .await
        .map_err(|cause| cause.to_string())?;

    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("HTTP {} {}", status.as_u16(), compact_text(&text)));
    }

    parse_ollama_tags_json(&text).map_err(|cause| cause.to_string())
}

fn parse_ollama_tags_json(body: &str) -> Result<Vec<LocalInstalledModel>, serde_json::Error> {
    let parsed: Value = serde_json::from_str(body)?;
    let models = parsed
        .get("models")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let id = item
                        .get("name")
                        .or_else(|| item.get("model"))
                        .and_then(Value::as_str)?
                        .to_owned();
                    let digest = item
                        .get("digest")
                        .and_then(Value::as_str)
                        .map(str::to_owned);
                    let modified_at = item
                        .get("modified_at")
                        .and_then(Value::as_str)
                        .map(str::to_owned);
                    let size = item.get("size").and_then(Value::as_u64).map(human_size);
                    Some(LocalInstalledModel {
                        id,
                        size,
                        modified_at,
                        digest,
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Ok(models)
}

async fn test_generate(model_id: &str) -> Result<(), String> {
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|cause| cause.to_string())?
        .post("http://127.0.0.1:11434/api/generate")
        .json(&json!({
            "model": model_id,
            "prompt": "Responda apenas: ok",
            "stream": false
        }))
        .send()
        .await
        .map_err(|cause| cause.to_string())?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("HTTP {} {}", status.as_u16(), compact_text(&text)));
    }
    let parsed: Value = serde_json::from_str(&text).map_err(|cause| cause.to_string())?;
    let has_response = parsed
        .get("response")
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty());
    if has_response {
        Ok(())
    } else {
        Err("resposta sem campo `response`".to_owned())
    }
}

async fn disk_ok(path: &str) -> Option<bool> {
    let output = Command::new("df").args(["-Pk", path]).output().await.ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout.lines().nth(1)?;
    let available_kb = line.split_whitespace().nth(3)?.parse::<u64>().ok()?;
    Some(available_kb > 8 * 1024 * 1024)
}

fn human_size(bytes: u64) -> String {
    let gib = bytes as f64 / 1024.0 / 1024.0 / 1024.0;
    if gib >= 1.0 {
        format!("{gib:.1} GB")
    } else {
        let mib = bytes as f64 / 1024.0 / 1024.0;
        format!("{mib:.0} MB")
    }
}

fn compact_text(text: &str) -> String {
    let compact = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    if compact.chars().count() <= 180 {
        compact
    } else {
        format!("{}...", compact.chars().take(177).collect::<String>())
    }
}

fn parse_ollama_list(stdout: &str) -> Vec<LocalInstalledModel> {
    let mut models = Vec::new();

    for line in stdout.lines().skip(1) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let tokens = trimmed.split_whitespace().collect::<Vec<_>>();
        if tokens.len() < 4 {
            continue;
        }

        let id = tokens[0].to_owned();
        let digest = Some(tokens[1].to_owned());
        let size = Some(format!("{} {}", tokens[2], tokens[3]));
        let modified_at = if tokens.len() > 4 {
            Some(tokens[4..].join(" "))
        } else {
            None
        };

        models.push(LocalInstalledModel {
            id,
            size,
            modified_at,
            digest,
        });
    }

    models
}

fn parse_progress_percent(line: &str) -> Option<u8> {
    for token in line.split_whitespace() {
        if let Some(raw) = token.strip_suffix('%') {
            if let Ok(parsed) = raw.parse::<u8>() {
                if parsed <= 100 {
                    return Some(parsed);
                }
            }
        }
    }
    None
}

#[derive(Debug, Default, PartialEq, Eq)]
struct TransferDetails {
    downloaded: Option<String>,
    total: Option<String>,
    speed: Option<String>,
}

fn parse_transfer_details(line: &str) -> TransferDetails {
    let mut details = TransferDetails::default();
    if let Ok(transfer_pattern) = regex::Regex::new(
        r"(?i)(\d+(?:[.,]\d+)?\s*(?:B|KB|MB|GB|TB))\s*/\s*(\d+(?:[.,]\d+)?\s*(?:B|KB|MB|GB|TB))",
    ) {
        if let Some(captures) = transfer_pattern.captures(line) {
            details.downloaded = captures
                .get(1)
                .map(|value| normalize_transfer_value(value.as_str()));
            details.total = captures
                .get(2)
                .map(|value| normalize_transfer_value(value.as_str()));
        }
    }
    if let Ok(speed_pattern) = regex::Regex::new(r"(?i)(\d+(?:[.,]\d+)?\s*(?:B|KB|MB|GB|TB)/s)") {
        if let Some(captures) = speed_pattern.captures(line) {
            details.speed = captures
                .get(1)
                .map(|value| normalize_transfer_value(value.as_str()));
        }
    }
    details
}

fn normalize_transfer_value(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ollama_list_rows() {
        let parsed = parse_ollama_list(
            "NAME                   ID              SIZE      MODIFIED\nllama3.2:latest        8934d96d3f08    4.7 GB    2 hours ago",
        );

        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].id, "llama3.2:latest");
        assert_eq!(parsed[0].size.as_deref(), Some("4.7 GB"));
    }

    #[test]
    fn parses_progress_token() {
        assert_eq!(parse_progress_percent("downloading 57%"), Some(57));
        assert_eq!(parse_progress_percent("no percentage"), None);
    }

    #[test]
    fn parses_transfer_details_from_ollama_progress() {
        let details = parse_transfer_details("pulling layer 57% 1.2 GB/4.7 GB 22.5 MB/s 2m");

        assert_eq!(details.downloaded.as_deref(), Some("1.2 GB"));
        assert_eq!(details.total.as_deref(), Some("4.7 GB"));
        assert_eq!(details.speed.as_deref(), Some("22.5 MB/s"));
    }

    #[test]
    fn parses_ollama_tags_json() {
        let parsed = parse_ollama_tags_json(
            r#"{"models":[{"name":"qwen2.5-coder:7b","digest":"abc","size":5046581248,"modified_at":"2026-05-06T00:00:00Z"}]}"#,
        )
        .expect("json deve parsear");

        assert_eq!(parsed[0].id, "qwen2.5-coder:7b");
        assert_eq!(parsed[0].digest.as_deref(), Some("abc"));
        assert_eq!(parsed[0].size.as_deref(), Some("4.7 GB"));
    }
}
