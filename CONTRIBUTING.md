# Contributing

Thanks for considering a contribution to Ailu AI Studio. This project values validated behavior over cosmetic polish, and small focused PRs over broad rewrites.

## Quick Start

```bash
git clone https://github.com/Lucasny7n/ailu-ai-studio.git
cd ailu-ai-studio
npm install
npm run doctor
npm run dev
```

Desktop development:

```bash
npm run tauri:dev
```

## Branches and Commits

- Branch from `main` unless maintainers ask otherwise.
- Use focused branch names such as `fix/provider-readiness`, `feat/llm-library-filter` or `docs/release-process`.
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `ci:` or `chore:`.
- Keep one behavioral concern per PR when practical.

## Pull Request Rules

Before opening a PR:

- explain the user-facing change;
- list files or areas touched;
- include validation evidence;
- include screenshots or visual smoke output for UI work;
- call out risk and rollback;
- confirm no secrets, logs, local model weights or generated artifacts are staged.

Do not mark a provider, model, STT path, terminal workflow or backend feature as ready unless it was tested against the real runtime path it depends on.

## Validation

Run the applicable checks:

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run screenshots
npm run test:visual
npm run icons:validate
git diff --check
```

Rust/Tauri checks:

```bash
cd src-tauri
cargo fmt --check
cargo check
cargo test
```

If Cargo target state leaks across local worktrees, use:

```bash
env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target cargo check
env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target cargo test
```

## Product Rules

- Local means Ollama only.
- Cloud means authenticated cloud providers only.
- A saved API key is not `ready` until a real connection test passes.
- Temporary chat uses the same provider pipeline as normal chat and does not persist.
- File Context is local staging until a separate backend ingestion flow exists.
- Terminal, editor and web preview surfaces stay experimental until their backend paths are complete.
- Errors shown to users should be short, actionable and sanitized.

## Security

Never commit:

- `.env` files or real credentials;
- API keys, OAuth tokens, local databases or keychain exports;
- `node_modules`, `dist`, `target`, `test-results` or Playwright reports;
- local model weights or downloaded runtimes;
- raw screenshots containing secrets.

See [SECURITY.md](SECURITY.md) for reporting and handling policy.

## UI Changes

Preserve the Ailu visual identity: black base, End-4 blue accents, clean hierarchy, left sidebar, center workspace and one right inspector tab at a time. Do not copy external branding, logos, screenshots or layouts.

For UI PRs, attach screenshots from:

```bash
npm run screenshots
```

Only promote intentional release screenshots into `docs/assets/screenshots/`.

## More Docs

- [Developer guide](docs/DEVELOPER_GUIDE.md)
- [Architecture](docs/architecture.md)
- [Providers](docs/providers.md)
- [LLM Library](docs/llm-library.md)
- [GitHub maintenance](docs/github-maintenance.md)
