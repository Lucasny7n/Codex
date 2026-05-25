# Support

Use GitHub Issues for reproducible bugs and focused feature requests.

## Before Opening an Issue

Run the basic diagnostics when possible:

```bash
npm run doctor
npm run healthcheck
npm run test -- --run
```

For desktop/Tauri problems, include whether `npm run dev` works separately from `npm run tauri:dev`.

## Good Bug Reports Include

- commit or app version;
- operating system and desktop/session;
- Node/npm versions;
- Rust/Cargo versions for Tauri issues;
- Ollama version and `ollama list` only if local models are involved;
- steps to reproduce;
- expected behavior;
- actual behavior;
- screenshots for UI regressions;
- redacted logs or terminal output.

Never paste API keys, OAuth tokens, private files, local databases or raw secrets.

## Feature Requests

Describe the problem first, then the smallest useful solution. Mention the affected area: AI Workspace, LLM Library, providers, local models, desktop shell, UI, docs or CI.

## Security

Do not use public issues for vulnerabilities or leaked secrets. Follow [SECURITY.md](SECURITY.md).
