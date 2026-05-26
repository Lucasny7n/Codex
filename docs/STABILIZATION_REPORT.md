# Ailu Studio — Full Stabilization Report

Branch: `refactor/full-stabilization-pass`  
Date: 2026-05-25  
Validation: typecheck ✓ · lint ✓ · 102 tests pass · build ✓

---

## Dead Code Removed

### Frontend Components (7 deleted)
- `src/components/panels/BasePromptPanel.tsx`
- `src/components/panels/ChangedFilesPanel.tsx`
- `src/components/panels/InspectorPanel.tsx`
- `src/components/panels/MemoryPanel.tsx`
- `src/components/panels/PermissionsPanel.tsx`
- `src/components/panels/StatusPanel.tsx`
- `src/components/panels/TasksPanel.tsx`

All seven were exported but never imported anywhere outside their own file.

### Test Files for Deleted Components (3 deleted)
- `tests/inspector-panel.test.tsx`
- `tests/memory-panel.test.tsx`
- `tests/permissions-panel.test.tsx`

### Dead Props in CommandInputPanel
Removed from interface and call site:
- `privilegedActions`, `onExecuteCommand`, `onRequestPrivilegedAction`, `actionJsonExamples`
- `executionMode`, `activeModelLabel`, `providerLabel`, `runtimeState`
- `onOpenModelSelector`, `onOpenTerminal`

Only 4 props are now in the interface: `busy`, `onSendOrder`, `orderDisabledReason`, `onOpenSkills`.

### Dead Code in App.tsx
- `buildActionJsonExamples()` function (JSON examples for removed privileged action panel)
- `homeFromDataRoot()` function (only used by `buildActionJsonExamples`)
- `const [privilegedActions, setPrivilegedActions]` state (never rendered)
- `const actionJsonExamples = useMemo(...)` (never passed to any component)
- `handleExecuteCommand()` function (orphaned after prop removal)
- `handleRequestPrivilegedAction()` function (orphaned after prop removal)
- Imports: `listPrivilegedActions`, `requestPrivilegedAction`, `PrivilegedActionSpec`
- `listPrivilegedActions()` call in init (was populating dead state)

### Dead CSS
- `.workspace-dirty` rule (class never applied in any component)

---

## New Features

### Chat Message Actions (ChatPanel.tsx)
- **Like** (`heart` icon): toggle per-message like state; mutually exclusive with dislike
- **Dislike** (`x` icon): toggle per-message dislike state; mutually exclusive with like
- **Listen** (`music` icon): speak message via Web Speech API (pt-BR, markdown stripped before TTS)
  - Clicking while speaking stops playback
- **Redo** (`refresh` icon): re-sends the prior user message, only shown when `onRedoMessage` is wired
  - Disabled while `isResponding`
  - Also available in the `...` popup menu

### CSS additions
- `.message-action-active`: accent color for toggled actions (like/listen)
- `.message-action-dislike.message-action-active`: error-red tint for dislike

### App.tsx wiring
- `handleRedoMessage(messageId)`: finds prior user message in session, re-sends via `handleSendPrompt`
- Both `ChatPanel` instances receive `onRedoMessage={handleRedoMessage}`

---

## Architecture Decisions

**Why remove the privileged action panel?**  
`CommandInputPanel` ignored those props entirely (they were never destructured). The state machinery (`listPrivilegedActions`, `handleRequestPrivilegedAction`, etc.) ran on init but its results were never consumed by any rendered component. Removing the dead code eliminates ~170 lines from App.tsx and one Tauri IPC call on startup.

**Why keep `requestExecution` and the permission event listeners?**  
`requestExecution` is still used in `handleSendPrompt` (the approval flow for skill execution). The `onPermissionRaised/Resolved/Outcome` listeners maintain the `pendingPermissions` store state which may be read by future permission UI.

**Why use `music` icon for listen?**  
`send` (paper plane) was semantically wrong. `music` is the closest available icon for audio playback.

---

## Rust Backend — Wave 1

No dead code: all 71 commands are registered, all public service functions are called.

---

## Rust Backend — Wave 2: honesty fixes

### Fake cloud-fallback readiness (fixed)
`backends/mod.rs::cloud_fallback()` hard-coded `BackendAvailability::Ready`,
so the runtime backend list advertised cloud as "ready" even when no provider
was configured or tested — directly violating the product rule "cloud fallback
never appears ready without a tested provider".

Fixed: cloud fallback now reports `BackendAvailability::Unknown` with an honest
detail ("Disponível apenas com um provedor cloud configurado e testado"). It
remains a viable last-resort candidate for the selector (Unknown still scores
as a candidate, and the `force_cloud` path still selects it on `WontRun`), but
it is no longer presented as confirmed-ready. Added a unit test
(`cloud_fallback_is_never_ready_without_provider`).

Verified via the standalone `engcheck` harness (full Tauri crate cannot
`cargo check` here — missing GTK/webkit system libs): **26/26** Local Engine
tests pass, including `wont_run_model_prefers_cloud` (fallback still works) and
the new cloud-honesty test.

### Other backend descriptors — audited, already honest
- `llama_cpp.rs`: CPU/server → `Ready` only when the binary is in PATH; all GPU
  variants (Vulkan/ROCm/HIP/CUDA/SYCL) → `Installed` (capability unconfirmed),
  never `Ready`, never auto-compiled. ROCm/HIP gated on `Healthy` accelerator.
- `openai_compatible.rs`: `NotInstalled` with a config plan. No fake readiness.

### hardware / local_runtime / local_engine overlap — audited, deferred
The three layers are complementary, not duplicated:
- `services/hardware.rs` — generic `HardwareProfile` + model-fit math + quant
  presets. Owns the pure parsers (`parse_meminfo`, `parse_rocm_smi_vram`,
  `parse_parameter_count`, `estimate_*`).
- `services/local_runtime.rs` — Ollama lifecycle (install/start/pull/test).
- `services/local_engine/*` — scored backend selection + `HardwareSnapshot`.
  `hardware_profiler.rs` **reuses** the pure parsers from `hardware.rs` rather
  than reimplementing them; only GPU enumeration differs (different output
  shapes). A full consolidation into one detection layer is desirable but was
  **deferred**: it changes public signatures across the command layer and
  cannot be `cargo check`-verified in this environment, so shipping it blind
  would risk a broken build. Tracked as a next step.

---

## Rust Backend — Wave 3: example hardware skills + latent compile fix

### Two proof-of-concept hardware skills (plain-text, versioned)
Added under `skills/` (git-tracked, never opaque memory):
- `repair-audio.{sh,json}` — restarts the user PipeWire stack (improved: clearer
  human report + explicit VM/rollback honesty notes).
- `repair-bluetooth.{sh,json}` — unblocks rfkill, restarts `bluetooth.service`,
  powers the controller on.

Both are `category: audio|bluetooth` → derived as **Hardware** → **ManualDryRun**:
never VM-tested, require dry-run + manual host approval (click + fala), and
state honestly that the real device cannot be validated in a VM and that there
is no full snapshot rollback for hardware. Both mandate `--dry-run`, reject
unknown args (exit 64), and are deterministic/auditable (fixed service lists,
no installs). Verified in-container: `bash -n` syntax, `--dry-run` runs (exit
0, gracefully handles absent `systemctl`/`rfkill`/`bluetoothctl`), valid JSON.

Added Rust test `repo_hardware_skills_require_manual_approval` that loads both
real skill files through `SkillStore` and asserts Hardware + ManualDryRun +
manual approval + dry-run support.

### Latent compile error fixed: `RiskLevel` missing `Copy`/`Eq`
`SkillManifest` derives `Eq`, and `skills::build_plan` moves `manifest.risk_level`
by value out of a `&SkillManifest`. But `RiskLevel` only derived
`Debug, Clone, Serialize, Deserialize` — so `SkillManifest`'s `Eq` derive and
the by-value move **could not compile**. This was masked because the full crate
cannot `cargo check` here (no GTK/webkit). `RiskLevel` is a fieldless enum, so
adding `Copy, PartialEq, Eq` is the correct, purely-additive fix. Confirmed via
the `skillcheck` harness (12/12 skills tests compile and pass).

**What you must validate on your real machine (cannot be tested here):**
- The actual audio repair on the host: run `repair-audio` dry-run, approve, and
  confirm PipeWire comes back (no audio devices exist in this container/VM).
- The actual Bluetooth repair on the host: `rfkill`/`bluetooth.service`/
  `bluetoothctl` and a real controller (no BT radio exists here).
- A full `cargo build`/`cargo test` on a machine with GTK/webkit to confirm the
  `RiskLevel` fix compiles in the complete crate (the harness compiles the
  skills module in isolation, which is strong but not identical to a full build).

---

## Validation

Frontend (full):
```
npm run typecheck   ✓  (0 errors)
npm run lint        ✓  (0 warnings)
npm test -- --run   ✓  102/102 tests pass (21 test files)
npm run build       ✓  378 kB JS · 154 kB CSS
```

Rust:
```
cargo fmt --check                 ✓  (clean)
cargo check / cargo test          ✗  full crate needs GTK/webkit (not installable here)
engcheck harness (Local Engine)   ✓  26/26 tests (mirrors real module files)
skillcheck harness (skills)       ✓  12/12 tests (mirrors real skills.rs + models)
skill scripts                     ✓  bash -n + --dry-run (exit 0) + valid JSON
```

## Remaining recommended work
- Thread real provider-readiness into `list_backends`/`recommend` so cloud can
  be `Ready` when (and only when) a tested provider exists.
- Consolidate hardware detection into a single layer behind one snapshot type.
- Lazy-load heavy modals (Settings, Skill Studio, File Manager) to shrink the
  initial JS chunk — modest win for a locally-bundled desktop app.
