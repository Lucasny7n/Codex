use std::{
    env, fs,
    io::Read,
    path::{Path, PathBuf},
    process::Command,
    sync::Arc,
};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::error::{AppError, AppResult, ErrorPayload};
use crate::models::{
    ActionableError, ActionableErrorSeverity, AgentSession, AppHealthAction, AppHealthCheck,
    AppHealthOverallStatus, AppHealthProvider, AppSettings, BootstrapPayload, CommandLogChunk,
    ConversationImportResult, ExecutionRequestInput, ExecutionResponse, LocalModelInstallProgress,
    LocalRuntimeSnapshot, LogStream, PendingIntentKind, PermissionDecision, PermissionOutcome,
    PermissionOutcomeStatus, PermissionRequest, PrivilegedActionRequestInput, PrivilegedActionSpec,
    ProviderAccountProfile, ProviderCredentialStatus, ProviderGenerateRequest,
    ProviderRuntimeStatus, ProviderStatusState, SessionExportFormat, SessionExportResult,
    SessionStatus, StatusKind, TaskStatus, WorkspaceMeta,
};
use crate::services::privileged_actions;
use crate::services::privileged_helper_client::HelperRequest;
use crate::services::provider_registry::ProviderRegistry;
use crate::services::session_manager::SessionManager;
use crate::state::AppState;

fn map_err(error: AppError) -> ErrorPayload {
    error.into()
}

#[tauri::command]
pub fn bootstrap_state(
    app: AppHandle,
    state: State<AppState>,
) -> Result<BootstrapPayload, ErrorPayload> {
    let settings = state.settings();

    if state.file_watcher.lock().is_none() {
        if let Ok(watcher) = state
            .file_watcher_service
            .start(app.clone(), &settings.workspace_root)
        {
            *state.file_watcher.lock() = Some(watcher);
        }
    }

    let memory = state.memory_manager.load_snapshot().map_err(map_err)?;
    let providers = state.provider_registry.providers();
    let provider_profiles = state.credential_store.account_profiles(&providers);
    let payload = BootstrapPayload {
        workspace_meta: load_workspace_meta(&settings.workspace_root),
        settings,
        sessions: state.session_manager.list_sessions(),
        pending_permissions: state.permission_manager.list_pending(),
        providers,
        provider_profiles,
        agent_profiles: state.provider_registry.agent_profiles(),
        memory,
        theme: state.load_system_theme(),
    };

    Ok(payload)
}

fn load_workspace_meta(root: &str) -> WorkspaceMeta {
    let repo_name = Path::new(root)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("workspace")
        .to_owned();

    WorkspaceMeta {
        root: root.to_owned(),
        repo_name,
        branch: git_output(root, ["branch", "--show-current"]).filter(|value| !value.is_empty()),
        head_short: git_output(root, ["rev-parse", "--short", "HEAD"])
            .filter(|value| !value.is_empty()),
        dirty: git_output(root, ["status", "--short"]).is_some_and(|value| !value.is_empty()),
    }
}

fn git_output<const N: usize>(root: &str, args: [&str; N]) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    Some(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn command_ok<const N: usize>(program: &str, args: [&str; N]) -> bool {
    Command::new(program)
        .args(args)
        .output()
        .ok()
        .is_some_and(|output| output.status.success())
}

const FILE_BROWSER_MAX_ENTRIES: usize = 500;
const FILE_PREVIEW_LIMIT_BYTES: u64 = 100 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum FileEntryKind {
    Directory,
    Pdf,
    Zip,
    Text,
    Json,
    Image,
    Code,
    Audio,
    Video,
    Generic,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileShortcut {
    id: String,
    label: String,
    path: String,
    exists: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileBrowserEntry {
    name: String,
    path: String,
    kind: FileEntryKind,
    extension: Option<String>,
    is_directory: bool,
    size: Option<u64>,
    modified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDirectoryListing {
    path: String,
    parent_path: Option<String>,
    entries: Vec<FileBrowserEntry>,
    shortcuts: Vec<FileShortcut>,
    truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum FilePreviewKind {
    Text,
    Pdf,
    Zip,
    Unavailable,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedFileAttachment {
    name: String,
    path: String,
    kind: FileEntryKind,
    extension: Option<String>,
    is_directory: bool,
    size: Option<u64>,
    modified_at: Option<String>,
    preview: Option<String>,
    preview_kind: Option<FilePreviewKind>,
    preview_truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum VoiceTranscriptionResultStatus {
    Done,
    MissingBackend,
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceTranscriptionResult {
    status: VoiceTranscriptionResultStatus,
    text: Option<String>,
    message: String,
    backend: Option<String>,
    command: Option<String>,
    technical_details: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SttToolStatus {
    id: String,
    label: String,
    installed: bool,
    path: Option<String>,
    ready: bool,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SttModelCandidate {
    label: String,
    path: String,
    source: String,
    exists: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSttConfigSnapshot {
    ffmpeg: SttToolStatus,
    backends: Vec<SttToolStatus>,
    model_path: Option<String>,
    model_exists: bool,
    model_candidates: Vec<SttModelCandidate>,
    ready: bool,
    install_command: String,
    message: String,
    checked_at: String,
}

fn home_dir() -> Result<PathBuf, AppError> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .filter(|path| path.exists())
        .or_else(|| std::env::current_dir().ok())
        .ok_or_else(|| AppError::Message("Não foi possível resolver a pasta inicial.".to_owned()))
}

fn expand_user_path(raw: &str) -> Result<PathBuf, AppError> {
    if raw.contains('\0') {
        return Err(AppError::Message("Caminho inválido.".to_owned()));
    }
    if raw == "~" {
        return home_dir();
    }
    if let Some(rest) = raw.strip_prefix("~/") {
        return Ok(home_dir()?.join(rest));
    }
    Ok(PathBuf::from(raw))
}

fn resolve_existing_path(path: Option<&str>) -> Result<PathBuf, AppError> {
    let candidate = match path.map(str::trim).filter(|value| !value.is_empty()) {
        Some(raw) => expand_user_path(raw)?,
        None => home_dir()?,
    };
    let absolute = if candidate.is_absolute() {
        candidate
    } else {
        std::env::current_dir()?.join(candidate)
    };
    absolute
        .canonicalize()
        .map_err(|_| AppError::Message("Caminho não encontrado ou inacessível.".to_owned()))
}

fn modified_iso(metadata: &fs::Metadata) -> Option<String> {
    metadata
        .modified()
        .ok()
        .map(|time| chrono::DateTime::<chrono::Utc>::from(time).to_rfc3339())
}

fn path_extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_lowercase)
        .filter(|extension| !extension.is_empty())
}

fn detect_file_kind(path: &Path, is_directory: bool) -> FileEntryKind {
    if is_directory {
        return FileEntryKind::Directory;
    }
    match path_extension(path).as_deref() {
        Some("pdf") => FileEntryKind::Pdf,
        Some("zip") | Some("7z") | Some("tar") | Some("gz") | Some("tgz") | Some("rar") => {
            FileEntryKind::Zip
        }
        Some("txt") | Some("md") | Some("markdown") | Some("log") | Some("csv") | Some("toml")
        | Some("yaml") | Some("yml") | Some("ini") => FileEntryKind::Text,
        Some("json") | Some("jsonl") => FileEntryKind::Json,
        Some("png") | Some("jpg") | Some("jpeg") | Some("webp") | Some("gif") | Some("svg") => {
            FileEntryKind::Image
        }
        Some("rs") | Some("ts") | Some("tsx") | Some("js") | Some("jsx") | Some("py")
        | Some("go") | Some("java") | Some("c") | Some("h") | Some("cpp") | Some("hpp")
        | Some("css") | Some("html") | Some("sh") | Some("fish") | Some("sql") => {
            FileEntryKind::Code
        }
        Some("mp3") | Some("wav") | Some("flac") | Some("ogg") => FileEntryKind::Audio,
        Some("mp4") | Some("mkv") | Some("mov") | Some("webm") => FileEntryKind::Video,
        _ => FileEntryKind::Generic,
    }
}

fn file_entry_from_path(path: &Path) -> Result<FileBrowserEntry, AppError> {
    let metadata = fs::metadata(path)?;
    let is_directory = metadata.is_dir();
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_owned)
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    Ok(FileBrowserEntry {
        name,
        path: path.to_string_lossy().to_string(),
        kind: detect_file_kind(path, is_directory),
        extension: path_extension(path),
        is_directory,
        size: if is_directory {
            None
        } else {
            Some(metadata.len())
        },
        modified_at: modified_iso(&metadata),
    })
}

fn shortcut(id: &str, label: &str, path: PathBuf) -> FileShortcut {
    let exists = path.is_dir();
    FileShortcut {
        id: id.to_owned(),
        label: label.to_owned(),
        path: path.to_string_lossy().to_string(),
        exists,
    }
}

fn file_shortcuts() -> Result<Vec<FileShortcut>, AppError> {
    let home = home_dir()?;
    let documents = {
        let localized = home.join("Documentos");
        if localized.is_dir() {
            localized
        } else {
            home.join("Documents")
        }
    };
    Ok(vec![
        shortcut("home", "Home", home.clone()),
        shortcut("downloads", "Downloads", home.join("Downloads")),
        shortcut("documents", "Documentos", documents),
        shortcut("images", "Imagens", home.join("Imagens")),
        shortcut("videos", "Vídeos", home.join("Vídeos")),
        shortcut("music", "Música", home.join("Música")),
        shortcut("desktop", "Área de trabalho", home.join("Área de trabalho")),
        shortcut(
            "recent",
            "Recentes",
            home.join(".local/share/recently-used.xbel"),
        ),
    ])
}

fn limited_text(mut text: String, limit: usize) -> (String, bool) {
    if text.len() <= limit {
        return (text, false);
    }
    let mut end = limit;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    text.truncate(end);
    (text, true)
}

fn read_text_preview(path: &Path, metadata: &fs::Metadata) -> Result<(String, bool), AppError> {
    let mut file = fs::File::open(path)?;
    let mut buffer = Vec::new();
    file.by_ref()
        .take(FILE_PREVIEW_LIMIT_BYTES + 1)
        .read_to_end(&mut buffer)?;
    let truncated =
        metadata.len() > FILE_PREVIEW_LIMIT_BYTES || buffer.len() as u64 > FILE_PREVIEW_LIMIT_BYTES;
    if buffer.len() as u64 > FILE_PREVIEW_LIMIT_BYTES {
        buffer.truncate(FILE_PREVIEW_LIMIT_BYTES as usize);
    }
    Ok((String::from_utf8_lossy(&buffer).to_string(), truncated))
}

fn command_preview(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).to_string();
    Some(limited_text(text, FILE_PREVIEW_LIMIT_BYTES as usize).0)
}

fn pdf_preview(path: &Path) -> (Option<String>, FilePreviewKind, bool) {
    let path_text = path.to_string_lossy();
    match command_preview("pdftotext", &["-layout", "-f", "1", "-l", "3", &path_text, "-"]) {
        Some(text) if !text.trim().is_empty() => {
            let (limited, truncated) = limited_text(text, FILE_PREVIEW_LIMIT_BYTES as usize);
            (Some(limited), FilePreviewKind::Pdf, truncated)
        }
        _ => (
            Some("Preview PDF indisponível: pdftotext ausente, PDF protegido ou arquivo sem camada de texto.".to_owned()),
            FilePreviewKind::Unavailable,
            false,
        ),
    }
}

fn zip_preview(path: &Path) -> (Option<String>, FilePreviewKind, bool) {
    let path_text = path.to_string_lossy();
    let text = command_preview("unzip", &["-l", &path_text])
        .or_else(|| command_preview("bsdtar", &["-tf", &path_text]));
    match text {
        Some(text) if !text.trim().is_empty() => {
            let (limited, truncated) = limited_text(text, FILE_PREVIEW_LIMIT_BYTES as usize);
            (Some(limited), FilePreviewKind::Zip, truncated)
        }
        _ => (
            Some("Preview ZIP indisponível: não foi possível listar o conteúdo com as ferramentas locais.".to_owned()),
            FilePreviewKind::Unavailable,
            false,
        ),
    }
}

const STT_INSTALL_COMMAND: &str = "sudo pacman -S ffmpeg whisper.cpp";

fn command_in_path(program: &str) -> Option<PathBuf> {
    let path = Path::new(program);
    if path.components().count() > 1 {
        return path.exists().then(|| path.to_path_buf());
    }
    let paths = env::var_os("PATH")?;
    env::split_paths(&paths)
        .map(|directory| directory.join(program))
        .find(|candidate| candidate.is_file())
}

fn audio_extension_from_mime(mime_type: Option<&str>) -> &'static str {
    match mime_type
        .unwrap_or_default()
        .split(';')
        .next()
        .unwrap_or_default()
    {
        "audio/wav" | "audio/wave" | "audio/x-wav" => "wav",
        "audio/ogg" => "ogg",
        "audio/mp4" | "audio/aac" => "m4a",
        "audio/mpeg" => "mp3",
        _ => "webm",
    }
}

fn voice_result(
    status: VoiceTranscriptionResultStatus,
    text: Option<String>,
    message: &str,
    backend: Option<&str>,
    command: Option<&str>,
    technical_details: Option<String>,
) -> VoiceTranscriptionResult {
    VoiceTranscriptionResult {
        status,
        text,
        message: message.to_owned(),
        backend: backend.map(str::to_owned),
        command: command.map(str::to_owned),
        technical_details,
    }
}

fn missing_transcription_backend_result(detail: Option<String>) -> VoiceTranscriptionResult {
    voice_result(
        VoiceTranscriptionResultStatus::MissingBackend,
        None,
        "Nenhum backend local de transcrição foi encontrado ou ficou configurado. Instale whisper.cpp e ffmpeg, depois aponte WHISPER_CPP_MODEL para um modelo local em ~/.codex/models.",
        None,
        Some(STT_INSTALL_COMMAND),
        detail,
    )
}

fn ffmpeg_convert_to_wav(input: &Path, temp_dir: &Path) -> Result<PathBuf, String> {
    let ffmpeg = command_in_path("ffmpeg").ok_or_else(|| "ffmpeg não está no PATH.".to_owned())?;
    let output_path = temp_dir.join("audio.wav");
    let output = Command::new(ffmpeg)
        .arg("-y")
        .arg("-i")
        .arg(input)
        .arg("-ar")
        .arg("16000")
        .arg("-ac")
        .arg("1")
        .arg(&output_path)
        .output()
        .map_err(|error| format!("falha ao executar ffmpeg: {error}"))?;
    if output.status.success() && output_path.is_file() {
        return Ok(output_path);
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    Err(if stderr.is_empty() {
        "ffmpeg não conseguiu converter o áudio.".to_owned()
    } else {
        stderr
    })
}

fn configured_model_path(raw: Option<&str>) -> Option<PathBuf> {
    let value = raw.map(str::trim).filter(|value| !value.is_empty())?;
    expand_user_path(value).ok().filter(|path| path.exists())
}

fn model_candidate(label: &str, path: PathBuf, source: &str) -> SttModelCandidate {
    let exists = path.exists();
    SttModelCandidate {
        label: label.to_owned(),
        path: path.to_string_lossy().to_string(),
        source: source.to_owned(),
        exists,
    }
}

fn stt_model_candidates(configured: Option<&str>) -> Vec<SttModelCandidate> {
    let mut candidates = Vec::new();
    if let Some(path) = configured
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .and_then(|value| expand_user_path(value).ok())
    {
        candidates.push(model_candidate("Configurado", path, "config"));
    }

    for key in [
        "WHISPER_CPP_MODEL",
        "WHISPER_MODEL",
        "FASTER_WHISPER_MODEL",
        "VOSK_MODEL",
    ] {
        if let Some(path) = env::var_os(key).map(PathBuf::from) {
            candidates.push(model_candidate(key, path, "environment"));
        }
    }

    if let Ok(home) = home_dir() {
        let fixed = [
            home.join(".codex/models/ggml-small.bin"),
            home.join(".codex/models/ggml-base.bin"),
            home.join(".codex/models/ggml-tiny.bin"),
            home.join(".local/share/whisper.cpp/ggml-small.bin"),
            home.join(".local/share/whisper.cpp/ggml-base.bin"),
            home.join(".local/share/whisper.cpp/ggml-tiny.bin"),
        ];
        for path in fixed {
            let label = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("Modelo Whisper")
                .to_owned();
            candidates.push(model_candidate(&label, path, "default"));
        }

        let models_dir = home.join(".codex/models");
        if let Ok(entries) = fs::read_dir(models_dir) {
            for path in entries.flatten().map(|entry| entry.path()).take(40) {
                let extension = path.extension().and_then(|extension| extension.to_str());
                let looks_like_model = path.is_dir()
                    || matches!(extension, Some("bin" | "gguf" | "pt" | "onnx" | "tflite"));
                if !looks_like_model {
                    continue;
                }
                let label = path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("Modelo local")
                    .to_owned();
                candidates.push(model_candidate(&label, path, "~/.codex/models"));
            }
        }
    }

    let mut deduped = Vec::new();
    for candidate in candidates {
        if deduped
            .iter()
            .any(|existing: &SttModelCandidate| existing.path == candidate.path)
        {
            continue;
        }
        deduped.push(candidate);
    }
    deduped
}

fn whisper_cpp_model_path(configured: Option<&str>) -> Option<PathBuf> {
    if let Some(path) = configured_model_path(configured).filter(|path| path.is_file()) {
        return Some(path);
    }
    for key in ["WHISPER_CPP_MODEL", "WHISPER_MODEL"] {
        if let Some(path) = env::var_os(key)
            .map(PathBuf::from)
            .filter(|path| path.is_file())
        {
            return Some(path);
        }
    }
    let home = home_dir().ok()?;
    [
        home.join(".codex/models/ggml-small.bin"),
        home.join(".codex/models/ggml-base.bin"),
        home.join(".codex/models/ggml-tiny.bin"),
        home.join(".local/share/whisper.cpp/ggml-small.bin"),
        home.join(".local/share/whisper.cpp/ggml-base.bin"),
        home.join(".local/share/whisper.cpp/ggml-tiny.bin"),
    ]
    .into_iter()
    .find(|path| path.is_file())
}

fn faster_whisper_local_model(configured: Option<&str>) -> Option<PathBuf> {
    configured_model_path(configured)
        .or_else(|| env::var_os("FASTER_WHISPER_MODEL").map(PathBuf::from))
        .filter(|path| path.exists())
}

fn vosk_local_model(configured: Option<&str>) -> Option<PathBuf> {
    configured_model_path(configured)
        .or_else(|| env::var_os("VOSK_MODEL").map(PathBuf::from))
        .filter(|path| path.exists())
}

fn tool_status(
    id: &str,
    label: &str,
    binary: Option<PathBuf>,
    ready: bool,
    message: &str,
) -> SttToolStatus {
    SttToolStatus {
        id: id.to_owned(),
        label: label.to_owned(),
        installed: binary.is_some(),
        path: binary.map(|path| path.to_string_lossy().to_string()),
        ready,
        message: message.to_owned(),
    }
}

fn stt_config_snapshot(model_path_input: Option<&str>) -> AppResult<LocalSttConfigSnapshot> {
    let ffmpeg_binary = command_in_path("ffmpeg");
    let ffmpeg = tool_status(
        "ffmpeg",
        "ffmpeg",
        ffmpeg_binary.clone(),
        ffmpeg_binary.is_some(),
        if ffmpeg_binary.is_some() {
            "ffmpeg disponível para converter áudio."
        } else {
            "ffmpeg ausente; instale antes de transcrever áudio gravado."
        },
    );
    let model_candidates = stt_model_candidates(model_path_input);
    let selected_model = model_path_input
        .and_then(|path| configured_model_path(Some(path)))
        .or_else(|| {
            model_candidates
                .iter()
                .find(|candidate| candidate.exists)
                .map(|candidate| PathBuf::from(&candidate.path))
        });
    let model_exists = selected_model.as_ref().is_some_and(|path| path.exists());

    let whisper_cli_binary = command_in_path("whisper-cli");
    let whisper_cpp_binary = command_in_path("whisper.cpp");
    let whisper_cli_ready = whisper_cli_binary.is_some()
        && whisper_cpp_model_path(model_path_input).is_some()
        && ffmpeg.installed;
    let whisper_cpp_ready = whisper_cpp_binary.is_some()
        && whisper_cpp_model_path(model_path_input).is_some()
        && ffmpeg.installed;
    let openai_whisper_binary = command_in_path("whisper");
    let openai_whisper_ready = openai_whisper_binary.is_some()
        && openai_whisper_cached_model().is_some()
        && ffmpeg.installed;
    let faster_binary = command_in_path("faster-whisper");
    let faster_ready = faster_binary.is_some()
        && faster_whisper_local_model(model_path_input).is_some()
        && ffmpeg.installed;
    let vosk_binary = command_in_path("vosk-transcriber").or_else(|| command_in_path("vosk"));
    let vosk_ready =
        vosk_binary.is_some() && vosk_local_model(model_path_input).is_some() && ffmpeg.installed;

    let backends = vec![
        tool_status(
            "whisper-cli",
            "whisper-cli",
            whisper_cli_binary,
            whisper_cli_ready,
            if whisper_cli_ready {
                "whisper-cli pronto com modelo local."
            } else {
                "Requer binário whisper-cli, ffmpeg e modelo .bin/.gguf local."
            },
        ),
        tool_status(
            "whisper.cpp",
            "whisper.cpp",
            whisper_cpp_binary,
            whisper_cpp_ready,
            if whisper_cpp_ready {
                "whisper.cpp pronto com modelo local."
            } else {
                "Requer binário whisper.cpp, ffmpeg e modelo .bin/.gguf local."
            },
        ),
        tool_status(
            "whisper",
            "OpenAI Whisper local",
            openai_whisper_binary,
            openai_whisper_ready,
            if openai_whisper_ready {
                "whisper Python pronto com modelo em cache."
            } else {
                "Requer binário whisper e modelo já baixado em ~/.cache/whisper."
            },
        ),
        tool_status(
            "faster-whisper",
            "faster-whisper",
            faster_binary,
            faster_ready,
            if faster_ready {
                "faster-whisper pronto com modelo local."
            } else {
                "Requer faster-whisper e FASTER_WHISPER_MODEL ou caminho configurado."
            },
        ),
        tool_status(
            "vosk",
            "Vosk",
            vosk_binary,
            vosk_ready,
            if vosk_ready {
                "Vosk pronto com modelo local."
            } else {
                "Requer vosk-transcriber/vosk e VOSK_MODEL ou caminho configurado."
            },
        ),
    ];
    let ready = ffmpeg.installed && backends.iter().any(|backend| backend.ready);
    let message = if ready {
        "Transcrição local pronta para teste.".to_owned()
    } else if !ffmpeg.installed {
        format!("Backend incompleto: instale os pacotes sugeridos ({STT_INSTALL_COMMAND}).")
    } else if backends.iter().all(|backend| !backend.installed) {
        format!("Nenhum backend STT local encontrado. Sugestão Arch: {STT_INSTALL_COMMAND}.")
    } else if !model_exists {
        "Backend encontrado, mas nenhum modelo local foi detectado. Escolha um caminho de modelo em ~/.codex/models.".to_owned()
    } else {
        "Backend encontrado, mas ainda não está pronto para transcrição local.".to_owned()
    };

    Ok(LocalSttConfigSnapshot {
        ffmpeg,
        backends,
        model_path: selected_model.map(|path| path.to_string_lossy().to_string()),
        model_exists,
        model_candidates,
        ready,
        install_command: STT_INSTALL_COMMAND.to_owned(),
        message,
        checked_at: crate::models::now_iso(),
    })
}

fn clean_transcript_output(raw: &str) -> String {
    let without_timestamps = regex::Regex::new(r"(?m)^\s*\[[^\]]+\]\s*")
        .ok()
        .map(|pattern| pattern.replace_all(raw, "").to_string())
        .unwrap_or_else(|| raw.to_owned());
    without_timestamps
        .lines()
        .map(str::trim)
        .filter(|line| {
            !line.is_empty()
                && !line.starts_with("whisper_")
                && !line.starts_with("system_info:")
                && !line.starts_with("main:")
        })
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_owned()
}

fn read_first_txt_file(directory: &Path) -> Option<String> {
    fs::read_dir(directory)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| path.extension().and_then(|ext| ext.to_str()) == Some("txt"))
        .and_then(|path| fs::read_to_string(path).ok())
        .map(|text| clean_transcript_output(&text))
        .filter(|text| !text.is_empty())
}

fn openai_whisper_cached_model() -> Option<String> {
    let cache_dir = home_dir().ok()?.join(".cache/whisper");
    let preferred = ["turbo", "small", "base", "tiny"];
    for name in preferred {
        if cache_dir.join(format!("{name}.pt")).is_file() {
            return Some(name.to_owned());
        }
    }
    fs::read_dir(cache_dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| path.extension().and_then(|extension| extension.to_str()) == Some("pt"))
        .and_then(|path| {
            path.file_stem()
                .and_then(|stem| stem.to_str())
                .map(str::to_owned)
        })
}

fn run_whisper_cpp(audio_path: &Path, model_path: Option<&str>) -> Result<Option<String>, String> {
    let Some(binary) = command_in_path("whisper-cli").or_else(|| command_in_path("whisper.cpp"))
    else {
        return Ok(None);
    };
    let Some(model) = whisper_cpp_model_path(model_path) else {
        return Err("whisper-cli encontrado, mas nenhum modelo local foi encontrado. Defina WHISPER_CPP_MODEL ou coloque ggml-base.bin em ~/.codex/models.".to_owned());
    };
    let output = Command::new(binary)
        .arg("-m")
        .arg(model)
        .arg("-f")
        .arg(audio_path)
        .arg("-l")
        .arg("pt")
        .arg("-nt")
        .output()
        .map_err(|error| format!("falha ao executar whisper-cli: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let text = clean_transcript_output(if stdout.trim().is_empty() {
        &stderr
    } else {
        &stdout
    });
    if output.status.success() && !text.is_empty() {
        Ok(Some(text))
    } else {
        Err(format!(
            "whisper-cli falhou: {}",
            stderr.trim().lines().last().unwrap_or("sem detalhe")
        ))
    }
}

fn run_openai_whisper(audio_path: &Path, temp_dir: &Path) -> Result<Option<String>, String> {
    let Some(binary) = command_in_path("whisper") else {
        return Ok(None);
    };
    let Some(model_name) = openai_whisper_cached_model() else {
        return Err("whisper encontrado, mas nenhum modelo local foi encontrado em ~/.cache/whisper; não baixei modelo automaticamente.".to_owned());
    };
    let output_dir = temp_dir.join("whisper-output");
    fs::create_dir_all(&output_dir)
        .map_err(|error| format!("falha ao criar saída whisper: {error}"))?;
    let output = Command::new(binary)
        .arg(audio_path)
        .arg("--model")
        .arg(model_name)
        .arg("--language")
        .arg("Portuguese")
        .arg("--task")
        .arg("transcribe")
        .arg("--fp16")
        .arg("False")
        .arg("--output_format")
        .arg("txt")
        .arg("--output_dir")
        .arg(&output_dir)
        .output()
        .map_err(|error| format!("falha ao executar whisper: {error}"))?;
    if let Some(text) = read_first_txt_file(&output_dir) {
        return Ok(Some(text));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let text = clean_transcript_output(&stdout);
    if output.status.success() && !text.is_empty() {
        Ok(Some(text))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "whisper falhou: {}",
            stderr.trim().lines().last().unwrap_or("sem detalhe")
        ))
    }
}

fn run_faster_whisper(
    audio_path: &Path,
    temp_dir: &Path,
    model_path: Option<&str>,
) -> Result<Option<String>, String> {
    let Some(binary) = command_in_path("faster-whisper") else {
        return Ok(None);
    };
    let Some(model_path) = faster_whisper_local_model(model_path) else {
        return Err("faster-whisper encontrado, mas FASTER_WHISPER_MODEL não aponta para um modelo local; não baixei modelo automaticamente.".to_owned());
    };
    let output_dir = temp_dir.join("faster-whisper-output");
    fs::create_dir_all(&output_dir)
        .map_err(|error| format!("falha ao criar saída faster-whisper: {error}"))?;
    let output = Command::new(binary)
        .arg(audio_path)
        .arg("--model")
        .arg(model_path)
        .arg("--language")
        .arg("pt")
        .arg("--output_dir")
        .arg(&output_dir)
        .arg("--output_format")
        .arg("txt")
        .output()
        .map_err(|error| format!("falha ao executar faster-whisper: {error}"))?;
    if let Some(text) = read_first_txt_file(&output_dir) {
        return Ok(Some(text));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let text = clean_transcript_output(&stdout);
    if output.status.success() && !text.is_empty() {
        Ok(Some(text))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "faster-whisper falhou: {}",
            stderr.trim().lines().last().unwrap_or("sem detalhe")
        ))
    }
}

fn run_vosk_transcriber(
    audio_path: &Path,
    model_path: Option<&str>,
) -> Result<Option<String>, String> {
    let Some(binary) = command_in_path("vosk-transcriber").or_else(|| command_in_path("vosk"))
    else {
        return Ok(None);
    };
    let mut command = Command::new(binary);
    if let Some(model) = vosk_local_model(model_path) {
        command.arg("-m").arg(model);
    }
    let output = command
        .arg("-i")
        .arg(audio_path)
        .output()
        .map_err(|error| format!("falha ao executar vosk-transcriber/vosk: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let text = clean_transcript_output(&stdout);
    if output.status.success() && !text.is_empty() {
        Ok(Some(text))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "vosk-transcriber falhou: {}",
            stderr.trim().lines().last().unwrap_or("sem detalhe")
        ))
    }
}

#[tauri::command]
pub fn get_stt_config_state(
    model_path: Option<String>,
) -> Result<LocalSttConfigSnapshot, ErrorPayload> {
    stt_config_snapshot(model_path.as_deref()).map_err(map_err)
}

#[tauri::command]
pub fn transcribe_audio(
    audio_bytes: Vec<u8>,
    mime_type: Option<String>,
    model_path: Option<String>,
) -> Result<VoiceTranscriptionResult, ErrorPayload> {
    if audio_bytes.is_empty() {
        return Ok(voice_result(
            VoiceTranscriptionResultStatus::Error,
            None,
            "Nenhum áudio foi recebido para transcrição.",
            None,
            None,
            None,
        ));
    }

    let temp_dir = env::temp_dir().join(format!("codex-voice-{}", Uuid::new_v4()));
    if let Err(error) = fs::create_dir_all(&temp_dir) {
        return Ok(voice_result(
            VoiceTranscriptionResultStatus::Error,
            None,
            "Não foi possível preparar arquivo temporário de áudio.",
            None,
            None,
            Some(error.to_string()),
        ));
    }

    let input_path = temp_dir.join(format!(
        "input.{}",
        audio_extension_from_mime(mime_type.as_deref())
    ));
    if let Err(error) = fs::write(&input_path, &audio_bytes) {
        let _ = fs::remove_dir_all(&temp_dir);
        return Ok(voice_result(
            VoiceTranscriptionResultStatus::Error,
            None,
            "Não foi possível salvar áudio temporário.",
            None,
            None,
            Some(error.to_string()),
        ));
    }

    let mut diagnostics = Vec::new();
    let audio_path = match ffmpeg_convert_to_wav(&input_path, &temp_dir) {
        Ok(path) => path,
        Err(error) => {
            diagnostics.push(error);
            input_path.clone()
        }
    };

    let attempts: [(&str, Result<Option<String>, String>); 1] = [(
        "whisper-cli",
        run_whisper_cpp(&audio_path, model_path.as_deref()),
    )];
    for (backend, attempt) in attempts {
        match attempt {
            Ok(Some(text)) => {
                let _ = fs::remove_dir_all(&temp_dir);
                return Ok(voice_result(
                    VoiceTranscriptionResultStatus::Done,
                    Some(text),
                    "Transcrição concluída.",
                    Some(backend),
                    None,
                    None,
                ));
            }
            Ok(None) => {}
            Err(error) => diagnostics.push(error),
        }
    }

    let attempts: [(&str, Result<Option<String>, String>); 1] =
        [("whisper", run_openai_whisper(&audio_path, &temp_dir))];
    for (backend, attempt) in attempts {
        match attempt {
            Ok(Some(text)) => {
                let _ = fs::remove_dir_all(&temp_dir);
                return Ok(voice_result(
                    VoiceTranscriptionResultStatus::Done,
                    Some(text),
                    "Transcrição concluída.",
                    Some(backend),
                    None,
                    None,
                ));
            }
            Ok(None) => {}
            Err(error) => diagnostics.push(error),
        }
    }

    let attempts: [(&str, Result<Option<String>, String>); 1] = [(
        "faster-whisper",
        run_faster_whisper(&audio_path, &temp_dir, model_path.as_deref()),
    )];
    for (backend, attempt) in attempts {
        match attempt {
            Ok(Some(text)) => {
                let _ = fs::remove_dir_all(&temp_dir);
                return Ok(voice_result(
                    VoiceTranscriptionResultStatus::Done,
                    Some(text),
                    "Transcrição concluída.",
                    Some(backend),
                    None,
                    None,
                ));
            }
            Ok(None) => {}
            Err(error) => diagnostics.push(error),
        }
    }

    let attempts: [(&str, Result<Option<String>, String>); 1] = [(
        "vosk-transcriber",
        run_vosk_transcriber(&audio_path, model_path.as_deref()),
    )];
    for (backend, attempt) in attempts {
        match attempt {
            Ok(Some(text)) => {
                let _ = fs::remove_dir_all(&temp_dir);
                return Ok(voice_result(
                    VoiceTranscriptionResultStatus::Done,
                    Some(text),
                    "Transcrição concluída.",
                    Some(backend),
                    None,
                    None,
                ));
            }
            Ok(None) => {}
            Err(error) => diagnostics.push(error),
        }
    }

    let detail = if diagnostics.is_empty() {
        None
    } else {
        Some(diagnostics.join("\n"))
    };
    let _ = fs::remove_dir_all(&temp_dir);
    Ok(missing_transcription_backend_result(detail))
}

#[tauri::command]
pub fn list_file_directory(path: Option<String>) -> Result<FileDirectoryListing, ErrorPayload> {
    let directory = resolve_existing_path(path.as_deref()).map_err(map_err)?;
    let metadata = fs::metadata(&directory)
        .map_err(AppError::from)
        .map_err(map_err)?;
    if !metadata.is_dir() {
        return Err(map_err(AppError::Message(
            "O caminho informado não é uma pasta.".to_owned(),
        )));
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(&directory)
        .map_err(AppError::from)
        .map_err(map_err)?
        .flatten()
    {
        if let Ok(entry) = file_entry_from_path(&entry.path()) {
            entries.push(entry);
        }
        if entries.len() > FILE_BROWSER_MAX_ENTRIES {
            break;
        }
    }

    let truncated = entries.len() > FILE_BROWSER_MAX_ENTRIES;
    entries.truncate(FILE_BROWSER_MAX_ENTRIES);
    entries.sort_by(|left, right| {
        right
            .is_directory
            .cmp(&left.is_directory)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    Ok(FileDirectoryListing {
        path: directory.to_string_lossy().to_string(),
        parent_path: directory
            .parent()
            .map(|parent| parent.to_string_lossy().to_string()),
        entries,
        shortcuts: file_shortcuts().map_err(map_err)?,
        truncated,
    })
}

#[tauri::command]
pub fn get_file_attachment(path: String) -> Result<SelectedFileAttachment, ErrorPayload> {
    let resolved = resolve_existing_path(Some(&path)).map_err(map_err)?;
    let metadata = fs::metadata(&resolved)
        .map_err(AppError::from)
        .map_err(map_err)?;
    let is_directory = metadata.is_dir();
    let kind = detect_file_kind(&resolved, is_directory);
    let (preview, preview_kind, preview_truncated) = if is_directory {
        (None, None, false)
    } else {
        match kind {
            FileEntryKind::Text | FileEntryKind::Json | FileEntryKind::Code => {
                let (preview, truncated) =
                    read_text_preview(&resolved, &metadata).map_err(map_err)?;
                (Some(preview), Some(FilePreviewKind::Text), truncated)
            }
            FileEntryKind::Pdf => {
                let (preview, preview_kind, truncated) = pdf_preview(&resolved);
                (preview, Some(preview_kind), truncated)
            }
            FileEntryKind::Zip => {
                let (preview, preview_kind, truncated) = zip_preview(&resolved);
                (preview, Some(preview_kind), truncated)
            }
            _ => (None, Some(FilePreviewKind::Unavailable), false),
        }
    };

    let name = resolved
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_owned)
        .unwrap_or_else(|| resolved.to_string_lossy().to_string());

    Ok(SelectedFileAttachment {
        name,
        path: resolved.to_string_lossy().to_string(),
        kind,
        extension: path_extension(&resolved),
        is_directory,
        size: if is_directory {
            None
        } else {
            Some(metadata.len())
        },
        modified_at: modified_iso(&metadata),
        preview,
        preview_kind,
        preview_truncated,
    })
}

#[cfg(test)]
mod file_browser_tests {
    use super::*;

    fn temp_file_browser_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("codex-file-browser-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("deve criar diretório temporário");
        dir
    }

    #[test]
    fn list_file_directory_returns_entries_and_metadata() {
        let dir = temp_file_browser_dir();
        let nested = dir.join("nested");
        fs::create_dir_all(&nested).expect("deve criar subpasta");
        fs::write(dir.join("notes.md"), "conteúdo de teste").expect("deve criar arquivo");

        let listing = list_file_directory(Some(dir.to_string_lossy().to_string()))
            .expect("deve listar pasta");

        assert_eq!(listing.path, dir.canonicalize().unwrap().to_string_lossy());
        assert!(listing
            .entries
            .iter()
            .any(|entry| entry.name == "nested" && entry.is_directory));
        assert!(listing
            .entries
            .iter()
            .any(|entry| entry.name == "notes.md" && !entry.is_directory));
        assert!(listing
            .shortcuts
            .iter()
            .any(|shortcut| shortcut.id == "home"));

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn get_file_attachment_reads_limited_text_preview() {
        let dir = temp_file_browser_dir();
        let file = dir.join("notes.md");
        fs::write(&file, "linha 1\nlinha 2").expect("deve criar arquivo");

        let attachment =
            get_file_attachment(file.to_string_lossy().to_string()).expect("deve resolver anexo");

        assert_eq!(attachment.name, "notes.md");
        assert_eq!(attachment.kind, FileEntryKind::Text);
        assert_eq!(attachment.preview_kind, Some(FilePreviewKind::Text));
        assert!(attachment.preview.unwrap_or_default().contains("linha 1"));
        assert!(!attachment.preview_truncated);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn get_file_attachment_rejects_invalid_path() {
        let result = get_file_attachment("/path/que/nao/existe/passada-06".to_owned());
        assert!(result.is_err());
    }
}

fn actionable_error(
    code: &str,
    severity: ActionableErrorSeverity,
    message: &str,
    action_label: &str,
    technical_details: Option<String>,
) -> ActionableError {
    ActionableError {
        code: code.to_owned(),
        severity,
        message: message.to_owned(),
        action_label: Some(action_label.to_owned()),
        action_target: None,
        technical_details,
    }
}

#[tauri::command]
pub fn list_sessions(
    state: State<AppState>,
) -> Result<Vec<crate::models::AgentSession>, ErrorPayload> {
    Ok(state.session_manager.list_sessions())
}

#[tauri::command]
pub fn list_pending_permissions(
    state: State<AppState>,
) -> Result<Vec<crate::models::PermissionRequest>, ErrorPayload> {
    Ok(state.permission_manager.list_pending())
}

#[tauri::command]
pub fn list_privileged_actions() -> Result<Vec<PrivilegedActionSpec>, ErrorPayload> {
    Ok(privileged_actions::catalog())
}

#[tauri::command]
pub async fn test_provider_connection(
    state: State<'_, AppState>,
    provider_id: String,
) -> Result<ProviderRuntimeStatus, ErrorPayload> {
    let status = state
        .provider_registry
        .test_connection(&provider_id)
        .await
        .map_err(map_err)?;
    state
        .credential_store
        .mark_provider_test_result(&provider_id, &status)
        .map_err(map_err)?;
    Ok(status)
}

#[tauri::command]
pub async fn get_local_runtime_state(
    state: State<'_, AppState>,
) -> Result<LocalRuntimeSnapshot, ErrorPayload> {
    let settings = state.settings();
    Ok(state.local_runtime_service.snapshot(&settings).await)
}

#[tauri::command]
pub async fn start_local_runtime(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<LocalRuntimeSnapshot, ErrorPayload> {
    let settings = state.settings();
    let snapshot = state
        .local_runtime_service
        .start_runtime(&settings)
        .await
        .map_err(map_err)?;
    let _ = app.emit("local-runtime-state", snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
pub fn list_provider_credentials(
    state: State<AppState>,
) -> Result<Vec<ProviderCredentialStatus>, ErrorPayload> {
    let ids = state
        .provider_registry
        .providers()
        .into_iter()
        .filter(|provider| provider.configurable)
        .map(|provider| provider.id)
        .collect::<Vec<_>>();
    Ok(state.credential_store.statuses(&ids))
}

#[tauri::command]
pub fn list_provider_profiles(
    state: State<AppState>,
) -> Result<Vec<ProviderAccountProfile>, ErrorPayload> {
    let providers = state.provider_registry.providers();
    Ok(state.credential_store.account_profiles(&providers))
}

#[tauri::command]
pub fn save_provider_credential(
    state: State<AppState>,
    provider_id: String,
    key: String,
) -> Result<ProviderCredentialStatus, ErrorPayload> {
    state
        .credential_store
        .save(&provider_id, &key)
        .map_err(map_err)
}

#[tauri::command]
pub fn save_provider_profile_credential(
    state: State<AppState>,
    provider_id: String,
    profile_id: Option<String>,
    name: String,
    key: String,
    make_default: bool,
) -> Result<ProviderAccountProfile, ErrorPayload> {
    state
        .credential_store
        .save_profile(
            &provider_id,
            profile_id.as_deref(),
            &name,
            &key,
            make_default,
        )
        .map_err(map_err)
}

#[tauri::command]
pub fn save_credential(
    state: State<AppState>,
    provider_id: String,
    profile_id: Option<String>,
    name: String,
    key: String,
    make_default: bool,
) -> Result<ProviderAccountProfile, ErrorPayload> {
    save_provider_profile_credential(state, provider_id, profile_id, name, key, make_default)
}

#[tauri::command]
pub fn remove_provider_profile(
    state: State<AppState>,
    profile_id: String,
) -> Result<(), ErrorPayload> {
    state
        .credential_store
        .remove_profile(&profile_id)
        .map_err(map_err)
}

#[tauri::command]
pub fn set_default_provider_profile(
    state: State<AppState>,
    provider_id: String,
    profile_id: String,
) -> Result<(), ErrorPayload> {
    state
        .credential_store
        .set_default_profile(&provider_id, &profile_id)
        .map_err(map_err)
}

#[tauri::command]
pub fn rename_provider_profile(
    state: State<AppState>,
    profile_id: String,
    name: String,
) -> Result<(), ErrorPayload> {
    state
        .credential_store
        .rename_profile(&profile_id, &name)
        .map_err(map_err)
}

#[tauri::command]
pub fn remove_provider_credential(
    state: State<AppState>,
    provider_id: String,
) -> Result<ProviderCredentialStatus, ErrorPayload> {
    state.credential_store.remove(&provider_id).map_err(map_err)
}

#[tauri::command]
pub async fn get_app_health_check(
    state: State<'_, AppState>,
) -> Result<AppHealthCheck, ErrorPayload> {
    let settings = state.settings();
    let base_dir = settings.workspace_root.clone();
    let expected_base_dir = state
        .config_manager
        .home_dir()
        .join("Codex-Codex")
        .to_string_lossy()
        .to_string();
    let providers = state
        .provider_registry
        .providers()
        .into_iter()
        .map(|provider| {
            let profile_count = state
                .credential_store
                .account_profiles(&[provider.clone()])
                .len();
            AppHealthProvider {
                has_key: state.credential_store.exists(&provider.id),
                status: provider.status,
                id: provider.id,
                profile_count: Some(profile_count),
                selected_profile_id: settings.selected_provider_profile_id.clone(),
            }
        })
        .collect::<Vec<_>>();
    let ollama = state.local_runtime_service.snapshot(&settings).await;
    let branch =
        git_output(&base_dir, ["branch", "--show-current"]).filter(|value| !value.is_empty());
    let node_ok = command_ok("node", ["--version"]);
    let npm_ok = command_ok("npm", ["--version"]);
    let cargo_ok = command_ok("cargo", ["--version"]);
    let tauri_ok = command_ok("npm", ["run", "tauri", "--", "--version"]);
    let correct_base_dir = base_dir == expected_base_dir;

    let mut actions = Vec::new();
    let mut recent_errors = Vec::new();
    if !correct_base_dir {
        actions.push(AppHealthAction {
            label: "Abrir ~/Codex-Codex".to_owned(),
            command: Some(format!("cd {expected_base_dir}")),
        });
        recent_errors.push(actionable_error(
            "wrong_workspace",
            ActionableErrorSeverity::Error,
            "Workspace ativo não é ~/Codex-Codex.",
            "Corrigir base",
            Some(format!("base atual: {base_dir}")),
        ));
    }

    for provider in &providers {
        if !matches!(provider.status.state, ProviderStatusState::Ready) {
            actions.push(AppHealthAction {
                label: format!("Configurar {}", provider.id),
                command: provider.status.command.clone(),
            });
        }
    }

    for action in &ollama.repair_actions {
        actions.push(AppHealthAction {
            label: action.clone(),
            command: Some(action.clone()),
        });
    }

    let has_error = !correct_base_dir
        || !node_ok
        || !npm_ok
        || !cargo_ok
        || matches!(ollama.state, crate::models::LocalRuntimeState::Error);
    let has_warning = !actions.is_empty()
        || !tauri_ok
        || !matches!(ollama.state, crate::models::LocalRuntimeState::Ready);
    let overall_status = if has_error {
        AppHealthOverallStatus::Error
    } else if has_warning {
        AppHealthOverallStatus::Warning
    } else {
        AppHealthOverallStatus::Ok
    };

    Ok(AppHealthCheck {
        base_dir,
        expected_base_dir,
        correct_base_dir,
        branch,
        node_ok,
        npm_ok,
        cargo_ok,
        tauri_ok,
        providers,
        ollama,
        sessions_count: Some(state.session_manager.list_sessions().len()),
        active_session_id: None,
        storage_root: Some(
            state
                .config_manager
                .sessions_dir()
                .to_string_lossy()
                .to_string(),
        ),
        credentials_encrypted: Some(false),
        recent_errors,
        overall_status,
        actions,
    })
}

#[tauri::command]
pub async fn install_local_runtime(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<LocalRuntimeSnapshot, ErrorPayload> {
    let settings = state.settings();
    let snapshot = state
        .local_runtime_service
        .install_runtime(&settings)
        .await
        .map_err(map_err)?;
    let _ = app.emit("local-runtime-state", snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
pub async fn install_local_model(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: String,
) -> Result<LocalRuntimeSnapshot, ErrorPayload> {
    let settings = state.settings();
    let snapshot = state
        .local_runtime_service
        .install_model(
            &settings,
            &model_id,
            |progress: LocalModelInstallProgress| {
                let _ = app.emit("local-model-progress", progress);
            },
        )
        .await
        .map_err(map_err)?;

    let _ = app.emit("local-runtime-state", snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
pub async fn remove_local_model(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: String,
) -> Result<LocalRuntimeSnapshot, ErrorPayload> {
    let settings = state.settings();
    let snapshot = state
        .local_runtime_service
        .remove_model(&settings, &model_id)
        .await
        .map_err(map_err)?;
    let _ = app.emit("local-runtime-state", snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
pub fn create_session(
    app: AppHandle,
    state: State<AppState>,
    title: String,
) -> Result<crate::models::AgentSession, ErrorPayload> {
    let session = state
        .session_manager
        .create_session(&title)
        .map_err(map_err)?;
    let _ = app.emit("session-changed", session.clone());
    Ok(session)
}

#[tauri::command]
pub fn rename_session(
    app: AppHandle,
    state: State<AppState>,
    session_id: String,
    title: String,
) -> Result<crate::models::AgentSession, ErrorPayload> {
    let session = state
        .session_manager
        .rename_session(&session_id, &title)
        .map_err(map_err)?;
    let _ = app.emit("session-changed", session.clone());
    Ok(session)
}

#[tauri::command]
pub fn delete_session(state: State<AppState>, session_id: String) -> Result<(), ErrorPayload> {
    state
        .session_manager
        .delete_session(&session_id)
        .map_err(map_err)
}

#[tauri::command]
pub fn archive_session(
    app: AppHandle,
    state: State<AppState>,
    session_id: String,
) -> Result<AgentSession, ErrorPayload> {
    let session = state
        .session_manager
        .archive_session(&session_id)
        .map_err(map_err)?;
    let _ = app.emit("session-changed", session.clone());
    Ok(session)
}

#[tauri::command]
pub fn restore_session(
    app: AppHandle,
    state: State<AppState>,
    session_id: String,
) -> Result<AgentSession, ErrorPayload> {
    let session = state
        .session_manager
        .restore_session(&session_id)
        .map_err(map_err)?;
    let _ = app.emit("session-changed", session.clone());
    Ok(session)
}

#[tauri::command]
pub fn list_archived_sessions(state: State<AppState>) -> Vec<AgentSession> {
    state.session_manager.list_archived_sessions()
}

#[tauri::command]
pub fn archive_all_sessions(
    app: AppHandle,
    state: State<AppState>,
) -> Result<Vec<AgentSession>, ErrorPayload> {
    let archived = state
        .session_manager
        .archive_all_sessions()
        .map_err(map_err)?;
    for session in &archived {
        let _ = app.emit("session-changed", session.clone());
    }
    Ok(state.session_manager.list_sessions())
}

#[tauri::command]
pub fn delete_all_sessions(app: AppHandle, state: State<AppState>) -> Result<usize, ErrorPayload> {
    let sessions = state.session_manager.list_all_sessions();
    let count = state
        .session_manager
        .delete_all_sessions()
        .map_err(map_err)?;
    for session in sessions {
        let _ = app.emit("session-deleted", session.id);
    }
    Ok(count)
}

#[tauri::command]
pub fn duplicate_session(
    app: AppHandle,
    state: State<AppState>,
    session_id: String,
) -> Result<crate::models::AgentSession, ErrorPayload> {
    let session = state
        .session_manager
        .duplicate_session(&session_id)
        .map_err(map_err)?;
    let _ = app.emit("session-changed", session.clone());
    Ok(session)
}

#[tauri::command]
pub fn export_session(
    state: State<AppState>,
    session_id: String,
    format: SessionExportFormat,
) -> Result<SessionExportResult, ErrorPayload> {
    state
        .session_manager
        .export_session(&session_id, format)
        .map_err(map_err)
}

#[tauri::command]
pub fn export_all_conversations(
    state: State<AppState>,
) -> Result<SessionExportResult, ErrorPayload> {
    state
        .session_manager
        .export_all_conversations()
        .map_err(map_err)
}

#[tauri::command]
pub fn import_conversations(
    app: AppHandle,
    state: State<AppState>,
    path: String,
) -> Result<ConversationImportResult, ErrorPayload> {
    let file = expand_user_path(&path).map_err(map_err)?;
    if !file.is_file() {
        return Err(map_err(AppError::Message(
            "Arquivo JSON de conversas não encontrado.".to_owned(),
        )));
    }
    let result = state
        .session_manager
        .import_conversations_from_file(&file)
        .map_err(map_err)?;
    for session in &result.sessions {
        let _ = app.emit("session-changed", session.clone());
    }
    Ok(result)
}

#[tauri::command]
pub fn update_session_environment(
    app: AppHandle,
    state: State<AppState>,
    session_id: String,
    provider_id: String,
    model_id: String,
    agent_profile_id: String,
    account_profile_id: Option<String>,
) -> Result<AgentSession, ErrorPayload> {
    let session = state
        .session_manager
        .update_environment(
            &session_id,
            provider_id,
            model_id,
            agent_profile_id,
            account_profile_id,
        )
        .map_err(map_err)?;
    let _ = app.emit("session-changed", session.clone());
    Ok(session)
}

#[tauri::command]
pub fn apply_environment_to_all_sessions(
    app: AppHandle,
    state: State<AppState>,
    provider_id: String,
    model_id: String,
    agent_profile_id: String,
    account_profile_id: Option<String>,
) -> Result<Vec<AgentSession>, ErrorPayload> {
    let sessions = state
        .session_manager
        .apply_environment_to_all(provider_id, model_id, agent_profile_id, account_profile_id)
        .map_err(map_err)?;
    for session in &sessions {
        let _ = app.emit("session-changed", session.clone());
    }
    Ok(sessions)
}

#[tauri::command]
pub fn append_user_message(
    app: AppHandle,
    state: State<AppState>,
    session_id: String,
    content: String,
) -> Result<crate::models::AgentSession, ErrorPayload> {
    let session = state
        .session_manager
        .append_user_message(&session_id, &content)
        .map_err(map_err)?;
    let _ = app.emit("session-changed", session.clone());
    Ok(session)
}

#[tauri::command]
pub async fn send_order_to_agent(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    content: String,
    mode: Option<String>,
    attachments: Option<Vec<Value>>,
) -> Result<AgentSession, ErrorPayload> {
    let _mode = mode;
    run_agent_order(
        Some(&app),
        state.session_manager.clone(),
        state.provider_registry.clone(),
        state.settings(),
        session_id,
        content,
        attachments.unwrap_or_default(),
    )
    .await
    .map_err(map_err)
}

fn attachment_text(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(redact_secret_like)
}

fn attachment_context(attachments: &[Value]) -> String {
    if attachments.is_empty() {
        return String::new();
    }

    let mut blocks = Vec::new();
    for attachment in attachments {
        let name = attachment_text(attachment, "name").unwrap_or_else(|| "arquivo".to_owned());
        let path = attachment_text(attachment, "path")
            .unwrap_or_else(|| "caminho indisponível".to_owned());
        let kind = attachment_text(attachment, "kind").unwrap_or_else(|| "generic".to_owned());
        let mime = attachment_text(attachment, "mimeType");
        let size = attachment.get("size").and_then(Value::as_u64);
        let preview = attachment_text(attachment, "previewTextLimited");

        let mut lines = vec![
            format!("Nome: {name}"),
            format!("Caminho: {path}"),
            format!("Tipo: {kind}"),
        ];
        if let Some(mime) = mime {
            lines.push(format!("MIME: {mime}"));
        }
        if let Some(size) = size {
            lines.push(format!("Tamanho: {size} bytes"));
        }
        if let Some(preview) = preview {
            lines.push("Preview limitado para contexto oculto:".to_owned());
            lines.push(preview);
        }
        blocks.push(lines.join("\n"));
    }

    format!(
        "Anexos brutos/metadados recebidos pelo app. Não renderizar como texto da conversa; use path/metadados e ferramentas locais se precisar abrir.\n\n{}",
        blocks.join("\n\n")
    )
}

fn prompt_with_attachments(prompt: &str, attachments: &[Value]) -> String {
    let context = attachment_context(attachments);
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
    format!("{prompt}\n\n[preferência do usuário]\nResponda em: {label}.")
}

async fn run_agent_order(
    app: Option<&AppHandle>,
    session_manager: Arc<SessionManager>,
    provider_registry: Arc<ProviderRegistry>,
    settings: AppSettings,
    session_id: String,
    content: String,
    attachments: Vec<Value>,
) -> crate::error::AppResult<AgentSession> {
    let prompt = content.trim();
    if prompt.is_empty() && attachments.is_empty() {
        return Err(AppError::Message("Ordem vazia.".to_owned()));
    }
    let visible_prompt = if prompt.is_empty() {
        "Anexo enviado."
    } else {
        prompt
    };
    let provider_prompt = prompt_with_language_preference(
        &prompt_with_attachments(visible_prompt, &attachments),
        &settings.ai_response_language,
    );

    let session_environment = session_manager.get_session(&session_id).ok();
    let provider_id = session_environment
        .as_ref()
        .and_then(|session| session.provider_id.clone())
        .unwrap_or_else(|| settings.selected_provider_id.clone());
    let model_id = if let Some(model_id) = session_environment
        .as_ref()
        .and_then(|session| session.model_id.clone())
    {
        model_id
    } else if settings.execution_mode == crate::models::ExecutionMode::Local {
        settings
            .selected_local_model_id
            .clone()
            .unwrap_or_else(|| settings.selected_model_id.clone())
    } else {
        settings.selected_model_id.clone()
    };
    let agent_profile_id = session_environment
        .as_ref()
        .and_then(|session| session.agent_profile_id.clone())
        .unwrap_or_else(|| settings.selected_agent_id.clone());
    let account_profile_id = session_environment
        .as_ref()
        .and_then(|session| session.account_profile_id.clone())
        .or_else(|| settings.selected_provider_profile_id.clone());
    let session = session_manager.append_user_message_with_context(
        &session_id,
        visible_prompt,
        attachments.clone(),
        Some(provider_id.clone()),
        Some(model_id.clone()),
        Some(agent_profile_id),
        account_profile_id.clone(),
    )?;
    emit_session(app, &session);

    let provider_label = provider_registry
        .providers()
        .into_iter()
        .find(|provider| provider.id == provider_id)
        .map(|provider| provider.label)
        .unwrap_or_else(|| provider_id.clone());
    let provider_state = provider_registry
        .provider_status(&provider_id)
        .map(|status| format!("{:?}", status.state))
        .unwrap_or_else(|| "Unavailable".to_owned());

    if let Some(session) = session_manager.update_status(
        &session_id,
        SessionStatus::Executing,
        Some("Enviar ordem ao provider"),
        Some(TaskStatus::Running),
        Some(format!(
            "{provider_label} / {model_id} / estado: {provider_state}"
        )),
    )? {
        emit_session(app, &session);
    }

    emit_status_note(
        app,
        session_manager.make_status_note(
            &session_id,
            StatusKind::Info,
            "Provider em execução",
            &format!("{provider_label} receberá a ordem selecionada."),
        ),
    );

    let request = ProviderGenerateRequest {
        provider_id: provider_id.clone(),
        model_id: model_id.clone(),
        prompt: provider_prompt,
        attachments,
        workspace_root: settings.workspace_root,
        account_profile_id,
    };

    match provider_registry.generate_response(request).await {
        Ok(result) => {
            emit_provider_logs(app, &session_id, &result);
            emit_status_note(
                app,
                session_manager.make_status_note(
                    &session_id,
                    StatusKind::Success,
                    "Resposta do provider recebida",
                    result
                        .status
                        .command
                        .as_deref()
                        .unwrap_or("Provider sem comando externo."),
                ),
            );

            let session = session_manager
                .append_assistant_message(
                    &session_id,
                    &result.content,
                    Some(result.status.message),
                    SessionStatus::Idle,
                )?
                .ok_or_else(|| AppError::Message("Sessão não encontrada".to_owned()))?;
            emit_session(app, &session);
            Ok(session)
        }
        Err(cause) => {
            let detail = cause.to_string();
            emit_status_note(
                app,
                session_manager.make_status_note(
                    &session_id,
                    StatusKind::Error,
                    "Provider falhou",
                    &detail,
                ),
            );

            let message = provider_chat_error_message(&provider_label, &model_id, &detail);
            let session = session_manager
                .append_assistant_message(
                    &session_id,
                    &message,
                    Some(
                        "Falha controlada do provider; nenhuma resposta simulada foi usada."
                            .to_owned(),
                    ),
                    SessionStatus::Error,
                )?
                .ok_or_else(|| AppError::Message("Sessão não encontrada".to_owned()))?;
            emit_session(app, &session);
            Ok(session)
        }
    }
}

fn provider_chat_error_message(provider_label: &str, model_id: &str, detail: &str) -> String {
    let mut lines = detail
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter(|line| !line.starts_with('{') && !line.starts_with('['))
        .map(redact_secret_like)
        .collect::<Vec<_>>();

    if lines.is_empty() {
        lines.push("Erro de provider".to_owned());
        lines.push("Revise a conta ou modelo no Ambiente.".to_owned());
    }

    if !lines.iter().any(|line| line.starts_with("Provider:")) {
        lines.push(format!("Provider: {provider_label}"));
    }
    if !lines.iter().any(|line| line.starts_with("Modelo:")) {
        lines.push(format!("Modelo: {model_id}"));
    }

    lines.join("\n")
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

fn emit_session(app: Option<&AppHandle>, session: &AgentSession) {
    if let Some(app) = app {
        let _ = app.emit("session-changed", session.clone());
    }
}

fn emit_status_note(app: Option<&AppHandle>, note: crate::models::StatusNote) {
    if let Some(app) = app {
        let _ = app.emit("status-note", note);
    }
}

fn emit_provider_logs(
    app: Option<&AppHandle>,
    session_id: &str,
    result: &crate::models::ProviderRunResult,
) {
    let Some(app) = app else {
        return;
    };
    let execution_id = Uuid::new_v4().to_string();

    if let Some(command) = &result.command {
        let _ = app.emit(
            "command-log",
            CommandLogChunk {
                execution_id: execution_id.clone(),
                session_id: session_id.to_owned(),
                stream: LogStream::Meta,
                line: format!("provider command: {command}"),
                at: crate::models::now_iso(),
            },
        );
    }

    if let Some(stdout) = &result.stdout {
        for line in stdout.lines() {
            let _ = app.emit(
                "command-log",
                CommandLogChunk {
                    execution_id: execution_id.clone(),
                    session_id: session_id.to_owned(),
                    stream: LogStream::Stdout,
                    line: line.to_owned(),
                    at: crate::models::now_iso(),
                },
            );
        }
    }

    if let Some(stderr) = &result.stderr {
        for line in stderr.lines() {
            let _ = app.emit(
                "command-log",
                CommandLogChunk {
                    execution_id: execution_id.clone(),
                    session_id: session_id.to_owned(),
                    stream: LogStream::Stderr,
                    line: line.to_owned(),
                    at: crate::models::now_iso(),
                },
            );
        }
    }
}

#[cfg(test)]
mod agent_order_tests {
    use super::*;

    fn temp_sessions_dir() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("codex-agent-order-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("deve criar diretório temporário");
        dir
    }

    fn mock_settings(workspace_root: String) -> AppSettings {
        AppSettings {
            workspace_root,
            codex_root: "/tmp/codex-root".to_owned(),
            selected_provider_id: "mock-development".to_owned(),
            selected_model_id: "mock-development-model".to_owned(),
            selected_agent_id: "equilibrado".to_owned(),
            selected_provider_profile_id: Some("mock-development:default".to_owned()),
            preferred_shell: "/usr/bin/bash".to_owned(),
            auto_approve_safe_read: true,
            execution_mode: crate::models::ExecutionMode::Cloud,
            selected_local_model_id: None,
            model_selection_history: Vec::new(),
            local_models_root: "/tmp/.codex/models".to_owned(),
            theme_preference: crate::models::ThemePreference::Dark,
            ai_response_language: "pt-BR".to_owned(),
            auto_generate_titles: true,
            auto_copy_responses: false,
            paste_large_text_as_file: true,
            personalization: crate::models::AppPersonalizationSettings::default(),
        }
    }

    #[tokio::test]
    async fn send_order_to_agent_adds_provider_response() {
        let dir = temp_sessions_dir();
        let session_manager = Arc::new(SessionManager::new(&dir).expect("manager deve iniciar"));
        let provider_registry = Arc::new(ProviderRegistry::new_with_mock_for_tests());
        let session = session_manager
            .create_session("teste")
            .expect("sessão deve ser criada");

        let updated = run_agent_order(
            None,
            session_manager,
            provider_registry,
            mock_settings(dir.to_string_lossy().to_string()),
            session.id,
            "crie um plano curto".to_owned(),
            Vec::new(),
        )
        .await
        .expect("ordem mock deve responder");

        assert!(updated.messages.iter().any(|message| matches!(
            message.role,
            crate::models::ChatRole::User
        ) && message.content
            == "crie um plano curto"));
        assert!(updated.messages.iter().any(|message| matches!(
            message.role,
            crate::models::ChatRole::Assistant
        ) && message.content.starts_with("[MOCK]")));

        let _ = fs::remove_dir_all(dir);
    }
}

#[tauri::command]
pub fn request_privileged_action(
    app: AppHandle,
    state: State<AppState>,
    input: PrivilegedActionRequestInput,
) -> Result<PermissionRequest, ErrorPayload> {
    let settings = state.settings();
    let prepared = privileged_actions::prepare(&input).map_err(map_err)?;

    let request_id = Uuid::new_v4().to_string();
    let request = privileged_actions::build_permission_request(
        request_id,
        &input,
        settings.workspace_root,
        &prepared,
    );

    state
        .permission_manager
        .store_pending_privileged(request.clone(), input.clone());

    if let Ok(Some(session)) = state.session_manager.update_status(
        &request.session_id,
        SessionStatus::WaitingApproval,
        Some("Aguardando aprovação de ação privilegiada"),
        Some(TaskStatus::Pending),
        Some(format!("{} [{}]", request.command, request.risk)),
    ) {
        let _ = app.emit("session-changed", session);
    }

    let note = state.session_manager.make_status_note(
        &request.session_id,
        StatusKind::Warn,
        "Ação privilegiada pendente",
        &format!("{} ({})", request.title, request.command),
    );
    let _ = app.emit("status-note", note);
    let _ = app.emit("permission-raised", request.clone());

    Ok(request)
}

#[tauri::command]
pub async fn request_execution(
    app: AppHandle,
    state: State<'_, AppState>,
    input: ExecutionRequestInput,
) -> Result<ExecutionResponse, ErrorPayload> {
    let settings = state.settings();
    let assessment = state.permission_manager.assess(&input, &settings);

    if assessment.requires_approval {
        state
            .permission_manager
            .store_pending_command(assessment.request.clone(), input.clone());

        if let Ok(Some(session)) = state.session_manager.update_status(
            &input.session_id,
            SessionStatus::WaitingApproval,
            Some("Aguardando aprovação"),
            Some(TaskStatus::Pending),
            Some(format!("{}", assessment.request.command)),
        ) {
            let _ = app.emit("session-changed", session);
        }

        let note = state.session_manager.make_status_note(
            &input.session_id,
            StatusKind::Warn,
            "Ação sensível aguardando aprovação",
            &format!(
                "{} [{}]",
                assessment.request.command, assessment.request.risk
            ),
        );
        let _ = app.emit("status-note", note);
        let _ = app.emit("permission-raised", assessment.request.clone());

        return Ok(ExecutionResponse {
            execution_id: None,
            approval_required: true,
            permission_request: Some(assessment.request),
        });
    }

    let execution_id = state
        .command_executor
        .execute(app.clone(), settings, state.session_manager.clone(), input)
        .await;

    let execution_id = match execution_id {
        Ok(id) => id,
        Err(cause) => {
            let _ = app.emit(
                "status-note",
                state.session_manager.make_status_note(
                    &assessment.request.session_id,
                    StatusKind::Error,
                    "Execução bloqueada por política",
                    &cause.to_string(),
                ),
            );
            if let Ok(Some(session)) = state.session_manager.update_status(
                &assessment.request.session_id,
                SessionStatus::Error,
                Some("Execução bloqueada por política"),
                Some(TaskStatus::Error),
                Some(cause.to_string()),
            ) {
                let _ = app.emit("session-changed", session);
            }
            return Ok(ExecutionResponse {
                execution_id: None,
                approval_required: false,
                permission_request: None,
            });
        }
    };

    Ok(ExecutionResponse {
        execution_id: Some(execution_id),
        approval_required: false,
        permission_request: None,
    })
}

#[tauri::command]
pub async fn decide_permission(
    app: AppHandle,
    state: State<'_, AppState>,
    request_id: String,
    decision: PermissionDecision,
) -> Result<(), ErrorPayload> {
    let intent = state
        .permission_manager
        .resolve(&request_id, decision.clone());
    let _ = app.emit("permission-resolved", request_id.clone());

    match (decision, intent) {
        (PermissionDecision::AllowOnce, Some(intent)) => match intent.kind {
            PendingIntentKind::Command(input) => {
                let settings = state.settings();
                if let Err(cause) = state
                    .command_executor
                    .execute(app.clone(), settings, state.session_manager.clone(), input)
                    .await
                {
                    let _ = app.emit(
                        "status-note",
                        state.session_manager.make_status_note(
                            &intent.request.session_id,
                            StatusKind::Error,
                            "Execução bloqueada por política",
                            &cause.to_string(),
                        ),
                    );
                    if let Ok(Some(session)) = state.session_manager.update_status(
                        &intent.request.session_id,
                        SessionStatus::Error,
                        Some("Execução bloqueada por política"),
                        Some(TaskStatus::Error),
                        Some(cause.to_string()),
                    ) {
                        let _ = app.emit("session-changed", session);
                    }
                    emit_permission_outcome(
                        &app,
                        PermissionOutcome {
                            request_id: intent.request.id,
                            session_id: intent.request.session_id,
                            status: PermissionOutcomeStatus::Blocked,
                            summary: cause.to_string(),
                            stdout: None,
                            stderr: None,
                            exit_code: None,
                            at: crate::models::now_iso(),
                        },
                    );
                }
            }
            PendingIntentKind::Privileged(input) => {
                let outcome = run_privileged_action(&state, &intent.request, &input).await;
                match outcome {
                    Ok(outcome) => {
                        let status_kind = match outcome.status {
                            PermissionOutcomeStatus::Success => StatusKind::Success,
                            _ => StatusKind::Error,
                        };
                        let _ = app.emit(
                            "status-note",
                            state.session_manager.make_status_note(
                                &outcome.session_id,
                                status_kind,
                                "Resultado da ação privilegiada",
                                &outcome.summary,
                            ),
                        );
                        let _ = state.session_manager.update_status(
                            &outcome.session_id,
                            if matches!(outcome.status, PermissionOutcomeStatus::Success) {
                                SessionStatus::Idle
                            } else {
                                SessionStatus::Error
                            },
                            Some("Ação privilegiada executada"),
                            Some(
                                if matches!(outcome.status, PermissionOutcomeStatus::Success) {
                                    TaskStatus::Done
                                } else {
                                    TaskStatus::Error
                                },
                            ),
                            Some(outcome.summary.clone()),
                        );
                        emit_permission_outcome(&app, outcome);
                    }
                    Err(cause) => {
                        let outcome = PermissionOutcome {
                            request_id: intent.request.id,
                            session_id: intent.request.session_id.clone(),
                            status: PermissionOutcomeStatus::Blocked,
                            summary: cause.to_string(),
                            stdout: None,
                            stderr: None,
                            exit_code: None,
                            at: crate::models::now_iso(),
                        };
                        let _ = app.emit(
                            "status-note",
                            state.session_manager.make_status_note(
                                &intent.request.session_id,
                                StatusKind::Error,
                                "Ação privilegiada bloqueada",
                                &cause.to_string(),
                            ),
                        );
                        let _ = state.session_manager.update_status(
                            &intent.request.session_id,
                            SessionStatus::Error,
                            Some("Ação privilegiada bloqueada"),
                            Some(TaskStatus::Error),
                            Some(cause.to_string()),
                        );
                        emit_permission_outcome(&app, outcome);
                    }
                }
            }
        },
        (PermissionDecision::DenyOnce, Some(intent)) => {
            let note = state.session_manager.make_status_note(
                &intent.request.session_id,
                StatusKind::Warn,
                "Permissão negada",
                &format!("Ação/comando bloqueado: {}", intent.request.command),
            );
            let _ = app.emit("status-note", note);
            if let Ok(Some(session)) = state.session_manager.update_status(
                &intent.request.session_id,
                SessionStatus::Idle,
                Some("Permissão negada"),
                Some(TaskStatus::Done),
                Some("Usuário negou a ação sensível.".to_owned()),
            ) {
                let _ = app.emit("session-changed", session);
            }

            emit_permission_outcome(
                &app,
                PermissionOutcome {
                    request_id: intent.request.id,
                    session_id: intent.request.session_id,
                    status: PermissionOutcomeStatus::Denied,
                    summary: "Usuário negou a ação sensível".to_owned(),
                    stdout: None,
                    stderr: None,
                    exit_code: None,
                    at: crate::models::now_iso(),
                },
            );
        }
        _ => {}
    }

    Ok(())
}

async fn run_privileged_action(
    state: &State<'_, AppState>,
    request: &PermissionRequest,
    input: &PrivilegedActionRequestInput,
) -> Result<PermissionOutcome, AppError> {
    let prepared = privileged_actions::prepare(input)?;
    let helper_request = HelperRequest {
        request_id: request.id.clone(),
        session_id: request.session_id.clone(),
        action_id: input.action_id.clone(),
        args: prepared.args,
        dry_run: input.dry_run,
        user_home: state
            .config_manager
            .home_dir()
            .to_string_lossy()
            .to_string(),
        requested_at: crate::models::now_iso(),
    };

    state
        .privileged_helper_client
        .execute_with_pkexec(&helper_request)
        .await
}

fn emit_permission_outcome(app: &AppHandle, outcome: PermissionOutcome) {
    let _ = app.emit("permission-outcome", outcome);
}

#[tauri::command]
pub async fn open_project_in_vscode(
    state: State<'_, AppState>,
    path: String,
) -> Result<(), ErrorPayload> {
    state
        .vscode_bridge
        .open_project(&path)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn open_file_in_vscode(
    state: State<'_, AppState>,
    path: String,
    line: Option<u32>,
) -> Result<(), ErrorPayload> {
    state
        .vscode_bridge
        .open_file(&path, line)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn open_diff_in_vscode(
    state: State<'_, AppState>,
    left_path: String,
    right_path: String,
) -> Result<(), ErrorPayload> {
    state
        .vscode_bridge
        .open_diff(&left_path, &right_path)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub fn update_settings(
    state: State<AppState>,
    settings: crate::models::AppSettings,
) -> Result<crate::models::AppSettings, ErrorPayload> {
    let saved = state
        .config_manager
        .update_settings(settings)
        .map_err(map_err)?;
    state.set_settings(saved.clone());
    Ok(saved)
}

#[tauri::command]
pub fn get_base_prompt(state: State<AppState>) -> Result<String, ErrorPayload> {
    let path = state.config_manager.codex_root().join("AGENTS.md");
    let content = fs::read_to_string(path)
        .map_err(AppError::from)
        .map_err(map_err)?;
    Ok(content)
}

#[tauri::command]
pub fn update_base_prompt(state: State<AppState>, content: String) -> Result<(), ErrorPayload> {
    let path = state.config_manager.codex_root().join("AGENTS.md");
    let _ = state
        .config_manager
        .make_backup(&path, "agents-md")
        .map_err(map_err)?;
    fs::write(path, content)
        .map_err(AppError::from)
        .map_err(map_err)
}
