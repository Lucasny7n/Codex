# Codex Command Center

AI Command Center desktop para controlar conversas, modelos locais/cloud, anexos e fluxos de execução com uma interface limpa estilo Qwen/End4.

O projeto usa Tauri v2, Rust, React, TypeScript e Vite. A regra central é simples: nenhum provider, modelo ou runtime aparece como pronto sem configuração e teste real.

## Screenshots

As capturas oficiais de validação visual são geradas por Playwright:

```bash
npm run screenshots
```

Na Passada 13, os arquivos `pass-13-*.png` são gravados em:

```text
/home/lucas/Lucas-Workspace/Temp
```

## Recursos

- Chat persistente com sessões, exportação e arquivamento.
- Bate-papo temporário em memória, sem aparecer no histórico.
- Composer com anexos como chips, sem despejar TXT no campo de texto.
- Seletor único `Nuvem | Local` com status honesto.
- Catálogo cloud/local pesquisável por modelo, provider, runtime, família e capacidade.
- Configurações limpas com cinco abas: Geral, Interface, Modelos, Conversas e Personalização.
- STT local preparado para `ffmpeg`, `whisper.cpp`, `whisper`, `faster-whisper` ou Vosk.
- Terminal e ações privilegiadas via fluxo controlado, sem `sudo` silencioso.
- Tema claro/escuro/sistema com tokens centralizados.

## Stack

- Frontend: React 18, TypeScript, Zustand, Vite.
- Desktop: Tauri v2.
- Backend: Rust, Tokio, Reqwest.
- Testes: Vitest, Testing Library, Playwright.
- Modelos locais: Ollama hoje; arquitetura preparada para outros runtimes.

## Requisitos

- Node.js e npm.
- Rust stable e Cargo.
- Dependências nativas do Tauri/WebKitGTK para Linux.
- Opcional: Ollama para modelos locais.
- Opcional: `ffmpeg` e backend Whisper/Vosk para transcrição local.

## Instalação

```bash
npm install
```

## Desenvolvimento

Frontend Vite:

```bash
npm run dev
```

App Tauri:

```bash
npm run tauri dev
```

## Build

```bash
npm run build
npm run tauri build
```

## Validação

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run screenshots
npm run test:visual
git diff --check
```

Backend Rust:

```bash
cd src-tauri
cargo fmt --check
cargo check
cargo test
```

## Estrutura

```text
src/                    Frontend React
src/components/          UI, painéis, composer, chat e settings
src/lib/                 API Tauri, catálogo de modelos e status
src/stores/              Estado global Zustand
src/styles/              Tokens, layout e componentes
src-tauri/src/           Backend Rust, commands e services
src-tauri/icons/         Ícones do app
docs/                    Arquitetura, desenvolvimento, modelos, STT e roadmap
tests/                   Testes unitários e visuais
scripts/                 Scripts de ambiente e instalação local
```

## Providers e Modelos

Providers cloud precisam de API key/login e teste real antes de ficarem selecionáveis. Credencial salva sem teste fica em estado de configuração/teste, não `ready`.

Modelos locais só ficam selecionáveis quando o runtime está ativo, o modelo aparece em `ollama list` e o teste curto de geração confirma funcionamento.

Veja [docs/MODELS.md](docs/MODELS.md).

## STT

O microfone depende do WebView conseguir gravar áudio e de um backend local configurado. O app não instala pacotes nem baixa modelos automaticamente.

Veja [docs/STT.md](docs/STT.md).

## Troubleshooting

- Provider sem chave: abra o seletor de modelos e configure o provider específico.
- Ollama offline: valide `command -v ollama`, `systemctl is-active ollama` e `ollama list`.
- STT sem transcrição: valide `ffmpeg`, backend Whisper/Vosk e modelo local.
- Screenshot visual falhando: rode `npx playwright install chromium`.
- Tauri dev na porta ocupada: verifique a porta `5173`.

## Roadmap Curto

- Consolidar chat e temporário como fluxos equivalentes com persistência diferente.
- Endurecer STT local com diagnóstico guiado.
- Evoluir catálogo multimodal sem ativar imagem antes da base estar sólida.
- Adicionar runtimes locais além de Ollama quando houver integração segura.

Veja [docs/ROADMAP.md](docs/ROADMAP.md).
