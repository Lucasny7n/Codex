# Release Process

Ailu is pre-1.0. Keep releases small, honest and reversible.

## Version Alignment

Update these together:

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock` if Cargo metadata changes
- `src-tauri/tauri.conf.json`
- `CHANGELOG.md`

Do not bump a major version without an explicit release decision.

## Pre-Release Validation

```bash
npm install
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run screenshots
npm run test:visual
npm run icons:validate
git diff --check
cd src-tauri
cargo fmt --check
cargo check
cargo test
```

If Cargo target state is contaminated locally:

```bash
env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target cargo check
env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target cargo test
```

## Build Artifacts

```bash
npm run tauri:build
```

Only attach intentional release artifacts. Do not attach `node_modules`, `target`, `dist` internals, raw logs or temporary screenshots.

## Tagging

Use annotated tags:

```bash
git tag -a v0.1.0 -m "Ailu AI Studio v0.1.0"
git push origin v0.1.0
```

## Release Notes

Include:

- summary;
- notable features;
- fixed bugs;
- validation;
- known limitations;
- upgrade notes;
- rollback notes.

Be explicit about experimental surfaces. File Context is staging, terminal/editor/web preview are experimental unless a release has validated backend integration, and providers require real credentials before readiness.

## Rollback

For a bad release:

1. Mark the GitHub release as pre-release or remove the artifact if it is unsafe.
2. Open a fix-forward PR when practical.
3. If the tag must be removed, document why before deleting it.
4. Keep `CHANGELOG.md` honest about the withdrawn or superseded release.
