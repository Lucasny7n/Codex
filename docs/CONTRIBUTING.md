# Contributing

Contributions are welcome when they preserve the core product rule: real functionality before visual polish, and no ready state without validation.

## Workflow

1. Start from an issue or a clear problem statement.
2. Pull latest `main`.
3. Work in a focused branch.
4. Keep changes scoped by domain.
5. Add or update tests for behavior changes.
6. Run validation before opening a PR.

## Commit style

Use Conventional Commits:

```text
feat: add provider validation
fix: keep temporary chat out of persisted sessions
docs: clarify ollama setup
chore: prepare release checklist
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

Run visual checks for UI work:

```bash
npm run screenshots
npm run test:visual
```

## Functional rules

- Local means Ollama only.
- Cloud means cloud providers only.
- Saved API key without a successful test is not ready.
- Temporary chat uses the real provider pipeline and does not persist.
- STT backend readiness and microphone capture readiness are separate.
- UI errors are short, human and sanitized.

## PR expectations

Include:

- What changed.
- Why it changed.
- Main files touched.
- Validation evidence.
- Screenshots for UI changes.
- Known risk and rollback.
