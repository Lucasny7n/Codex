# Release Checklist

Use this checklist before tagging or presenting a public release.

## Repository

- README is current.
- Required docs exist and match real behavior.
- Issue and PR templates are useful.
- No secrets, local models, screenshots from temp folders, logs, `node_modules` or targets are staged.
- `git diff --check` passes.

## App identity

- Product name is `Ailu AI Studio`.
- Tauri window title is `Ailu AI Studio`.
- Desktop entry uses `Name=Ailu AI Studio`.
- App class/binary is `ailu-ai-studio`.
- Icons validate alpha/transparency.

## Validation

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run screenshots
npm run test:visual
npm run icons:validate
npm run healthcheck || true
npm run doctor || true
git diff --check
cd src-tauri
cargo fmt --check
cargo check
cargo test
```

## Manual checks

- Home and chat look clean in dark and light themes.
- Composer has no native select and clears immediately on send.
- Loading appears while waiting for model response.
- Temporary chat does not persist.
- Local search for `gpt oss` shows Ollama candidates as download candidates.
- Cloud tab does not show Ollama models.
- Local tab does not show cloud providers.
- Health does not show raw logs.
- STT backend and microphone capture are shown separately.
