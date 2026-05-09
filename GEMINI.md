# Projeto: Codex Command Center

Este projeto vive em /home/lucas/Codex-Codex.

Antes de alterar código:
- Leia README.md.
- Leia docs/GUIA_DE_USO.md.
- Leia docs/ARCHITECTURE.md.
- Leia docs/PERMISSIONS.md.
- Rode git status.
- Faça backup ou trabalhe com Git diff limpo.

Stack esperada:
- Tauri v2
- Rust backend
- React + TypeScript frontend
- Vite
- Zustand
- Helper privilegiado com allowlist
- Integração com VS Code
- Config/memórias em ~/.codex

Comandos úteis:

- npm run tauri dev
- npm run lint
- npm run typecheck
- npm run test
- cargo check
- cargo test

Problema recente conhecido:
O projeto tem dois binários Rust:
- codex_command_center
- codex-privileged-helper

Se npm run tauri dev falhar com cargo run sem saber o binário, corrigir src-tauri/Cargo.toml com:
default-run = "codex_command_center"

Não usar sudo.
Não instalar helper sem confirmação.
