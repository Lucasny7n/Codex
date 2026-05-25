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

## Rust Backend

No changes — the backend audit found zero dead code. All 71 commands are registered, all public service functions are called, no duplicate logic.

---

## Validation

```
npm run typecheck   ✓  (0 errors)
npm run lint        ✓  (0 warnings)
npm test -- --run   ✓  102/102 tests pass (21 test files)
npm run build       ✓  378 kB JS · 154 kB CSS
```
