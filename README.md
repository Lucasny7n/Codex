# Ailu AI Studio

[![CI](https://github.com/Lucasny7n/ailu-ai-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Lucasny7n/ailu-ai-studio/actions/workflows/ci.yml)
![Tauri](https://img.shields.io/badge/Tauri-2.x-24c8db)
![React](https://img.shields.io/badge/React-18-61dafb)
![Rust](https://img.shields.io/badge/Rust-stable-f46623)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![License](https://img.shields.io/badge/license-MIT-blue)

Premium desktop AI studio for local Ollama models, authenticated cloud providers, project memory, safe actions and curated LLM research.

Ailu is a Tauri/Rust/React app for people who want a serious AI workspace without fake readiness. Local and cloud AI are intentionally separate, provider status is validated before use, and risky file or command actions go through explicit approval surfaces.

## Overview

Ailu combines a clean desktop chat experience with engineering-grade controls:

- persistent and temporary conversations;
- a unified `[ Local | Cloud ]` selector with hard routing separation;
- real Ollama snapshots for local models;
- masked BYOK provider profiles with explicit connection tests;
- project context, file attachments and hidden context;
- an AI Workspace for plans, approvals, file context, terminal access and runtime notes;
- an LLM Library for papers, leaderboards, open models, datasets, evaluation, inference, safety and tutorials;
- responsive modes for fullscreen, split-screen, small windows and square floating windows.

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Chat sessions | Implemented | Persistent sessions, archive/restore, export/import and temporary chat. |
| Local AI | Implemented | Ollama only. Installed models come from real `/api/tags` or `ollama list`. |
| Cloud providers | Implemented/experimental by adapter | Credentials must be configured and tested before `ready`. |
| STT | Implemented with local prerequisites | Backend and microphone capture status are separate. |
| LLM Library | Implemented initial catalog | Curated subset with filters, favorites, actions and local metadata. |
| AI Workspace | Implemented shell | Plan board, approvals view, provider status, file context and terminal entrypoint. |
| Terminal/web preview | Experimental | Terminal drawer exists; web preview is documented for a future backend pass. |
| Desktop packaging | Implemented baseline | Tauri 2, Linux bundle metadata and `.desktop` helper are present. |

## Features

### AI Command Center

- Central chat with real provider/model routing.
- Temporary chat uses the same provider pipeline without persisting history.
- AI Workspace adds plans, approvals, provider routing status, project memory and file context.
- Terminal access remains behind the existing controlled command/permission path.

### Providers and BYOK

- Cloud providers require real credentials, OAuth, CLI auth or a custom endpoint depending on adapter.
- Saved keys are masked and must be tested before they become selectable.
- Provider errors are translated into short user-facing messages.
- Raw API keys, JSON dumps and stack traces should not appear in UI, logs, screenshots or commits.

See [docs/providers.md](docs/providers.md).

### Local Models

Local means **Ollama only**. Ailu does not mix local models into cloud lists and does not mark a model installed until the refreshed Ollama runtime confirms it.

See [docs/OLLAMA.md](docs/OLLAMA.md).

### LLM Library

The LLM Library is inspired by curated research repositories, but ships as an original, compact product dataset. It includes categories for milestone papers, leaderboards, open LLMs, data, evaluation, training, inference, applications, tutorials, books, security, compression, code LLMs, multimodal models and local models.

See [docs/llm-library.md](docs/llm-library.md).

### Responsive Layout

The current shell preserves the Ailu identity while adding:

- `comfortable`, `compact` and `focus` layout modes;
- viewport detection for narrow, compact, wide, ultrawide and square-ish windows;
- collapsible/overlay sidebar behavior for smaller windows;
- grid/card sizing that avoids horizontal overflow;
- tighter spacing and stable controls in compact mode.

See [docs/responsive-qa.md](docs/responsive-qa.md).

## Screenshots

Visual smoke screenshots are generated locally and should be promoted to release assets only when they are intentional.

```bash
npm run screenshots
```

Current screenshot notes live in `docs/screenshots/README.md` when release screenshots are available. Do not commit temporary files from `test-results/`.

## Why Ailu

Ailu is built around honest operation:

- no fake provider success;
- no silent model installs;
- no local/cloud model mixing;
- no terminal-first UX for normal configuration;
- no secrets in logs or screenshots;
- no broad rewrites when a small validated change is safer.

## Architecture

Frontend:

- React 18 + TypeScript + Vite;
- Zustand store;
- shared design tokens in `src/styles`;
- modular components under `src/components`;
- catalog/search utilities under `src/data` and `src/lib`.

Desktop/backend:

- Tauri 2;
- Rust services for provider registry, credential storage, sessions, permissions, local runtime and command execution;
- Linux packaging metadata in `src-tauri/tauri.conf.json` and `assets/ailu-ai-studio.desktop`.

See [docs/architecture.md](docs/architecture.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Security and Privacy

- Never commit `.env`, API keys, local databases, model weights, `node_modules`, logs or temporary screenshots.
- Never use `sudo -S`.
- Never download runtimes or models silently.
- Use the app credential flow instead of plain localStorage for provider secrets.
- Treat every file write, command execution, network/download, install and privileged operation as an explicit permission category.

See [docs/security.md](docs/security.md).

## Installation

```bash
git clone https://github.com/Lucasny7n/ailu-ai-studio.git
cd ailu-ai-studio
npm install
npm run doctor
npm run tauri:dev
```

Frontend-only development:

```bash
npm run dev
```

## Development

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run screenshots
npm run test:visual
npm run icons:validate
npm run healthcheck
```

Rust checks:

```bash
cd src-tauri
cargo fmt --check
cargo check
cargo test
```

## Build

```bash
npm run build
npm run tauri:build
```

## Desktop App

Default window: `1440x900`. Minimum window: `900x600`. The app is configured as a Tauri desktop application with Linux bundle targets and a `.desktop` installer helper.

See [docs/desktop-app.md](docs/desktop-app.md).

## Troubleshooting

Start with:

```bash
npm run doctor
npm run healthcheck
```

Useful guides:

- [Installation](docs/INSTALLATION.md)
- [User Guide](docs/USER_GUIDE.md)
- [Developer Guide](docs/DEVELOPER_GUIDE.md)
- [Ollama](docs/OLLAMA.md)
- [STT](docs/STT.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Roadmap

The roadmap separates implemented, experimental and planned work. Items are not treated as shipped until tests and runtime validation prove them.

See [docs/roadmap.md](docs/roadmap.md).

## Contributing

Read [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) and use the pull request template. Behavior changes need validation evidence. UI changes should include screenshots or visual smoke results when practical.

## Credits

This upgrade studied Terax AI for product architecture patterns and Awesome-LLM for catalog organization. The implementation is original and does not copy branding, assets or substantial source text.

See [docs/credits.md](docs/credits.md) and [THIRD_PARTY.md](THIRD_PARTY.md).

## License

MIT. See [LICENSE](LICENSE).
