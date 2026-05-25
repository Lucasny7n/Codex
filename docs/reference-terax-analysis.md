# Terax AI Reference Analysis

Reference: https://github.com/crynta/terax-ai
Observed: 2026-05-17
License: Apache-2.0

## What Was Observed

- Terax positions itself as a lightweight AI-native desktop terminal/ADE built with Tauri, Rust and React.
- Its README communicates concrete modules instead of vague AI claims: terminal, editor, file explorer, web preview, AI panel, BYOK providers, local model path and approval flow.
- `TERAX.md` is used as workspace memory and architecture guidance, with clear ownership between Rust OS access and frontend UI.
- The architecture emphasizes native PTY/session handling, file APIs, search/grep, keychain secrets, AI tools, approval-gated write/run actions and edit diffs.
- The product language is direct about what exists and which credentials/local endpoints are required.

## What Was Adapted For Ailu

- Strengthened `AILU.md` as the Ailu-specific project memory and operating contract.
- Made AI Workspace more operational: editable plan items, clear-plan confirmation, richer approval cards, provider route to Settings and explicit context staging.
- Kept terminal/web preview labeled experimental where Ailu does not yet have Terax-level backend modules.
- Updated docs to describe the Rust/backend boundary and the fact that file/command actions need explicit permission flows.
- Kept the visual language as Ailu's black/End-4 blue shell instead of copying Terax layout, branding or assets.

## What Was Not Copied

- No Terax source files, screenshots, logo, icon, copy, module names or UI layout were copied.
- Ailu did not adopt Terax's LM Studio local model policy; Ailu local remains Ollama-only.
- Ailu did not claim full editor/diff/web-preview parity.

## License Risk

- Terax is Apache-2.0. This pass used it as reference only and copied no code/assets/text, so no NOTICE or source-level attribution is required beyond repository-level credit.
- If a future change copies implementation details or substantial text, update `THIRD_PARTY.md`, `docs/credits.md` and any required NOTICE/comments before merging.

## Next Steps

- Split the Ailu workspace implementation into smaller modules after this PR.
- Add real backend-backed context ingestion before marketing File Context as more than staging.
- Add editor/diff accept-reject flow only after command/file permission semantics are stable.
- Keep provider setup in Settings/Health surfaces instead of relying on terminal instructions.
