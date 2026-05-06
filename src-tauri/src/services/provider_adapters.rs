use std::env;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::process::Command as StdCommand;
use std::sync::Arc;
use std::time::Duration;

use tokio::process::Command;
use tokio::time::timeout;

use crate::error::{AppError, AppResult};
use crate::models::{
    now_iso, ModelDescriptor, ProviderDescriptor, ProviderGenerateRequest, ProviderRunResult,
    ProviderRuntimeStatus, ProviderStatusState,
};

type ProviderFuture<'a, T> = Pin<Box<dyn Future<Output = AppResult<T>> + Send + 'a>>;

pub trait ProviderAdapter: Send + Sync {
    fn descriptor(&self) -> ProviderDescriptor;
    fn status(&self) -> ProviderRuntimeStatus;
    fn test_connection<'a>(&'a self) -> ProviderFuture<'a, ProviderRuntimeStatus>;
    fn generate_response<'a>(
        &'a self,
        request: ProviderGenerateRequest,
    ) -> ProviderFuture<'a, ProviderRunResult>;
}

#[derive(Debug)]
pub struct GeminiCliAdapter;

impl GeminiCliAdapter {
    const ID: &'static str = "gemini-cli";
    const MODEL_ID: &'static str = "gemini-cli-default";
    const TIMEOUT_SECONDS: u64 = 45;
    const TEST_TIMEOUT_SECONDS: u64 = 20;

    fn command_path(&self) -> Option<PathBuf> {
        find_command_in_path("gemini")
    }

    fn version_for(&self, path: &Path) -> Option<String> {
        StdCommand::new(path)
            .arg("--version")
            .env("GEMINI_CLI_NO_RELAUNCH", "true")
            .env("NO_COLOR", "1")
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_owned())
            .filter(|version| !version.is_empty())
    }

    fn has_headless_auth_configuration(&self) -> bool {
        env::var("GEMINI_API_KEY").is_ok()
            || env::var("GOOGLE_API_KEY").is_ok()
            || env::var("GOOGLE_APPLICATION_CREDENTIALS").is_ok()
            || env::var("GOOGLE_CLOUD_PROJECT").is_ok()
    }

    fn has_interactive_oauth_configuration(&self) -> bool {
        gemini_home().join("oauth_creds.json").exists()
            || gemini_home().join("settings.json").exists()
    }

    fn command_preview(&self, model_id: &str, prompt: &str) -> String {
        let mut parts = vec![
            "gemini".to_owned(),
            "--prompt".to_owned(),
            abbreviate_prompt(prompt),
            "--output-format".to_owned(),
            "text".to_owned(),
            "--approval-mode".to_owned(),
            "plan".to_owned(),
            "--skip-trust".to_owned(),
        ];

        if model_id != Self::MODEL_ID {
            parts.push("--model".to_owned());
            parts.push(model_id.to_owned());
        }

        parts.join(" ")
    }

    async fn run_prompt(
        &self,
        request: ProviderGenerateRequest,
        timeout_seconds: u64,
    ) -> AppResult<ProviderRunResult> {
        let Some(path) = self.command_path() else {
            return Err(AppError::Message(
                "Gemini CLI indisponível: binário `gemini` não encontrado no PATH.".to_owned(),
            ));
        };

        if !self.has_headless_auth_configuration() {
            return Err(AppError::Message(
                "Gemini CLI não configurado para execução automática: defina GEMINI_API_KEY, GOOGLE_API_KEY ou Application Default Credentials. Login OAuth interativo não é suficiente para o runner headless.".to_owned(),
            ));
        }

        let command_preview = self.command_preview(&request.model_id, &request.prompt);
        let mut command = Command::new(path);
        command
            .arg("--prompt")
            .arg(&request.prompt)
            .arg("--output-format")
            .arg("text")
            .arg("--approval-mode")
            .arg("plan")
            .arg("--skip-trust")
            .current_dir(&request.workspace_root)
            .env("GEMINI_CLI_NO_RELAUNCH", "true")
            .env("NO_COLOR", "1")
            .env("TERM", "dumb")
            .env("BROWSER", "www-browser")
            .kill_on_drop(true);

        if request.model_id != Self::MODEL_ID {
            command.arg("--model").arg(&request.model_id);
        }

        let child = command
            .spawn()
            .map_err(|cause| AppError::Message(format!("Falha ao iniciar Gemini CLI: {cause}")))?;
        let output = timeout(
            Duration::from_secs(timeout_seconds),
            child.wait_with_output(),
        )
        .await
        .map_err(|_| {
            AppError::Message(format!(
                "Gemini CLI não respondeu dentro de {timeout_seconds}s."
            ))
        })?
        .map_err(|cause| AppError::Message(format!("Falha ao aguardar Gemini CLI: {cause}")))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_owned();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        let combined = format!("{stdout}\n{stderr}");

        if output.status.success() && !stdout.is_empty() && !looks_like_auth_prompt(&combined) {
            return Ok(ProviderRunResult {
                content: stdout.clone(),
                status: provider_status(
                    ProviderStatusState::Ready,
                    "Gemini CLI respondeu com sucesso.",
                    Some(command_preview.clone()),
                    self.command_path()
                        .as_deref()
                        .and_then(|path| self.version_for(path)),
                ),
                command: Some(command_preview),
                stdout: Some(stdout),
                stderr: optional_text(stderr),
                exit_code: output.status.code(),
            });
        }

        let message = if looks_like_auth_prompt(&combined) {
            "Gemini CLI instalado, mas autenticação/configuração não está pronta para execução automática.".to_owned()
        } else if combined.trim().is_empty() {
            "Gemini CLI finalizou sem resposta utilizável.".to_owned()
        } else {
            format!("Gemini CLI falhou: {}", compact_error(&combined))
        };

        Err(AppError::Message(format!(
            "{message} Comando: {command_preview}"
        )))
    }
}

impl ProviderAdapter for GeminiCliAdapter {
    fn descriptor(&self) -> ProviderDescriptor {
        let status = self.status();
        ProviderDescriptor {
            id: Self::ID.to_owned(),
            label: "Gemini CLI".to_owned(),
            configurable: true,
            enabled: matches!(status.state, ProviderStatusState::Ready),
            status,
            models: vec![ModelDescriptor {
                id: Self::MODEL_ID.to_owned(),
                label: "Gemini CLI padrão".to_owned(),
                provider_id: Self::ID.to_owned(),
                context_window: None,
                supports_tools: false,
            }],
        }
    }

    fn status(&self) -> ProviderRuntimeStatus {
        let Some(path) = self.command_path() else {
            return provider_status(
                ProviderStatusState::Unavailable,
                "Gemini CLI indisponível: binário `gemini` não encontrado no PATH.",
                Some("which gemini".to_owned()),
                None,
            );
        };

        let version = self.version_for(&path);
        if version.is_none() {
            return provider_status(
                ProviderStatusState::Error,
                "Gemini CLI encontrado, mas `gemini --version` falhou.",
                Some(format!("{} --version", path.display())),
                None,
            );
        }

        if !self.has_headless_auth_configuration() {
            let message = if self.has_interactive_oauth_configuration() {
                "Gemini CLI instalado com OAuth interativo local, mas o runner headless exige GEMINI_API_KEY, GOOGLE_API_KEY ou Application Default Credentials."
            } else {
                "Gemini CLI instalado, mas não há GEMINI_API_KEY, GOOGLE_API_KEY ou Application Default Credentials para execução automática."
            };

            return provider_status(
                ProviderStatusState::NotConfigured,
                message,
                Some(format!("{} --version", path.display())),
                version,
            );
        }

        provider_status(
            ProviderStatusState::Ready,
            "Gemini CLI instalado e com configuração local detectada. Use Testar provider para validar autenticação.",
            Some(format!("{} --version", path.display())),
            version,
        )
    }

    fn test_connection<'a>(&'a self) -> ProviderFuture<'a, ProviderRuntimeStatus> {
        Box::pin(async move {
            let status = self.status();
            if status.state != ProviderStatusState::Ready {
                return Ok(status);
            }

            let request = ProviderGenerateRequest {
                provider_id: Self::ID.to_owned(),
                model_id: Self::MODEL_ID.to_owned(),
                prompt: "Responda apenas: ok".to_owned(),
                workspace_root: env::current_dir()
                    .unwrap_or_else(|_| PathBuf::from("."))
                    .to_string_lossy()
                    .to_string(),
            };

            match self.run_prompt(request, Self::TEST_TIMEOUT_SECONDS).await {
                Ok(result) => Ok(result.status),
                Err(cause) => Ok(provider_status(
                    ProviderStatusState::Error,
                    format!("Teste do Gemini CLI falhou: {cause}"),
                    Some("gemini --prompt <teste> --output-format text --approval-mode plan --skip-trust".to_owned()),
                    self.command_path()
                        .as_deref()
                        .and_then(|path| self.version_for(path)),
                )),
            }
        })
    }

    fn generate_response<'a>(
        &'a self,
        request: ProviderGenerateRequest,
    ) -> ProviderFuture<'a, ProviderRunResult> {
        Box::pin(async move { self.run_prompt(request, Self::TIMEOUT_SECONDS).await })
    }
}

#[derive(Debug)]
pub struct MockDevelopmentAdapter;

impl ProviderAdapter for MockDevelopmentAdapter {
    fn descriptor(&self) -> ProviderDescriptor {
        ProviderDescriptor {
            id: "mock-development".to_owned(),
            label: "Mock Provider (desenvolvimento)".to_owned(),
            configurable: false,
            enabled: true,
            status: self.status(),
            models: vec![ModelDescriptor {
                id: "mock-development-model".to_owned(),
                label: "Mock de desenvolvimento".to_owned(),
                provider_id: "mock-development".to_owned(),
                context_window: Some(4_000),
                supports_tools: false,
            }],
        }
    }

    fn status(&self) -> ProviderRuntimeStatus {
        provider_status(
            ProviderStatusState::Mock,
            "Provider mock para desenvolvimento. As respostas são simuladas e não vêm de IA real.",
            None,
            None,
        )
    }

    fn test_connection<'a>(&'a self) -> ProviderFuture<'a, ProviderRuntimeStatus> {
        Box::pin(async move { Ok(self.status()) })
    }

    fn generate_response<'a>(
        &'a self,
        request: ProviderGenerateRequest,
    ) -> ProviderFuture<'a, ProviderRunResult> {
        Box::pin(async move {
            let content = format!(
                "[MOCK] resposta simulada para desenvolvimento.\n\nPrompt recebido:\n{}",
                request.prompt
            );

            Ok(ProviderRunResult {
                content,
                status: self.status(),
                command: None,
                stdout: None,
                stderr: None,
                exit_code: Some(0),
            })
        })
    }
}

#[derive(Debug)]
pub struct LocalOllamaUnavailableAdapter;

impl ProviderAdapter for LocalOllamaUnavailableAdapter {
    fn descriptor(&self) -> ProviderDescriptor {
        ProviderDescriptor {
            id: "local-ollama".to_owned(),
            label: "Local Ollama (indisponível)".to_owned(),
            configurable: true,
            enabled: false,
            status: self.status(),
            models: vec![ModelDescriptor {
                id: "qwen2.5-coder".to_owned(),
                label: "Qwen2.5 Coder (não conectado)".to_owned(),
                provider_id: "local-ollama".to_owned(),
                context_window: Some(32_000),
                supports_tools: false,
            }],
        }
    }

    fn status(&self) -> ProviderRuntimeStatus {
        provider_status(
            ProviderStatusState::Unavailable,
            "Ollama não está conectado neste app. Se o binário existir no futuro, ainda será necessário implementar adapter real.",
            Some("which ollama".to_owned()),
            None,
        )
    }

    fn test_connection<'a>(&'a self) -> ProviderFuture<'a, ProviderRuntimeStatus> {
        Box::pin(async move { Ok(self.status()) })
    }

    fn generate_response<'a>(
        &'a self,
        _request: ProviderGenerateRequest,
    ) -> ProviderFuture<'a, ProviderRunResult> {
        Box::pin(async move {
            Err(AppError::Message(
                "Provider indisponível: Ollama ainda não possui runner real neste app.".to_owned(),
            ))
        })
    }
}

#[derive(Default)]
pub struct ProviderAdapterRegistry {
    adapters: Vec<Arc<dyn ProviderAdapter>>,
}

impl ProviderAdapterRegistry {
    pub fn new() -> Self {
        Self {
            adapters: vec![
                Arc::new(GeminiCliAdapter),
                Arc::new(MockDevelopmentAdapter),
                Arc::new(LocalOllamaUnavailableAdapter),
            ],
        }
    }

    pub fn descriptors(&self) -> Vec<ProviderDescriptor> {
        self.adapters
            .iter()
            .map(|adapter| adapter.descriptor())
            .collect()
    }

    pub fn status(&self, provider_id: &str) -> Option<ProviderRuntimeStatus> {
        self.adapters
            .iter()
            .find(|adapter| adapter.descriptor().id == provider_id)
            .map(|adapter| adapter.status())
    }

    pub async fn test_connection(&self, provider_id: &str) -> AppResult<ProviderRuntimeStatus> {
        let adapter = self.adapter(provider_id)?;
        adapter.test_connection().await
    }

    pub async fn generate_response(
        &self,
        request: ProviderGenerateRequest,
    ) -> AppResult<ProviderRunResult> {
        let adapter = self.adapter(&request.provider_id)?;
        adapter.generate_response(request).await
    }

    fn adapter(&self, provider_id: &str) -> AppResult<&Arc<dyn ProviderAdapter>> {
        self.adapters
            .iter()
            .find(|adapter| adapter.descriptor().id == provider_id)
            .ok_or_else(|| {
                AppError::Message(format!(
                    "Provider `{provider_id}` não está registrado ou está indisponível."
                ))
            })
    }
}

fn provider_status(
    state: ProviderStatusState,
    message: impl Into<String>,
    command: Option<String>,
    version: Option<String>,
) -> ProviderRuntimeStatus {
    ProviderRuntimeStatus {
        state,
        message: message.into(),
        command,
        version,
        checked_at: now_iso(),
    }
}

fn find_command_in_path(name: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    env::split_paths(&path)
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.is_file())
}

fn gemini_home() -> PathBuf {
    if let Ok(home) = env::var("GEMINI_CLI_HOME") {
        return PathBuf::from(home);
    }

    env::var("HOME")
        .map(|home| PathBuf::from(home).join(".gemini"))
        .unwrap_or_else(|_| PathBuf::from(".gemini"))
}

fn abbreviate_prompt(prompt: &str) -> String {
    let trimmed = prompt.replace('\n', "\\n");
    if trimmed.chars().count() <= 80 {
        return format!("\"{trimmed}\"");
    }

    let prefix = trimmed.chars().take(77).collect::<String>();
    format!("\"{prefix}...\"")
}

fn looks_like_auth_prompt(text: &str) -> bool {
    let lower = text.to_lowercase();
    lower.contains("authentication")
        || lower.contains("manual authorization")
        || lower.contains("authorization is required")
        || lower.contains("oauth")
        || lower.contains("sign-in")
        || lower.contains("login")
        || lower.contains("opening your browser")
        || lower.contains("opening authentication")
        || lower.contains("do you want to continue")
        || lower.contains("api key")
}

fn compact_error(text: &str) -> String {
    let collapsed = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ");

    if collapsed.chars().count() <= 240 {
        return collapsed;
    }

    format!("{}...", collapsed.chars().take(237).collect::<String>())
}

fn optional_text(text: String) -> Option<String> {
    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn mock_provider_marks_response_as_mock() {
        let adapter = MockDevelopmentAdapter;
        let result = adapter
            .generate_response(ProviderGenerateRequest {
                provider_id: "mock-development".to_owned(),
                model_id: "mock-development-model".to_owned(),
                prompt: "teste".to_owned(),
                workspace_root: ".".to_owned(),
            })
            .await
            .expect("mock deve responder");

        assert!(result.content.starts_with("[MOCK]"));
        assert_eq!(result.status.state, ProviderStatusState::Mock);
    }

    #[tokio::test]
    async fn unavailable_provider_does_not_generate_fake_response() {
        let adapter = LocalOllamaUnavailableAdapter;
        let result = adapter
            .generate_response(ProviderGenerateRequest {
                provider_id: "local-ollama".to_owned(),
                model_id: "qwen2.5-coder".to_owned(),
                prompt: "teste".to_owned(),
                workspace_root: ".".to_owned(),
            })
            .await;

        assert!(result.is_err());
    }

    #[test]
    fn detects_auth_prompt_text() {
        assert!(looks_like_auth_prompt(
            "Opening authentication page in your browser. Do you want to continue?"
        ));
    }
}
