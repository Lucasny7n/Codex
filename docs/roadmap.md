# Roadmap

This roadmap is intentionally honest. A feature is not considered shipped until implementation and validation evidence exist.

## Implemented

- Tauri desktop shell.
- Persistent and temporary chat.
- Cloud/Local model selector with separation rules.
- Ollama runtime snapshot and local model management.
- Provider profile credential flow with masked keys and explicit tests.
- STT backend status separated from microphone capture status.
- LLM Library initial catalog, search, filters, favorites and AI actions.
- AI Workspace shell with plan board, approvals, provider summary, file context and terminal entrypoint.
- Responsive layout modes: comfortable, compact and focus.

## Experimental

- Terminal as a broader AI-native command surface.
- Web preview detection.
- Editor/diff workflow for AI-generated file changes.
- Advanced agent tools behind feature flags.
- Expanded provider adapters and model comparison workflows.

## Planned

- Split `src/app/App.tsx` into smaller hooks/modules.
- Add robust editor/diff accept/reject flow.
- Add local web preview backend with safe URL detection.
- Add window size/position restore when persistence semantics are stable.
- Expand LLM Library through reviewed curated additions.
- Add screenshots as intentional release assets.
- Improve CI coverage for responsive layouts and AI Workspace interactions.

## Out of Scope Without Explicit Approval

- Silent runtime/model downloads.
- Force-pushing release branches.
- Replacing the Ailu visual identity.
- Importing giant third-party resource lists.
- Claiming provider/STT/web preview readiness without runtime validation.
