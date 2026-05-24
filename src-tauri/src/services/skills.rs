//! Skill executor with VM testing and automatic rollback.
//!
//! A skill is a deterministic plain-text script stored in a versioned folder
//! (never opaque "memory"). The hard rules enforced here:
//!
//! * Every skill must support `--dry-run`; a script without it is rejected.
//! * Software skills (file/package/git) are tested in a throwaway libvirt VM:
//!   snapshot -> run -> auto rollback if an error is detected.
//! * Hardware skills (audio/bluetooth/gpu) are NEVER VM-tested. They require a
//!   dry-run preview plus explicit manual approval on the host.
//! * Approval is click + spoken summary; nothing auto-approves.

use std::path::{Path, PathBuf};

use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::models::{
    now_iso, RiskLevel, SkillCategory, SkillExecutionMode, SkillExecutionPlan, SkillKind,
    SkillManifest, SkillVmOutcome, SkillVmReport,
};

/// Maps a category to whether it touches host hardware.
pub fn derive_kind(category: SkillCategory) -> SkillKind {
    match category {
        SkillCategory::File | SkillCategory::Package | SkillCategory::Git => SkillKind::Software,
        SkillCategory::Audio
        | SkillCategory::Bluetooth
        | SkillCategory::Gpu
        | SkillCategory::Network
        | SkillCategory::Other => SkillKind::Hardware,
    }
}

/// Hard constraint: only software skills may be VM-tested.
pub fn is_vm_testable(kind: SkillKind) -> bool {
    matches!(kind, SkillKind::Software)
}

pub fn execution_mode(kind: SkillKind) -> SkillExecutionMode {
    if is_vm_testable(kind) {
        SkillExecutionMode::VmTested
    } else {
        SkillExecutionMode::ManualDryRun
    }
}

/// A skill is only valid if its script can be invoked with `--dry-run`.
pub fn script_supports_dry_run(script_contents: &str) -> bool {
    let lower = script_contents.to_lowercase();
    lower.contains("--dry-run") || lower.contains("dry_run") || lower.contains("dryrun")
}

/// Content fingerprint (FNV-1a) used to detect that a trusted script changed.
/// Not a cryptographic hash; it only answers "is this byte-for-byte the script
/// the user approved?".
pub fn content_fingerprint(contents: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in contents.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("fnv1a-{hash:016x}")
}

/// Error detection for the VM test: any of a non-zero exit, non-empty stderr,
/// or a failed functional check triggers rollback.
pub fn should_rollback(
    exit_code: Option<i32>,
    stderr: &str,
    functional_test_passed: Option<bool>,
) -> bool {
    if exit_code.map(|code| code != 0).unwrap_or(true) {
        return true;
    }
    if !stderr.trim().is_empty() {
        return true;
    }
    matches!(functional_test_passed, Some(false))
}

fn spoken_summary(name: &str, kind: SkillKind) -> String {
    match kind {
        SkillKind::Software => format!(
            "Vou testar a skill \"{name}\" numa VM limpa com snapshot e rollback automático antes de aplicar algo no teu sistema."
        ),
        SkillKind::Hardware => format!(
            "A skill \"{name}\" mexe em hardware, então não roda em VM. Vou primeiro simular em dry-run e nada muda até você aprovar."
        ),
    }
}

fn rationale(kind: SkillKind, risk: RiskLevel) -> String {
    let risk_text = match risk {
        RiskLevel::Low => "risco baixo",
        RiskLevel::Medium => "risco médio",
        RiskLevel::High => "risco alto",
        RiskLevel::Critical => "risco crítico",
    };
    match kind {
        SkillKind::Software => {
            format!("Skill de software ({risk_text}): elegível para teste em VM com rollback.")
        }
        SkillKind::Hardware => format!(
            "Skill de hardware ({risk_text}): exige dry-run e aprovação manual no host, sem VM."
        ),
    }
}

fn quote_arg(arg: &str) -> String {
    if arg.is_empty()
        || arg
            .chars()
            .any(|c| c.is_whitespace() || "\"'\\$`".contains(c))
    {
        format!("'{}'", arg.replace('\'', "'\\''"))
    } else {
        arg.to_owned()
    }
}

fn join_command(script_path: &str, args: &[String], dry_run: bool) -> String {
    let mut parts = vec!["bash".to_owned(), quote_arg(script_path)];
    if dry_run {
        parts.push("--dry-run".to_owned());
    }
    for arg in args {
        parts.push(quote_arg(arg));
    }
    parts.join(" ")
}

/// Build a validated execution plan, refusing skills without dry-run support.
pub fn build_plan(
    manifest: &SkillManifest,
    script_contents: &str,
    args: &[String],
) -> Result<SkillExecutionPlan, String> {
    if !script_supports_dry_run(script_contents) {
        return Err(format!(
            "Skill \"{}\" não suporta --dry-run; toda skill com mutação precisa de dry-run.",
            manifest.id
        ));
    }
    let kind = derive_kind(manifest.category);
    let mode = execution_mode(kind);
    Ok(SkillExecutionPlan {
        skill_id: manifest.id.clone(),
        kind,
        mode,
        requires_manual_approval: matches!(kind, SkillKind::Hardware),
        supports_dry_run: true,
        dry_run_command: join_command(&manifest.script_path, args, true),
        run_command: join_command(&manifest.script_path, args, false),
        rationale: rationale(kind, manifest.risk_level),
        spoken_summary: spoken_summary(&manifest.name, kind),
    })
}

// --- libvirt command building (pure) -------------------------------------

pub fn virsh_snapshot_create_args(domain: &str, snapshot: &str) -> Vec<String> {
    vec![
        "snapshot-create-as".to_owned(),
        "--domain".to_owned(),
        domain.to_owned(),
        "--name".to_owned(),
        snapshot.to_owned(),
        "--atomic".to_owned(),
    ]
}

pub fn virsh_revert_args(domain: &str, snapshot: &str) -> Vec<String> {
    vec![
        "snapshot-revert".to_owned(),
        "--domain".to_owned(),
        domain.to_owned(),
        "--snapshotname".to_owned(),
        snapshot.to_owned(),
        "--running".to_owned(),
    ]
}

pub fn virsh_delete_args(domain: &str, snapshot: &str) -> Vec<String> {
    vec![
        "snapshot-delete".to_owned(),
        "--domain".to_owned(),
        domain.to_owned(),
        "--snapshotname".to_owned(),
        snapshot.to_owned(),
    ]
}

pub fn virsh_domstate_args(domain: &str) -> Vec<String> {
    vec!["domstate".to_owned(), domain.to_owned()]
}

// --- VM runner abstraction ------------------------------------------------

#[derive(Debug, Clone)]
pub struct VmRunOutput {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

/// Abstraction over the test VM so orchestration is testable without libvirt.
/// The real implementation drives `virsh`; tests use an in-memory mock.
#[allow(async_fn_in_trait)]
pub trait VmRunner {
    async fn create_snapshot(&self, domain: &str, snapshot: &str) -> Result<(), String>;
    async fn run_script(
        &self,
        domain: &str,
        script_path: &str,
        args: &[String],
    ) -> Result<VmRunOutput, String>;
    async fn revert_snapshot(&self, domain: &str, snapshot: &str) -> Result<(), String>;
    async fn delete_snapshot(&self, domain: &str, snapshot: &str) -> Result<(), String>;
}

fn tail(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim_end();
    let total = trimmed.chars().count();
    if total <= max_chars {
        return trimmed.to_owned();
    }
    let kept: String = trimmed.chars().skip(total - max_chars).collect();
    format!("…{kept}")
}

fn alternatives_on_failure() -> Vec<String> {
    vec![
        "Revisar a saída de erro e ajustar o script da skill.".to_owned(),
        "Executar em dry-run no host e inspecionar o que a skill faria.".to_owned(),
        "Tentar uma skill alternativa para a mesma tarefa.".to_owned(),
    ]
}

/// Orchestrate a software-skill VM test: snapshot -> run -> evaluate -> rollback.
/// Hardware skills must never reach this path; callers gate on `is_vm_testable`.
pub async fn run_skill_in_vm<R: VmRunner>(
    runner: &R,
    domain: &str,
    manifest: &SkillManifest,
    script_path: &str,
    args: &[String],
    snapshot: &str,
    functional_test_passed: Option<bool>,
) -> SkillVmReport {
    let mut steps = Vec::new();

    let mut report = SkillVmReport {
        skill_id: manifest.id.clone(),
        snapshot_name: snapshot.to_owned(),
        outcome: SkillVmOutcome::Blocked,
        exit_code: None,
        stdout_tail: String::new(),
        stderr_tail: String::new(),
        functional_test_passed,
        rolled_back: false,
        steps: Vec::new(),
        alternatives: Vec::new(),
        at: now_iso(),
    };

    steps.push(format!("snapshot {snapshot}"));
    if let Err(err) = runner.create_snapshot(domain, snapshot).await {
        steps.push(format!("snapshot falhou: {err}"));
        report.stderr_tail = err;
        report.steps = steps;
        report.alternatives = alternatives_on_failure();
        return report;
    }

    steps.push("run skill na VM".to_owned());
    let output = match runner.run_script(domain, script_path, args).await {
        Ok(output) => output,
        Err(err) => {
            steps.push(format!("execução falhou: {err}; revertendo"));
            let _ = runner.revert_snapshot(domain, snapshot).await;
            let _ = runner.delete_snapshot(domain, snapshot).await;
            report.outcome = SkillVmOutcome::RolledBack;
            report.rolled_back = true;
            report.stderr_tail = err;
            report.steps = steps;
            report.alternatives = alternatives_on_failure();
            return report;
        }
    };

    report.exit_code = output.exit_code;
    report.stdout_tail = tail(&output.stdout, 2000);
    report.stderr_tail = tail(&output.stderr, 2000);

    let rollback = should_rollback(output.exit_code, &output.stderr, functional_test_passed);
    if rollback {
        steps.push("erro detectado: rollback".to_owned());
        let _ = runner.revert_snapshot(domain, snapshot).await;
        let _ = runner.delete_snapshot(domain, snapshot).await;
        report.outcome = SkillVmOutcome::RolledBack;
        report.rolled_back = true;
        report.alternatives = alternatives_on_failure();
    } else {
        steps.push("skill passou; limpando VM de teste".to_owned());
        let _ = runner.revert_snapshot(domain, snapshot).await;
        let _ = runner.delete_snapshot(domain, snapshot).await;
        report.outcome = SkillVmOutcome::Passed;
        report.rolled_back = false;
    }
    report.steps = steps;
    report
}

// --- Skill store (plain-text, versioned) ----------------------------------

/// Loads skills from a versioned folder: each skill is `<id>.json` (manifest)
/// next to its `<id>.sh` script. No opaque memory, just files under git.
pub struct SkillStore {
    root: PathBuf,
}

impl SkillStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn list(&self) -> Vec<SkillManifest> {
        let mut skills = Vec::new();
        let Ok(entries) = std::fs::read_dir(&self.root) else {
            return skills;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
                continue;
            }
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(manifest) = serde_json::from_str::<SkillManifest>(&content) {
                    skills.push(manifest);
                }
            }
        }
        skills.sort_by(|a, b| a.id.cmp(&b.id));
        skills
    }

    pub fn load(&self, id: &str) -> Result<SkillManifest, String> {
        if !is_safe_skill_id(id) {
            return Err(format!("id de skill inválido: {id}"));
        }
        let path = self.root.join(format!("{id}.json"));
        let content =
            std::fs::read_to_string(&path).map_err(|err| format!("skill não encontrada: {err}"))?;
        serde_json::from_str::<SkillManifest>(&content)
            .map_err(|err| format!("manifest inválido: {err}"))
    }

    pub fn read_script(&self, manifest: &SkillManifest) -> Result<(PathBuf, String), String> {
        let script_path = self.root.join(&manifest.script_path);
        let contents = std::fs::read_to_string(&script_path)
            .map_err(|err| format!("script da skill ausente: {err}"))?;
        Ok((script_path, contents))
    }

    pub fn plan(&self, id: &str, args: &[String]) -> Result<SkillExecutionPlan, String> {
        let manifest = self.load(id)?;
        let (_, contents) = self.read_script(&manifest)?;
        build_plan(&manifest, &contents, args)
    }

    /// Promote a skill to trusted after a successful, approved run. The script
    /// fingerprint is recorded so a later edit invalidates trust.
    pub fn mark_trusted(&self, id: &str) -> Result<SkillManifest, String> {
        let mut manifest = self.load(id)?;
        let (_, contents) = self.read_script(&manifest)?;
        manifest.trusted = true;
        manifest.checksum = Some(content_fingerprint(&contents));
        manifest.updated_at = Some(now_iso());
        let path = self.root.join(format!("{id}.json"));
        let serialized = serde_json::to_string_pretty(&manifest)
            .map_err(|err| format!("falha ao serializar manifest: {err}"))?;
        std::fs::write(&path, serialized)
            .map_err(|err| format!("falha ao salvar manifest: {err}"))?;
        Ok(manifest)
    }

    /// A skill stays trusted only while its script matches the approved fingerprint.
    pub fn is_trust_valid(&self, manifest: &SkillManifest) -> bool {
        if !manifest.trusted {
            return false;
        }
        let Some(expected) = &manifest.checksum else {
            return false;
        };
        match self.read_script(manifest) {
            Ok((_, contents)) => &content_fingerprint(&contents) == expected,
            Err(_) => false,
        }
    }
}

fn is_safe_skill_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

// --- Real libvirt-backed VM runner -----------------------------------------

/// Drives a throwaway Arch VM: snapshots via `virsh`, script execution over SSH.
/// Configure `domain` (libvirt domain) and `ssh_target` (e.g. `root@192.168.x.y`).
pub struct VirshVmRunner {
    ssh_target: String,
}

impl VirshVmRunner {
    pub fn new(ssh_target: String) -> Self {
        Self { ssh_target }
    }
}

async fn run_virsh(args: &[String]) -> Result<(), String> {
    let output = Command::new("virsh")
        .args(args)
        .output()
        .await
        .map_err(|err| format!("falha ao executar virsh: {err}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_owned())
    }
}

impl VmRunner for VirshVmRunner {
    async fn create_snapshot(&self, domain: &str, snapshot: &str) -> Result<(), String> {
        run_virsh(&virsh_snapshot_create_args(domain, snapshot)).await
    }

    async fn run_script(
        &self,
        _domain: &str,
        script_path: &str,
        args: &[String],
    ) -> Result<VmRunOutput, String> {
        let script = std::fs::read_to_string(script_path)
            .map_err(|err| format!("não foi possível ler o script: {err}"))?;
        let quoted_args: Vec<String> = args.iter().map(|arg| quote_arg(arg)).collect();
        let remote = format!("bash -s -- {}", quoted_args.join(" "));
        let mut child = Command::new("ssh")
            .arg("-o")
            .arg("BatchMode=yes")
            .arg(&self.ssh_target)
            .arg(remote)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|err| format!("falha ao abrir ssh para a VM: {err}"))?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(script.as_bytes())
                .await
                .map_err(|err| format!("falha ao enviar script para a VM: {err}"))?;
        }
        let output = child
            .wait_with_output()
            .await
            .map_err(|err| format!("falha ao executar script na VM: {err}"))?;
        Ok(VmRunOutput {
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }

    async fn revert_snapshot(&self, domain: &str, snapshot: &str) -> Result<(), String> {
        run_virsh(&virsh_revert_args(domain, snapshot)).await
    }

    async fn delete_snapshot(&self, domain: &str, snapshot: &str) -> Result<(), String> {
        run_virsh(&virsh_delete_args(domain, snapshot)).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    fn manifest(category: SkillCategory) -> SkillManifest {
        SkillManifest {
            id: "demo".to_owned(),
            name: "Demo".to_owned(),
            description: "desc".to_owned(),
            category,
            risk_level: RiskLevel::Medium,
            script_path: "skills/demo.sh".to_owned(),
            checksum: None,
            trusted: false,
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn software_categories_are_vm_testable() {
        assert_eq!(derive_kind(SkillCategory::Package), SkillKind::Software);
        assert!(is_vm_testable(derive_kind(SkillCategory::Package)));
        assert_eq!(
            execution_mode(SkillKind::Software),
            SkillExecutionMode::VmTested
        );
    }

    #[test]
    fn hardware_categories_never_vm_tested() {
        for category in [
            SkillCategory::Audio,
            SkillCategory::Bluetooth,
            SkillCategory::Gpu,
        ] {
            let kind = derive_kind(category);
            assert_eq!(kind, SkillKind::Hardware);
            assert!(!is_vm_testable(kind));
            assert_eq!(execution_mode(kind), SkillExecutionMode::ManualDryRun);
        }
    }

    #[test]
    fn rejects_skill_without_dry_run() {
        let result = build_plan(&manifest(SkillCategory::Package), "echo hello", &[]);
        assert!(result.is_err());
    }

    #[test]
    fn hardware_plan_requires_manual_approval() {
        let plan = build_plan(
            &manifest(SkillCategory::Audio),
            "#!/bin/bash\nif [ \"$1\" = --dry-run ]; then echo plan; fi",
            &[],
        )
        .expect("valid");
        assert_eq!(plan.mode, SkillExecutionMode::ManualDryRun);
        assert!(plan.requires_manual_approval);
        assert!(plan.dry_run_command.contains("--dry-run"));
    }

    #[test]
    fn args_are_shell_quoted() {
        let plan = build_plan(
            &manifest(SkillCategory::Package),
            "# supports --dry-run",
            &["a b; rm -rf /".to_owned()],
        )
        .expect("valid");
        assert!(plan.run_command.contains("'a b; rm -rf /'"));
    }

    #[test]
    fn rollback_triggers() {
        assert!(should_rollback(Some(1), "", None));
        assert!(should_rollback(Some(0), "error: boom", None));
        assert!(should_rollback(Some(0), "", Some(false)));
        assert!(should_rollback(None, "", None));
        assert!(!should_rollback(Some(0), "", None));
        assert!(!should_rollback(Some(0), "  ", Some(true)));
    }

    #[test]
    fn fingerprint_is_stable_and_sensitive() {
        assert_eq!(content_fingerprint("abc"), content_fingerprint("abc"));
        assert_ne!(content_fingerprint("abc"), content_fingerprint("abd"));
    }

    #[test]
    fn virsh_args_built() {
        assert_eq!(
            virsh_snapshot_create_args("arch-test", "snap1"),
            vec![
                "snapshot-create-as",
                "--domain",
                "arch-test",
                "--name",
                "snap1",
                "--atomic"
            ]
        );
        assert!(virsh_revert_args("d", "s").contains(&"snapshot-revert".to_owned()));
    }

    #[derive(Default)]
    struct MockRunner {
        calls: RefCell<Vec<String>>,
        fail_run: bool,
        exit_code: Option<i32>,
        stderr: String,
    }

    impl VmRunner for MockRunner {
        async fn create_snapshot(&self, _d: &str, s: &str) -> Result<(), String> {
            self.calls.borrow_mut().push(format!("snapshot:{s}"));
            Ok(())
        }
        async fn run_script(
            &self,
            _d: &str,
            _p: &str,
            _a: &[String],
        ) -> Result<VmRunOutput, String> {
            self.calls.borrow_mut().push("run".to_owned());
            if self.fail_run {
                return Err("vm exec error".to_owned());
            }
            Ok(VmRunOutput {
                exit_code: self.exit_code,
                stdout: "ok".to_owned(),
                stderr: self.stderr.clone(),
            })
        }
        async fn revert_snapshot(&self, _d: &str, s: &str) -> Result<(), String> {
            self.calls.borrow_mut().push(format!("revert:{s}"));
            Ok(())
        }
        async fn delete_snapshot(&self, _d: &str, s: &str) -> Result<(), String> {
            self.calls.borrow_mut().push(format!("delete:{s}"));
            Ok(())
        }
    }

    fn block_on<F: std::future::Future>(future: F) -> F::Output {
        // Minimal executor so tests need no async runtime dependency.
        use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};
        fn noop(_: *const ()) {}
        fn clone(_: *const ()) -> RawWaker {
            RawWaker::new(std::ptr::null(), &VTABLE)
        }
        static VTABLE: RawWakerVTable = RawWakerVTable::new(clone, noop, noop, noop);
        let waker = unsafe { Waker::from_raw(RawWaker::new(std::ptr::null(), &VTABLE)) };
        let mut cx = Context::from_waker(&waker);
        let mut future = Box::pin(future);
        loop {
            if let Poll::Ready(value) = future.as_mut().poll(&mut cx) {
                return value;
            }
        }
    }

    #[test]
    fn vm_test_passes_and_cleans_up() {
        let runner = MockRunner {
            exit_code: Some(0),
            ..Default::default()
        };
        let report = block_on(run_skill_in_vm(
            &runner,
            "arch-test",
            &manifest(SkillCategory::Package),
            "skills/demo.sh",
            &[],
            "snap-demo",
            Some(true),
        ));
        assert_eq!(report.outcome, SkillVmOutcome::Passed);
        assert!(!report.rolled_back);
        let calls = runner.calls.borrow().clone();
        assert_eq!(calls[0], "snapshot:snap-demo");
        assert_eq!(calls[1], "run");
        assert!(calls.iter().any(|c| c == "revert:snap-demo"));
    }

    #[test]
    fn vm_test_rolls_back_on_nonzero_exit() {
        let runner = MockRunner {
            exit_code: Some(2),
            ..Default::default()
        };
        let report = block_on(run_skill_in_vm(
            &runner,
            "arch-test",
            &manifest(SkillCategory::Package),
            "skills/demo.sh",
            &[],
            "snap-demo",
            None,
        ));
        assert_eq!(report.outcome, SkillVmOutcome::RolledBack);
        assert!(report.rolled_back);
        assert!(!report.alternatives.is_empty());
        assert!(runner
            .calls
            .borrow()
            .iter()
            .any(|c| c == "revert:snap-demo"));
    }

    #[test]
    fn vm_test_rolls_back_when_runner_errors() {
        let runner = MockRunner {
            fail_run: true,
            ..Default::default()
        };
        let report = block_on(run_skill_in_vm(
            &runner,
            "arch-test",
            &manifest(SkillCategory::Package),
            "skills/demo.sh",
            &[],
            "snap-demo",
            None,
        ));
        assert_eq!(report.outcome, SkillVmOutcome::RolledBack);
        assert!(report.rolled_back);
    }
}
