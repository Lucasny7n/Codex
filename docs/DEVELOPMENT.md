# Desenvolvimento

Este guia descreve o caminho local para instalar, rodar, validar e depurar o Ailu AI Studio.

## Instalação

```bash
npm install
```

Pré-requisitos:

- Node.js e npm.
- Rust stable com Cargo.
- Dependências nativas do Tauri/WebKitGTK.
- Ollama opcional para modo Local.
- `ffmpeg` e backend Whisper/Vosk opcionais para STT.

## Scripts

```bash
npm run dev            # Vite
npm run tauri dev      # App desktop
npm run build          # Typecheck + build Vite
npm run lint
npm run typecheck
npm run test -- --run
npm run screenshots
npm run test:visual
npm run icons:validate
npm run healthcheck
```

Backend:

```bash
cd src-tauri
cargo fmt --check
cargo check
cargo test
```

## Rodar o app

Para desenvolvimento frontend isolado:

```bash
npm run dev
```

Para validar WebView, shell plugin, permissões e backend Rust:

```bash
npm run tauri dev
```

Se a porta `5173` estiver ocupada, finalize o processo existente ou ajuste o ambiente antes de concluir que o app falhou.

## Testes

Unitários e integração leve:

```bash
npm run test -- --run
```

Visual:

```bash
npm run screenshots
npm run test:visual
```

Os screenshots ficam em `test-results/screenshots` por padrão. Defina `CODEX_SCREENSHOT_DIR` para gravar em outro diretório.

## Padrões de código

- UI compartilhada fica em `src/components/common`.
- Superfícies de chat ficam em `src/components/chat`.
- Configurações ficam em `src/components/settings`.
- Lógica de modelos fica em `src/lib/models`.
- Integração Ollama fica em `src/lib/ollama` e `src-tauri/src/services/local_runtime.rs`.
- Chamadas Tauri ficam em `src/lib/api`.
- Tipos frontend ficam em `src/types`.
- Serviços Rust concentram regra de negócio; commands Rust devem ser ponte Tauri.

Evite misturar UI, chamada externa e regra de negócio no mesmo arquivo. `src/app/App.tsx` e `src-tauri/src/commands/mod.rs` ainda são áreas grandes e devem ser reduzidas com refatorações pequenas e testadas.

## Debug Tauri

- Confirme que o app sobe com `npm run tauri dev`.
- Leia a saída Rust para erro de comando, permissão ou provider.
- Use `Health Check` no app para diagnosticar storage, provider, Ollama, WebView e dependências.
- Não use `sudo -S` e não execute instalação silenciosa.

## Debug Ollama

```bash
command -v ollama
ollama --version
ollama list
curl -s http://127.0.0.1:11434/api/tags
```

No app, o modo Local deve indicar `service_offline`, `api_unreachable`, `model_missing`, `downloading` ou `ready` conforme o estado real.

## Checklist antes de PR

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

Rode `npm run screenshots` e `npm run test:visual` quando a mudança tocar UI, layout, CSS, modal, seletor, composer ou chat.
