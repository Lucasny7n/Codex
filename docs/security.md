# Security

Security in Ailu is mostly about preventing false readiness, secret leakage and unreviewed actions.

## Secrets

- Do not commit `.env`, `.env.local`, tokens, API keys, OAuth artifacts or local databases.
- Do not put API keys in screenshots, logs, tests or issue templates.
- Prefer `CredentialStore` and keyring-backed storage where available.
- Mask credentials in UI.

## Command and File Actions

Every file write or command action should include:

- summary;
- category;
- risk level;
- target;
- reason;
- rollback when available;
- confirmation/cancel path.

Permission categories include safe read, workspace write, external write, network, privileged, package install and critical system.

AI Workspace context staging is not backend ingestion. A staged path, URL or note is only local UI state until a separate approved backend flow reads or writes files.

## Local Runtime

- Do not install Ollama or models silently.
- Do not run package managers without explicit user approval.
- Do not treat a catalog candidate as installed.
- Do not use cloud credentials for local routing.

## Cloud Runtime

- Do not treat saved keys as validated.
- Do not show raw provider JSON or stack traces by default.
- Do not retry paid requests blindly.
- Show quota/rate-limit/provider-down states separately when possible.

## Desktop Surface

- Keep Tauri capabilities minimal.
- Keep shell/command permissions scoped.
- Keep WebView microphone permission separate from backend STT readiness.
- Document any new privileged helper path before enabling it.

## Release Checklist

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run icons:validate
cd src-tauri && cargo fmt --check && cargo check && cargo test
git diff --check
```

If a step fails for an external reason, record the exact reason in `docs/upgrade-report.md` or release notes.
