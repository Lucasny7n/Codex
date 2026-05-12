# Codex Command Center

[![CI](https://github.com/Lucasny7n/Codex/actions/workflows/ci.yml/badge.svg)](https://github.com/Lucasny7n/Codex/actions/workflows/ci.yml)
![Tauri](https://img.shields.io/badge/Tauri-2.x-24c8db)
![React](https://img.shields.io/badge/React-18-61dafb)
![Rust](https://img.shields.io/badge/Rust-stable-f46623)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![License](https://img.shields.io/badge/license-MIT-blue)

Codex Command Center é um app desktop premium para operar modelos de IA locais e na nuvem com sessões, anexos, permissões explícitas e diagnóstico honesto. Ele é construído com Tauri, Rust, React e TypeScript.

## Visão geral

O projeto separa o uso local via Ollama dos providers na nuvem. Nenhum provider, conta, runtime ou modelo é marcado como pronto sem configuração e teste real. Quando algo ainda não está configurado, a interface deve indicar o estado correto e encaminhar o usuário para a ação necessária.

## Principais recursos

- Chat persistente com sessões, renomeação, duplicação, arquivamento, exportação e importação.
- Bate-papo temporário em memória, usando o mesmo pipeline real de provider/modelo sem persistir histórico.
- Seletor único `Nuvem | Local`, com status real e ações distintas para providers cloud e Ollama.
- Model Manager local para listar, buscar, baixar, testar, detalhar e remover modelos Ollama.
- Providers cloud com API key/profile, teste de conexão e bloqueio explícito quando credencial ou login faltam.
- Composer com anexos como chips, contexto oculto e preview limitado, sem despejar arquivos no campo de texto.
- STT/microfone preparado para backends locais, com diagnóstico de dependência e permissão.
- Health Check para provider, Ollama, permissões, storage, WebView e dependências do host.
- Ações privilegiadas com aprovação, risco e rollback, sem `sudo` silencioso.
- UI escura, limpa e responsiva, com sidebar, área central de chat e superfícies auxiliares em modal/drawer.

## Modelos locais com Ollama

O modo Local usa Ollama real. O app consulta o runtime local, lista modelos instalados, permite baixar modelos pelo nome aceito pelo Ollama e só marca um modelo como utilizável quando ele aparece no snapshot do runtime e passa no teste curto.

Comandos equivalentes para diagnóstico manual:

```bash
ollama list
curl -s http://127.0.0.1:11434/api/tags
ollama pull <modelo>
ollama show <modelo>
ollama rm <modelo>
```

Modelos encontrados em busca local mas ainda não instalados aparecem como candidatos para baixar, não como prontos.

## Modelos na nuvem

Providers cloud exigem API key, login, OAuth ou autenticação CLI conforme o adapter. Credencial salva sem teste fica em estado de configuração/teste. Apenas providers e profiles testados com sucesso podem ser usados no chat.

Estados relevantes incluem `ready`, `testing`, `requires_api_key`, `requires_login`, `requires_cli_auth`, `quota_exceeded`, `rate_limited`, `provider_unavailable`, `misconfigured` e `unavailable`.

## Bate-papo temporário

O bate-papo temporário usa o mesmo provider, profile e modelo selecionados no chat normal. A diferença é persistência: a conversa temporária não cria sessão, não entra no histórico e descarta mensagens/anexos quando o modo é encerrado.

## Anexos e arquivos

Anexos são tratados como contexto estruturado. O composer exibe nome, tipo e tamanho; previews textuais são limitados e enviados como contexto oculto quando aplicável. O app não deve enviar diretórios inteiros, binários grandes ou arquivos fora do limite sem indicação clara.

## STT / microfone

O fluxo de microfone depende de três partes reais: permissão do WebView/portal, captura de áudio no frontend e backend local de transcrição. O app verifica `ffmpeg` e backends como `whisper.cpp`, `whisper`, `faster-whisper` ou Vosk, mas não instala modelos nem pacotes automaticamente.

## Instalação

Requisitos:

- Node.js e npm.
- Rust stable e Cargo.
- Dependências nativas do Tauri/WebKitGTK para Linux.
- Opcional: Ollama para modelos locais.
- Opcional: `ffmpeg` e backend Whisper/Vosk para STT.

```bash
npm install
```

## Desenvolvimento

Frontend Vite:

```bash
npm run dev
```

App desktop Tauri:

```bash
npm run tauri dev
```

Health check local:

```bash
npm run healthcheck
```

## Build

Frontend:

```bash
npm run build
```

Bundle Tauri:

```bash
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
npm run icons:validate
git diff --check
```

Backend Rust:

```bash
cd src-tauri
cargo fmt --check
cargo check
cargo test
```

## Estrutura do projeto

```text
src/
  app/                 Composição principal do app React
  components/          UI por domínio: chat, settings, models, file, layout e common
  lib/                 API Tauri, modelos, Ollama, providers, STT, tema e utilitários
  stores/              Estado global Zustand
  styles/              Tokens, layout e componentes CSS
  types/               Contratos TypeScript compartilhados
src-tauri/src/
  commands/            Ponte Tauri entre frontend e serviços
  models/              Contratos Rust serializáveis
  services/            Sessões, providers, Ollama, credenciais, permissões e execução
docs/                  Arquitetura, desenvolvimento, modelos, segurança e troubleshooting
tests/                 Testes unitários, integração leve e visual
scripts/               Instalação local, health check e validação de ícones
```

## Segurança

- API keys não entram em log, screenshot, commit ou mensagem de erro.
- Credenciais devem passar por `CredentialStore` e aparecer sempre mascaradas na UI.
- `sudo -S` é proibido; ações privilegiadas exigem aprovação explícita.
- Arquivos pesados, modelos e segredos ficam fora do Git por `.gitignore`.
- Modo temporário não persiste conversa, histórico ou anexos.

Veja [docs/SECURITY.md](docs/SECURITY.md).

## Roadmap

O roadmap prioriza estabilização do pipeline real, diagnóstico guiado e manutenção da experiência premium sem prometer capacidades que ainda não estão implementadas. Veja [docs/ROADMAP.md](docs/ROADMAP.md).

## Contribuição

Leia [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) antes de abrir PR. A validação mínima inclui lint, typecheck, testes, build frontend, checks Rust e `git diff --check`.

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE).
