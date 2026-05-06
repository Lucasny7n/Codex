use tokio::process::Command;

use crate::error::{AppError, AppResult};

#[derive(Debug, Default)]
pub struct VscodeBridge;

impl VscodeBridge {
    pub async fn open_project(&self, path: &str) -> AppResult<()> {
        self.run_code([path]).await
    }

    pub async fn open_file(&self, path: &str, line: Option<u32>) -> AppResult<()> {
        if let Some(line) = line {
            self.run_code(["--goto", &format!("{path}:{line}")]).await
        } else {
            self.run_code([path]).await
        }
    }

    pub async fn open_diff(&self, left: &str, right: &str) -> AppResult<()> {
        self.run_code(["--diff", left, right]).await
    }

    async fn run_code<I, S>(&self, args: I) -> AppResult<()>
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        let mut command = Command::new("code");
        for arg in args {
            command.arg(arg.as_ref());
        }

        let status = command.status().await?;
        if status.success() {
            Ok(())
        } else {
            Err(AppError::Message(format!(
                "VS Code retornou código {:?}",
                status.code()
            )))
        }
    }
}
