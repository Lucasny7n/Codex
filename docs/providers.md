# Providers

Ailu supports cloud providers and local Ollama through separate domains.

## Domains

### Local

Local means Ollama only.

- Installed state comes from the real runtime snapshot.
- Model downloads require explicit user action.
- A model is selectable only after refresh confirms it exists.
- CLI output is diagnostic; `/api/tags` and generation tests are the product truth when available.

### Cloud

Cloud providers require one of:

- API key;
- OAuth/login flow;
- CLI auth;
- custom OpenAI-compatible endpoint.

A saved credential is not automatically `ready`. It should be `testing` or configured-but-not-ready until a real provider test succeeds.

## Current Product Config

Provider policy metadata lives in:

```text
src/config/providers.ts
```

This file documents domain, auth type, readiness policy and secret policy for key provider classes.

## UI Rules

- Keep `[ Local | Cloud ]` visible in model selection.
- Never show cloud models in the Local tab.
- Never show Ollama candidates as cloud models.
- Do not mark provider/account/model ready just because a key was saved.
- Mask credentials.
- Use short actionable errors.
- AI Workspace may summarize provider state, but Settings > Modelos remains the route for adding keys, testing credentials and selecting models.
- A saved but untested credential should remain `testing` or action-required until a real adapter test succeeds.

## Security Rules

- Do not use localStorage for raw API keys when the backend credential abstraction is available.
- Do not print keys in Tauri commands, Rust errors, frontend logs, tests or screenshots.
- Do not include real credentials in `.env.example`.

## Validation

Before claiming provider work is complete:

```bash
npm run lint
npm run typecheck
npm run test -- --run
cargo check
cargo test
```

If a provider requires external credentials, document whether it was runtime-tested or only type/build-tested.
