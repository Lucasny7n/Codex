use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use parking_lot::RwLock;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::{
    now_iso, AgentSession, ChatMessage, ChatRole, SessionExportFormat, SessionExportResult,
    SessionStatus, SessionTask, StatusKind, TaskStatus,
};

#[derive(Debug)]
pub struct SessionManager {
    sessions_dir: PathBuf,
    sessions: RwLock<HashMap<String, AgentSession>>,
}

impl SessionManager {
    pub fn new(sessions_dir: &Path) -> AppResult<Self> {
        let manager = Self {
            sessions_dir: sessions_dir.to_path_buf(),
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

    pub fn delete_session(&self, session_id: &str) -> AppResult<()> {
        self.sessions.write().remove(session_id);
        let file = self.sessions_dir.join(format!("{session_id}.json"));
        if file.exists() {
            fs::remove_file(file)?;
        }
        Ok(())
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

        let exports_dir = self.sessions_dir.join("exports");
        fs::create_dir_all(&exports_dir)?;
        let extension = match format {
            SessionExportFormat::Markdown => "md",
            SessionExportFormat::Json => "json",
        };
        let file = exports_dir.join(format!(
            "{}-{}.{}",
            safe_file_stem(&session.title),
            session.id,
            extension
        ));
        let body = match format {
            SessionExportFormat::Markdown => export_markdown(&session),
            SessionExportFormat::Json => serde_json::to_string_pretty(&session)?,
        };
        fs::write(&file, &body)?;

        Ok(SessionExportResult {
            path: file.to_string_lossy().to_string(),
            format,
            bytes: body.len(),
        })
    }

    pub fn append_user_message(&self, session_id: &str, content: &str) -> AppResult<AgentSession> {
        self.append_user_message_with_context(session_id, content, None, None, None, None)
    }

    pub fn append_user_message_with_context(
        &self,
        session_id: &str,
        content: &str,
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

fn title_from_content(content: &str) -> String {
    let compact = normalize_title(content);
    if compact == "Nova conversa" {
        return format!("Conversa {}", now_iso());
    }
    compact.chars().take(54).collect()
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

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_sessions_dir() -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("codex-session-manager-test-{}", Uuid::new_v4()));
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
        let manager = SessionManager::new(&dir).expect("manager deve iniciar");
        let session = manager
            .create_session("Diagnosticar Settings")
            .expect("sessão deve ser criada");

        assert!(session.messages.is_empty());

        let updated = manager
            .append_user_message_with_context(
                &session.id,
                "corrigir scroll de Settings",
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
        assert!(fs::read_to_string(&export.path)
            .expect("export deve existir")
            .contains("corrigir scroll de Settings"));

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
}
