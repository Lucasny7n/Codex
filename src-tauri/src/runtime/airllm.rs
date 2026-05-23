use crate::executor::ApprovedExecutionPlan;
use crate::executor::SkillStep;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SidecarStatusResponse {
    pub ok: bool,
    pub python: Option<String>,
    pub airllm_installed: Option<bool>,
    pub torch_installed: Option<bool>,
    pub device: Option<String>,
    pub code: Option<String>,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SidecarGenerateResponse {
    pub ok: bool,
    pub model: Option<String>,
    pub response: Option<String>,
    pub tokens_per_second: Option<f64>,
    pub elapsed_ms: Option<u64>,
    pub code: Option<String>,
    pub message: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalModel {
    pub id: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SidecarListModelsResponse {
    pub ok: bool,
    pub models: Option<Vec<LocalModel>>,
    pub code: Option<String>,
    pub message: Option<String>,
}

fn get_venv_python() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Não foi possível encontrar diretório home")?;
    let python_path = home.join(".local/share/ailu/airllm-venv/bin/python3");

    // We try to return the path even if it doesn't exist yet,
    // because the sidecar itself might be executed via system python to return an honest "airllm_not_installed" error.
    Ok(python_path)
}

fn get_sidecar_path() -> Result<PathBuf, String> {
    // Para simplificar no dev/prod, assumiremos que o sidecar está na raiz do projeto dev
    // ou no cache app data em prod. Para agora, local path.
    let path = std::env::current_dir()
        .unwrap_or_default()
        .join("sidecars")
        .join("ailu_runtime.py");
    if path.exists() {
        Ok(path)
    } else {
        // Fallback genérico (poderia ser tauri app path resolver no futuro)
        Ok(PathBuf::from("sidecars/ailu_runtime.py"))
    }
}

#[tauri::command]
pub fn run_airllm_status() -> Result<SidecarStatusResponse, String> {
    let python_path = get_venv_python()?;
    let python_bin = if python_path.exists() {
        python_path.to_string_lossy().to_string()
    } else {
        // Se não tem venv, usa python do sistema para rodar o sidecar que vai dizer que airllm não está instalado.
        "python3".to_string()
    };

    let sidecar_path = get_sidecar_path()?;

    let output = Command::new(&python_bin)
        .arg(&sidecar_path)
        .arg("status")
        .output()
        .map_err(|e| format!("Falha ao invocar sidecar: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        // Tentar ler json de erro mesmo assim
        if let Ok(json_resp) = serde_json::from_str::<SidecarStatusResponse>(&stdout) {
            return Ok(json_resp);
        }
        return Err(format!("Erro interno no sidecar: {}", stderr));
    }

    match serde_json::from_str::<SidecarStatusResponse>(&stdout) {
        Ok(resp) => Ok(resp),
        Err(e) => Err(format!(
            "Erro ao parsear JSON do sidecar: {} - Saída: {}",
            e, stdout
        )),
    }
}

#[tauri::command]
pub fn run_airllm_generate(
    model: String,
    prompt: String,
) -> Result<SidecarGenerateResponse, String> {
    let python_path = get_venv_python()?;
    if !python_path.exists() {
        return Ok(SidecarGenerateResponse {
            ok: false,
            model: None,
            response: None,
            tokens_per_second: None,
            elapsed_ms: None,
            code: Some("venv_missing".into()),
            message: Some("Ambiente Python local não encontrado.".into()),
        });
    }

    let sidecar_path = get_sidecar_path()?;

    let output = Command::new(&python_path)
        .arg(&sidecar_path)
        .arg("generate")
        .arg("--model")
        .arg(&model)
        .arg("--prompt")
        .arg(&prompt)
        .output()
        .map_err(|e| format!("Falha ao invocar sidecar: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    match serde_json::from_str::<SidecarGenerateResponse>(&stdout) {
        Ok(resp) => Ok(resp),
        Err(e) => Err(format!("Erro ao parsear resposta do modelo: {}", e)),
    }
}

#[tauri::command]
pub fn run_airllm_benchmark(model: String) -> Result<String, String> {
    Ok(format!(
        "Benchmark para {} requisitado, funcionalidade pendente.",
        model
    ))
}

#[tauri::command]
pub fn list_local_models() -> Result<Vec<LocalModel>, String> {
    let home = dirs::home_dir().ok_or("Home não encontrada")?;
    let models_dir = home.join(".local/share/ailu/models");

    let python_path = get_venv_python()?;
    let python_bin = if python_path.exists() {
        python_path.to_string_lossy().to_string()
    } else {
        "python3".to_string()
    };
    let sidecar_path = get_sidecar_path()?;

    let output = Command::new(&python_bin)
        .arg(&sidecar_path)
        .arg("list-models")
        .arg("--models-dir")
        .arg(&models_dir.to_string_lossy().to_string())
        .output()
        .map_err(|e| format!("Falha ao listar modelos via sidecar: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    match serde_json::from_str::<SidecarListModelsResponse>(&stdout) {
        Ok(resp) => Ok(resp.models.unwrap_or_default()),
        Err(_) => Ok(vec![]),
    }
}

#[tauri::command]
pub fn create_airllm_setup_plan() -> Result<ApprovedExecutionPlan, String> {
    let home = dirs::home_dir().ok_or("Home não encontrada")?;
    let venv_dir = home.join(".local/share/ailu/airllm-venv");
    let pip_bin = venv_dir.join("bin/pip").to_string_lossy().to_string();

    let sidecars_dir = std::env::current_dir().unwrap_or_default().join("sidecars");
    let requirements = sidecars_dir
        .join("requirements-airllm.txt")
        .to_string_lossy()
        .to_string();

    let steps = vec![
        SkillStep {
            order: 1,
            description: "Criar ambiente virtual Python 3 (venv)".into(),
            command: "python3".into(),
            args: vec![
                "-m".into(),
                "venv".into(),
                venv_dir.to_string_lossy().to_string(),
            ],
            risk_level: "Seguro".into(),
            requires_sudo: false,
        },
        SkillStep {
            order: 2,
            description: "Atualizar pip".into(),
            command: pip_bin.clone(),
            args: vec!["install".into(), "--upgrade".into(), "pip".into()],
            risk_level: "Seguro".into(),
            requires_sudo: false,
        },
        SkillStep {
            order: 3,
            description: "Instalar dependências AirLLM e PyTorch".into(),
            command: pip_bin.clone(),
            args: vec!["install".into(), "-r".into(), requirements],
            risk_level: "Seguro".into(),
            requires_sudo: false,
        },
    ];

    let plan = ApprovedExecutionPlan {
        id: format!("setup-airllm-{}", chrono::Utc::now().timestamp()),
        skill_id: "setup-runtime".into(),
        summary: "Instalar AirLLM Runtime Local".into(),
        reason:
            "Necessário para rodar LLMs de bilhões de parâmetros na CPU/RAM localmente sem OOM."
                .into(),
        total_risk: "Seguro".into(),
        requires_sudo: false,
        requires_internet: Some(true),
        modifies_files: Some(true),
        modifies_services: Some(false),
        backup_required: Some(false),
        status: "pending".into(),
        steps,
        rollback_plan: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        approved_at: None,
    };

    Ok(plan)
}
