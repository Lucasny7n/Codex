use std::sync::Arc;
use std::time::Duration;

use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::models::{
    AiFallbackModelConfig, AiFallbackPolicy, AiRoutingSettings, ChatMessage, ChatRole,
    ProviderGenerateRequest, ProviderRunResult,
};
use crate::services::provider_registry::ProviderRegistry;

pub struct AiRouter {
    provider_registry: Arc<ProviderRegistry>,
}

pub struct AiRouteRequest {
    pub provider_id: String,
    pub model_id: String,
    pub prompt: String,
    pub history: Vec<ChatMessage>,
    pub mode: Option<String>,
    pub attachments: Vec<Value>,
    pub workspace_root: String,
    pub account_profile_id: Option<String>,
    pub language: String,
    pub temporary: bool,
    pub developer_mode: bool,
    pub routing: AiRoutingSettings,
}

pub struct AiRouteResult {
    pub result: ProviderRunResult,
    pub provider_id: String,
    pub model_id: String,
    pub account_profile_id: Option<String>,
    pub fallback_used: bool,
    pub attempts: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AiRouteCandidate {
    pub provider_id: String,
    pub model_id: String,
    pub account_profile_id: Option<String>,
    pub timeout_ms: Option<u64>,
}

impl AiRouter {
    pub fn new(provider_registry: Arc<ProviderRegistry>) -> Self {
        Self { provider_registry }
    }

    pub async fn route(&self, request: AiRouteRequest) -> AppResult<AiRouteResult> {
        let prompt = build_provider_prompt(&request);
        let candidates = fallback_plan(
            AiRouteCandidate {
                provider_id: request.provider_id.clone(),
                model_id: request.model_id.clone(),
                account_profile_id: request.account_profile_id.clone(),
                timeout_ms: None,
            },
            &request.routing,
            request.developer_mode,
        );

        let mut attempts = Vec::new();
        let mut last_error: Option<AppError> = None;

        for (index, candidate) in candidates.iter().enumerate() {
            let provider_id = candidate.provider_id.clone();
            let model_id = candidate.model_id.clone();
            attempts.push(format!("{provider_id}/{model_id}"));
            let call = self
                .provider_registry
                .generate_response(ProviderGenerateRequest {
                    provider_id: provider_id.clone(),
                    model_id: model_id.clone(),
                    prompt: prompt.clone(),
                    attachments: request.attachments.clone(),
                    workspace_root: request.workspace_root.clone(),
                    account_profile_id: candidate.account_profile_id.clone(),
                });
            let result = if let Some(timeout_ms) = candidate.timeout_ms {
                match tokio::time::timeout(Duration::from_millis(timeout_ms), call).await {
                    Ok(result) => result,
                    Err(_) => Err(AppError::Message(format!(
                        "Timeout de fallback após {timeout_ms} ms em {provider_id}/{model_id}."
                    ))),
                }
            } else {
                call.await
            };

            match result {
                Ok(result) => {
                    return Ok(AiRouteResult {
                        result,
                        provider_id,
                        model_id,
                        account_profile_id: candidate.account_profile_id.clone(),
                        fallback_used: index > 0,
                        attempts,
                    });
                }
                Err(cause) => {
                    let retryable = is_retryable_provider_error(&cause.to_string());
                    last_error = Some(cause);
                    if !retryable || index + 1 >= candidates.len() {
                        break;
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            AppError::Message("Nenhum provider disponível para roteamento.".to_owned())
        }))
    }
}

pub fn fallback_plan(
    primary: AiRouteCandidate,
    routing: &AiRoutingSettings,
    developer_mode: bool,
) -> Vec<AiRouteCandidate> {
    let mut candidates = vec![primary.clone()];
    if !developer_mode || !routing.fallback_enabled {
        return candidates;
    }

    let mut fallback = routing
        .fallback_models
        .iter()
        .filter(|item| item.enabled)
        .filter(|item| {
            item.provider_id != primary.provider_id
                || item.model_id != primary.model_id
                || item.account_profile_id != primary.account_profile_id
        })
        .map(candidate_from_config)
        .collect::<Vec<_>>();

    fallback.sort_by_key(|candidate| policy_score(candidate, &routing.fallback_policy));
    for candidate in fallback {
        if !candidates.iter().any(|existing| existing == &candidate) {
            candidates.push(candidate);
        }
    }
    candidates
}

fn candidate_from_config(config: &AiFallbackModelConfig) -> AiRouteCandidate {
    AiRouteCandidate {
        provider_id: config.provider_id.clone(),
        model_id: config.model_id.clone(),
        account_profile_id: config.account_profile_id.clone(),
        timeout_ms: config.timeout_ms,
    }
}

fn policy_score(candidate: &AiRouteCandidate, policy: &AiFallbackPolicy) -> u8 {
    let is_local = candidate.provider_id == "local-ollama";
    let model = candidate.model_id.to_lowercase();
    match policy {
        AiFallbackPolicy::LocalFirst => {
            if is_local {
                0
            } else {
                1
            }
        }
        AiFallbackPolicy::CloudFirst => {
            if is_local {
                1
            } else {
                0
            }
        }
        AiFallbackPolicy::FastFirst => {
            if model.contains("mini")
                || model.contains("flash")
                || model.contains("haiku")
                || model.contains("3b")
                || model.contains("1.5b")
            {
                0
            } else {
                1
            }
        }
        AiFallbackPolicy::Code => {
            if model.contains("coder")
                || model.contains("code")
                || model.contains("codestral")
                || model.contains("devstral")
            {
                0
            } else {
                1
            }
        }
        AiFallbackPolicy::CostLow => {
            if is_local
                || model.contains("free")
                || model.contains("mini")
                || model.contains("flash")
                || model.contains("1.5b")
                || model.contains("3b")
            {
                0
            } else {
                1
            }
        }
        AiFallbackPolicy::Automatic => 0,
    }
}

fn build_provider_prompt(request: &AiRouteRequest) -> String {
    let base = prompt_with_attachments(
        &prompt_with_history(&request.history, &request.prompt, request.temporary),
        &request.attachments,
    );
    prompt_with_language_preference(
        &prompt_with_mode_preference(&base, request.mode.as_deref()),
        &request.language,
    )
}

fn prompt_with_history(messages: &[ChatMessage], prompt: &str, temporary: bool) -> String {
    let history = messages
        .iter()
        .rev()
        .take(if temporary { 8 } else { 12 })
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .filter_map(|message| {
            let role = match &message.role {
                ChatRole::User => "Usuário",
                ChatRole::Assistant => "Assistente",
                ChatRole::System => "Sistema",
                ChatRole::Tool => "Ferramenta",
            };
            let content = message.content.trim();
            if content.is_empty() {
                None
            } else {
                Some(format!("{role}: {}", redact_secret_like(content)))
            }
        })
        .collect::<Vec<_>>();

    if history.is_empty() {
        prompt.to_owned()
    } else if temporary {
        format!(
            "[histórico temporário em memória, não persistido]\n{}\n\n[solicitação atual]\n{prompt}",
            history.join("\n")
        )
    } else {
        format!(
            "[histórico da conversa persistida]\n{}\n\n[solicitação atual]\n{prompt}",
            history.join("\n")
        )
    }
}

fn attachment_text(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(redact_secret_like)
}

fn attachment_context(prompt: &str, attachments: &[Value]) -> String {
    if attachments.is_empty() {
        return String::new();
    }

    let mut blocks = Vec::new();
    for attachment in attachments {
        let name = attachment_text(attachment, "name").unwrap_or_else(|| "arquivo".to_owned());
        let path = attachment_text(attachment, "path")
            .unwrap_or_else(|| "caminho indisponível".to_owned());
        let kind = attachment_text(attachment, "kind").unwrap_or_else(|| "generic".to_owned());
        let context_source = attachment_text(attachment, "contextSource");
        let preview = attachment_text(attachment, "contextText")
            .or_else(|| attachment_text(attachment, "previewTextLimited"));
        let mut lines = vec![
            format!("Nome: {name}"),
            format!("Caminho: {path}"),
            format!("Tipo: {kind}"),
        ];
        if let Some(source) = context_source {
            lines.push(format!("Origem: {source}"));
        }
        if let Some(preview) = preview {
            let chunks = relevant_chunks(prompt, &preview, 4);
            if chunks.is_empty() {
                lines.push("Conteúdo disponível, mas sem trecho textual relevante para a solicitação atual.".to_owned());
            } else {
                lines.push("Trechos relevantes para contexto oculto:".to_owned());
                for (index, chunk) in chunks.iter().enumerate() {
                    lines.push(format!("[chunk {}]\n{}", index + 1, chunk));
                }
            }
        }
        blocks.push(lines.join("\n"));
    }

    format!(
        "Anexos brutos/metadados recebidos pelo app. Não renderizar como texto da conversa; use path/metadados e ferramentas locais se precisar abrir.\n\n{}",
        blocks.join("\n\n")
    )
}

fn relevant_chunks(prompt: &str, text: &str, limit: usize) -> Vec<String> {
    let chunks = chunk_text(text, 1200, 180);
    if chunks.is_empty() {
        return Vec::new();
    }
    let terms = lexical_terms(prompt);
    if terms.is_empty() {
        return chunks.into_iter().take(limit).collect();
    }
    let mut scored = chunks
        .into_iter()
        .enumerate()
        .map(|(index, chunk)| {
            let lower = normalize_for_search(&chunk);
            let score = terms
                .iter()
                .map(|term| lower.matches(term).count())
                .sum::<usize>();
            (score, index, chunk)
        })
        .filter(|(score, _, _)| *score > 0)
        .collect::<Vec<_>>();
    scored.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| left.1.cmp(&right.1)));
    scored
        .into_iter()
        .take(limit)
        .map(|(_, _, chunk)| chunk)
        .collect()
}

fn chunk_text(text: &str, size: usize, overlap: usize) -> Vec<String> {
    let clean = text.trim();
    if clean.is_empty() {
        return Vec::new();
    }
    let mut chunks = Vec::new();
    let mut start = 0;
    while start < clean.len() {
        let mut end = (start + size).min(clean.len());
        while end > start && !clean.is_char_boundary(end) {
            end -= 1;
        }
        let chunk = clean[start..end].trim();
        if !chunk.is_empty() {
            chunks.push(chunk.to_owned());
        }
        if end >= clean.len() {
            break;
        }
        start = end.saturating_sub(overlap);
        while start < clean.len() && !clean.is_char_boundary(start) {
            start += 1;
        }
    }
    chunks
}

fn lexical_terms(text: &str) -> Vec<String> {
    let normalized = normalize_for_search(text);
    let mut terms = Vec::new();
    for term in normalized
        .split(|ch: char| !(ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.'))
        .map(str::trim)
        .filter(|term| term.len() >= 3)
    {
        if !terms.iter().any(|existing: &String| existing == term) {
            terms.push(term.to_owned());
        }
    }
    terms
}

fn normalize_for_search(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|ch| match ch {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            other => other,
        })
        .collect()
}

fn prompt_with_attachments(prompt: &str, attachments: &[Value]) -> String {
    let context = attachment_context(prompt, attachments);
    if context.is_empty() {
        prompt.to_owned()
    } else {
        format!("{prompt}\n\n[contexto oculto de anexos]\n{context}")
    }
}

fn prompt_with_language_preference(prompt: &str, language: &str) -> String {
    let label = match language {
        "en" => "English",
        "es" => "Español",
        _ => "Português (Brasil)",
    };
    format!(
        "[preferência do usuário]\nResponda em {label}. Não repita esta instrução.\n\n[solicitação]\n{prompt}"
    )
}

fn prompt_with_mode_preference(prompt: &str, mode: Option<&str>) -> String {
    let Some(mode) = mode else {
        return prompt.to_owned();
    };
    let instruction = match mode {
        "thinking" => {
            "Use análise mais cuidadosa antes de responder, mantendo a resposta final limpa."
        }
        "fast" => "Priorize uma resposta curta, direta e de baixa latência.",
        "code" => "Priorize implementação, código, comandos e validação técnica.",
        "terminal" => {
            "Trate como fluxo de terminal: planeje comandos, riscos e confirmação antes de execução."
        }
        _ => "Escolha automaticamente o melhor comportamento para a solicitação.",
    };
    format!("{prompt}\n\n[modo selecionado]\n{instruction}")
}

fn is_retryable_provider_error(detail: &str) -> bool {
    let lower = detail.to_lowercase();
    lower.contains("rate")
        || lower.contains("limite")
        || lower.contains("quota")
        || lower.contains("timeout")
        || lower.contains("rede")
        || lower.contains("network")
        || lower.contains("provider indisponível")
        || lower.contains("provider_unavailable")
        || lower.contains("api key inválida")
        || lower.contains("invalid_api_key")
        || lower.contains("permissão negada")
        || lower.contains("forbidden")
        || lower.contains("offline")
        || lower.contains("unavailable")
}

fn redact_secret_like(line: &str) -> String {
    line.split_whitespace()
        .map(|part| {
            let trimmed =
                part.trim_matches(|ch: char| ch == ',' || ch == ';' || ch == '"' || ch == '\'');
            if trimmed.starts_with("sk-")
                || trimmed.starts_with("rk-")
                || trimmed.starts_with("AIza")
                || trimmed.len() > 32
                    && trimmed
                        .chars()
                        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
            {
                "[segredo-mascarado]".to_owned()
            } else {
                part.to_owned()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(policy: AiFallbackPolicy) -> AiRoutingSettings {
        AiRoutingSettings {
            fallback_enabled: true,
            fallback_policy: policy,
            fallback_models: vec![
                AiFallbackModelConfig {
                    provider_id: "local-ollama".to_owned(),
                    model_id: "qwen2.5-coder:7b".to_owned(),
                    account_profile_id: None,
                    enabled: true,
                    label: None,
                    timeout_ms: Some(30_000),
                },
                AiFallbackModelConfig {
                    provider_id: "openai-api".to_owned(),
                    model_id: "gpt-5.4-mini".to_owned(),
                    account_profile_id: Some("openai-api:default".to_owned()),
                    enabled: true,
                    label: None,
                    timeout_ms: Some(30_000),
                },
            ],
        }
    }

    #[test]
    fn fallback_disabled_keeps_only_primary() {
        let mut routing = config(AiFallbackPolicy::Automatic);
        routing.fallback_enabled = false;
        let plan = fallback_plan(
            AiRouteCandidate {
                provider_id: "openai-api".to_owned(),
                model_id: "gpt-5.5".to_owned(),
                account_profile_id: None,
                timeout_ms: None,
            },
            &routing,
            true,
        );

        assert_eq!(plan.len(), 1);
        assert_eq!(plan[0].model_id, "gpt-5.5");
    }

    #[test]
    fn local_first_prioritizes_local_fallback() {
        let plan = fallback_plan(
            AiRouteCandidate {
                provider_id: "openai-api".to_owned(),
                model_id: "gpt-5.5".to_owned(),
                account_profile_id: None,
                timeout_ms: None,
            },
            &config(AiFallbackPolicy::LocalFirst),
            true,
        );

        assert_eq!(plan[0].model_id, "gpt-5.5");
        assert_eq!(plan[1].provider_id, "local-ollama");
    }

    #[test]
    fn code_policy_prioritizes_coder_models() {
        let plan = fallback_plan(
            AiRouteCandidate {
                provider_id: "gemini-api".to_owned(),
                model_id: "gemini-2.5-pro".to_owned(),
                account_profile_id: None,
                timeout_ms: None,
            },
            &config(AiFallbackPolicy::Code),
            true,
        );

        assert_eq!(plan[1].model_id, "qwen2.5-coder:7b");
    }
}
