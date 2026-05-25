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
```

## Remaining recommended work
- Thread real provider-readiness into `list_backends`/`recommend` so cloud can
  be `Ready` when (and only when) a tested provider exists.
- Consolidate hardware detection into a single layer behind one snapshot type.
- Lazy-load heavy modals (Settings, Skill Studio, File Manager) to shrink the
  initial JS chunk — modest win for a locally-bundled desktop app.
