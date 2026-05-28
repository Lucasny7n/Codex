use std::{
    env, fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Arc,
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::error::{AppError, AppResult, ErrorPayload};
use crate::models::local_engine::{
    BackendStatus, BenchmarkKind, BenchmarkResult, HardwareSnapshot, ModelRuntimeRequest,
    RuntimeBackendId, RuntimeEstimate, RuntimePreset, RuntimeRecommendation,
};
use crate::models::{
    ActionableError, ActionableErrorSeverity, AgentSession, AppHealthAction, AppHealthCheck,
    AppHealthOverallStatus, AppHealthProvider, AppSettings, BootstrapPayload, ChatMessage,
    ChatRole, CommandLogChunk, ConversationImportResult, ExecutionRequestInput, ExecutionResponse,
    HardwareProfile, LocalModelInstallProgress, LocalRuntimeSnapshot, LogStream, MemoryEntry,
    ModelComparisonRequest, ModelComparisonResponse, ModelComparisonResult, ModelFitEstimate,
    ModelFitRequest, OllamaLibrarySearchResult, OllamaModelDetails, PendingIntentKind,
    PermissionDecision, PermissionOutcome, PermissionOutcomeStatus, PermissionRequest,
    PrivilegedActionRequestInput, PrivilegedActionSpec, ProviderAccountProfile,
    ProviderCredentialStatus, ProviderGenerateRequest, ProviderRuntimeStatus, ProviderStatusState,
    QuantOption, SessionExportFormat, SessionExportResult, SessionStatus, SkillExecutionPlan,
    SkillManifest, SkillVmReport, StatusKind, SystemHealthItem, TaskStatus, UserSkill,
    UserSkillDryRun, UserSkillInput, WorkspaceMeta,
};
use crate::services::ai_router::{AiRouteRequest, AiRouter};
use crate::services::memory_store::MemoryEntryStore;
use crate::services::privileged_actions;
use crate::services::privileged_helper_client::HelperRequest;
use crate::services::provider_registry::ProviderRegistry;
use crate::services::session_manager::SessionManager;
use crate::services::skills::{self, SkillStore, VirshVmRunner};
use crate::services::user_skills::UserSkillStore;
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

fn command_text(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn has_app_project_markers(root: &Path) -> bool {
    root.join("package.json").is_file()
        && root.join("src-tauri/tauri.conf.json").is_file()
        && root.join("assets/ailu-ai-studio.desktop").is_file()
}

fn resolve_app_project_root_from_candidates(
    settings_workspace_root: &str,
    candidates: &[PathBuf],
) -> PathBuf {
    let mut roots = Vec::new();
    for candidate in candidates {
        roots.push(candidate.clone());
        if let Some(parent) = candidate.parent() {
            roots.push(parent.to_path_buf());
        }
    }
    roots.push(PathBuf::from(settings_workspace_root));

    roots
        .into_iter()
        .find(|root| has_app_project_markers(root))
        .unwrap_or_else(|| PathBuf::from(settings_workspace_root))
}

fn app_project_root_for_health(settings_workspace_root: &str) -> PathBuf {
    let mut candidates = Vec::new();
    if let Ok(current_dir) = env::current_dir() {
        candidates.push(current_dir);
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")));
    resolve_app_project_root_from_candidates(settings_workspace_root, &candidates)
}

fn health_item(
    id: &str,
    label: &str,
    ok: bool,
    detail: String,
    action: Option<&str>,
    command: Option<&str>,
) -> SystemHealthItem {
    SystemHealthItem {
        id: id.to_owned(),
        label: label.to_owned(),
        status: if ok { "ok" } else { "warning" }.to_owned(),
        detail,
        action: action.map(str::to_owned),
        command: command.map(str::to_owned),
    }
}

fn health_item_with_status(
    id: &str,
    label: &str,
    status: &str,
    detail: String,
    action: Option<&str>,
    command: Option<&str>,
) -> SystemHealthItem {
    SystemHealthItem {
        id: id.to_owned(),
        label: label.to_owned(),
        status: status.to_owned(),
        detail,
        action: action.map(str::to_owned),
        command: command.map(str::to_owned),
    }
}

fn systemctl_user_active(unit: &str) -> bool {
    Command::new("systemctl")
        .args(["--user", "is-active", unit])
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
    capture_status: Option<String>,
    capture_backend: Option<String>,
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
pub struct SttCaptureSnapshot {
    webview_status: String,
    webview_message: String,
    native_status: String,
    native_message: String,
    native_tools: Vec<String>,
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
    capture: SttCaptureSnapshot,
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

const STT_INSTALL_COMMAND: &str = "pacman -S --needed ffmpeg whisper.cpp";
const STT_TRANSCRIPTION_FAILURE_MESSAGE: &str = "Captei o áudio, mas não consegui transcrever.";
const STT_NO_SPEECH_MESSAGE: &str =
    "Nenhuma fala foi reconhecida. Tente falar mais perto do microfone.";
const MIC_CAPTURE_FAILURE_MESSAGE: &str =
    "Não consegui acessar o microfone. Verifique PipeWire/WirePlumber ou selecione outro dispositivo.";
const NATIVE_CAPTURE_FAILURE_MESSAGE: &str =
    "Não consegui gravar áudio pelo fallback nativo. Verifique o dispositivo de entrada.";

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
        capture_status: None,
        capture_backend: None,
    }
}

fn missing_transcription_backend_result(detail: Option<String>) -> VoiceTranscriptionResult {
    voice_result(
        VoiceTranscriptionResultStatus::MissingBackend,
        None,
        "Transcrição local indisponível. Verifique ffmpeg, whisper-cli e um modelo local.",
        None,
        Some(STT_INSTALL_COMMAND),
        detail,
    )
}

fn attach_capture_status(
    mut result: VoiceTranscriptionResult,
    status: &str,
    backend: Option<&str>,
) -> VoiceTranscriptionResult {
    result.capture_status = Some(status.to_owned());
    result.capture_backend = backend.map(str::to_owned);
    result
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

fn recorded_file_ok(path: &Path) -> bool {
    fs::metadata(path)
        .ok()
        .is_some_and(|metadata| metadata.is_file() && metadata.len() > 128)
}

fn wait_child_with_timeout(child: &mut Child, timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("falha ao aguardar captura nativa: {error}"))?
        {
            return status
                .success()
                .then_some(())
                .ok_or_else(|| format!("captura nativa saiu com status {status}"));
        }

        if Instant::now() >= deadline {
            child
                .kill()
                .map_err(|error| format!("falha ao encerrar captura nativa: {error}"))?;
            let _ = child.wait();
            return Ok(());
        }

        thread::sleep(Duration::from_millis(80));
    }
}

fn run_native_capture_program(
    program: &str,
    args: &[String],
    output_path: &Path,
    timeout: Duration,
) -> Result<(), String> {
    let binary = command_in_path(program).ok_or_else(|| format!("{program} não encontrado"))?;
    let mut child = Command::new(binary)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("falha ao iniciar {program}: {error}"))?;
    wait_child_with_timeout(&mut child, timeout)?;
    if recorded_file_ok(output_path) {
        Ok(())
    } else {
        Err(format!("{program} não gerou WAV utilizável"))
    }
}

fn record_short_native_wav(temp_dir: &Path) -> Result<(PathBuf, String), Vec<String>> {
    let mut diagnostics = Vec::new();
    let attempts: Vec<(&str, Vec<String>, Duration)> = vec![
        (
            "pw-record",
            vec![
                "--media-category".to_owned(),
                "Capture".to_owned(),
                "--rate".to_owned(),
                "16000".to_owned(),
                "--channels".to_owned(),
                "1".to_owned(),
                "--sample-count".to_owned(),
                "32000".to_owned(),
                temp_dir.join("pw-record.wav").to_string_lossy().to_string(),
            ],
            Duration::from_millis(2300),
        ),
        (
            "parecord",
            vec![
                "--file-format=wav".to_owned(),
                "--rate=16000".to_owned(),
                "--channels=1".to_owned(),
                temp_dir.join("parecord.wav").to_string_lossy().to_string(),
            ],
            Duration::from_millis(2300),
        ),
        (
            "arecord",
            vec![
                "-q".to_owned(),
                "-f".to_owned(),
                "S16_LE".to_owned(),
                "-r".to_owned(),
                "16000".to_owned(),
                "-c".to_owned(),
                "1".to_owned(),
                "-d".to_owned(),
                "2".to_owned(),
                temp_dir.join("arecord.wav").to_string_lossy().to_string(),
            ],
            Duration::from_millis(4200),
        ),
        (
            "ffmpeg",
            vec![
                "-hide_banner".to_owned(),
                "-loglevel".to_owned(),
                "error".to_owned(),
                "-y".to_owned(),
                "-f".to_owned(),
                "pulse".to_owned(),
                "-i".to_owned(),
                "default".to_owned(),
                "-t".to_owned(),
                "2".to_owned(),
                "-ac".to_owned(),
                "1".to_owned(),
                "-ar".to_owned(),
                "16000".to_owned(),
                temp_dir.join("ffmpeg.wav").to_string_lossy().to_string(),
            ],
            Duration::from_millis(5200),
        ),
    ];

    for (program, args, timeout) in attempts {
        let Some(output) = args.last().map(PathBuf::from) else {
            continue;
        };
        match run_native_capture_program(program, &args, &output, timeout) {
            Ok(()) => return Ok((output, program.to_owned())),
            Err(error) => {
                diagnostics.push(error);
                let _ = fs::remove_file(output);
            }
        }
    }

    Err(diagnostics)
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
        "WHISPER_MODEL",
        "WHISPER_CPP_MODEL",
        "FASTER_WHISPER_MODEL",
        "VOSK_MODEL",
    ] {
        if let Some(path) = env::var_os(key).map(PathBuf::from) {
            candidates.push(model_candidate(key, path, "environment"));
        }
    }

    if let Ok(home) = home_dir() {
        let mut fixed = vec![
            home.join(".codex/models/ggml-base.bin"),
            home.join(".codex/models/ggml-small.bin"),
            home.join(".codex/models/ggml-tiny.bin"),
            home.join(".local/share/whisper.cpp/ggml-base.bin"),
            home.join(".local/share/whisper.cpp/ggml-small.bin"),
            home.join(".local/share/whisper.cpp/ggml-tiny.bin"),
        ];
        fixed.extend([
            PathBuf::from("/home/lucas/.codex/models/ggml-base.bin"),
            PathBuf::from("/home/lucas/.codex/models/ggml-small.bin"),
            PathBuf::from("/home/lucas/.codex/models/ggml-tiny.bin"),
        ]);
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

fn whisper_model_path(configured: Option<&str>) -> Option<PathBuf> {
    if let Some(path) = configured_model_path(configured).filter(|path| path.is_file()) {
        return Some(path);
    }
    for key in ["WHISPER_MODEL", "WHISPER_CPP_MODEL"] {
        if let Some(path) = env::var_os(key)
            .map(PathBuf::from)
            .filter(|path| path.is_file())
        {
            return Some(path);
        }
    }
    let home = home_dir().ok()?;
    let mut fixed = vec![
        home.join(".codex/models/ggml-base.bin"),
        home.join(".codex/models/ggml-small.bin"),
        home.join(".codex/models/ggml-tiny.bin"),
        home.join(".local/share/whisper.cpp/ggml-base.bin"),
        home.join(".local/share/whisper.cpp/ggml-small.bin"),
        home.join(".local/share/whisper.cpp/ggml-tiny.bin"),
    ];
    fixed.extend([
        PathBuf::from("/home/lucas/.codex/models/ggml-base.bin"),
        PathBuf::from("/home/lucas/.codex/models/ggml-small.bin"),
        PathBuf::from("/home/lucas/.codex/models/ggml-tiny.bin"),
    ]);
    fixed.into_iter().find(|path| path.is_file())
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

fn stt_capture_snapshot() -> SttCaptureSnapshot {
    let pipewire_active = systemctl_user_active("pipewire.service");
    let wireplumber_active = systemctl_user_active("wireplumber.service");
    let portal_active = systemctl_user_active("xdg-desktop-portal.service");
    let native_tools = ["pw-record", "parecord", "arecord", "ffmpeg"]
        .into_iter()
        .filter(|program| command_in_path(program).is_some())
        .map(str::to_owned)
        .collect::<Vec<_>>();

    let webview_ready = pipewire_active && wireplumber_active && portal_active;
    SttCaptureSnapshot {
        webview_status: if webview_ready { "ok" } else { "warning" }.to_owned(),
        webview_message: if webview_ready {
            "PipeWire, WirePlumber e portal ativos. O teste real acontece ao clicar no microfone."
                .to_owned()
        } else {
            "WebView pode pedir permissão ou falhar se PipeWire, WirePlumber ou portal não estiverem ativos."
                .to_owned()
        },
        native_status: if native_tools.is_empty() {
            "warning"
        } else {
            "ok"
        }
        .to_owned(),
        native_message: if native_tools.is_empty() {
            "Nenhum fallback nativo encontrado: pw-record, parecord, arecord ou ffmpeg.".to_owned()
        } else {
            format!(
                "Fallback nativo disponível via {}.",
                native_tools.join(", ")
            )
        },
        native_tools,
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
    let whisper_cli_installed = whisper_cli_binary.is_some();
    let whisper_cpp_installed = whisper_cpp_binary.is_some();
    let whisper_model = whisper_model_path(model_path_input);
    let whisper_cli_ready = whisper_cli_installed && whisper_model.is_some() && ffmpeg.installed;
    let whisper_cpp_ready = whisper_cpp_installed && whisper_model.is_some() && ffmpeg.installed;
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
            } else if whisper_cli_installed && !model_exists {
                "whisper-cli encontrado; selecione um modelo em ~/.codex/models."
            } else if whisper_cli_installed && !ffmpeg.installed {
                "whisper-cli encontrado; ffmpeg ainda é necessário para converter áudio."
            } else {
                "whisper-cli não encontrado."
            },
        ),
        tool_status(
            "whisper.cpp",
            "whisper.cpp",
            whisper_cpp_binary,
            whisper_cpp_ready,
            if whisper_cpp_ready {
                "whisper.cpp pronto com modelo local."
            } else if whisper_cli_ready {
                "Opcional; whisper-cli já cobre a transcrição local."
            } else if whisper_cpp_installed && !model_exists {
                "whisper.cpp encontrado; selecione um modelo local."
            } else {
                "Opcional; o backend principal é whisper-cli."
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
    let ready = whisper_cli_ready;
    let message = if ready {
        match selected_model.as_ref() {
            Some(path) => format!(
                "Transcrição local pronta. Modelo: {}",
                path.to_string_lossy()
            ),
            None => "Transcrição local pronta para teste.".to_owned(),
        }
    } else if !ffmpeg.installed {
        "ffmpeg não encontrado. Ele é necessário para converter áudio antes da transcrição."
            .to_owned()
    } else if !whisper_cli_installed {
        "whisper-cli não encontrado. Ele é o backend principal de transcrição local.".to_owned()
    } else if !model_exists {
        "Modelo Whisper não encontrado. Escolha um arquivo ggml em ~/.codex/models.".to_owned()
    } else {
        "Backend encontrado, mas ainda não está pronto para transcrição local.".to_owned()
    };
    let selected_model_text = selected_model
        .as_ref()
        .map(|path| path.to_string_lossy().to_string());

    Ok(LocalSttConfigSnapshot {
        ffmpeg,
        backends,
        model_path: selected_model_text,
        model_exists,
        model_candidates,
        ready,
        install_command: STT_INSTALL_COMMAND.to_owned(),
        message,
        capture: stt_capture_snapshot(),
        checked_at: crate::models::now_iso(),
    })
}

fn clean_transcript_output(raw: &str) -> String {
    let without_timestamps =
        regex::Regex::new(r"(?m)^\s*(?:\[[^\]]+\]|[\d:.,]+\s*-->\s*[\d:.,]+)\s*")
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
                && !line.starts_with("ggml_")
                && !line.starts_with("whisper_")
                && !line.starts_with("whisper_print_timings:")
                && !line.starts_with("whisper_init")
                && !line.contains("processing audio")
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

fn sanitize_backend_detail(raw: &str) -> String {
    let first = raw
        .lines()
        .rev()
        .map(str::trim)
        .find(|line| {
            !line.is_empty()
                && !line.starts_with('{')
                && !line.starts_with('[')
                && !line.contains("stack")
                && !line.contains("backtrace")
        })
        .unwrap_or("sem detalhe");
    first.chars().take(180).collect()
}

fn run_whisper_cli(audio_path: &Path, model_path: Option<&str>) -> Result<Option<String>, String> {
    let Some(binary) = command_in_path("whisper-cli") else {
        return Ok(None);
    };
    let Some(model) = whisper_model_path(model_path) else {
        return Err("Modelo Whisper não encontrado. Coloque ggml-base.bin em ~/.codex/models ou selecione o caminho no app.".to_owned());
    };
    let output = Command::new(binary)
        .arg("-m")
        .arg(&model)
        .arg("-f")
        .arg(audio_path)
        .arg("-l")
        .arg("pt")
        .arg("-nt")
        .output()
        .map_err(|error| format!("Não consegui executar whisper-cli: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let text = clean_transcript_output(if stdout.trim().is_empty() {
        &stderr
    } else {
        &stdout
    });
    if output.status.success() {
        return if text.is_empty() {
            Err(STT_NO_SPEECH_MESSAGE.to_owned())
        } else {
            Ok(Some(text))
        };
    }
    Err(format!(
        "whisper-cli falhou: {}",
        sanitize_backend_detail(&stderr)
    ))
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

    let snapshot = match stt_config_snapshot(model_path.as_deref()) {
        Ok(snapshot) => snapshot,
        Err(error) => return Err(map_err(error)),
    };
    if !snapshot.ready {
        return Ok(missing_transcription_backend_result(Some(snapshot.message)));
    }

    let temp_dir = env::temp_dir().join(format!("ailu-voice-{}", Uuid::new_v4()));
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

    let audio_path = match ffmpeg_convert_to_wav(&input_path, &temp_dir) {
        Ok(path) => path,
        Err(error) => {
            let _ = fs::remove_dir_all(&temp_dir);
            return Ok(voice_result(
                VoiceTranscriptionResultStatus::Error,
                None,
                STT_TRANSCRIPTION_FAILURE_MESSAGE,
                Some("ffmpeg"),
                None,
                Some(sanitize_backend_detail(&error)),
            ));
        }
    };

    let selected_model = snapshot.model_path.as_deref().or(model_path.as_deref());
    let mut diagnostics = Vec::new();
    match run_whisper_cli(&audio_path, selected_model) {
        Ok(Some(text)) => {
            let _ = fs::remove_dir_all(&temp_dir);
            return Ok(voice_result(
                VoiceTranscriptionResultStatus::Done,
                Some(text),
                "Transcrição concluída.",
                Some("whisper-cli"),
                None,
                None,
            ));
        }
        Ok(None) => diagnostics
            .push("whisper-cli deixou de estar disponível após o snapshot STT.".to_owned()),
        Err(error) if error == STT_NO_SPEECH_MESSAGE => {
            let _ = fs::remove_dir_all(&temp_dir);
            return Ok(voice_result(
                VoiceTranscriptionResultStatus::Error,
                None,
                STT_NO_SPEECH_MESSAGE,
                Some("whisper-cli"),
                None,
                None,
            ));
        }
        Err(error) => diagnostics.push(error),
    }

    for (backend, attempt) in [
        ("whisper", run_openai_whisper(&audio_path, &temp_dir)),
        (
            "faster-whisper",
            run_faster_whisper(&audio_path, &temp_dir, model_path.as_deref()),
        ),
        (
            "vosk-transcriber",
            run_vosk_transcriber(&audio_path, model_path.as_deref()),
        ),
    ] {
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

    let result = voice_result(
        VoiceTranscriptionResultStatus::Error,
        None,
        STT_TRANSCRIPTION_FAILURE_MESSAGE,
        Some("whisper-cli"),
        None,
        Some(sanitize_backend_detail(&diagnostics.join("\n"))),
    );
    let _ = fs::remove_dir_all(&temp_dir);
    Ok(result)
}

#[tauri::command]
pub fn record_and_transcribe_short_test(
    model_path: Option<String>,
) -> Result<VoiceTranscriptionResult, ErrorPayload> {
    let temp_dir = env::temp_dir().join(format!("ailu-native-voice-{}", Uuid::new_v4()));
    if let Err(error) = fs::create_dir_all(&temp_dir) {
        return Ok(voice_result(
            VoiceTranscriptionResultStatus::Error,
            None,
            MIC_CAPTURE_FAILURE_MESSAGE,
            Some("native-capture"),
            None,
            Some(error.to_string()),
        ));
    }

    let result = match record_short_native_wav(&temp_dir) {
        Ok((audio_path, capture_backend)) => match fs::read(&audio_path) {
            Ok(bytes) => match transcribe_audio(bytes, Some("audio/wav".to_owned()), model_path) {
                Ok(mut transcription) => {
                    let capture_note = format!("captura nativa: {capture_backend}");
                    transcription.capture_status = Some("ok".to_owned());
                    transcription.capture_backend = Some(capture_backend);
                    transcription.technical_details = Some(
                        transcription
                            .technical_details
                            .map(|details| format!("{capture_note}\n{details}"))
                            .unwrap_or(capture_note),
                    );
                    Ok(transcription)
                }
                Err(error) => Ok(attach_capture_status(
                    voice_result(
                        VoiceTranscriptionResultStatus::Error,
                        None,
                        "Captura nativa funcionou, mas a transcrição local falhou.",
                        Some("native-capture"),
                        None,
                        Some(error.message),
                    ),
                    "ok",
                    Some("native-capture"),
                )),
            },
            Err(error) => Ok(attach_capture_status(
                voice_result(
                    VoiceTranscriptionResultStatus::Error,
                    None,
                    NATIVE_CAPTURE_FAILURE_MESSAGE,
                    Some("native-capture"),
                    None,
                    Some(error.to_string()),
                ),
                "error",
                Some("native-capture"),
            )),
        },
        Err(diagnostics) => Ok(attach_capture_status(
            voice_result(
                VoiceTranscriptionResultStatus::Error,
                None,
                NATIVE_CAPTURE_FAILURE_MESSAGE,
                Some("native-capture"),
                None,
                Some(diagnostics.join("\n")),
            ),
            "error",
            Some("native-capture"),
        )),
    };

    let _ = fs::remove_dir_all(&temp_dir);
    result
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
mod health_tests {
    use super::*;

    #[test]
    fn health_root_prefers_app_markers_over_stale_workspace_setting() {
        let root = env::temp_dir().join(format!("ailu-health-test-{}", Uuid::new_v4()));
        let stale_workspace = root.join("Codex-Codex");
        let app_root = root.join("ailu-ai-studio");
        fs::create_dir_all(&stale_workspace).expect("workspace antigo");
        fs::create_dir_all(app_root.join("src-tauri")).expect("src-tauri");
        fs::create_dir_all(app_root.join("assets")).expect("assets");
        fs::write(app_root.join("package.json"), "{}").expect("package marker");
        fs::write(app_root.join("src-tauri/tauri.conf.json"), "{}").expect("tauri marker");
        fs::write(
            app_root.join("assets/ailu-ai-studio.desktop"),
            "[Desktop Entry]",
        )
        .expect("desktop marker");

        let resolved = resolve_app_project_root_from_candidates(
            &stale_workspace.to_string_lossy(),
            &[app_root.join("src-tauri")],
        );

        assert_eq!(resolved, app_root);
        let _ = fs::remove_dir_all(root);
    }
}

#[cfg(test)]
mod stt_tests {
    use super::*;
    use std::{ffi::OsString, sync::Mutex};

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    struct TestEnv {
        root: PathBuf,
        bin: PathBuf,
        home: PathBuf,
        old_home: Option<OsString>,
        old_path: Option<OsString>,
        old_log: Option<OsString>,
        old_whisper_model: Option<OsString>,
        old_whisper_cpp_model: Option<OsString>,
        old_faster_whisper_model: Option<OsString>,
        old_vosk_model: Option<OsString>,
    }

    impl TestEnv {
        fn new() -> Self {
            let root = env::temp_dir().join(format!("ailu-stt-test-{}", Uuid::new_v4()));
            let bin = root.join("bin");
            let home = root.join("home");
            fs::create_dir_all(&bin).expect("bin temporário");
            fs::create_dir_all(home.join(".codex/models")).expect("modelo temporário");
            fs::write(home.join(".codex/models/ggml-base.bin"), "fake model").expect("modelo");
            let old_home = env::var_os("HOME");
            let old_path = env::var_os("PATH");
            let old_log = env::var_os("AILU_WHISPER_ARGS_LOG");
            let old_whisper_model = env::var_os("WHISPER_MODEL");
            let old_whisper_cpp_model = env::var_os("WHISPER_CPP_MODEL");
            let old_faster_whisper_model = env::var_os("FASTER_WHISPER_MODEL");
            let old_vosk_model = env::var_os("VOSK_MODEL");
            env::set_var("HOME", &home);
            env::set_var("PATH", &bin);
            env::remove_var("AILU_WHISPER_ARGS_LOG");
            env::remove_var("WHISPER_MODEL");
            env::remove_var("WHISPER_CPP_MODEL");
            env::remove_var("FASTER_WHISPER_MODEL");
            env::remove_var("VOSK_MODEL");
            Self {
                root,
                bin,
                home,
                old_home,
                old_path,
                old_log,
                old_whisper_model,
                old_whisper_cpp_model,
                old_faster_whisper_model,
                old_vosk_model,
            }
        }

        fn model_path(&self) -> PathBuf {
            self.home.join(".codex/models/ggml-base.bin")
        }

        fn write_executable(&self, name: &str, body: &str) {
            let path = self.bin.join(name);
            fs::write(&path, body).expect("script temporário");
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut permissions = fs::metadata(&path).expect("metadata").permissions();
                permissions.set_mode(0o755);
                fs::set_permissions(&path, permissions).expect("chmod");
            }
        }

        fn add_ffmpeg(&self) {
            self.write_executable(
                "ffmpeg",
                "#!/bin/sh\nlast=\"\"\ninput=\"\"\nprev=\"\"\nfor arg in \"$@\"; do\n  last=\"$arg\"\n  if [ \"$prev\" = \"-i\" ]; then input=\"$arg\"; fi\n  prev=\"$arg\"\ndone\nif [ -n \"$input\" ] && [ -f \"$input\" ]; then /usr/bin/cp \"$input\" \"$last\"; else i=0; : > \"$last\"; while [ \"$i\" -lt 256 ]; do printf x >> \"$last\"; i=$((i + 1)); done; fi\n",
            );
        }

        fn add_whisper_cli(&self) -> PathBuf {
            let log = self.root.join("whisper-args.log");
            env::set_var("AILU_WHISPER_ARGS_LOG", &log);
            self.write_executable(
                "whisper-cli",
                "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$AILU_WHISPER_ARGS_LOG\"\nprintf '[00:00:00.000 --> 00:00:01.000] Olá mundo\\n'\n",
            );
            log
        }

        fn add_whisper_cli_failure(&self) {
            self.write_executable(
                "whisper-cli",
                "#!/bin/sh\nprintf 'internal stack trace secret\\n' >&2\nexit 2\n",
            );
        }

        fn add_whisper_cli_empty(&self) {
            self.write_executable("whisper-cli", "#!/bin/sh\nexit 0\n");
        }

        fn add_pw_record(&self) {
            self.write_executable(
                "pw-record",
                "#!/bin/sh\nlast=\"\"\nfor arg in \"$@\"; do last=\"$arg\"; done\ni=0; : > \"$last\"; while [ \"$i\" -lt 256 ]; do printf x >> \"$last\"; i=$((i + 1)); done\n",
            );
        }
    }

    impl Drop for TestEnv {
        fn drop(&mut self) {
            match &self.old_home {
                Some(value) => env::set_var("HOME", value),
                None => env::remove_var("HOME"),
            }
            match &self.old_path {
                Some(value) => env::set_var("PATH", value),
                None => env::remove_var("PATH"),
            }
            match &self.old_log {
                Some(value) => env::set_var("AILU_WHISPER_ARGS_LOG", value),
                None => env::remove_var("AILU_WHISPER_ARGS_LOG"),
            }
            match &self.old_whisper_model {
                Some(value) => env::set_var("WHISPER_MODEL", value),
                None => env::remove_var("WHISPER_MODEL"),
            }
            match &self.old_whisper_cpp_model {
                Some(value) => env::set_var("WHISPER_CPP_MODEL", value),
                None => env::remove_var("WHISPER_CPP_MODEL"),
            }
            match &self.old_faster_whisper_model {
                Some(value) => env::set_var("FASTER_WHISPER_MODEL", value),
                None => env::remove_var("FASTER_WHISPER_MODEL"),
            }
            match &self.old_vosk_model {
                Some(value) => env::set_var("VOSK_MODEL", value),
                None => env::remove_var("VOSK_MODEL"),
            }
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn stt_snapshot_accepts_whisper_cli_and_default_base_model() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let env = TestEnv::new();
        env.add_ffmpeg();
        env.add_whisper_cli();

        let snapshot = stt_config_snapshot(None).expect("snapshot STT");

        assert!(snapshot.ready);
        assert_eq!(
            snapshot.model_path.as_deref(),
            Some(env.model_path().to_string_lossy().as_ref())
        );
        assert!(snapshot
            .backends
            .iter()
            .any(|backend| backend.id == "whisper-cli" && backend.ready));
        assert!(snapshot
            .backends
            .iter()
            .any(|backend| backend.id == "whisper.cpp" && !backend.installed));
        assert!(!snapshot.message.contains("Instale whisper.cpp"));
    }

    #[test]
    fn transcribe_audio_uses_whisper_cli_model_and_file_arguments() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let env = TestEnv::new();
        env.add_ffmpeg();
        let log = env.add_whisper_cli();

        let result = transcribe_audio(vec![1, 2, 3, 4], Some("audio/wav".to_owned()), None)
            .expect("transcrição");

        assert_eq!(result.status, VoiceTranscriptionResultStatus::Done);
        assert_eq!(result.text.as_deref(), Some("Olá mundo"));
        let args = fs::read_to_string(log).expect("args do whisper-cli");
        assert!(args.contains("-m\n"));
        assert!(args.contains(&env.model_path().to_string_lossy().to_string()));
        assert!(args.contains("-f\n"));
    }

    #[test]
    fn transcribe_audio_does_not_return_missing_backend_when_ready_whisper_cli_fails() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let env = TestEnv::new();
        env.add_ffmpeg();
        env.add_whisper_cli_failure();

        let result = transcribe_audio(vec![1, 2, 3, 4], Some("audio/wav".to_owned()), None)
            .expect("transcrição");

        assert_eq!(result.status, VoiceTranscriptionResultStatus::Error);
        assert_eq!(result.message, STT_TRANSCRIPTION_FAILURE_MESSAGE);
        assert_eq!(result.backend.as_deref(), Some("whisper-cli"));
        assert!(result.command.is_none());
        assert!(!result
            .technical_details
            .as_deref()
            .unwrap_or_default()
            .contains("stack trace"));
    }

    #[test]
    fn transcribe_audio_reports_no_speech_without_missing_backend_when_ready() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let env = TestEnv::new();
        env.add_ffmpeg();
        env.add_whisper_cli_empty();

        let result = transcribe_audio(vec![1, 2, 3, 4], Some("audio/wav".to_owned()), None)
            .expect("transcrição");

        assert_eq!(result.status, VoiceTranscriptionResultStatus::Error);
        assert_eq!(result.message, STT_NO_SPEECH_MESSAGE);
        assert!(result.command.is_none());
    }

    #[test]
    fn native_capture_prefers_pw_record_when_it_generates_wav() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let env = TestEnv::new();
        env.add_pw_record();
        let temp_dir = env.root.join("capture");
        fs::create_dir_all(&temp_dir).expect("capture dir");

        let (wav, backend) = record_short_native_wav(&temp_dir).expect("captura nativa");

        assert_eq!(backend, "pw-record");
        assert!(recorded_file_ok(&wav));
    }

    #[test]
    fn native_capture_ok_transcription_failure_is_not_missing_backend() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let env = TestEnv::new();
        env.add_ffmpeg();
        env.add_whisper_cli_failure();
        env.add_pw_record();

        let result = record_and_transcribe_short_test(None).expect("teste nativo");

        assert_eq!(result.status, VoiceTranscriptionResultStatus::Error);
        assert_eq!(result.capture_status.as_deref(), Some("ok"));
        assert_eq!(result.message, STT_TRANSCRIPTION_FAILURE_MESSAGE);
        assert_ne!(
            result.status,
            VoiceTranscriptionResultStatus::MissingBackend
        );
    }

    #[test]
    fn native_capture_reports_human_failure_when_no_tool_works() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let env = TestEnv::new();
        let temp_dir = env.root.join("capture-fail");
        fs::create_dir_all(&temp_dir).expect("capture dir");

        let diagnostics = record_short_native_wav(&temp_dir).expect_err("deve falhar");

        assert!(diagnostics.iter().any(|line| line.contains("pw-record")));
    }
}

#[cfg(test)]
mod file_browser_tests {
    use super::*;

    fn temp_file_browser_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ailu-file-browser-test-{}", Uuid::new_v4()));
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
        let result = get_file_attachment("/path/que/nao/existe/arquivo".to_owned());
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
pub async fn detect_hardware(state: State<'_, AppState>) -> Result<HardwareProfile, ErrorPayload> {
    Ok(state.hardware_service.detect().await)
}

#[tauri::command]
pub fn list_quant_presets(state: State<AppState>) -> Result<Vec<QuantOption>, ErrorPayload> {
    Ok(state.hardware_service.quant_presets())
}

#[tauri::command]
pub async fn estimate_model_fits(
    state: State<'_, AppState>,
    requests: Vec<ModelFitRequest>,
) -> Result<Vec<ModelFitEstimate>, ErrorPayload> {
    let profile = state.hardware_service.detect().await;
    Ok(state.hardware_service.estimate_fits(&profile, &requests))
}

#[tauri::command]
pub async fn detect_local_hardware(
    state: State<'_, AppState>,
) -> Result<HardwareSnapshot, ErrorPayload> {
    Ok(state.local_engine.detect_hardware().await)
}

#[tauri::command]
pub async fn list_runtime_backends(
    state: State<'_, AppState>,
) -> Result<Vec<BackendStatus>, ErrorPayload> {
    Ok(state.local_engine.list_backends().await)
}

#[tauri::command]
pub async fn estimate_model_runtime(
    state: State<'_, AppState>,
    request: ModelRuntimeRequest,
) -> Result<RuntimeEstimate, ErrorPayload> {
    Ok(state.local_engine.estimate_runtime(&request).await)
}

#[tauri::command]
pub async fn recommend_model_runtime(
    state: State<'_, AppState>,
    request: ModelRuntimeRequest,
) -> Result<RuntimeRecommendation, ErrorPayload> {
    Ok(state.local_engine.recommend(&request).await)
}

#[tauri::command]
pub fn list_runtime_presets(state: State<AppState>) -> Result<Vec<RuntimePreset>, ErrorPayload> {
    Ok(state.local_engine.list_presets())
}

#[tauri::command]
pub fn save_runtime_preset(
    state: State<AppState>,
    preset: RuntimePreset,
) -> Result<Vec<RuntimePreset>, ErrorPayload> {
    state
        .local_engine
        .save_preset(preset)
        .map_err(AppError::Message)
        .map_err(map_err)
}

#[tauri::command]
pub fn delete_runtime_preset(
    state: State<AppState>,
    model_id: String,
    backend_id: RuntimeBackendId,
) -> Result<Vec<RuntimePreset>, ErrorPayload> {
    state
        .local_engine
        .delete_preset(&model_id, backend_id)
        .map_err(AppError::Message)
        .map_err(map_err)
}

#[tauri::command]
pub async fn test_model_runtime(
    state: State<'_, AppState>,
    model_id: String,
    backend_id: RuntimeBackendId,
) -> Result<BenchmarkResult, ErrorPayload> {
    Ok(state
        .local_engine
        .benchmark(&model_id, backend_id, BenchmarkKind::Smoke)
        .await)
}

#[tauri::command]
pub async fn benchmark_model_runtime(
    state: State<'_, AppState>,
    model_id: String,
    backend_id: RuntimeBackendId,
) -> Result<BenchmarkResult, ErrorPayload> {
    Ok(state
        .local_engine
        .benchmark(&model_id, backend_id, BenchmarkKind::Quick)
        .await)
}

fn skill_store(state: &State<AppState>) -> SkillStore {
    let root = PathBuf::from(state.settings().workspace_root).join("skills");
    SkillStore::new(root)
}

#[tauri::command]
pub fn list_skills(state: State<AppState>) -> Result<Vec<SkillManifest>, ErrorPayload> {
    Ok(skill_store(&state).list())
}

#[tauri::command]
pub fn plan_skill(
    state: State<AppState>,
    skill_id: String,
    args: Vec<String>,
) -> Result<SkillExecutionPlan, ErrorPayload> {
    skill_store(&state)
        .plan(&skill_id, &args)
        .map_err(AppError::Message)
        .map_err(map_err)
}

#[tauri::command]
pub fn mark_skill_trusted(
    state: State<AppState>,
    skill_id: String,
) -> Result<SkillManifest, ErrorPayload> {
    skill_store(&state)
        .mark_trusted(&skill_id)
        .map_err(AppError::Message)
        .map_err(map_err)
}

#[tauri::command]
pub async fn test_skill_in_vm(
    state: State<'_, AppState>,
    skill_id: String,
    args: Vec<String>,
    domain: String,
    ssh_target: String,
) -> Result<SkillVmReport, ErrorPayload> {
    let store = skill_store(&state);
    let manifest = store
        .load(&skill_id)
        .map_err(AppError::Message)
        .map_err(map_err)?;
    let kind = skills::derive_kind(manifest.category);
    if !skills::is_vm_testable(kind) {
        return Err(map_err(AppError::Message(
            "Skill de hardware não roda em VM. Use dry-run e aprovação manual no host.".to_owned(),
        )));
    }
    let (script_path, contents) = store
        .read_script(&manifest)
        .map_err(AppError::Message)
        .map_err(map_err)?;
    // Reject anything that cannot be previewed in dry-run before touching the VM.
    skills::build_plan(&manifest, &contents, &args)
        .map_err(AppError::Message)
        .map_err(map_err)?;

    let runner = VirshVmRunner::new(ssh_target);
    let snapshot = format!("ailu-skill-{skill_id}-{}", Uuid::new_v4());
    let script = script_path.to_string_lossy().to_string();
    Ok(skills::run_skill_in_vm(&runner, &domain, &manifest, &script, &args, &snapshot, None).await)
}

fn user_skill_store(state: &State<AppState>) -> UserSkillStore {
    UserSkillStore::default_for_dir(state.config_manager.data_root())
}

#[tauri::command]
pub fn list_user_skills(state: State<AppState>) -> Result<Vec<UserSkill>, ErrorPayload> {
    Ok(user_skill_store(&state).list())
}

#[tauri::command]
pub fn save_user_skill(
    state: State<AppState>,
    input: UserSkillInput,
) -> Result<Vec<UserSkill>, ErrorPayload> {
    user_skill_store(&state)
        .save(input)
        .map_err(AppError::Message)
        .map_err(map_err)
}

#[tauri::command]
pub fn delete_user_skill(
    state: State<AppState>,
    id: String,
) -> Result<Vec<UserSkill>, ErrorPayload> {
    user_skill_store(&state)
        .delete(&id)
        .map_err(AppError::Message)
        .map_err(map_err)
}

#[tauri::command]
pub fn dry_run_user_skill(
    state: State<AppState>,
    id: String,
) -> Result<UserSkillDryRun, ErrorPayload> {
    user_skill_store(&state)
        .dry_run(&id)
        .map_err(AppError::Message)
        .map_err(map_err)
}

fn memory_entry_store(state: &State<AppState>) -> MemoryEntryStore {
    MemoryEntryStore::default_for_dir(state.memory_manager.memory_dir())
}

#[tauri::command]
pub fn list_memory_entries(state: State<AppState>) -> Result<Vec<MemoryEntry>, ErrorPayload> {
    Ok(memory_entry_store(&state).list())
}

#[tauri::command]
pub fn save_memory_entry(
    state: State<AppState>,
    entry: MemoryEntry,
) -> Result<Vec<MemoryEntry>, ErrorPayload> {
    memory_entry_store(&state)
        .save(entry)
        .map_err(AppError::Message)
        .map_err(map_err)
}

#[tauri::command]
pub fn delete_memory_entry(
    state: State<AppState>,
    id: String,
) -> Result<Vec<MemoryEntry>, ErrorPayload> {
    memory_entry_store(&state)
        .delete(&id)
        .map_err(AppError::Message)
        .map_err(map_err)
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
    let app_root = app_project_root_for_health(&settings.workspace_root);
    let base_dir = app_root.to_string_lossy().to_string();
    let expected_base_dir = base_dir.clone();
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
    let stt = stt_config_snapshot(None).ok();
    let branch =
        git_output(&base_dir, ["branch", "--show-current"]).filter(|value| !value.is_empty());
    let node_ok = command_ok("node", ["--version"]);
    let npm_ok = command_ok("npm", ["--version"]);
    let cargo_ok = command_ok("cargo", ["--version"]);
    let tauri_ok = command_ok("npm", ["run", "tauri", "--", "--version"]);
    let correct_base_dir = base_dir == expected_base_dir;
    let git_dirty =
        git_output(&base_dir, ["status", "--short"]).is_some_and(|value| !value.is_empty());
    let disk_detail = command_text("df", &["-h", &settings.local_models_root])
        .and_then(|text| text.lines().nth(1).map(str::to_owned))
        .unwrap_or_else(|| "Espaço em disco não detectado.".to_owned());
    let gpu_detail = command_text(
        "sh",
        &[
            "-c",
            "lspci 2>/dev/null | grep -Ei 'vga|3d|display' | head -3",
        ],
    )
    .filter(|text| !text.is_empty())
    .unwrap_or_else(|| "GPU não detectada via lspci neste ambiente.".to_owned());
    let workflow_exists = app_root.join(".github/workflows/ci.yml").is_file();
    let desktop_entry_exists = app_root.join("assets/ailu-ai-studio.desktop").is_file();
    let icon_exists = app_root.join("src-tauri/icons/512x512.png").is_file();
    let stt_backend_status = match stt.as_ref() {
        Some(snapshot) if snapshot.ready => "ok",
        Some(snapshot) if !snapshot.ffmpeg.installed => "error",
        Some(_) => "warning",
        None => "warning",
    };
    let stt_backend_detail = stt
        .as_ref()
        .map(|snapshot| {
            if snapshot.ready {
                return snapshot.message.clone();
            }
            let model = snapshot
                .model_path
                .clone()
                .unwrap_or_else(|| "modelo não selecionado".to_owned());
            format!("{} Modelo: {model}", snapshot.message)
        })
        .unwrap_or_else(|| "Diagnóstico STT indisponível.".to_owned());
    let stt_backend_action = if stt_backend_status == "ok" {
        Some("Gravar teste curto")
    } else {
        Some("Configurar transcrição local")
    };
    let stt_backend_command = if stt_backend_status == "ok" {
        None
    } else {
        stt.as_ref()
            .map(|snapshot| snapshot.install_command.as_str())
    };
    let capture = stt
        .as_ref()
        .map(|snapshot| snapshot.capture.clone())
        .unwrap_or_else(stt_capture_snapshot);
    let ffmpeg_installed = command_ok("ffmpeg", ["-version"]);
    let pipewire_active = systemctl_user_active("pipewire.service");
    let wireplumber_active = systemctl_user_active("wireplumber.service");
    let portal_active = systemctl_user_active("xdg-desktop-portal.service");

    let mut items = vec![
        health_item(
            "ollama-installed",
            "Ollama instalado",
            ollama.installed,
            ollama
                .runtime_path
                .clone()
                .unwrap_or_else(|| ollama.message.clone()),
            Some("Instalar Ollama"),
            ollama.install_command.as_deref(),
        ),
        health_item(
            "ollama-api",
            "Ollama API ativa",
            ollama.api_reachable,
            ollama.api_url.clone(),
            Some("Iniciar serviço Ollama"),
            Some("systemctl --user status ollama || systemctl status ollama"),
        ),
        health_item(
            "ollama-models",
            "Modelos Ollama instalados",
            !ollama.installed_models.is_empty(),
            format!("{} modelo(s)", ollama.installed_models.len()),
            Some("Baixar modelo pelo Model Manager"),
            Some("ollama list"),
        ),
        health_item(
            "disk",
            "Espaço em disco",
            ollama.disk_ok.unwrap_or(false),
            disk_detail,
            Some("Liberar espaço em disco"),
            Some("df -h ~/.codex/models"),
        ),
        health_item(
            "gpu",
            "GPU detectada",
            !gpu_detail.starts_with("GPU não"),
            gpu_detail,
            None,
            Some("lspci | grep -Ei 'vga|3d|display'"),
        ),
        health_item(
            "pipewire",
            "PipeWire",
            pipewire_active,
            "Serviço de áudio do usuário.".to_owned(),
            Some("Verificar PipeWire"),
            Some("systemctl --user status pipewire"),
        ),
        health_item(
            "wireplumber",
            "WirePlumber",
            wireplumber_active,
            "Gerenciador PipeWire.".to_owned(),
            Some("Verificar WirePlumber"),
            Some("systemctl --user status wireplumber"),
        ),
        health_item(
            "portal",
            "xdg-desktop-portal",
            portal_active,
            "Portal necessário para permissões do WebView.".to_owned(),
            Some("Verificar portal"),
            Some("systemctl --user status xdg-desktop-portal"),
        ),
        health_item(
            "ffmpeg",
            "ffmpeg",
            ffmpeg_installed,
            "Conversão de áudio para STT.".to_owned(),
            if ffmpeg_installed {
                None
            } else {
                Some("Instalar ffmpeg")
            },
            if ffmpeg_installed {
                None
            } else {
                Some("pacman -S --needed ffmpeg")
            },
        ),
        health_item_with_status(
            "stt-backend",
            "Backend STT",
            stt_backend_status,
            stt_backend_detail,
            stt_backend_action,
            stt_backend_command,
        ),
        health_item_with_status(
            "microphone-webview",
            "Captura WebView",
            &capture.webview_status,
            capture.webview_message.clone(),
            Some("Testar microfone no composer"),
            Some("systemctl --user status pipewire wireplumber xdg-desktop-portal"),
        ),
        health_item_with_status(
            "microphone-native",
            "Captura nativa",
            &capture.native_status,
            capture.native_message.clone(),
            Some("Gravar teste curto"),
            Some("pw-record / parecord / arecord / ffmpeg"),
        ),
        health_item(
            "api-keys",
            "API keys configuradas",
            providers.iter().any(|provider| provider.has_key),
            "Credenciais são mascaradas e testadas por provider.".to_owned(),
            Some("Configurar provider"),
            None,
        ),
        health_item(
            "providers-tested",
            "Providers testados",
            providers
                .iter()
                .any(|provider| matches!(provider.status.state, ProviderStatusState::Ready)),
            "Ready só aparece após teste real.".to_owned(),
            Some("Testar conexão"),
            None,
        ),
        health_item(
            "desktop-entry",
            "Desktop entry",
            desktop_entry_exists,
            "assets/ailu-ai-studio.desktop".to_owned(),
            if desktop_entry_exists {
                None
            } else {
                Some("Instalar desktop entry")
            },
            if desktop_entry_exists {
                None
            } else {
                Some("bash scripts/install-desktop-entry.sh")
            },
        ),
        health_item(
            "icon",
            "Ícone",
            icon_exists,
            "src-tauri/icons/512x512.png".to_owned(),
            if icon_exists {
                None
            } else {
                Some("Validar alpha")
            },
            if icon_exists {
                None
            } else {
                Some("npm run icons:validate")
            },
        ),
        health_item(
            "ci",
            "GitHub Actions",
            workflow_exists,
            ".github/workflows/ci.yml".to_owned(),
            Some("Rodar CI local"),
            Some("npm run lint && npm run test -- --run"),
        ),
        health_item(
            "git",
            "Workspace Git",
            !git_dirty,
            if git_dirty {
                "Worktree sujo.".to_owned()
            } else {
                "Worktree limpo.".to_owned()
            },
            Some("Revisar git status"),
            Some("git status --short"),
        ),
    ];
    for item in &mut items {
        if item.id == "ollama-api" && !ollama.installed {
            item.status = "error".to_owned();
        }
    }

    let mut actions = Vec::new();
    let mut recent_errors = Vec::new();
    if !correct_base_dir {
        actions.push(AppHealthAction {
            label: "Abrir workspace ativo".to_owned(),
            command: Some(format!("cd {expected_base_dir}")),
        });
        recent_errors.push(actionable_error(
            "wrong_workspace",
            ActionableErrorSeverity::Error,
            "Workspace ativo não corresponde à base configurada.",
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
        items,
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
pub async fn show_local_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<OllamaModelDetails, ErrorPayload> {
    let settings = state.settings();
    state
        .local_runtime_service
        .show_model(&settings, &model_id)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn search_ollama_library(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<OllamaLibrarySearchResult>, ErrorPayload> {
    state
        .local_runtime_service
        .search_library(&query)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn test_local_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<ProviderRuntimeStatus, ErrorPayload> {
    match state.local_runtime_service.test_model(&model_id).await {
        Ok(()) => Ok(ProviderRuntimeStatus {
            state: ProviderStatusState::Ready,
            message: format!("Ollama respondeu ao teste curto de `{model_id}`."),
            command: Some("POST http://127.0.0.1:11434/api/generate".to_owned()),
            version: None,
            checked_at: crate::models::now_iso(),
        }),
        Err(error) => Ok(ProviderRuntimeStatus {
            state: ProviderStatusState::Error,
            message: error.to_string(),
            command: Some("POST http://127.0.0.1:11434/api/generate".to_owned()),
            version: None,
            checked_at: crate::models::now_iso(),
        }),
    }
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
    run_agent_order(
        Some(&app),
        state.session_manager.clone(),
        state.provider_registry.clone(),
        state.settings(),
        session_id,
        content,
        mode,
        attachments.unwrap_or_default(),
    )
    .await
    .map_err(map_err)
}

#[tauri::command]
pub async fn send_temporary_order_to_agent(
    state: State<'_, AppState>,
    messages: Option<Vec<ChatMessage>>,
    content: String,
    mode: Option<String>,
    attachments: Option<Vec<Value>>,
) -> Result<AgentSession, ErrorPayload> {
    run_temporary_agent_order(
        state.provider_registry.clone(),
        state.settings(),
        messages.unwrap_or_default(),
        content,
        mode,
        attachments.unwrap_or_default(),
    )
    .await
    .map_err(map_err)
}

#[tauri::command]
pub async fn compare_models(
    state: State<'_, AppState>,
    input: ModelComparisonRequest,
) -> Result<ModelComparisonResponse, ErrorPayload> {
    let prompt = input.prompt.trim().to_owned();
    if prompt.is_empty() {
        return Err(map_err(AppError::Message(
            "Prompt de comparação vazio.".to_owned(),
        )));
    }
    if input.targets.len() < 2 {
        return Err(map_err(AppError::Message(
            "Escolha pelo menos dois modelos para comparar.".to_owned(),
        )));
    }

    let settings = state.settings();
    let mut results = Vec::new();
    for target in input.targets.into_iter().take(6) {
        let provider_id = target.provider_id.clone();
        let model_id = target.model_id.clone();
        let label = target.label.clone();
        match state
            .provider_registry
            .generate_response(ProviderGenerateRequest {
                provider_id: provider_id.clone(),
                model_id: model_id.clone(),
                prompt: prompt.clone(),
                attachments: Vec::new(),
                workspace_root: settings.workspace_root.clone(),
                account_profile_id: target.account_profile_id.clone(),
            })
            .await
        {
            Ok(result) => results.push(ModelComparisonResult {
                provider_id,
                model_id,
                label,
                ok: true,
                content: Some(result.content),
                error: None,
                command: result.command,
            }),
            Err(error) => results.push(ModelComparisonResult {
                provider_id,
                model_id,
                label,
                ok: false,
                content: None,
                error: Some(provider_chat_error_message(
                    "provider",
                    "modelo",
                    &error.to_string(),
                )),
                command: None,
            }),
        }
    }

    Ok(ModelComparisonResponse {
        prompt,
        results,
        completed_at: crate::models::now_iso(),
    })
}

async fn run_agent_order(
    app: Option<&AppHandle>,
    session_manager: Arc<SessionManager>,
    provider_registry: Arc<ProviderRegistry>,
    settings: AppSettings,
    session_id: String,
    content: String,
    mode: Option<String>,
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
    let session_environment = session_manager.get_session(&session_id).ok();
    let history = session_environment
        .as_ref()
        .map(|session| session.messages.clone())
        .unwrap_or_default();
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

    let router = AiRouter::new(provider_registry.clone());
    match router
        .route(AiRouteRequest {
            provider_id: provider_id.clone(),
            model_id: model_id.clone(),
            prompt: visible_prompt.to_owned(),
            history,
            mode,
            attachments,
            workspace_root: settings.workspace_root,
            account_profile_id,
            language: settings.ai_response_language,
            temporary: false,
            developer_mode: settings.developer_mode,
            routing: settings.ai_routing,
        })
        .await
    {
        Ok(route) => {
            emit_provider_logs(app, &session_id, &route.result);
            emit_status_note(
                app,
                session_manager.make_status_note(
                    &session_id,
                    StatusKind::Success,
                    "Resposta do provider recebida",
                    route
                        .result
                        .status
                        .command
                        .as_deref()
                        .unwrap_or("Provider sem comando externo."),
                ),
            );

            let summary = if route.fallback_used {
                format!(
                    "{} Respondido por fallback: {}/{}. Tentativas: {}.",
                    route.result.status.message,
                    route.provider_id,
                    route.model_id,
                    route.attempts.join(" -> ")
                )
            } else {
                route.result.status.message.clone()
            };
            let session = session_manager
                .append_assistant_message(
                    &session_id,
                    &route.result.content,
                    Some(summary),
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

async fn run_temporary_agent_order(
    provider_registry: Arc<ProviderRegistry>,
    settings: AppSettings,
    mut messages: Vec<ChatMessage>,
    content: String,
    mode: Option<String>,
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

    let created_at = messages
        .first()
        .map(|message| message.created_at.clone())
        .unwrap_or_else(crate::models::now_iso);
    messages.push(ChatMessage {
        id: Uuid::new_v4().to_string(),
        role: ChatRole::User,
        content: visible_prompt.to_owned(),
        created_at: crate::models::now_iso(),
        reasoning_summary: None,
        attachments: attachments.clone(),
    });

    let provider_id = settings.selected_provider_id.clone();
    let model_id = if settings.execution_mode == crate::models::ExecutionMode::Local {
        settings
            .selected_local_model_id
            .clone()
            .unwrap_or_else(|| settings.selected_model_id.clone())
    } else {
        settings.selected_model_id.clone()
    };
    let provider_label = provider_registry
        .providers()
        .into_iter()
        .find(|provider| provider.id == provider_id)
        .map(|provider| provider.label)
        .unwrap_or_else(|| provider_id.clone());
    let history = messages[..messages.len().saturating_sub(1)].to_vec();
    let router = AiRouter::new(provider_registry.clone());
    match router
        .route(AiRouteRequest {
            provider_id: provider_id.clone(),
            model_id: model_id.clone(),
            prompt: visible_prompt.to_owned(),
            history,
            mode,
            attachments,
            workspace_root: settings.workspace_root,
            account_profile_id: settings.selected_provider_profile_id.clone(),
            language: settings.ai_response_language,
            temporary: true,
            developer_mode: settings.developer_mode,
            routing: settings.ai_routing,
        })
        .await
    {
        Ok(route) => {
            let summary = if route.fallback_used {
                format!(
                    "{} Respondido por fallback: {}/{}. Tentativas: {}.",
                    route.result.status.message,
                    route.provider_id,
                    route.model_id,
                    route.attempts.join(" -> ")
                )
            } else {
                route.result.status.message.clone()
            };
            messages.push(ChatMessage {
                id: Uuid::new_v4().to_string(),
                role: ChatRole::Assistant,
                content: route.result.content,
                created_at: crate::models::now_iso(),
                reasoning_summary: Some(summary),
                attachments: Vec::new(),
            });
            Ok(temporary_session(
                messages,
                created_at,
                SessionStatus::Idle,
                route.provider_id,
                route.model_id,
                settings.selected_agent_id,
                route.account_profile_id,
            ))
        }
        Err(cause) => {
            let detail = cause.to_string();
            messages.push(ChatMessage {
                id: Uuid::new_v4().to_string(),
                role: ChatRole::Assistant,
                content: provider_chat_error_message(&provider_label, &model_id, &detail),
                created_at: crate::models::now_iso(),
                reasoning_summary: Some(
                    "Falha controlada do provider; nenhuma resposta simulada foi usada.".to_owned(),
                ),
                attachments: Vec::new(),
            });
            Ok(temporary_session(
                messages,
                created_at,
                SessionStatus::Error,
                provider_id,
                model_id,
                settings.selected_agent_id,
                settings.selected_provider_profile_id,
            ))
        }
    }
}

fn temporary_session(
    messages: Vec<ChatMessage>,
    created_at: String,
    status: SessionStatus,
    provider_id: String,
    model_id: String,
    agent_profile_id: String,
    account_profile_id: Option<String>,
) -> AgentSession {
    AgentSession {
        id: "temporary-chat".to_owned(),
        title: "Bate-papo Temporário".to_owned(),
        created_at,
        updated_at: crate::models::now_iso(),
        status,
        messages,
        tasks: Vec::new(),
        archived: false,
        provider_id: Some(provider_id),
        model_id: Some(model_id),
        agent_profile_id: Some(agent_profile_id),
        account_profile_id,
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
        lines.push("Revise a conta ou modelo em Configurações > Modelos.".to_owned());
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
        let dir = std::env::temp_dir().join(format!("ailu-agent-order-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("deve criar diretório temporário");
        dir
    }

    fn mock_settings(workspace_root: String) -> AppSettings {
        AppSettings {
            workspace_root,
            codex_root: "/tmp/ailu-data-root".to_owned(),
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
            developer_mode: false,
            ai_routing: crate::models::AiRoutingSettings::default(),
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
            None,
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

    #[tokio::test]
    async fn temporary_order_sends_user_text_to_provider_without_persistence_manager() {
        let provider_registry = Arc::new(ProviderRegistry::new_with_mock_for_tests());
        let settings = mock_settings("/tmp/workspace".to_owned());

        let updated = run_temporary_agent_order(
            provider_registry,
            settings,
            Vec::new(),
            "opa".to_owned(),
            None,
            Vec::new(),
        )
        .await
        .expect("temporário mock deve responder");

        assert_eq!(updated.id, "temporary-chat");
        assert!(updated.messages.iter().any(|message| matches!(
            message.role,
            crate::models::ChatRole::User
        ) && message.content == "opa"));
        let assistant = updated
            .messages
            .iter()
            .rev()
            .find(|message| matches!(message.role, crate::models::ChatRole::Assistant))
            .expect("resposta do provider deve existir");
        assert!(assistant.content.contains("[solicitação]\nopa"));
        assert_ne!(assistant.content.trim(), "Português (Brasil)");
    }

    #[tokio::test]
    async fn temporary_order_sends_in_memory_history_to_provider() {
        let provider_registry = Arc::new(ProviderRegistry::new_with_mock_for_tests());
        let settings = mock_settings("/tmp/workspace".to_owned());
        let previous = vec![
            ChatMessage {
                id: "m1".to_owned(),
                role: ChatRole::User,
                content: "pergunta anterior".to_owned(),
                created_at: crate::models::now_iso(),
                reasoning_summary: None,
                attachments: Vec::new(),
            },
            ChatMessage {
                id: "m2".to_owned(),
                role: ChatRole::Assistant,
                content: "resposta anterior".to_owned(),
                created_at: crate::models::now_iso(),
                reasoning_summary: None,
                attachments: Vec::new(),
            },
        ];

        let updated = run_temporary_agent_order(
            provider_registry,
            settings,
            previous,
            "continue".to_owned(),
            Some("terminal".to_owned()),
            Vec::new(),
        )
        .await
        .expect("temporário mock deve responder com histórico");

        let assistant = updated
            .messages
            .iter()
            .rev()
            .find(|message| matches!(message.role, crate::models::ChatRole::Assistant))
            .expect("resposta do provider deve existir");
        assert!(assistant
            .content
            .contains("histórico temporário em memória"));
        assert!(assistant.content.contains("pergunta anterior"));
        assert!(assistant.content.contains("resposta anterior"));
        assert!(assistant.content.contains("[solicitação atual]\ncontinue"));
        assert!(assistant.content.contains("fluxo de terminal"));
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

// ── System read-only tools and local TTS ──────────────────────────────────

/// Returns true when `name` is resolvable on PATH. Uses `command -v`, which is
/// a shell builtin and does not execute the target program.
fn binary_in_path(name: &str) -> bool {
    Command::new("sh")
        .arg("-c")
        .arg(format!("command -v {name}"))
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessEntry {
    user: String,
    pid: String,
    cpu: String,
    mem: String,
    command: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessListReport {
    os: String,
    command_used: String,
    timestamp: String,
    processes: Vec<ProcessEntry>,
    error: Option<String>,
}

/// Read-only listing of the top processes by memory. No sudo, no shell from the
/// model — a fixed, safe `ps` invocation.
#[tauri::command]
pub fn list_running_processes() -> Result<ProcessListReport, ErrorPayload> {
    let timestamp = crate::models::now_iso();
    let os = std::env::consts::OS.to_owned();

    if os != "linux" && os != "macos" {
        return Ok(ProcessListReport {
            os,
            command_used: String::new(),
            timestamp,
            processes: Vec::new(),
            error: Some(
                "Listagem de processos suportada apenas em Linux/macOS neste app.".to_owned(),
            ),
        });
    }

    let command_used = "ps aux --sort=-%mem | head -20".to_owned();
    let output = Command::new("ps").args(["aux", "--sort=-%mem"]).output();
    let output = match output {
        Ok(output) if output.status.success() => output,
        Ok(output) => {
            return Ok(ProcessListReport {
                os,
                command_used,
                timestamp,
                processes: Vec::new(),
                error: Some(format!(
                    "`ps` retornou erro: {}",
                    String::from_utf8_lossy(&output.stderr).trim()
                )),
            });
        }
        Err(cause) => {
            return Ok(ProcessListReport {
                os,
                command_used,
                timestamp,
                processes: Vec::new(),
                error: Some(format!("Não foi possível executar `ps`: {cause}")),
            });
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut processes = Vec::new();
    // Skip the header row; ps aux columns:
    // USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
    for line in stdout.lines().skip(1).take(20) {
        let mut parts = line.split_whitespace();
        let user = parts.next().unwrap_or_default().to_owned();
        let pid = parts.next().unwrap_or_default().to_owned();
        let cpu = parts.next().unwrap_or_default().to_owned();
        let mem = parts.next().unwrap_or_default().to_owned();
        // Drop VSZ RSS TTY STAT START TIME (6 columns) before COMMAND.
        for _ in 0..6 {
            parts.next();
        }
        let command = parts.collect::<Vec<_>>().join(" ");
        if pid.is_empty() {
            continue;
        }
        processes.push(ProcessEntry {
            user,
            pid,
            cpu,
            mem,
            command,
        });
    }

    Ok(ProcessListReport {
        os,
        command_used,
        timestamp,
        processes,
        error: None,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsStatus {
    available: bool,
    engine: Option<String>,
    detail: String,
    install_hint: Option<String>,
}

/// Detects a local speech engine without speaking. Order of preference:
/// speech-dispatcher (`spd-say`) then `espeak-ng`/`espeak`.
fn detect_tts_engine() -> Option<&'static str> {
    if binary_in_path("spd-say") {
        Some("spd-say")
    } else if binary_in_path("espeak-ng") {
        Some("espeak-ng")
    } else if binary_in_path("espeak") {
        Some("espeak")
    } else {
        None
    }
}

#[tauri::command]
pub fn get_tts_status() -> Result<TtsStatus, ErrorPayload> {
    match detect_tts_engine() {
        Some(engine) => Ok(TtsStatus {
            available: true,
            engine: Some(engine.to_owned()),
            detail: format!("Engine de voz local detectada: {engine}."),
            install_hint: None,
        }),
        None => Ok(TtsStatus {
            available: false,
            engine: None,
            detail: "Nenhuma engine de voz local encontrada.".to_owned(),
            install_hint: Some(
                "Instale com: sudo pacman -S speech-dispatcher espeak-ng (Arch) ou o pacote equivalente da sua distro.".to_owned(),
            ),
        }),
    }
}

/// Speaks `text` via the detected local engine. Text is passed as a process
/// argument (never through a shell), so it cannot be interpreted as a command.
#[tauri::command]
pub fn speak_text(text: String, lang: Option<String>) -> Result<TtsStatus, ErrorPayload> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(TtsStatus {
            available: true,
            engine: None,
            detail: "Nada para falar.".to_owned(),
            install_hint: None,
        });
    }

    let engine = match detect_tts_engine() {
        Some(engine) => engine,
        None => return get_tts_status(),
    };

    let lang = lang.unwrap_or_else(|| "pt-BR".to_owned());
    let spawn = match engine {
        "spd-say" => Command::new("spd-say")
            .args(["-l", &lang, "-w", "--", trimmed])
            .spawn(),
        "espeak-ng" | "espeak" => Command::new(engine)
            .args(["-v", "pt", trimmed])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn(),
        _ => return get_tts_status(),
    };

    match spawn {
        Ok(_) => Ok(TtsStatus {
            available: true,
            engine: Some(engine.to_owned()),
            detail: format!("Falando com {engine}."),
            install_hint: None,
        }),
        Err(cause) => Ok(TtsStatus {
            available: false,
            engine: Some(engine.to_owned()),
            detail: format!("Falha ao iniciar {engine}: {cause}"),
            install_hint: None,
        }),
    }
}

/// Stops any in-progress local speech.
#[tauri::command]
pub fn stop_speech() -> Result<(), ErrorPayload> {
    match detect_tts_engine() {
        Some("spd-say") => {
            let _ = Command::new("spd-say").arg("-C").output();
        }
        Some("espeak-ng") => {
            let _ = Command::new("pkill").args(["-x", "espeak-ng"]).output();
        }
        Some("espeak") => {
            let _ = Command::new("pkill").args(["-x", "espeak"]).output();
        }
        _ => {}
    }
    Ok(())
}
