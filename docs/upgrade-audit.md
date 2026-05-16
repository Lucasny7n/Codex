# Upgrade Audit: Terax AI + Awesome-LLM Inspired Pass

Date: 2026-05-16  
Branch: `feature/terax-awesome-llm-upgrade`  
Repository: `https://github.com/Lucasny7n/ailu-ai-studio`

## Commands Used

```bash
pwd
git status --short --branch
git diff --stat
git pull --ff-only
git switch -c feature/terax-awesome-llm-upgrade
git clone --depth 1 https://github.com/crynta/terax-ai.git /tmp/ailu-upgrade-refs/terax-ai
git clone --depth 1 https://github.com/hannibal046/awesome-llm.git /tmp/ailu-upgrade-refs/awesome-llm
npm run typecheck
npm run lint
```

The reference repositories were cloned under `/tmp/ailu-upgrade-refs` and were not copied into the Ailu worktree.

## Stack Detected

- Package manager: npm (`package-lock.json` present).
- Frontend: React 18, TypeScript, Vite.
- Desktop: Tauri 2.
- Backend: Rust.
- State: Zustand store in `src/stores/appStore.ts`.
- Styling: CSS variables and component styles under `src/styles`.
- Tests: Vitest, Testing Library, Playwright visual smoke and Cargo tests.
- CI: GitHub Actions with frontend, Rust and manual visual jobs.
- Desktop packaging: `src-tauri/tauri.conf.json`, icon set and `assets/ailu-ai-studio.desktop`.

## Current Structure

- `src/app/App.tsx`: main shell orchestration, bootstrap, session routing, project modal, temporary chat and settings modal.
- `src/components/chat`: chat transcript, composer and STT flow.
- `src/components/layout`: app shell and topbar.
- `src/components/panels`: sessions, settings-related panels, terminal drawer and status surfaces.
- `src/components/file`: local file manager modal.
- `src/lib/api`: Tauri API bridge and event listeners.
- `src/lib/models`: model registry, search/options, presets and comparison service.
- `src/lib/ollama`: Ollama catalog/search.
- `src-tauri/src/services`: provider, credentials, permissions, local runtime, sessions and command execution.
- `docs`: existing public docs for install, security, release, STT, Ollama and operations.

## Reference Findings

### Terax AI

Useful ideas:

- desktop-first README structure;
- AI-native workspace positioning;
- terminal, editor, file explorer, web preview and AI side-panel as coordinated modules;
- BYOK and local model messaging;
- project memory file;
- task/plan/tool approval flow.

Not copied:

- branding, logo, screenshots, source files, assets, README text and UI layout.

### Awesome-LLM

Useful ideas:

- category taxonomy for LLM research and engineering;
- split between papers, leaderboards, open models, datasets, training, inference, applications, tutorials and security;
- curated-resource approach instead of a flat feature list.

Not copied:

- full resource list, tables, images, repository assets or substantial text.

## Risks

- `src/app/App.tsx` remains large; broad refactors should be split into later PRs.
- Provider readiness must remain tied to real adapter tests, not UI labels.
- Local model UX must continue to use Ollama runtime truth.
- Terminal/editor/web preview features need backend hardening before they can be sold as complete IDE capabilities.
- Responsive overlays must be visually checked in small and square windows.

## Opportunities

- Add a native LLM Library as a product differentiator.
- Make AI Workspace the quiet place for planning, approvals, runtime notes and project memory.
- Improve Tauri window defaults for normal desktop use.
- Make docs more professional while preserving honesty about experimental modules.
- Add feature flags for product surfaces that may need staged release.

## Implementation Plan

1. Add feature/config modules and `.env.example`.
2. Add LLM Library data, search/filter utilities, UI and tests.
3. Add AI Workspace panel for plans, approvals, providers, project memory, file context and terminal entrypoint.
4. Add responsive layout modes and viewport-aware classes.
5. Adjust Tauri window defaults and document desktop behavior.
6. Rewrite README and add focused docs for architecture, providers, security, roadmap, desktop, LLM library and responsive QA.
7. Validate lint, typecheck, tests, build, icons and Rust checks.
8. Commit, push and open PR if GitHub auth allows.

## Reuse Policy

This upgrade uses Terax AI and Awesome-LLM as references only. Any future direct copying must add attribution in `THIRD_PARTY.md`, `docs/credits.md`, comments where appropriate and any required NOTICE file.
