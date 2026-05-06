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

        let summary = "Plano curto: diagnosticar contexto real, validar dependências/estado atual, executar em etapas pequenas com rollback.".to_owned();

        session.messages.push(ChatMessage {
            id: Uuid::new_v4().to_string(),
            role: ChatRole::Assistant,
            content: "Recebido. Vou seguir com diagnóstico antes de alterar.".to_owned(),
            created_at: now_iso(),
            reasoning_summary: Some(summary),
        });

        session.tasks.push(SessionTask {
            id: Uuid::new_v4().to_string(),
            title: "Diagnosticar contexto da solicitação".to_owned(),
            status: TaskStatus::Pending,
            detail: Some("Listar estado atual, riscos e plano antes da execução.".to_owned()),
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
