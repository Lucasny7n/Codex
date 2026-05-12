# Desenvolvimento

## Setup

```bash
npm install
```

## Rodar

Frontend:

```bash
npm run dev
```

App desktop:

```bash
npm run tauri dev
```

## Ollama Local

O app trata Ollama como única fonte local ativa. Para validar o runtime manualmente:

```bash
ollama list
curl -s http://127.0.0.1:11434/api/tags
ollama pull gpt-oss
ollama show gpt-oss
ollama rm gpt-oss
```

No app, use `Settings > Modelos > Model Manager local` para buscar qualquer nome aceito pelo Ollama, baixar com progresso real, testar, ver detalhes e remover. O resultado só vira instalado depois do refresh do snapshot do Ollama.

## STT

O modal de microfone fica no composer, não em uma aba separada. A detecção verifica `navigator.mediaDevices`, permissões do WebView, PipeWire/WirePlumber/portal no painel de saúde, `ffmpeg`, backends Whisper/Vosk e modelo local.

## Scripts

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run screenshots
npm run test:visual
npm run icons:validate
```

Backend:

```bash
cd src-tauri
cargo fmt --check
cargo check
cargo test
```

## Regras de Implementação

- Corrigir comportamento real antes de polish visual.
- Não marcar provider/modelo como pronto sem teste real.
- Não usar `window.alert`, `prompt` ou `confirm`.
- Não despejar conteúdo de anexo no composer.
- Não adicionar abas técnicas em Configurações.
- Não executar sudo silencioso.
- Não commitar secrets, modelos pesados, logs ou screenshots temporárias.
- Não usar `modelRegistry.ts` como fonte principal da aba Local; local real vem de Ollama.
- Não habilitar fallback entre modelos fora do Modo Desenvolvedor.

## Testes Visuais

`npm run screenshots` e `npm run test:visual` usam Playwright. Por padrão as capturas vão para `test-results/screenshots`; defina `CODEX_SCREENSHOT_DIR=/home/lucas/Lucas-Workspace/Temp` quando quiser comparar no host.

## Ícones

A fonte vetorial fica em `assets/icon-source.svg`. Gere os PNGs com `npm run icons:generate` e valide transparência real com `npm run icons:validate`.

## Checklist Antes de Commit

1. `git status --short`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test -- --run`
5. `npm run build`
6. `npm run screenshots`
7. `npm run test:visual`
8. `npm run icons:validate`
9. `git diff --check`
10. `cd src-tauri && cargo fmt --check && cargo check && cargo test`

## Organização

- UI compartilhada vai em `src/components/common`.
- Painéis completos ficam em `src/components/panels`.
- Contratos de dados ficam em `src/types/domain.ts`.
- Catálogo cloud e sugestões ficam em `src/lib/modelRegistry.ts`.
- Opções do seletor ficam em `src/lib/modelCatalogService.ts`.
- Ollama real fica em `src/lib/ollamaCatalogService.ts` e `src-tauri/src/services/local_runtime.rs`.
- Documentos/RAG lexical ficam em `src/lib/documentContextService.ts`.
- Presets ficam em `src/lib/promptPresetService.ts`.
- Memória por projeto fica em `src/lib/projectMemoryService.ts`.
- Estados e ações de provider ficam em `src/lib/providerStatus.ts`.
- Commands Tauri ficam em `src-tauri/src/commands/mod.rs`.
- Serviços Rust ficam em `src-tauri/src/services`.
