# AILU.md

This file is the project memory and operating contract for Ailu AI Studio. It is intentionally named for Ailu and must not be replaced by third-party project names.

## Product Intent

Ailu AI Studio is a desktop AI workspace for local Ollama models and authenticated cloud providers. It should feel calm, professional and useful before it feels flashy.

## Stack

- Frontend: React 18, TypeScript, Vite, Zustand.
- Desktop/backend: Tauri 2, Rust.
- Tests: Vitest, Testing Library, Playwright visual smoke, Cargo tests.
- Package manager: npm with `package-lock.json`.

## Core Rules

- Local models are Ollama only.
- Cloud providers are cloud only.
- No provider, account or model is `ready` without a real test.
- Saved credentials are masked and routed through the credential abstraction.
- API keys, tokens and local secrets never appear in logs, screenshots, docs examples or commits.
- File writes and command execution require preview, risk classification and explicit approval.
- Technical errors become short user-facing messages; raw details belong behind diagnostic surfaces.

## UX Rules

- Preserve the Ailu visual identity.
- Keep the center workspace dominant.
- Keep advanced settings behind Settings, AI Workspace, drawers or modals.
- Support fullscreen, split-screen, small windows and square floating windows.
- Use `comfortable`, `compact` and `focus` layout modes consistently.
- Avoid horizontal overflow, clipped text and fixed panels that block scroll.

## Development Commands

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run screenshots
npm run test:visual
npm run icons:validate
cd src-tauri && cargo fmt --check && cargo check && cargo test
```

## Current Architecture Notes

- `src/app/App.tsx` still owns a large amount of orchestration and should be split gradually.
- `src/data/llm-resources.ts` is the curated LLM Library dataset.
- `src/lib/llmLibrary/search.ts` is the search/filter layer for the catalog.
- `src/components/workspace/AiWorkspacePanel.tsx` is the current AI workspace shell for plans, approvals and runtime context.
- `src-tauri/src/services/credential_store.rs` is the sensitive credential boundary.

## Risk Register

- Provider adapters can drift when external APIs change.
- Tauri/WebKit and Linux portal behavior can differ by distro/session.
- Local Ollama state must be treated as runtime truth, not as a static registry.
- Web preview/editor/terminal features need backend hardening before being marketed as complete IDE features.

## Release Policy

Do not mark a release ready without lint, typecheck, tests, build and Rust validation. If a validation step is unavailable or externally blocked, document that explicitly in the release report.
