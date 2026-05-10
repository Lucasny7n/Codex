# Arquitetura

## Visão Geral

Codex Command Center é um app desktop Tauri com frontend React e backend Rust. A UI controla sessões, composer, anexos, modelos, settings e drawers. O backend concentra estado persistido, providers, runtimes locais, permissões e execução.

## Camadas

### Frontend

- `src/App.tsx`: orquestra bootstrap, sessão ativa, Bate-papo Temporário, TopBar, Settings e drawers.
- `src/components/panels/CommandInputPanel.tsx`: composer, modos, anexos e STT.
- `src/components/panels/ChatPanel.tsx`: transcript, mensagens, anexos e erros de provider.
- `src/components/layout/TopBar.tsx`: seletor `Nuvem | Local`, busca e configuração por modelo/provider.
- `src/components/panels/SettingsPanel.tsx`: cinco abas permitidas e configuração limpa de preferências.
- `src/lib/modelRegistry.ts`: catálogo estruturado de modelos cloud/local.
- `src/lib/providerStatus.ts`: regra de seleção e ações por status.
- `src/styles/*.css`: tokens, layout e componentes.

### Backend

- `src-tauri/src/commands/mod.rs`: comandos Tauri, file picker, STT, chat persistente e chat temporário.
- `src-tauri/src/services/session_manager.rs`: sessões persistidas, export/import, arquivar/excluir.
- `src-tauri/src/services/provider_adapters.rs`: adapters reais de providers cloud e local Ollama.
- `src-tauri/src/services/provider_registry.rs`: catálogo runtime dos adapters.
- `src-tauri/src/services/credential_store.rs`: credenciais mascaradas, profiles e estado testado.
- `src-tauri/src/services/local_runtime.rs`: diagnóstico, instalação e teste de Ollama/modelos.
- `src-tauri/src/services/command_executor.rs`: execução controlada de comandos.
- `src-tauri/src/services/permission_manager.rs`: risco, aprovação e bloqueio de ações perigosas.

## Fluxo de Chat Persistente

1. UI chama `create_session` apenas quando necessário.
2. UI chama `send_order_to_agent`.
3. Backend adiciona mensagem do usuário em `SessionManager`.
4. Backend monta prompt com anexos, modo e idioma.
5. `ProviderRegistry` chama adapter real.
6. Resposta ou erro controlado é persistido na sessão.

## Fluxo de Bate-papo Temporário

1. UI ativa estado temporário em memória.
2. UI chama `send_temporary_order_to_agent`.
3. Backend usa o mesmo `ProviderRegistry`, mas não chama `SessionManager.persist_session`.
4. Resposta volta como `AgentSession` efêmera com id `temporary-chat`.
5. Ao sair do modo temporário, o frontend descarta as mensagens.

## Providers

Status possíveis incluem `ready`, `testing`, `requires_api_key`, `requires_login`, `requires_cli_auth`, `model_missing`, `service_offline`, `api_unreachable`, `experimental` e `unavailable`.

Regra: somente `ready` é selecionável. Credencial salva sem teste não vira `ready`.

## Anexos

O composer exibe chips com nome, tipo e tamanho. Prévia textual limitada pode ir no payload oculto para o provider, mas não é despejada no textarea.

## STT

O frontend grava via Web APIs quando disponíveis. O backend converte com `ffmpeg` e tenta backends locais em ordem: `whisper-cli`/`whisper.cpp`, `whisper`, `faster-whisper`, Vosk.

## Persistência

- Sessões: arquivos JSON sob o diretório gerenciado pelo app.
- Exportações: `~/Downloads/Sessoes`.
- Preferências: settings do backend e algumas preferências locais da UI.
- Segredos: `CredentialStore`; chaves completas não devem ir para logs, screenshots ou commit.
