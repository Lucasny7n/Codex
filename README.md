# Codex Command Center

**Premium desktop command center for AI coding agents.**  
Built with **Tauri v2**, **Rust**, **React**, **TypeScript** and a clean **Qwen-style / End4 Hyprland-inspired** interface.

> A focused workspace for local and cloud AI models, provider profiles, coding sessions, terminal-assisted workflows and controlled agent execution.

---

## English

### What is this?

Codex Command Center is a desktop application designed to make AI coding workflows feel clean, controlled and premium.

Instead of exposing a technical dashboard full of logs, providers and runtime noise, the app is being shaped around a minimal command interface with a single central model/environment flow.

### Core goals

- Keep the interface minimal and distraction-free.
- Unify local and cloud AI models in one place.
- Manage API keys, login profiles and provider status safely.
- Support coding sessions and project-oriented conversations.
- Allow controlled terminal workflows without exposing raw logs by default.
- Preserve an elegant dark visual style inspired by Qwen, End4 and Hyprland.

### Features

- Qwen-style minimal desktop UI
- Tauri v2 app shell
- React + TypeScript frontend
- Rust backend
- Local model support
- Cloud provider support
- Provider profiles and account management
- API key save/test/remove flow
- Session history
- Session export as Markdown, JSON or TXT
- Terminal workflow support
- Controlled permission model for risky commands
- Premium dark design system

### Current UX direction

The app is moving toward a very clean layout:

- thin left sidebar;
- model selector at the top;
- central prompt pill;
- no technical panels on the home screen;
- all advanced settings inside modals/popups;
- provider errors shown as short actionable cards;
- no raw JSON, stack traces or unnecessary metadata in normal chat.

### Development

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

### Recommended local path

```bash
~/Lucas-Workspace/Projects/Codex-Codex
```

---

## Português

### O que é?

Codex Command Center é um aplicativo desktop feito para controlar fluxos de programação com IA de forma limpa, organizada e premium.

A ideia não é ser um painel técnico cheio de logs e informações soltas. O objetivo é ter uma interface simples, bonita e direta, com tudo relacionado a modelos, API, login e providers concentrado em um fluxo único.

### Objetivos principais

- Manter a interface minimalista e sem poluição.
- Unificar modelos locais e modelos em nuvem.
- Gerenciar API keys, contas e profiles com segurança.
- Organizar sessões e conversas por projeto.
- Permitir fluxos com terminal de forma controlada.
- Manter visual escuro premium inspirado em Qwen, End4 e Hyprland.

### Funcionalidades

- Interface minimalista estilo Qwen
- Aplicativo desktop com Tauri v2
- Frontend em React + TypeScript
- Backend em Rust
- Suporte a modelos locais
- Suporte a provedores em nuvem
- Gerenciamento de profiles/contas por provider
- Fluxo para salvar, testar e remover API key
- Histórico de sessões
- Exportação de sessão em Markdown, JSON ou TXT
- Suporte a terminal
- Modelo de permissões para comandos sensíveis
- Design system escuro premium

### Direção atual da UX

O app está sendo refinado para ficar com:

- sidebar fina;
- seletor de modelo no topo;
- input central em formato pill;
- nenhuma informação técnica na tela inicial;
- configurações avançadas em modais/popups;
- erros de provider em cards curtos e acionáveis;
- nada de JSON cru, stack trace ou metadata inútil no chat normal.

### Rodar em desenvolvimento

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

### Caminho local recomendado

```bash
~/Lucas-Workspace/Projects/Codex-Codex
```

---

## Project structure

```text
src/          React frontend
src-tauri/    Tauri / Rust backend
docs/         Documentation and handoff notes
tests/        Frontend tests
.github/      GitHub metadata
```

---

## Status

Active development. The current focus is UI polish, provider reliability, local/cloud model flows, session UX and a cleaner GitHub presentation.
