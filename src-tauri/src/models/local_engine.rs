//! Ailu Local Engine (Runtime Manager) contracts.
//!
//! Honest, hardware-aware types shared with the frontend. Detection never
//! fabricates a value: unknown fields are `None`/`Unknown` with a note.
//! Built on top of `services::hardware` primitives; this module adds the
//! richer snapshot, model fit classes, runtime backends and presets.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GpuVendor {
    Amd,
    Nvidia,
    Intel,
    Other,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AcceleratorApi {
    Cuda,
    Rocm,
    Hip,
    Vulkan,
    Sycl,
    OpenCl,
    Cpu,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AcceleratorStatus {
    /// Confirmed working (binary present and probe succeeded).
    Healthy,
    /// Tooling present but health not confirmed.
    Present,
    /// Not detected.
    Unavailable,
    /// Could not be probed in this environment.
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceleratorInfo {
    pub api: AcceleratorApi,
    pub status: AcceleratorStatus,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OsInfo {
    pub os: String,
    pub kernel: Option<String>,
    pub distro: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuInfo {
    pub model: Option<String>,
    pub physical_cores: Option<usize>,
    pub logical_threads: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    pub total_bytes: u64,
    pub available_bytes: Option<u64>,
    pub swap_total_bytes: u64,
    pub headroom_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuDevice {
    pub vendor: GpuVendor,
    pub name: Option<String>,
    pub vram_total_bytes: Option<u64>,
    pub vram_used_bytes: Option<u64>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    pub mount: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HardwareProfileTag {
    WeakPc,
    MediumPc,
    LowRamPc,
    HighRamPc,
    AmdPc,
    AmdVulkanPc,
    AmdRocmPc,
    NvidiaPc,
    IntelArcPc,
    Server,
    Experimental,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareSnapshot {
    pub os: OsInfo,
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub gpus: Vec<GpuDevice>,
    pub disks: Vec<DiskInfo>,
    pub accelerators: Vec<AcceleratorInfo>,
    pub profile_tags: Vec<HardwareProfileTag>,
    pub notes: Vec<String>,
    pub detected_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeBackendId {
    Ollama,
    LlamaCppCpu,
    LlamaCppVulkan,
    LlamaCppRocm,
    LlamaCppHip,
    LlamaCppCuda,
    LlamaCppSycl,
    LlamaCppServer,
    OpenAiCompatible,
    AirLlm,
    Vllm,
    ExLlamaV2,
    MlcLlm,
    TensorRtLlm,
    SgLang,
    FlexGen,
    TransformersAccelerate,
    KoboldCpp,
    CloudFallback,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionProfile {
    Safe,
    Fast,
    Balanced,
    Heavy,
    Max,
    VramSaver,
    RamSaver,
    LongContext,
    Code,
    Chat,
    Agent,
    Rag,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelFormat {
    Gguf,
    Safetensors,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelSizeClass {
    Light,
    Medium,
    Heavy,
    VeryHeavy,
    Absurd,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FitClass {
    Excellent,
    Fits,
    Tight,
    SlowSwap,
    WontRun,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProfile {
    pub model_id: String,
    pub parameter_count: Option<u64>,
    pub size_class: ModelSizeClass,
    pub format: ModelFormat,
    pub quantization: Option<String>,
    pub weight_bytes: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WarningSeverity {
    Info,
    Warning,
    Strong,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWarning {
    pub code: String,
    pub severity: WarningSeverity,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeEstimate {
    pub fit: FitClass,
    pub recommended: bool,
    pub experimental: bool,
    pub vram_required_bytes: Option<u64>,
    pub ram_required_bytes: u64,
    pub recommended_context: u32,
    pub uses_offload: bool,
    pub expected_slow: bool,
    pub speed_hint: String,
    pub warnings: Vec<RuntimeWarning>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackendAvailability {
    /// Installed, probed, and ready to run.
    Ready,
    /// Installed but not confirmed working.
    Installed,
    /// Not installed on this system.
    NotInstalled,
    /// Detected but flagged experimental / not recommended.
    Experimental,
    /// Planned; descriptor only for now.
    FutureAvailable,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendStatus {
    pub id: RuntimeBackendId,
    pub label: String,
    pub availability: BackendAvailability,
    pub version: Option<String>,
    pub detail: String,
    pub experimental: bool,
    /// Safe, human-readable install/build plan. Never auto-executed.
    pub install_plan: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeRecommendation {
    pub backend: RuntimeBackendId,
    pub profile: ExecutionProfile,
    pub estimate: RuntimeEstimate,
    pub score: i32,
    pub rationale: String,
    pub message: String,
    pub alternatives: Vec<RuntimeBackendId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePreset {
    pub model_id: String,
    pub backend_id: RuntimeBackendId,
    pub profile: ExecutionProfile,
    pub context_size: u32,
    #[serde(default)]
    pub gpu_layers: Option<i32>,
    #[serde(default)]
    pub threads: Option<u32>,
    #[serde(default)]
    pub batch_size: Option<u32>,
    #[serde(default)]
    pub kv_cache_quant: Option<String>,
    #[serde(default)]
    pub offload_gpu: bool,
    #[serde(default)]
    pub offload_cpu: bool,
    #[serde(default)]
    pub offload_ram: bool,
    #[serde(default)]
    pub offload_disk: bool,
    #[serde(default)]
    pub env: Vec<(String, String)>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BenchmarkKind {
    Smoke,
    Quick,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkResult {
    pub model_id: String,
    pub backend_id: RuntimeBackendId,
    pub kind: BenchmarkKind,
    pub ok: bool,
    pub tokens_per_second: Option<f64>,
    pub time_to_first_token_ms: Option<u64>,
    pub ram_peak_bytes: Option<u64>,
    pub vram_peak_bytes: Option<u64>,
    pub bottleneck: Option<String>,
    pub detail: String,
    pub at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRuntimeRequest {
    pub model_id: String,
    #[serde(default)]
    pub parameter_label: Option<String>,
    #[serde(default)]
    pub quantization: Option<String>,
    #[serde(default)]
    pub file_bytes: Option<u64>,
    #[serde(default)]
    pub context_size: Option<u32>,
    #[serde(default)]
    pub profile: Option<ExecutionProfile>,
}
