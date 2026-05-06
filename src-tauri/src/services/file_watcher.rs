use std::path::PathBuf;

use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};
use crate::models::{now_iso, FileChangeEntry, FileEventKind};

#[derive(Debug)]
pub struct RunningWatcher {
    pub _watcher: RecommendedWatcher,
}

#[derive(Debug, Default)]
pub struct FileWatcherService;

impl FileWatcherService {
    pub fn start(&self, app: AppHandle, workspace_root: &str) -> AppResult<RunningWatcher> {
        let path = PathBuf::from(workspace_root);
        if !path.exists() {
            return Err(AppError::Message(format!(
                "Workspace não encontrado para watcher: {workspace_root}"
            )));
        }

        let app_for_events = app.clone();
        let mut watcher = RecommendedWatcher::new(
            move |result: notify::Result<notify::Event>| {
                if let Ok(event) = result {
                    let Some(kind) = map_event_kind(&event.kind) else {
                        return;
                    };
                    for file_path in event.paths {
                        let payload = FileChangeEntry {
                            path: file_path.to_string_lossy().to_string(),
                            event: kind.clone(),
                            at: now_iso(),
                        };
                        let _ = app_for_events.emit("file-changed", payload);
                    }
                }
            },
            Config::default(),
        )
        .map_err(|cause| AppError::Message(cause.to_string()))?;

        watcher
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|cause| AppError::Message(cause.to_string()))?;
        Ok(RunningWatcher { _watcher: watcher })
    }
}

fn map_event_kind(kind: &EventKind) -> Option<FileEventKind> {
    match kind {
        EventKind::Create(_) => Some(FileEventKind::Create),
        EventKind::Modify(notify::event::ModifyKind::Name(_)) => Some(FileEventKind::Rename),
        EventKind::Modify(_) => Some(FileEventKind::Modify),
        EventKind::Remove(_) => Some(FileEventKind::Remove),
        _ => None,
    }
}
