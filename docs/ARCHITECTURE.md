# Arquitetura

## Stack

- Desktop: Tauri v2
- Backend: Rust assíncrono (`tokio`)
- Frontend: React + TypeScript + Vite
- Estado UI: Zustand

## Camadas

1. UI (`src/components`)
- Layout: `AppShell` (grade de 3 colunas), `TopBar`.
- Painéis: sessões, conversa (`ChatPanel`), tarefas, status, permissões, logs, arquivos alterados, configurações.
- Design System: `tokens.css`, `layout.css`, `components.css` (modular e baseado em variáveis CSS).
- Onboarding/ajuda: painel `Primeiros Passos` com ações rápidas para docs, logs, VS Code e check de ambiente.

2. Session Engine (`src-tauri/src/services/session_manager.rs`)
- Criação de sessão
- Histórico de mensagens
- Estado operacional da sessão

3. Permission Manager (`src-tauri/src/services/permission_manager.rs`)
- Classificação de comando por risco/categoria
- Fila de aprovações pendentes
- Resolução `allow_once/deny_once`

4. Command Execution (`src-tauri/src/services/command_executor.rs`)
- Spawn de comandos via shell configurável
- Streaming de `stdout/stderr` para frontend
- Eventos de status e update de sessão
- Política de privilégio: sem prompt de senha no app; `sudo` apenas com `-n`

5. Memory Manager (`src-tauri/src/services/memory_manager.rs`)
- Snapshot operacional a partir de `~/.codex`
- Organização em arquivos limpos dentro de `~/.codex/codex-ui/memory`

6. VS Code Bridge (`src-tauri/src/services/vscode_bridge.rs`)
- Abrir projeto/arquivo/diff usando `code`

7. File Watcher (`src-tauri/src/services/file_watcher.rs`)
- Observa workspace e emite eventos de alteração em tempo real

8. Provider Adapter Layer (`src-tauri/src/services/provider_adapters.rs`)
- Trait `ProviderAdapter` para permitir novos backends sem hardcode na UI
- Adapters iniciais: OpenAI, Anthropic e Local Ollama
- Registro de providers por capacidade/configuração

## Fluxo principal

1. Frontend chama `bootstrap_state`
2. Backend carrega settings/sessões/memórias/providers
3. Usuário envia ordem ou comando
4. Permission Manager decide autoexecução ou aprovação
5. Command Executor roda e transmite logs/eventos
6. Session Manager persiste evolução e estado
