# Developer Guide

## Stack

- Tauri 2 for the desktop shell.
- Rust for local services and system integration.
- React and TypeScript for UI.
- Zustand for app state.
- Vitest and Testing Library for unit/component tests.
- Playwright for visual smoke tests.

## Important paths

```text
src/app/App.tsx
src/components/
src/lib/
src/stores/
src/styles/
src/types/
src-tauri/src/
tests/
scripts/
```

## Local development

```bash
npm install
npm run dev
npm run tauri:dev
```

## Validation

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run icons:validate
git diff --check
cd src-tauri
cargo fmt --check
cargo check
cargo test
```

UI changes should also run:

```bash
npm run screenshots
npm run test:visual
```

## Product rules

- Local models use Ollama only.
- Cloud providers never appear in Local.
- Ollama models never appear in Cloud.
- No provider is ready without real validation.
- No API key appears in UI, logs, tests or screenshots.
- Errors shown in UI must be short and human.
- Raw JSON, stack traces and command dumps stay out of normal UI.

## Rust command guidance

Keep Tauri commands thin. Map technical failures to `ErrorPayload` or user-facing result objects. Clean temporary files after use. Never run privileged commands without explicit user action.

## Frontend guidance

Use existing design tokens in `src/styles/tokens.css`. Prefer existing shared components in `src/components/common`. Keep Settings tabs limited to the product tabs used by the app.
