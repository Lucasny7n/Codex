# Ailu Studio — Reality Audit

Branch: `refactor/full-stabilization-pass`. Honest classification of every major
area: what is **real**, **partial**, **broken/fake**, or **missing**, with
file:line evidence. Written after auditing the React frontend and the Rust
backend, and after manually tracing the flagged flows.

> Environment note: the full Tauri crate cannot `cargo check`/`cargo test` here
> (no GTK/webkit). Rust logic is verified via standalone harnesses that compile
> the real module files. UI behavior cannot be exercised here — anything marked
> "needs real app" must be confirmed on the Arch/RX 7600 machine.

---

## Classification table

| Area | State | Notes |
|------|-------|-------|
| Chat (send/stream/render) | **Real** | `ChatPanel.tsx`, `ai_router.rs`; markdown render, provider-error cards |
| Conversation titling | **Fixed this pass** | was raw 54-char copy → now clean topic fallback (`session_manager.rs:581`) |
| Chat actions: copy | **Real** | clipboard API (`ChatPanel.tsx:340`) |
| Chat actions: like/dislike | **Partial** | local state only, not persisted (`ChatPanel.tsx:345-360`) |
| Chat actions: listen (TTS) | **Partial** | Web Speech, pt-BR, markdown-stripped; no Tauri-webview fallback path |
| Chat actions: redo | **Real (basic)** | re-sends prior user message (`App.tsx handleRedoMessage`) |
| Chat actions: share | **Removed this pass** | was a toast stub; deleted from both menus |
| Models / Ollama mgmt | **Real** | install/remove/list/search via Ollama (`local_runtime.rs:201-499`) |
| Model hardware-fit badges | **Missing in catalog UI** | `LocalCompatibility` type exists, no badge render; engine has the math |
| Máquina Local screen | **Missing as a screen** | hardware backend is real (`hardware.rs`, `detect_local_hardware`); no dedicated UI |
| Local Engine | **Real (logic)** | scored selector, AMD Vulkan-first, ROCm-only-if-healthy; cloud no longer fake-ready |
| Hardware detection | **Real** | `/proc/meminfo`, `rocm-smi`, sysfs DRM (`hardware.rs:33-122`) |
| Cloud providers | **Real** | adapters + credential store + tested status (`provider_adapters.rs`) |
| STT (voice in) | **Real** | whisper-cli + native fallback (`CommandInputPanel.tsx`) |
| TTS (voice out) | **Partial** | see "listen" above |
| Skills executor | **Real** | dry-run/approval/trust/report (`skills.rs`) |
| Skill Studio UI | **Partial (read-only)** | lists/plans/tests/approves; **no import/create-by-text/create-with-AI** |
| VM testing | **Real (logic)** | snapshot→run→rollback, software-only (`run_skill_in_vm`); needs real libvirt to exercise |
| File attachments | **Partial** | preview text (≤2400 chars) is sent (`CommandInputPanel.tsx:155-181`); no explicit lido/incluído UI state, no large-file chunking/summary |
| Memory | **Reworked this pass** | new structured `MemoryEntry` store (scope/project/origin/confidence/dates), CRUD commands, and a management UI; recall-into-context + NL commands still pending (see below) |
| Projects | **Real (basic)** | session grouping + per-project memory |
| Health | **Real but raw** | 20+ real checks (`commands/mod.rs:2375-2674`); UI is a flat grid, not grouped human diagnostic |
| Permissions / approvals | **Real** | request→pending→resolve, blocks sudo/pkexec, no auto-approval for risky (`permission_manager.rs`, `command_executor.rs`) |
| AI tool-use | **Missing (stub)** | `ChatRole::Tool` exists but unused; router only emits text (`ai_router.rs`). The AI cannot call app tools |
| Session menu (pin) | **Fake** | toast "será conectado" (`App.tsx:1393`) — still present |
| CSS / components | **Mostly real** | 9k-line `components.css`; some visual inconsistency reported across panels |
| Tests | **Real** | frontend 102 passing; Rust logic via harnesses (engcheck 26, skillcheck 12, titlecheck 3) |
| Docs | **Real** | STABILIZATION_REPORT, SKILLS_AND_RUNTIME, this audit |

---

## Fixed in this pass (verified)

1. **Conversation titling** (`session_manager.rs:581`): replaced the 54-char raw
   truncation with a deterministic clean fallback — first meaningful line (skips
   blank lines and whole fenced code blocks), strips markdown markers, ≤7 words,
   ≤48 chars, trims trailing punctuation, capitalizes. A pasted wall of text now
   yields a short topic, not a dumped prompt. Covered by 3 unit tests
   (`summarizes_instead_of_copying_raw`, `strips_markdown_and_code_noise`,
   `falls_back_on_empty`), verified via the `titlecheck` harness (3/3).
   *Note:* this is the deterministic **fallback**; a true LLM-summarized title
   depends on AI tool-use (see below).
2. **"Compartilhar" removed**: deleted the share menu items and the `'share'`
   action from `SessionsPanel.tsx` and the project menu + handler branch in
   `App.tsx`. No share references remain. Frontend lint/typecheck/102 tests green.

---

## Memory rework (§5) — implemented this pass

Built a unified, structured, locally-stored memory layer (no more opaque
markdown-only global + localStorage-only project split):

- **Model** (`models/mod.rs`): `MemoryEntry { id, content, kind, scope, project,
  origin, confidence, manual, createdAt, updatedAt }` with enums
  `MemoryEntryKind` (preference/fact/policy/fix/note), `MemoryScope`
  (global/project), `MemoryOrigin` (user/inferred/imported), `MemoryRecallMode`
  (default/project_only).
- **Store** (`services/memory_store.rs`): JSON-backed at `{memory_dir}/entries.json`,
  modeled on the proven `presets.rs` pattern. Pure `upsert` (keyed by id,
  preserves `createdAt`, forces global entries to drop their project), `remove`,
  and `recall` (default = global + active project; project_only = isolated).
  7 unit tests, verified via the `memcheck` harness (7/7).
- **Commands** (`commands/mod.rs` + `lib.rs`): `list_memory_entries`,
  `save_memory_entry`, `delete_memory_entry`.
- **UI** (`MemoryManagerModal.tsx`, opened from Settings → Personalização →
  "Gerenciar memórias"): list, filter (todas/global/projeto), create, edit,
  delete, with scope/kind/project/origin/confidence/date shown. 5 vitest tests.

Still pending (next step, needs the running app / tool-use):
- Wiring `recall()` into the live prompt context (inject global+project memories
  on send, honoring default vs project-only). The logic + scope semantics are
  done and tested; only the send-flow injection remains.
- Natural-language commands ("lembre que…", "esqueça…", "o que você lembra?")
  — these depend on AI tool-use (§3), which was not selected for this pass.
- Migrating the old localStorage project summaries into the new store.

## What is incomplete or only decorative (not yet fixed)

- **AI tool-use** (directive §3, §14): the largest gap. The router has no
  function-calling, so "qual meu hardware?", "rode um update", "meus modelos
  locais", "o que está errado?" are answered as plain text, not by invoking the
  (already real) backend tools. This is an architecturally significant feature.
- **Máquina Local screen** (§1): backend hardware/engine data is real but there
  is no dedicated screen surfacing CPU/GPU/RAM/VRAM/swap/disk/Vulkan/ROCm/Ollama
  + model download UX.
- **Model hardware-fit badges** (§8): the fit math exists in the engine; the
  catalog UI doesn't render fits/tight/swap/won't-run badges, so `gpt-oss:120b`
  shows no strong warning.
- **Memory system** (§5): two disconnected stores (backend global markdown +
  frontend localStorage project memory). No unified scope model, no edit/delete
  UI, no natural-language "lembre/esqueça" commands (those need tool-use).
- **File attachments** (§4): only a ≤2400-char preview is sent; no explicit
  lido/incluído/falhou state in the UI and no large-file chunking/summary.
- **Skill Studio import / create-by-text / create-with-AI** (§7): not present.
- **Health grouping** (§10): real checks, but the UI is a raw grid, not grouped
  by IA local / Voz / Sistema / Providers / Git.
- **TTS fallback** (§6): works via Web Speech in a normal webview; no explicit
  fallback/error message if `speechSynthesis` is unavailable in the Tauri webview.
- **Session menu "pin"** (§11): still a toast stub — should be implemented or hidden.
- **Visual consistency** (§9): reported inconsistency across panels; needs the
  running app to assess and tune.

---

## Why the rest was not done in this pass

Most remaining items require building and running the real Tauri app (which
needs GTK/webkit, unavailable in this container) to implement and verify UI,
or are large features (AI tool-use, Máquina Local screen, memory rework, Skill
Studio authoring) that are architecturally significant and should be sequenced
and confirmed rather than attempted blind. Shipping unverifiable UI/feature code
and calling it done would violate the directive's "não declare pronto sem testar".

## Recommended next sequence (proposed)

1. **AI tool-use core** — unlocks §3, §5 (NL memory), §14. Define a tool schema,
   wire hardware/model-list/health/skill tools, parse tool calls, keep approval
   for anything mutating. Biggest leverage.
2. **Máquina Local screen** (§1) + **model fit badges** (§8) — reuse existing
   engine data; mostly UI.
3. **Memory unification + UI** (§5).
4. **Skill Studio authoring** (§7: import, by-text, with-AI).
5. **Health grouping** (§10) + **visual consistency pass** (§9) + **pin/menu** (§11).

Each needs a build+manual smoke test on the real machine before being declared done.

## How to validate what changed here

```bash
# Titles (Rust logic): on the real machine
cd src-tauri && cargo test title_from_content   # 3 tests

# Share removal (frontend)
npm run lint && npm run typecheck && npm test -- --run   # 102 pass
# In the app: open a conversation menu — "Compartilhar" should be gone.
# Start a new chat with a long pasted prompt — title should be a short topic.
```
