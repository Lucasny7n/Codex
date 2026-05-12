# Codex Context Bootstrap

This file keeps coding-agent context close to the repository. It is not a product manual; public documentation lives in `README.md` and `docs/`.

## Operating rules

- Work from the current checkout only.
- Confirm `pwd`, `git status`, branch and relevant diffs before editing.
- Prefer small, reversible changes.
- Do not copy from unrelated worktrees.
- Do not add API keys, tokens, logs, screenshots, model weights or local databases.
- Do not mark providers, profiles, runtimes or models as ready without real validation.
- Do not install runtimes or models silently.
- Do not use `sudo -S`.

## Product rules

- `Nuvem` and `Local` must stay visually and behaviorally separate.
- Local means Ollama real.
- A model candidate that is not installed is a download candidate, not ready.
- A cloud provider without validated authentication is not ready.
- Temporary chat uses the real provider pipeline and does not persist history.
- STT depends on WebView permission, audio capture, `ffmpeg`, backend and local model.

## Required validation

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

Run `npm run screenshots` and `npm run test:visual` for visual or interaction changes.
