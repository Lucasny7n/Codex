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

## Scripts

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run screenshots
npm run test:visual
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

## Testes Visuais

`npm run screenshots` e `npm run test:visual` usam Playwright. As capturas da Passada 13 são gravadas em `/home/lucas/Lucas-Workspace/Temp` para não poluir o repositório.

## Checklist Antes de Commit

1. `git status --short`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test -- --run`
5. `npm run build`
6. `npm run screenshots`
7. `npm run test:visual`
8. `git diff --check`
9. `cd src-tauri && cargo fmt --check && cargo check && cargo test`

## Organização

- UI compartilhada vai em `src/components/common`.
- Painéis completos ficam em `src/components/panels`.
- Contratos de dados ficam em `src/types/domain.ts`.
- Catálogo de modelos fica em `src/lib/modelRegistry.ts`.
- Estados e ações de provider ficam em `src/lib/providerStatus.ts`.
- Commands Tauri ficam em `src-tauri/src/commands/mod.rs`.
- Serviços Rust ficam em `src-tauri/src/services`.
