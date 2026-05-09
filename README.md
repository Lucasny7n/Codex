# Codex Command Center

A premium desktop command center for AI coding agents, built with Tauri, Rust, React and TypeScript.

Clean Qwen-style interface, local/cloud AI model control, provider profiles, terminal workflows and an End4/Hyprland-inspired design.

---

## English

### Overview

Codex Command Center is a desktop application focused on controlling AI coding workflows through a clean, minimal and premium interface.

### Main Features

- Premium Qwen-style dark UI
- Tauri v2 desktop app
- React + TypeScript frontend
- Rust backend
- Local and cloud AI model selection
- Provider profile management
- API key configuration and testing
- Session management
- Export sessions as Markdown, JSON or TXT
- Terminal workflow support
- End4/Hyprland-inspired visual style

### Development

```bash
npm install
npm run dev
npm run tauri dev
```

### Local validation

```bash
npm ci
npm run lint
npm run typecheck
npm run test -- --run
npm run build
cd src-tauri && cargo fmt --check && cargo check && cargo test
```

Visual screenshots use Playwright:

```bash
npm run screenshots
```

### Build

```bash
npm run tauri build
```

---

## Português

### Visão geral

Codex Command Center é um aplicativo desktop para controlar fluxos de programação com IA em uma interface limpa, minimalista e premium.

### Principais recursos

- Interface escura premium estilo Qwen
- Aplicativo desktop com Tauri v2
- Frontend em React + TypeScript
- Backend em Rust
- Seleção de modelos locais e em nuvem
- Gerenciamento de perfis por provider
- Configuração e teste de API key
- Gerenciamento de sessões
- Exportação em Markdown, JSON ou TXT
- Suporte a terminal
- Visual inspirado em End4/Hyprland

### Rodar em desenvolvimento

```bash
npm install
npm run dev
npm run tauri dev
```

### Validação local

```bash
npm ci
npm run lint
npm run typecheck
npm run test -- --run
npm run build
cd src-tauri && cargo fmt --check && cargo check && cargo test
```

Capturas visuais usam Playwright:

```bash
npm run screenshots
```

### Build

```bash
npm run tauri build
```

---

## Project Structure

```text
src/          React frontend
src-tauri/    Tauri/Rust backend
docs/         Documentation and notes
tests/        Frontend tests
.github/      GitHub metadata
```

---

## Status

This project is under active development.
