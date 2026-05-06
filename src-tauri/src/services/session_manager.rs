use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use parking_lot::RwLock;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::{
    now_iso, AgentSession, ChatMessage, ChatRole, SessionStatus, SessionTask, StatusKind,
    TaskStatus,
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
            messages: vec![ChatMessage {
                id: Uuid::new_v4().to_string(),
                role: ChatRole::System,
                content: "Sessão criada. Pronto para diagnóstico e execução segura.".to_owned(),
                created_at: now,
                reasoning_summary: None,
            }],
            tasks: vec![],
        };

        self.persist_session(&session)?;
        self.sessions
            .write()
            .insert(session.id.clone(), session.clone());
        Ok(session)
    }

    pub fn append_user_message(&self, session_id: &str, content: &str) -> AppResult<AgentSession> {
        let mut sessions = self.sessions.write();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Sessão não encontrada"))?;

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
}
