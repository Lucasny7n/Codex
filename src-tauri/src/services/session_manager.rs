use chrono::Utc;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use parking_lot::RwLock;
use uuid::Uuid;

use crate::error::AppResult;
use serde_json::Value;

use crate::models::{
    now_iso, AgentSession, ChatMessage, ChatRole, ConversationExportEnvelope,
    ConversationExportMetadata, ConversationImportResult, SessionExportFormat, SessionExportResult,
    SessionStatus, SessionTask, StatusKind, TaskStatus,
};

#[derive(Debug)]
pub struct SessionManager {
    sessions_dir: PathBuf,
    export_dir: PathBuf,
    sessions: RwLock<HashMap<String, AgentSession>>,
}

impl SessionManager {
    pub fn new(sessions_dir: &Path) -> AppResult<Self> {
        Self::new_with_export_dir(sessions_dir, default_export_dir())
    }

    fn new_with_export_dir(sessions_dir: &Path, export_dir: PathBuf) -> AppResult<Self> {
        let manager = Self {
            sessions_dir: sessions_dir.to_path_buf(),
            export_dir,
            sessions: RwLock::new(HashMap::new()),
        };
        manager.load_from_disk()?;
        Ok(manager)
    }

    fn load_from_disk(&self) -> AppResult<()> {
        let mut store = self.sessions.write();
        store.clear();

        for entry in fs::read_dir(&self.sessions_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|it| it.to_str()) != Some("json") {
                continue;
            }
            let raw = fs::read_to_string(&path)?;
            let session: AgentSession = serde_json::from_str(&raw)?;
            store.insert(session.id.clone(), session);
        }
        Ok(())
    }

    pub fn list_sessions(&self) -> Vec<AgentSession> {
        let mut items = self
            .sessions
            .read()
            .values()
            .filter(|session| !session.archived)
            .cloned()
            .collect::<Vec<AgentSession>>();
        items.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        items
    }

    pub fn list_archived_sessions(&self) -> Vec<AgentSession> {
        let mut items = self
            .sessions
            .read()
            .values()
            .filter(|session| session.archived)
            .cloned()
            .collect::<Vec<AgentSession>>();
        items.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        items
    }

    pub fn list_all_sessions(&self) -> Vec<AgentSession> {
        let mut items = self
            .sessions
            .read()
            .values()
            .cloned()
            .collect::<Vec<AgentSession>>();
        items.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        items
    }

    pub fn create_session(&self, title: &str) -> AppResult<AgentSession> {
        let now = now_iso();
        let session = AgentSession {
            id: Uuid::new_v4().to_string(),
            title: title.to_owned(),
            created_at: now.clone(),
            updated_at: now.clone(),
            status: SessionStatus::Idle,
            messages: vec![],
            tasks: vec![],
            archived: false,
            provider_id: None,
            model_id: None,
            agent_profile_id: None,
            account_profile_id: None,
        };

        self.persist_session(&session)?;
        self.sessions
            .write()
            .insert(session.id.clone(), session.clone());
        Ok(session)
    }

    pub fn rename_session(&self, session_id: &str, title: &str) -> AppResult<AgentSession> {
        let normalized = normalize_title(title);
        let mut sessions = self.sessions.write();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Sessão não encontrada"))?;

        session.title = normalized;
        session.updated_at = now_iso();
        let cloned = session.clone();
        drop(sessions);

        self.persist_session(&cloned)?;
        Ok(cloned)
    }

    pub fn get_session(&self, session_id: &str) -> AppResult<AgentSession> {
        Ok(self
            .sessions
            .read()
            .get(session_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Sessão não encontrada"))?)
    }

    pub fn update_environment(
        &self,
        session_id: &str,
        provider_id: String,
        model_id: String,
        agent_profile_id: String,
        account_profile_id: Option<String>,
    ) -> AppResult<AgentSession> {
        let mut sessions = self.sessions.write();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Sessão não encontrada"))?;

        session.provider_id = Some(provider_id);
        session.model_id = Some(model_id);
        session.agent_profile_id = Some(agent_profile_id);
        session.account_profile_id = account_profile_id;
        session.updated_at = now_iso();
        let cloned = session.clone();
        drop(sessions);

        self.persist_session(&cloned)?;
        Ok(cloned)
    }

    pub fn apply_environment_to_all(
        &self,
        provider_id: String,
        model_id: String,
        agent_profile_id: String,
        account_profile_id: Option<String>,
    ) -> AppResult<Vec<AgentSession>> {
        let mut sessions = self.sessions.write();
        let mut updated = Vec::with_capacity(sessions.len());
        let now = now_iso();

        for session in sessions.values_mut() {
            session.provider_id = Some(provider_id.clone());
            session.model_id = Some(model_id.clone());
            session.agent_profile_id = Some(agent_profile_id.clone());
            session.account_profile_id = account_profile_id.clone();
            session.updated_at = now.clone();
            updated.push(session.clone());
        }
        drop(sessions);

        for session in &updated {
            self.persist_session(session)?;
        }

        Ok(updated)
    }

    pub fn delete_session(&self, session_id: &str) -> AppResult<()> {
        self.sessions.write().remove(session_id);
        let file = self.sessions_dir.join(format!("{session_id}.json"));
        if file.exists() {
            fs::remove_file(file)?;
        }
        Ok(())
    }

    pub fn archive_session(&self, session_id: &str) -> AppResult<AgentSession> {
        let mut sessions = self.sessions.write();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Sessão não encontrada"))?;
        session.archived = true;
        session.updated_at = now_iso();
        let cloned = session.clone();
        drop(sessions);

        self.persist_session(&cloned)?;
        Ok(cloned)
    }

    pub fn restore_session(&self, session_id: &str) -> AppResult<AgentSession> {
        let mut sessions = self.sessions.write();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Sessão não encontrada"))?;
        session.archived = false;
        session.updated_at = now_iso();
        let cloned = session.clone();
        drop(sessions);

        self.persist_session(&cloned)?;
        Ok(cloned)
    }

    pub fn archive_all_sessions(&self) -> AppResult<Vec<AgentSession>> {
        let now = now_iso();
        let mut sessions = self.sessions.write();
        let mut archived = Vec::new();

        for session in sessions.values_mut() {
            if session.archived {
                continue;
            }
            session.archived = true;
            session.updated_at = now.clone();
            archived.push(session.clone());
        }
        drop(sessions);

        for session in &archived {
            self.persist_session(session)?;
        }

        Ok(archived)
    }

    pub fn delete_all_sessions(&self) -> AppResult<usize> {
        let ids = self
            .sessions
            .read()
            .keys()
            .cloned()
            .collect::<Vec<String>>();
        let count = ids.len();

        for id in &ids {
            let file = self.sessions_dir.join(format!("{id}.json"));
            if file.exists() {
                fs::remove_file(file)?;
            }
        }

        self.sessions.write().clear();
        Ok(count)
    }

    pub fn duplicate_session(&self, session_id: &str) -> AppResult<AgentSession> {
        let source = self
            .sessions
            .read()
            .get(session_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Sessão não encontrada"))?;
        let now = now_iso();
        let mut duplicate = source;
        duplicate.id = Uuid::new_v4().to_string();
        duplicate.title = format!("{} (cópia)", duplicate.title);
        duplicate.created_at = now.clone();
        duplicate.updated_at = now;
        duplicate.status = SessionStatus::Idle;
        duplicate.archived = false;

        self.persist_session(&duplicate)?;
        self.sessions
            .write()
            .insert(duplicate.id.clone(), duplicate.clone());
        Ok(duplicate)
    }

    pub fn export_session(
        &self,
        session_id: &str,
        format: SessionExportFormat,
    ) -> AppResult<SessionExportResult> {
        let session = self
            .sessions
            .read()
            .get(session_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Sessão não encontrada"))?;

        let exports_dir = self.export_dir.clone();
        fs::create_dir_all(&exports_dir)?;
        let extension = match format {
            SessionExportFormat::Markdown => "md",
            SessionExportFormat::Json => "json",
            SessionExportFormat::Txt => "txt",
        };
        let file = unique_export_path(&exports_dir, &safe_file_stem(&session.title), extension);
        let body = match format {
            SessionExportFormat::Markdown => export_markdown(&session),
            SessionExportFormat::Json => serde_json::to_string_pretty(&session)?,
            SessionExportFormat::Txt => export_text(&session),
        };
        fs::write(&file, &body)?;

        Ok(SessionExportResult {
            path: file.to_string_lossy().to_string(),
            format,
            bytes: body.len(),
        })
    }

    pub fn export_all_conversations(&self) -> AppResult<SessionExportResult> {
        let sessions = self.list_all_sessions();
        let exports_dir = self.export_dir.clone();
        fs::create_dir_all(&exports_dir)?;
        let file = unique_export_path(&exports_dir, "ailu-conversas", "json");
        let envelope = ConversationExportEnvelope {
            version: "ailu-ai-studio.conversations.v1".to_owned(),
            exported_at: now_iso(),
            metadata: ConversationExportMetadata {
                source: "Ailu AI Studio".to_owned(),
                sessions_count: sessions.len(),
            },
            sessions,
        };
        let body = serde_json::to_string_pretty(&envelope)?;
        fs::write(&file, &body)?;

        Ok(SessionExportResult {
            path: file.to_string_lossy().to_string(),
            format: SessionExportFormat::Json,
            bytes: body.len(),
        })
    }

    pub fn import_conversations_from_file(
        &self,
        path: &Path,
    ) -> AppResult<ConversationImportResult> {
        let raw = fs::read_to_string(path)?;
        let parsed: serde_json::Value = serde_json::from_str(&raw)?;
        let mut sessions: Vec<AgentSession> = if parsed.is_array() {
            serde_json::from_value(parsed)?
        } else {
            let envelope: ConversationExportEnvelope = serde_json::from_value(parsed)?;
            if envelope.version != "ailu-ai-studio.conversations.v1"
                && envelope.version != "codex-command-center.conversations.v1"
            {
                return Err(
                    anyhow::anyhow!("Arquivo de conversas com versão incompatível.").into(),
                );
            }
            envelope.sessions
        };

        let mut store = self.sessions.write();
        let mut used_ids = store.keys().cloned().collect::<HashSet<String>>();
        let mut imported = Vec::new();
        let mut reassigned_ids = 0;
        let mut skipped = 0;
        let now = now_iso();

        for mut session in sessions.drain(..) {
            if session.title.trim().is_empty() {
                skipped += 1;
                continue;
            }
            if session.created_at.trim().is_empty() {
                session.created_at = now.clone();
            }
            if session.updated_at.trim().is_empty() {
                session.updated_at = now.clone();
            }
            if session.id.trim().is_empty() || used_ids.contains(&session.id) {
                session.id = Uuid::new_v4().to_string();
                reassigned_ids += 1;
            }
            used_ids.insert(session.id.clone());
            store.insert(session.id.clone(), session.clone());
            imported.push(session);
        }
        drop(store);

        for session in &imported {
            self.persist_session(session)?;
        }

        Ok(ConversationImportResult {
            imported: imported.len(),
            skipped,
            reassigned_ids,
            sessions: imported
                .into_iter()
                .filter(|session| !session.archived)
                .collect(),
        })
    }

    pub fn append_user_message(&self, session_id: &str, content: &str) -> AppResult<AgentSession> {
        self.append_user_message_with_context(
            session_id,
            content,
            Vec::new(),
            None,
            None,
            None,
            None,
        )
    }

    pub fn append_user_message_with_context(
        &self,
        session_id: &str,
        content: &str,
        attachments: Vec<Value>,
        provider_id: Option<String>,
        model_id: Option<String>,
        agent_profile_id: Option<String>,
        account_profile_id: Option<String>,
    ) -> AppResult<AgentSession> {
        let mut sessions = self.sessions.write();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Sessão não encontrada"))?;

        if session.messages.is_empty() && session.title.trim().is_empty() {
            session.title = title_from_content(content);
        }
        if let Some(provider_id) = provider_id {
            session.provider_id = Some(provider_id);
        }
        if let Some(model_id) = model_id {
            session.model_id = Some(model_id);
        }
        if let Some(agent_profile_id) = agent_profile_id {
            session.agent_profile_id = Some(agent_profile_id);
        }
        if let Some(account_profile_id) = account_profile_id {
            session.account_profile_id = Some(account_profile_id);
        }

        session.messages.push(ChatMessage {
            id: Uuid::new_v4().to_string(),
            role: ChatRole::User,
            content: content.to_owned(),
            created_at: now_iso(),
            reasoning_summary: None,
            attachments,
        });

        session.tasks.push(SessionTask {
            id: Uuid::new_v4().to_string(),
            title: "Enviar ordem ao provider configurado".to_owned(),
            status: TaskStatus::Pending,
            detail: Some(
                "A resposta será gerada pelo provider selecionado ou marcada como erro.".to_owned(),
            ),
        });
        session.status = SessionStatus::Planning;
        session.updated_at = now_iso();

        let cloned = session.clone();
        drop(sessions);

        self.persist_session(&cloned)?;
        Ok(cloned)
    }

    pub fn update_status(
        &self,
        session_id: &str,
        status: SessionStatus,
        task_title: Option<&str>,
        task_status: Option<TaskStatus>,
        task_detail: Option<String>,
    ) -> AppResult<Option<AgentSession>> {
        let mut sessions = self.sessions.write();
        let Some(session) = sessions.get_mut(session_id) else {
            return Ok(None);
        };

        session.status = status;
        session.updated_at = now_iso();

        if let Some(title) = task_title {
            session.tasks.push(SessionTask {
                id: Uuid::new_v4().to_string(),
                title: title.to_owned(),
                status: task_status.unwrap_or(TaskStatus::Pending),
                detail: task_detail,
            });
        }

        let cloned = session.clone();
        drop(sessions);
        self.persist_session(&cloned)?;
        Ok(Some(cloned))
    }

    pub fn append_assistant_message(
        &self,
        session_id: &str,
        content: &str,
        summary: Option<String>,
        status: SessionStatus,
    ) -> AppResult<Option<AgentSession>> {
        let mut sessions = self.sessions.write();
        let Some(session) = sessions.get_mut(session_id) else {
            return Ok(None);
        };

        session.messages.push(ChatMessage {
            id: Uuid::new_v4().to_string(),
            role: ChatRole::Assistant,
            content: content.to_owned(),
            created_at: now_iso(),
            reasoning_summary: summary,
            attachments: Vec::new(),
        });
        session.status = status;
        session.updated_at = now_iso();

        let cloned = session.clone();
        drop(sessions);
        self.persist_session(&cloned)?;
        Ok(Some(cloned))
    }

    pub fn persist_session(&self, session: &AgentSession) -> AppResult<()> {
        let file = self.sessions_dir.join(format!("{}.json", session.id));
        let body = serde_json::to_string_pretty(session)?;
        fs::write(file, body)?;
        Ok(())
    }

    pub fn make_status_note(
        &self,
        session_id: &str,
        kind: StatusKind,
        title: &str,
        detail: &str,
    ) -> crate::models::StatusNote {
        crate::models::StatusNote {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_owned(),
            kind,
            title: title.to_owned(),
            detail: detail.to_owned(),
            at: now_iso(),
        }
    }
}

fn normalize_title(title: &str) -> String {
    let normalized = title.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        "Nova conversa".to_owned()
    } else {
        normalized.chars().take(80).collect()
    }
}

/// Deterministic, clean fallback title derived from the first user message.
/// This is the *fallback* path (used when no LLM-generated title is available):
/// it never dumps the raw prompt. It takes the first meaningful line, strips
/// markdown/code noise, keeps the first few words, and tidies casing so a long
/// or multi-line paste still yields a short, readable topic.
/// Obviously-offensive stems (pt-BR + en). If any appears in the message the
/// title is summarized neutrally — insults/slurs are never copied to the title.
const OFFENSIVE_STEMS: &[&str] = &[
    "cuz", "merd", "porra", "caralh", "fdp", "viad", "otari", "otári", "burro", "burra",
    "idiot", "babac", "arrombad", "puta", "puto", "bucet", "fode", "foda", "foda-se",
    "piroc", "corno", "desgrac", "desgraç", "vagabund", "retardad", "imbecil", "escrot",
    "travec", "cacet", "fud", "fuck", "shit", "bitch", "asshole", "dick", "cunt", "slut",
    "whore", "retard", "fagg", "pussy", "bastard", "nigg",
];

fn contains_offensive(text: &str) -> bool {
    let lower = text.to_lowercase();
    if OFFENSIVE_STEMS.iter().any(|stem| lower.contains(stem)) {
        return true;
    }
    // Standalone "cu" as a whole word.
    lower
        .split(|c: char| !c.is_alphanumeric())
        .any(|word| word == "cu")
}

fn title_from_content(content: &str) -> String {
    const MAX_WORDS: usize = 7;
    const MAX_CHARS: usize = 48;

    if contains_offensive(content) {
        return "Teste de linguagem informal".to_owned();
    }

    // First meaningful line: skip blank lines and entire fenced code blocks,
    // so a leading ```code``` paste never becomes the title.
    let mut in_fence = false;
    let first_line = content
        .lines()
        .map(str::trim)
        .find(|line| {
            if line.starts_with("```") {
                in_fence = !in_fence;
                return false;
            }
            !in_fence && !line.is_empty()
        })
        .unwrap_or("");

    let cleaned = first_line
        .trim_start_matches(|c| c == '#' || c == '-' || c == '*' || c == '>' || c == ' ')
        .replace('`', "");
    let compact = normalize_title(&cleaned);
    if compact == "Nova conversa" {
        return format!("Conversa {}", now_iso());
    }

    let mut title: String = compact
        .split_whitespace()
        .take(MAX_WORDS)
        .collect::<Vec<_>>()
        .join(" ");
    if title.chars().count() > MAX_CHARS {
        title = title.chars().take(MAX_CHARS).collect::<String>();
        if let Some(idx) = title.rfind(' ') {
            title.truncate(idx);
        }
    }
    let title = title
        .trim_end_matches(['.', ',', ':', ';', '!', '?', '-'])
        .trim();

    // Capitalize the first character for a tidy heading.
    let mut chars = title.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => format!("Conversa {}", now_iso()),
    }
}

fn safe_file_stem(title: &str) -> String {
    let stem = title
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    let cleaned = stem
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if cleaned.is_empty() {
        "sessao".to_owned()
    } else {
        cleaned.chars().take(60).collect()
    }
}

fn default_export_dir() -> PathBuf {
    if let Ok(custom) = std::env::var("CODEX_SESSION_EXPORT_DIR") {
        return PathBuf::from(custom);
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_owned());
    PathBuf::from(home).join("Downloads").join("Sessoes")
}

fn unique_export_path(dir: &Path, stem: &str, extension: &str) -> PathBuf {
    let first = dir.join(format!("{stem}.{extension}"));
    if !first.exists() {
        return first;
    }

    let timestamp = Utc::now().format("%Y%m%d-%H%M%S");
    for attempt in 0..100 {
        let suffix = if attempt == 0 {
            timestamp.to_string()
        } else {
            format!("{timestamp}-{attempt}")
        };
        let candidate = dir.join(format!("{stem}-{suffix}.{extension}"));
        if !candidate.exists() {
            return candidate;
        }
    }

    dir.join(format!("{stem}-{}.{}", Uuid::new_v4(), extension))
}

fn export_markdown(session: &AgentSession) -> String {
    let mut output = String::new();
    output.push_str(&format!("# {}\n\n", session.title));
    output.push_str(&format!("- ID: `{}`\n", session.id));
    output.push_str(&format!("- Criada em: `{}`\n", session.created_at));
    output.push_str(&format!("- Atualizada em: `{}`\n", session.updated_at));
    output.push_str(&format!("- Status: `{:?}`\n", session.status));
    if let Some(provider_id) = &session.provider_id {
        output.push_str(&format!("- Provider: `{provider_id}`\n"));
    }
    if let Some(model_id) = &session.model_id {
        output.push_str(&format!("- Modelo: `{model_id}`\n"));
    }
    if let Some(profile_id) = &session.agent_profile_id {
        output.push_str(&format!("- Perfil: `{profile_id}`\n"));
    }
    output.push_str("\n## Mensagens\n\n");

    if session.messages.is_empty() {
        output.push_str("_Sem mensagens._\n");
        return output;
    }

    for message in &session.messages {
        output.push_str(&format!(
            "### {:?} - `{}`\n\n{}\n\n",
            message.role, message.created_at, message.content
        ));
        if let Some(summary) = &message.reasoning_summary {
            output.push_str(&format!("> Justificativa: {}\n\n", summary));
        }
    }

    output
}

fn export_text(session: &AgentSession) -> String {
    let mut output = String::new();
    output.push_str(&format!("{}\n", session.title));
    output.push_str(&format!("ID: {}\n", session.id));
    output.push_str(&format!("Criada em: {}\n", session.created_at));
    output.push_str(&format!("Atualizada em: {}\n", session.updated_at));
    output.push_str(&format!("Status: {:?}\n\n", session.status));

    if session.messages.is_empty() {
        output.push_str("Sem mensagens.\n");
        return output;
    }

    for message in &session.messages {
        output.push_str(&format!(
            "{:?} - {}\n{}\n\n",
            message.role, message.created_at, message.content
        ));
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_sessions_dir() -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("ailu-session-manager-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("deve criar diretório temporário");
        dir
    }

    #[test]
    fn append_user_message_does_not_inject_fixed_assistant_response() {
        let dir = temp_sessions_dir();
        let manager = SessionManager::new(&dir).expect("manager deve iniciar");
        let session = manager
            .create_session("teste")
            .expect("sessão deve ser criada");
        let updated = manager
            .append_user_message(&session.id, "rodar fluxo real")
            .expect("mensagem deve ser adicionada");

        let assistant_messages = updated
            .messages
            .iter()
            .filter(|message| matches!(message.role, ChatRole::Assistant))
            .count();

        assert_eq!(assistant_messages, 0);
        assert!(updated
            .messages
            .iter()
            .any(|message| matches!(message.role, ChatRole::User)
                && message.content == "rodar fluxo real"));

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn created_session_starts_empty_and_can_export() {
        let dir = temp_sessions_dir();
        let exports_dir = dir.join("exports-test");
        let manager = SessionManager::new_with_export_dir(&dir, exports_dir.clone())
            .expect("manager deve iniciar");
        let session = manager
            .create_session("Diagnosticar Settings")
            .expect("sessão deve ser criada");

        assert!(session.messages.is_empty());

        let updated = manager
            .append_user_message_with_context(
                &session.id,
                "corrigir scroll de Settings",
                Vec::new(),
                Some("openai-api".to_owned()),
                Some("gpt-5.5".to_owned()),
                Some("equilibrado".to_owned()),
                Some("openai-api:default".to_owned()),
            )
            .expect("mensagem deve ser persistida");
        assert_eq!(updated.provider_id.as_deref(), Some("openai-api"));
        assert_eq!(updated.model_id.as_deref(), Some("gpt-5.5"));

        let export = manager
            .export_session(&session.id, SessionExportFormat::Markdown)
            .expect("export deve funcionar");
        assert!(export.path.ends_with(".md"));
        assert!(export
            .path
            .starts_with(exports_dir.to_string_lossy().as_ref()));
        assert!(fs::read_to_string(&export.path)
            .expect("export deve existir")
            .contains("corrigir scroll de Settings"));

        let txt_export = manager
            .export_session(&session.id, SessionExportFormat::Txt)
            .expect("export txt deve funcionar");
        assert!(txt_export.path.ends_with(".txt"));

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn delete_session_removes_persisted_file() {
        let dir = temp_sessions_dir();
        let manager = SessionManager::new(&dir).expect("manager deve iniciar");
        let session = manager
            .create_session("remover")
            .expect("sessão deve ser criada");
        let file = dir.join(format!("{}.json", session.id));
        assert!(file.exists());

        manager
            .delete_session(&session.id)
            .expect("delete deve funcionar");
        assert!(!file.exists());
        assert!(manager.list_sessions().is_empty());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn archive_all_sessions_hides_from_main_list_but_keeps_disk() {
        let dir = temp_sessions_dir();
        let manager = SessionManager::new(&dir).expect("manager deve iniciar");
        let session = manager
            .create_session("arquivar")
            .expect("sessão deve ser criada");

        let archived = manager
            .archive_all_sessions()
            .expect("arquivamento deve funcionar");

        assert_eq!(archived.len(), 1);
        assert!(archived[0].archived);
        assert!(manager.list_sessions().is_empty());
        assert_eq!(manager.list_archived_sessions().len(), 1);
        assert!(dir.join(format!("{}.json", session.id)).exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn archive_and_restore_single_session_keeps_lists_separate() {
        let dir = temp_sessions_dir();
        let manager = SessionManager::new(&dir).expect("manager deve iniciar");
        let session = manager
            .create_session("arquivada")
            .expect("sessão deve ser criada");

        let archived = manager
            .archive_session(&session.id)
            .expect("arquivamento individual deve funcionar");
        assert!(archived.archived);
        assert!(manager.list_sessions().is_empty());
        assert_eq!(manager.list_archived_sessions().len(), 1);

        let restored = manager
            .restore_session(&session.id)
            .expect("restauração individual deve funcionar");
        assert!(!restored.archived);
        assert_eq!(manager.list_sessions().len(), 1);
        assert!(manager.list_archived_sessions().is_empty());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn export_and_import_all_conversations_reassigns_conflicting_ids() {
        let dir = temp_sessions_dir();
        let exports_dir = dir.join("exports");
        let manager = SessionManager::new_with_export_dir(&dir, exports_dir.clone())
            .expect("manager deve iniciar");
        let session = manager
            .create_session("Exportável")
            .expect("sessão deve ser criada");
        manager
            .append_user_message(&session.id, "mensagem exportada")
            .expect("mensagem deve ser persistida");

        let export = manager
            .export_all_conversations()
            .expect("export global deve funcionar");
        assert!(export
            .path
            .starts_with(exports_dir.to_string_lossy().as_ref()));
        assert!(fs::read_to_string(&export.path)
            .expect("export deve existir")
            .contains("ailu-ai-studio.conversations.v1"));

        let import_result = manager
            .import_conversations_from_file(Path::new(&export.path))
            .expect("import deve funcionar");

        assert_eq!(import_result.imported, 1);
        assert_eq!(import_result.reassigned_ids, 1);
        assert_eq!(manager.list_sessions().len(), 2);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn import_conversations_rejects_invalid_json() {
        let dir = temp_sessions_dir();
        let manager = SessionManager::new(&dir).expect("manager deve iniciar");
        let file = dir.join("invalido.json");
        fs::write(&file, "{ invalido").expect("fixture deve ser escrita");

        let result = manager.import_conversations_from_file(&file);

        assert!(result.is_err());
        assert!(manager.list_sessions().is_empty());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn delete_all_sessions_removes_archived_and_visible_files() {
        let dir = temp_sessions_dir();
        let manager = SessionManager::new(&dir).expect("manager deve iniciar");
        manager.create_session("um").expect("sessão um");
        manager.create_session("dois").expect("sessão dois");
        manager
            .archive_all_sessions()
            .expect("arquivamento deve funcionar");

        let removed = manager
            .delete_all_sessions()
            .expect("delete global deve funcionar");

        assert_eq!(removed, 2);
        assert!(manager.list_all_sessions().is_empty());
        assert_eq!(
            fs::read_dir(&dir)
                .expect("diretório deve existir")
                .flatten()
                .filter(
                    |entry| entry.path().extension().and_then(|ext| ext.to_str()) == Some("json")
                )
                .count(),
            0
        );

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn title_from_content_summarizes_instead_of_copying_raw() {
        // A long, multi-line prompt must not become the literal title.
        let long = "Preciso de ajuda para otimizar o Ailu Studio inteiro, reduzindo \
                    peso, removendo código morto e melhorando a integração entre os \
                    módulos do app.\nSegue um monte de detalhes...";
        let title = title_from_content(long);
        assert!(title.chars().count() <= 48, "título curto: {title}");
        assert!(
            title.split_whitespace().count() <= 7,
            "poucas palavras: {title}"
        );
        assert!(!title.contains('\n'));
        // First character capitalized.
        assert!(title.chars().next().unwrap().is_uppercase());
    }

    #[test]
    fn title_from_content_strips_markdown_and_code_noise() {
        let title = title_from_content("# Correção do Bluetooth\nmais texto");
        assert_eq!(title, "Correção do Bluetooth");

        let fenced = title_from_content("```\ncodigo\n```\nDiagnóstico da Máquina Local");
        assert_eq!(fenced, "Diagnóstico da Máquina Local");
    }

    #[test]
    fn title_from_content_falls_back_on_empty() {
        assert!(title_from_content("   \n  ").starts_with("Conversa "));
    }

    #[test]
    fn title_from_content_never_copies_offensive_language() {
        let title = title_from_content("cara você é um idiota completo seu merda");
        assert_eq!(title, "Teste de linguagem informal");
        assert!(!title.to_lowercase().contains("idiot"));
        assert!(!title.to_lowercase().contains("merd"));

        let en = title_from_content("this is fucking broken you piece of shit");
        assert_eq!(en, "Teste de linguagem informal");
    }
}
