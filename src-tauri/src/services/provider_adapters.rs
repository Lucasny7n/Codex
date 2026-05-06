use std::env;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::process::Command as StdCommand;
use std::sync::Arc;
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::{json, Value};
use tokio::process::Command;
use tokio::time::timeout;

use crate::error::{AppError, AppResult};
use crate::models::{
    now_iso, ModelDescriptor, ProviderDescriptor, ProviderGenerateRequest, ProviderRunResult,
    ProviderRuntimeStatus, ProviderStatusState,
};
use crate::services::credential_store::CredentialStore;

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
pub struct OpenAiCompatibleAdapter {
    id: &'static str,
    label: &'static str,
    base_url: &'static str,
    model_ids: &'static [(&'static str, &'static str)],
    credential_store: Arc<CredentialStore>,
}

impl OpenAiCompatibleAdapter {
    fn new(
        id: &'static str,
        label: &'static str,
        base_url: &'static str,
        model_ids: &'static [(&'static str, &'static str)],
        credential_store: Arc<CredentialStore>,
    ) -> Self {
        Self {
            id,
            label,
            base_url,
            model_ids,
            credential_store,
        }
    }

    fn credential(&self) -> Option<String> {
        self.credential_store.get(self.id)
    }

    fn models(&self) -> Vec<ModelDescriptor> {
        self.model_ids
            .iter()
            .map(|(id, label)| ModelDescriptor {
                id: (*id).to_owned(),
                label: (*label).to_owned(),
                provider_id: self.id.to_owned(),
                context_window: None,
                supports_tools: false,
            })
            .collect()
    }

    fn client(&self, timeout_seconds: u64) -> AppResult<reqwest::Client> {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout_seconds))
            .build()
            .map_err(|cause| AppError::Message(format!("Falha ao criar cliente HTTP: {cause}")))
    }

    async fn get_models(&self, timeout_seconds: u64) -> AppResult<ProviderRuntimeStatus> {
        let Some(key) = self.credential() else {
            return Ok(provider_status(
                ProviderStatusState::RequiresApiKey,
                format!("{} requer API key antes de executar.", self.label),
                None,
                None,
            ));
        };

        let response = self
            .client(timeout_seconds)?
            .get(format!("{}/models", self.base_url))
            .headers(bearer_headers(&key)?)
            .send()
            .await
            .map_err(|cause| {
                AppError::Message(format!("Falha de rede ao testar provider: {cause}"))
            })?;

        let status = response.status();
        if status.is_success() {
            return Ok(provider_status(
                ProviderStatusState::Ready,
                format!("{} respondeu ao teste de modelos.", self.label),
                Some(format!("{}/models", self.base_url)),
                None,
            ));
        }

        let body = response.text().await.unwrap_or_default();
        Ok(provider_status(
            provider_state_from_http(status.as_u16(), &body),
            provider_message_from_http(self.label, status.as_u16(), &body),
            Some(format!("{}/models", self.base_url)),
            None,
        ))
    }

    async fn chat_completion(
        &self,
        request: ProviderGenerateRequest,
    ) -> AppResult<ProviderRunResult> {
        let Some(key) = self.credential() else {
            return Err(AppError::Message(format!(
                "{} requer API key. Adicione a credencial em Settings > IA / Providers.",
                self.label
            )));
        };

        let body = json!({
            "model": request.model_id,
            "messages": [{ "role": "user", "content": request.prompt }],
            "temperature": 0.2,
            "max_tokens": 1200
        });

        let response = self
            .client(60)?
            .post(format!("{}/chat/completions", self.base_url))
            .headers(bearer_headers(&key)?)
            .json(&body)
            .send()
            .await
            .map_err(|cause| {
                AppError::Message(format!("Falha de rede ao chamar provider: {cause}"))
            })?;

        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(AppError::Message(provider_message_from_http(
                self.label,
                status.as_u16(),
                &text,
            )));
        }

        let parsed: Value = serde_json::from_str(&text).map_err(|cause| {
            AppError::Message(format!("Resposta do provider não é JSON válido: {cause}"))
        })?;
        let content = parsed
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                AppError::Message(
                    "Provider respondeu sem conteúdo utilizável em choices[0].message.content."
                        .to_owned(),
                )
            })?
            .to_owned();

        Ok(ProviderRunResult {
            content,
            status: provider_status(
                ProviderStatusState::Ready,
                format!("{} respondeu pela API.", self.label),
                Some(format!("{}/chat/completions", self.base_url)),
                None,
            ),
            command: Some(format!("{}/chat/completions", self.base_url)),
            stdout: None,
            stderr: None,
            exit_code: Some(0),
        })
    }
}

impl ProviderAdapter for OpenAiCompatibleAdapter {
    fn descriptor(&self) -> ProviderDescriptor {
        let status = self.status();
        ProviderDescriptor {
            id: self.id.to_owned(),
            label: self.label.to_owned(),
            configurable: true,
            enabled: matches!(status.state, ProviderStatusState::Ready),
            status,
            models: self.models(),
        }
    }

    fn status(&self) -> ProviderRuntimeStatus {
        if self.credential().is_none() {
            return provider_status(
                ProviderStatusState::RequiresApiKey,
                format!("{} sem API key configurada.", self.label),
                None,
                None,
            );
        }

        provider_status(
            ProviderStatusState::Testing,
            format!(
                "{} tem credencial local, mas precisa de Testar conexão antes de ficar selecionável.",
                self.label
            ),
            Some(format!("{}/models", self.base_url)),
            None,
        )
    }

    fn test_connection<'a>(&'a self) -> ProviderFuture<'a, ProviderRuntimeStatus> {
        Box::pin(async move { self.get_models(5).await })
    }

    fn generate_response<'a>(
        &'a self,
        request: ProviderGenerateRequest,
    ) -> ProviderFuture<'a, ProviderRunResult> {
        Box::pin(async move { self.chat_completion(request).await })
    }
}

#[derive(Debug)]
pub struct AnthropicAdapter {
    credential_store: Arc<CredentialStore>,
}

impl AnthropicAdapter {
    const ID: &'static str = "anthropic-api";
    const LABEL: &'static str = "Anthropic API";
    const MODELS: &'static [(&'static str, &'static str)] = &[
        ("claude-sonnet-4", "Claude Sonnet 4"),
        ("claude-haiku-4", "Claude Haiku 4"),
    ];

    fn credential(&self) -> Option<String> {
        self.credential_store.get(Self::ID)
    }

    fn client(&self, timeout_seconds: u64) -> AppResult<reqwest::Client> {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout_seconds))
            .build()
            .map_err(|cause| AppError::Message(format!("Falha ao criar cliente HTTP: {cause}")))
    }

    fn headers(&self, key: &str) -> AppResult<HeaderMap> {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(key).map_err(|_| {
                AppError::Message("API key Anthropic contém caracteres inválidos.".to_owned())
            })?,
        );
        Ok(headers)
    }

    async fn generate(&self, request: ProviderGenerateRequest) -> AppResult<ProviderRunResult> {
        let Some(key) = self.credential() else {
            return Err(AppError::Message(
                "Anthropic API requer API key em Settings > IA / Providers.".to_owned(),
            ));
        };

        let body = json!({
            "model": request.model_id,
            "max_tokens": 1200,
            "messages": [{ "role": "user", "content": request.prompt }]
        });
        let response = self
            .client(60)?
            .post("https://api.anthropic.com/v1/messages")
            .headers(self.headers(&key)?)
            .json(&body)
            .send()
            .await
            .map_err(|cause| {
                AppError::Message(format!("Falha de rede ao chamar Anthropic: {cause}"))
            })?;

        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(AppError::Message(provider_message_from_http(
                Self::LABEL,
                status.as_u16(),
                &text,
            )));
        }

        let parsed: Value = serde_json::from_str(&text).map_err(|cause| {
            AppError::Message(format!("Resposta Anthropic não é JSON válido: {cause}"))
        })?;
        let content = parsed
            .get("content")
            .and_then(Value::as_array)
            .and_then(|items| {
                let parts = items
                    .iter()
                    .filter_map(|item| item.get("text").and_then(Value::as_str))
                    .collect::<Vec<_>>();
                if parts.is_empty() {
                    None
                } else {
                    Some(parts.join("\n"))
                }
            })
            .ok_or_else(|| {
                AppError::Message("Anthropic respondeu sem conteúdo textual.".to_owned())
            })?;

        Ok(ProviderRunResult {
            content,
            status: provider_status(
                ProviderStatusState::Ready,
                "Anthropic respondeu pela API.",
                Some("https://api.anthropic.com/v1/messages".to_owned()),
                None,
            ),
            command: Some("https://api.anthropic.com/v1/messages".to_owned()),
            stdout: None,
            stderr: None,
            exit_code: Some(0),
        })
    }
}

impl ProviderAdapter for AnthropicAdapter {
    fn descriptor(&self) -> ProviderDescriptor {
        let status = self.status();
        ProviderDescriptor {
            id: Self::ID.to_owned(),
            label: Self::LABEL.to_owned(),
            configurable: true,
            enabled: matches!(status.state, ProviderStatusState::Ready),
            status,
            models: Self::MODELS
                .iter()
                .map(|(id, label)| ModelDescriptor {
                    id: (*id).to_owned(),
                    label: (*label).to_owned(),
                    provider_id: Self::ID.to_owned(),
                    context_window: None,
                    supports_tools: false,
                })
                .collect(),
        }
    }

    fn status(&self) -> ProviderRuntimeStatus {
        if self.credential().is_none() {
            return provider_status(
                ProviderStatusState::RequiresApiKey,
                "Anthropic API sem API key configurada.",
                None,
                None,
            );
        }

        provider_status(
            ProviderStatusState::Testing,
            "Anthropic API tem credencial local, mas precisa de Testar conexão antes de ficar selecionável.",
            Some("https://api.anthropic.com/v1/models".to_owned()),
            None,
        )
    }

    fn test_connection<'a>(&'a self) -> ProviderFuture<'a, ProviderRuntimeStatus> {
        Box::pin(async move {
            let Some(key) = self.credential() else {
                return Ok(self.status());
            };
            let response = self
                .client(5)?
                .get("https://api.anthropic.com/v1/models")
                .headers(self.headers(&key)?)
                .send()
                .await
                .map_err(|cause| {
                    AppError::Message(format!("Falha de rede ao testar Anthropic: {cause}"))
                })?;
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            if status.is_success() {
                Ok(provider_status(
                    ProviderStatusState::Ready,
                    "Anthropic respondeu ao teste de modelos.",
                    Some("https://api.anthropic.com/v1/models".to_owned()),
                    None,
                ))
            } else {
                Ok(provider_status(
                    provider_state_from_http(status.as_u16(), &body),
                    provider_message_from_http(Self::LABEL, status.as_u16(), &body),
                    Some("https://api.anthropic.com/v1/models".to_owned()),
                    None,
                ))
            }
        })
    }

    fn generate_response<'a>(
        &'a self,
        request: ProviderGenerateRequest,
    ) -> ProviderFuture<'a, ProviderRunResult> {
        Box::pin(async move { self.generate(request).await })
    }
}

#[derive(Debug)]
pub struct GeminiApiAdapter {
    credential_store: Arc<CredentialStore>,
}

impl GeminiApiAdapter {
    const ID: &'static str = "gemini-api";
    const LABEL: &'static str = "Gemini API";

    fn credential(&self) -> Option<String> {
        self.credential_store.get(Self::ID)
    }

    async fn generate(&self, request: ProviderGenerateRequest) -> AppResult<ProviderRunResult> {
        let Some(key) = self.credential() else {
            return Err(AppError::Message(
                "Gemini API requer API key em Settings > IA / Providers.".to_owned(),
            ));
        };
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            request.model_id, key
        );
        let safe_url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
            request.model_id
        );
        let body = json!({
            "contents": [{ "parts": [{ "text": request.prompt }] }],
            "generationConfig": { "temperature": 0.2, "maxOutputTokens": 1200 }
        });
        let response = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|cause| AppError::Message(format!("Falha ao criar cliente HTTP: {cause}")))?
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(|cause| {
                AppError::Message(format!("Falha de rede ao chamar Gemini API: {cause}"))
            })?;
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(AppError::Message(provider_message_from_http(
                Self::LABEL,
                status.as_u16(),
                &text,
            )));
        }
        let parsed: Value = serde_json::from_str(&text).map_err(|cause| {
            AppError::Message(format!("Resposta Gemini não é JSON válido: {cause}"))
        })?;
        let content = parsed
            .get("candidates")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|candidate| candidate.get("content"))
            .and_then(|content| content.get("parts"))
            .and_then(Value::as_array)
            .map(|parts| {
                parts
                    .iter()
                    .filter_map(|part| part.get("text").and_then(Value::as_str))
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| AppError::Message("Gemini API respondeu sem texto.".to_owned()))?;

        Ok(ProviderRunResult {
            content,
            status: provider_status(
                ProviderStatusState::Ready,
                "Gemini API respondeu.",
                Some(safe_url.clone()),
                None,
            ),
            command: Some(safe_url),
            stdout: None,
            stderr: None,
            exit_code: Some(0),
        })
    }
}

impl ProviderAdapter for GeminiApiAdapter {
    fn descriptor(&self) -> ProviderDescriptor {
        let status = self.status();
        ProviderDescriptor {
            id: Self::ID.to_owned(),
            label: Self::LABEL.to_owned(),
            configurable: true,
            enabled: matches!(status.state, ProviderStatusState::Ready),
            status,
            models: vec![
                ModelDescriptor {
                    id: "gemini-2.5-pro".to_owned(),
                    label: "Gemini 2.5 Pro".to_owned(),
                    provider_id: Self::ID.to_owned(),
                    context_window: None,
                    supports_tools: false,
                },
                ModelDescriptor {
                    id: "gemini-2.5-flash".to_owned(),
                    label: "Gemini 2.5 Flash".to_owned(),
                    provider_id: Self::ID.to_owned(),
                    context_window: None,
                    supports_tools: false,
                },
            ],
        }
    }

    fn status(&self) -> ProviderRuntimeStatus {
        if self.credential().is_none() {
            return provider_status(
                ProviderStatusState::RequiresApiKey,
                "Gemini API sem GEMINI_API_KEY/GOOGLE_API_KEY ou key salva.",
                None,
                None,
            );
        }
        provider_status(
            ProviderStatusState::Testing,
            "Gemini API tem credencial local, mas precisa de Testar conexão antes de ficar selecionável.",
            Some("https://generativelanguage.googleapis.com/v1beta/models".to_owned()),
            None,
        )
    }

    fn test_connection<'a>(&'a self) -> ProviderFuture<'a, ProviderRuntimeStatus> {
        Box::pin(async move {
            let Some(key) = self.credential() else {
                return Ok(self.status());
            };
            let response = reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .map_err(|cause| {
                    AppError::Message(format!("Falha ao criar cliente HTTP: {cause}"))
                })?
                .get(format!(
                    "https://generativelanguage.googleapis.com/v1beta/models?key={key}"
                ))
                .send()
                .await
                .map_err(|cause| {
                    AppError::Message(format!("Falha de rede ao testar Gemini API: {cause}"))
                })?;
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            if status.is_success() {
                Ok(provider_status(
                    ProviderStatusState::Ready,
                    "Gemini API respondeu ao teste de modelos.",
                    Some("https://generativelanguage.googleapis.com/v1beta/models".to_owned()),
                    None,
                ))
            } else {
                Ok(provider_status(
                    provider_state_from_http(status.as_u16(), &body),
                    provider_message_from_http(Self::LABEL, status.as_u16(), &body),
                    Some("https://generativelanguage.googleapis.com/v1beta/models".to_owned()),
                    None,
                ))
            }
        })
    }

    fn generate_response<'a>(
        &'a self,
        request: ProviderGenerateRequest,
    ) -> ProviderFuture<'a, ProviderRunResult> {
        Box::pin(async move { self.generate(request).await })
    }
}

#[derive(Debug)]
pub struct OpenCodeZenAdapter;

impl ProviderAdapter for OpenCodeZenAdapter {
    fn descriptor(&self) -> ProviderDescriptor {
        ProviderDescriptor {
            id: "opencode-zen".to_owned(),
            label: "OpenCode Zen".to_owned(),
            configurable: true,
            enabled: false,
            status: self.status(),
            models: vec![ModelDescriptor {
                id: "zen-default".to_owned(),
                label: "Zen conectado".to_owned(),
                provider_id: "opencode-zen".to_owned(),
                context_window: None,
                supports_tools: false,
            }],
        }
    }

    fn status(&self) -> ProviderRuntimeStatus {
        provider_status(
            ProviderStatusState::RequiresLogin,
            "OpenCode Zen ainda precisa conexão/login explícito antes de rodar.",
            Some("opencode zen login".to_owned()),
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
                "OpenCode Zen não tem adapter operacional neste build. Conecte o provider antes de executar."
                    .to_owned(),
            ))
        })
    }
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
                ProviderStatusState::NotInstalled,
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
                ProviderStatusState::RequiresCliAuth,
                message,
                Some(format!("{} --version", path.display())),
                version,
            );
        }

        provider_status(
            ProviderStatusState::Testing,
            "Gemini CLI tem configuração headless detectada, mas precisa de Testar conexão antes de ficar selecionável.",
            Some(format!("{} --version", path.display())),
            version,
        )
    }

    fn test_connection<'a>(&'a self) -> ProviderFuture<'a, ProviderRuntimeStatus> {
        Box::pin(async move {
            let status = self.status();
            if !matches!(
                status.state,
                ProviderStatusState::Ready | ProviderStatusState::Testing
            ) {
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
pub struct LocalOllamaAdapter;

impl LocalOllamaAdapter {
    const ID: &'static str = "local-ollama";
    const GENERATE_TIMEOUT_SECONDS: u64 = 150;

    fn command_path(&self) -> Option<PathBuf> {
        find_command_in_path("ollama")
    }

    fn version_for(&self, path: &Path) -> Option<String> {
        StdCommand::new(path)
            .arg("--version")
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_owned())
            .filter(|value| !value.is_empty())
    }

    fn list_models_sync(&self, path: &Path) -> Vec<ModelDescriptor> {
        let output = StdCommand::new(path).arg("list").output().ok();
        let Some(output) = output else {
            return fallback_local_models();
        };
        if !output.status.success() {
            return fallback_local_models();
        }
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let mut models = Vec::new();
        for line in stdout.lines().skip(1) {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Some(model_id) = trimmed.split_whitespace().next() {
                models.push(ModelDescriptor {
                    id: model_id.to_owned(),
                    label: model_id.to_owned(),
                    provider_id: Self::ID.to_owned(),
                    context_window: Some(32_000),
                    supports_tools: false,
                });
            }
        }

        if models.is_empty() {
            return fallback_local_models();
        }
        models
    }

    fn list_connection_error(&self, path: &Path) -> Option<String> {
        let output = StdCommand::new(path).arg("list").output().ok()?;
        if output.status.success() {
            return None;
        }
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_owned();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        if detail.is_empty() {
            None
        } else {
            Some(detail)
        }
    }

    fn command_preview(&self, model_id: &str, prompt: &str) -> String {
        format!(
            "POST http://127.0.0.1:11434/api/generate model={} prompt={}",
            model_id,
            abbreviate_prompt(prompt)
        )
    }
}

impl ProviderAdapter for LocalOllamaAdapter {
    fn descriptor(&self) -> ProviderDescriptor {
        let status = self.status();
        let models = self
            .command_path()
            .as_deref()
            .map(|path| self.list_models_sync(path))
            .unwrap_or_else(fallback_local_models);

        ProviderDescriptor {
            id: Self::ID.to_owned(),
            label: "Local Ollama".to_owned(),
            configurable: true,
            enabled: matches!(status.state, ProviderStatusState::Ready),
            status,
            models,
        }
    }

    fn status(&self) -> ProviderRuntimeStatus {
        let Some(path) = self.command_path() else {
            return provider_status(
                ProviderStatusState::NotInstalled,
                "Ollama não encontrado. Instale o runtime local para ativar modelos offline.",
                Some("which ollama".to_owned()),
                None,
            );
        };

        let version = self.version_for(&path);
        if version.is_none() {
            return provider_status(
                ProviderStatusState::Error,
                "Ollama encontrado, mas `ollama --version` falhou.",
                Some(format!("{} --version", path.display())),
                None,
            );
        }

        if let Some(detail) = self.list_connection_error(&path) {
            let lowered = detail.to_lowercase();
            let status = if lowered.contains("could not connect")
                || lowered.contains("connection refused")
                || lowered.contains("is it running")
            {
                ProviderStatusState::ServiceOffline
            } else {
                ProviderStatusState::Error
            };

            return provider_status(
                status,
                format!(
                    "Ollama instalado, mas indisponível no momento: {}",
                    compact_error(&detail)
                ),
                Some(format!("{} list", path.display())),
                version,
            );
        }

        provider_status(
            ProviderStatusState::Ready,
            "Ollama instalado e pronto para respostas locais.",
            Some(format!("{} list", path.display())),
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
                model_id: fallback_local_model_id().to_owned(),
                prompt: "Responda apenas: ok".to_owned(),
                workspace_root: env::current_dir()
                    .unwrap_or_else(|_| PathBuf::from("."))
                    .to_string_lossy()
                    .to_string(),
            };

            match self.generate_response(request).await {
                Ok(result) => Ok(result.status),
                Err(cause) => Ok(provider_status(
                    ProviderStatusState::Error,
                    format!("Teste local falhou: {cause}"),
                    Some("POST http://127.0.0.1:11434/api/generate".to_owned()),
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
        Box::pin(async move {
            if self.command_path().is_none() {
                return Err(AppError::Message(
                    "Runtime local indisponível: `ollama` não foi encontrado no PATH.".to_owned(),
                ));
            };

            let command_preview = self.command_preview(&request.model_id, &request.prompt);
            let response = reqwest::Client::builder()
                .timeout(Duration::from_secs(Self::GENERATE_TIMEOUT_SECONDS))
                .build()
                .map_err(|cause| {
                    AppError::Message(format!("Falha ao criar cliente HTTP: {cause}"))
                })?
                .post("http://127.0.0.1:11434/api/generate")
                .json(&json!({
                    "model": request.model_id,
                    "prompt": request.prompt,
                    "stream": false
                }))
                .send()
                .await
                .map_err(|cause| {
                    AppError::Message(format!(
                        "API local do Ollama inacessível em http://127.0.0.1:11434: {cause}"
                    ))
                })?;

            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            if !status.is_success() {
                return Err(AppError::Message(format!(
                    "Ollama HTTP retornou {}: {}",
                    status.as_u16(),
                    compact_error(&text)
                )));
            }

            let parsed: Value = serde_json::from_str(&text).map_err(|cause| {
                AppError::Message(format!("Resposta Ollama não é JSON válido: {cause}"))
            })?;
            let content = parsed
                .get("response")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| {
                    AppError::Message(
                        "Ollama respondeu sem campo `response` utilizável.".to_owned(),
                    )
                })?
                .to_owned();

            Ok(ProviderRunResult {
                content: content.clone(),
                status: provider_status(
                    ProviderStatusState::Ready,
                    "Resposta local concluída pela API HTTP do Ollama.",
                    Some(command_preview.clone()),
                    self.command_path()
                        .as_deref()
                        .and_then(|path| self.version_for(path)),
                ),
                command: Some(command_preview),
                stdout: Some(content),
                stderr: None,
                exit_code: Some(0),
            })
        })
    }
}

pub struct ProviderAdapterRegistry {
    adapters: Vec<Arc<dyn ProviderAdapter>>,
}

impl ProviderAdapterRegistry {
    pub fn new(credential_store: Arc<CredentialStore>, include_mock: bool) -> Self {
        const OPENAI_MODELS: &[(&str, &str)] = &[
            ("gpt-5.5", "GPT-5.5"),
            ("gpt-5.4", "GPT-5.4"),
            ("gpt-5.4-mini", "GPT-5.4 Mini"),
        ];
        const OPENROUTER_MODELS: &[(&str, &str)] = &[
            ("openai/gpt-5.4-mini", "OpenAI GPT-5.4 Mini via OpenRouter"),
            (
                "anthropic/claude-sonnet-4",
                "Claude Sonnet 4 via OpenRouter",
            ),
            ("google/gemini-2.5-flash", "Gemini 2.5 Flash via OpenRouter"),
        ];

        let mut adapters: Vec<Arc<dyn ProviderAdapter>> = vec![
            Arc::new(GeminiCliAdapter),
            Arc::new(GeminiApiAdapter {
                credential_store: credential_store.clone(),
            }),
            Arc::new(OpenAiCompatibleAdapter::new(
                "openai-api",
                "OpenAI API",
                "https://api.openai.com/v1",
                OPENAI_MODELS,
                credential_store.clone(),
            )),
            Arc::new(OpenAiCompatibleAdapter::new(
                "openrouter-api",
                "OpenRouter",
                "https://openrouter.ai/api/v1",
                OPENROUTER_MODELS,
                credential_store.clone(),
            )),
            Arc::new(AnthropicAdapter {
                credential_store: credential_store.clone(),
            }),
            Arc::new(OpenCodeZenAdapter),
            Arc::new(LocalOllamaAdapter),
        ];

        if include_mock {
            adapters.push(Arc::new(MockDevelopmentAdapter));
        }

        Self { adapters }
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

fn bearer_headers(key: &str) -> AppResult<HeaderMap> {
    let mut headers = HeaderMap::new();
    let value = HeaderValue::from_str(&format!("Bearer {key}")).map_err(|_| {
        AppError::Message("API key contém caracteres inválidos para header HTTP.".to_owned())
    })?;
    headers.insert(AUTHORIZATION, value);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    Ok(headers)
}

fn provider_state_from_http(status: u16, body: &str) -> ProviderStatusState {
    let lower = body.to_lowercase();
    if status == 401 || status == 403 {
        return ProviderStatusState::RequiresApiKey;
    }
    if status == 429 && (lower.contains("quota") || lower.contains("insufficient_quota")) {
        return ProviderStatusState::QuotaExceeded;
    }
    if status == 429 {
        return ProviderStatusState::RateLimited;
    }
    if status == 400 || status == 404 {
        return ProviderStatusState::Misconfigured;
    }
    if status >= 500 {
        return ProviderStatusState::Unavailable;
    }
    ProviderStatusState::Error
}

fn provider_message_from_http(label: &str, status: u16, body: &str) -> String {
    let detail = compact_error(body);
    let action = match provider_state_from_http(status, body) {
        ProviderStatusState::RequiresApiKey => "verifique ou troque a API key",
        ProviderStatusState::QuotaExceeded => "troque de provider/modelo ou revise a cota",
        ProviderStatusState::RateLimited => "aguarde e tente novamente",
        ProviderStatusState::Misconfigured => "confira modelo, endpoint e configuração",
        ProviderStatusState::Unavailable => "tente novamente ou use outro provider",
        _ => "abra os detalhes do provider",
    };
    if detail.is_empty() {
        format!("{label} retornou HTTP {status}; {action}.")
    } else {
        format!("{label} retornou HTTP {status}; {action}. Detalhe: {detail}")
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

fn fallback_local_model_id() -> &'static str {
    "qwen2.5-coder:7b"
}

fn fallback_local_models() -> Vec<ModelDescriptor> {
    vec![
        ModelDescriptor {
            id: "qwen2.5-coder:7b".to_owned(),
            label: "Qwen2.5 Coder 7B".to_owned(),
            provider_id: "local-ollama".to_owned(),
            context_window: Some(32_000),
            supports_tools: false,
        },
        ModelDescriptor {
            id: "llama3.1:8b".to_owned(),
            label: "Llama 3.1 8B".to_owned(),
            provider_id: "local-ollama".to_owned(),
            context_window: Some(32_000),
            supports_tools: false,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_credential_store() -> Arc<CredentialStore> {
        let path = std::env::temp_dir().join(format!(
            "codex-provider-adapters-test-{}.json",
            uuid::Uuid::new_v4()
        ));
        Arc::new(CredentialStore::new(path).expect("credential store de teste deve iniciar"))
    }

    #[test]
    fn cloud_credential_requires_connection_test_before_ready() {
        let store = test_credential_store();
        store
            .save("openai-api", "sk-test-123456789")
            .expect("deve salvar credencial fake local");
        let adapter = OpenAiCompatibleAdapter::new(
            "openai-api",
            "OpenAI API",
            "https://api.openai.com/v1",
            &[("gpt-5.4-mini", "GPT-5.4 Mini")],
            store,
        );

        let status = adapter.status();

        assert_eq!(status.state, ProviderStatusState::Testing);
        assert!(status.message.contains("Testar conexão"));
    }

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
        let adapter = LocalOllamaAdapter;
        let result = adapter
            .generate_response(ProviderGenerateRequest {
                provider_id: "local-ollama".to_owned(),
                model_id: "qwen2.5-coder:7b".to_owned(),
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
