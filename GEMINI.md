# Gemini Review Guide

Use this file as a short handoff for external AI review tools.

## Project

Ailu AI Studio is a Tauri v2 desktop app built with Rust, React and TypeScript. It operates local Ollama models and authenticated cloud AI providers with honest readiness status.

## Before changing code

- Read `README.md`.
- Read `docs/ARCHITECTURE.md`.
- Read `docs/DEVELOPMENT.md`.
- Run `git status`.
- Work only from the current checkout.
- Do not add secrets, model weights, logs or generated screenshots.

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

Run visual tests when UI changes:

```bash
npm run screenshots
npm run test:visual
```

## Review focus

- Providers cloud without validated auth must not be selectable.
- Local models must come from real Ollama state.
- Temporary chat must not persist sessions or attachments.
- API keys must remain masked and out of logs.
- Commands Rust should remain a bridge to services, not collect new business logic.
