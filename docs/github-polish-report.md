# GitHub Polish Report

Date: 2026-05-17

## Branch and PR

- Branch: `feature/terax-awesome-llm-upgrade`
- PR: https://github.com/Lucasny7n/ailu-ai-studio/pull/4
- PR state before commit: open, base `main`, merge state `CLEAN`
- Decision: update PR #4 instead of opening a new PR

## Commit

- `docs: professionalize GitHub repository`

## Summary

This pass professionalizes the public GitHub surface of Ailu AI Studio without changing the main product UI or copying Terax assets/text. The work focuses on README presentation, repository hygiene, contribution flow, issue/PR templates, CI clarity, release process and intentional screenshots.

## Main Changes

- Rebuilt `README.md` as a GitHub landing page with centered logo, tagline, real badges, screenshots, feature grouping, honest status, quick start, validation, tech stack and docs map.
- Added root open-source docs:
  - `CONTRIBUTING.md`
  - `SECURITY.md`
  - `SUPPORT.md`
  - `CHANGELOG.md`
  - `ROADMAP.md`
- Added maintenance docs:
  - `docs/github-polish-audit.md`
  - `docs/reference-terax-github-polish.md`
  - `docs/github-maintenance.md`
  - `docs/release-process.md`
- Added intentional screenshot assets:
  - `docs/assets/screenshots/ailu-home.png`
  - `docs/assets/screenshots/ailu-ai-workspace.png`
  - `docs/assets/screenshots/ailu-llm-library.png`
  - `docs/assets/screenshots/ailu-responsive.png`
- Replaced duplicate Markdown issue templates with YAML issue forms.
- Expanded `.github/PULL_REQUEST_TEMPLATE.md`.
- Added:
  - `.github/ISSUE_TEMPLATE/config.yml`
  - `.github/dependabot.yml`
  - `.github/CODEOWNERS`
- Added `.gitattributes`.
- Hardened `.gitignore` while allowing intentional docs assets.
- Added CI `Security Hygiene` job for generated artifacts, high-confidence secret patterns and whitespace.
- Increased Playwright visual timeout from 30s to 60s to avoid flaky failure in the long screenshot smoke test.
- Updated repository polish tests to cover root docs, `.gitattributes`, YAML issue forms and README screenshots.

## Validation

Passed:

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run test -- --run`
- `npm run build`
- `npm run screenshots`
- `npm run test:visual`
- `npm run icons:validate`
- `git diff --check`
- `cargo fmt --check` from `src-tauri`
- `env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target cargo check` from `src-tauri`
- `env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target cargo test` from `src-tauri`

Notes:

- First `npm run test:visual` attempt failed by timeout at 30s in the longest screenshot scenario after `npm run screenshots` had passed in 29.3s. Cause: visual smoke timeout too tight for dozens of PNG captures. Fix: `playwright.config.ts` timeout increased to 60s. Rerun passed.
- `find . -name ".env" -o -name "*.log" -o -name "node_modules" -o -name "target"` reports local ignored folders: `node_modules` and `src-tauri/target`.
- The broad requested grep pattern reports false positives from `vosk-transcriber`, fake `sk-test...` test fixtures and ignored `dist/`. A high-confidence tracked-file scan for real-looking `sk-`, `ghp_` and `AIza` tokens returned no matches.

## GitHub Metadata

Recommended repo description:

```text
Desktop AI workspace for local-first planning, LLM discovery, provider setup, and responsive AI workflows.
```

Recommended topics:

```text
tauri, react, typescript, rust, ai, llm, desktop-app, local-first, developer-tools, ai-workspace
```

`gh auth status` reported an invalid token during this pass, so repo metadata, labels and PR comment automation may require re-authentication before applying through the GitHub API.

## Risks

- README screenshots can drift as UI evolves; refresh via `npm run screenshots` and promote only intentional assets.
- Visual smoke remains manual in CI to avoid heavy default browser dependency cost.
- Labels documented in `docs/github-maintenance.md` still need GitHub-side creation if they do not already exist.
- Branch protection is recommended but not configured automatically.

## Rollback

Safest rollback:

```bash
git revert <github-polish-commit>
```

Local pre-commit rollback:

```bash
git restore .
git clean -fd -- .github docs/assets docs/github-maintenance.md docs/github-polish-audit.md docs/github-polish-report.md docs/reference-terax-github-polish.md docs/release-process.md .gitattributes CHANGELOG.md CONTRIBUTING.md ROADMAP.md SECURITY.md SUPPORT.md
```

Do not use destructive cleanup without reviewing untracked files first.

## Next Steps

- Re-authenticate `gh` and apply repository description/topics if desired.
- Create the recommended labels from `docs/github-maintenance.md`.
- Configure branch protection for `main` in GitHub settings.
- Keep screenshots refreshed intentionally before releases.
