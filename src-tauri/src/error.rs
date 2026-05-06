use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Serde(#[from] serde_json::Error),
    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
}

#[derive(Debug, Serialize)]
pub struct ErrorPayload {
    pub message: String,
}

impl From<AppError> for ErrorPayload {
    fn from(value: AppError) -> Self {
        Self {
            message: value.to_string(),
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;
