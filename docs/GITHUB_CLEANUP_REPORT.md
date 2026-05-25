# GitHub Cleanup Report

Data: 2026-05-25

Repositorio: `Lucasny7n/ailu-ai-studio`

Branch alvo: `claude/ailu-refactor-skills-quant-p49AR` (PR #9)

## Objetivo E Protecoes

Esta limpeza estabelece `main` como linha estavel e mantem features em PR ate
validacao completa. Durante a auditoria:

- o checkout original estava em `feature/ailu-nexus-os-control-layer` com
  alteracoes locais nao commitadas; ele nao foi modificado;
- a validacao e a atualizacao do PR #9 foram feitas em clone isolado em
  `/tmp/ailu-github-cleanup-pr9-20260525`;
- nenhuma branch remota foi removida;
- nenhum force-push foi realizado;
- `main` nao recebe merge sem validacao local e checks do PR.

## Estado Inicial Encontrado

- `main` remoto estava em `c089329`, merge do PR #7, com hardware classifier,
  presets de quantizacao e executor de skills.
- O clone local original ainda apontava `origin/main` para `35a5e97`; portanto
  nao era fonte confiavel para decidir merges sem consultar o GitHub.
- O PR #9 era o unico PR recente mergeavel que continha conjuntamente
  `Skill Studio`, `Ailu Local Engine` e a tela `Meu PC`.

| PR | Estado inicial | Achado |
| --- | --- | --- |
| #2 | aberto, conflitante | redesign antigo com bloqueios de UX/readiness registrados |
| #3 | aberto, conflitante | auditoria antiga baseada em arvore superada |
| #4 | aberto, mergeavel | GitHub polish e AI Workspace ainda nao integralmente incorporados |
| #5 | aberto, mergeavel | rebuild experimental amplo, com bloqueio registrado de IA real |
| #6 | aberto, conflitante | implementacao alternativa de hardware/model-fit |
| #7 | merged | hardware classifier e skill executor ja em `main` |
| #8 | aberto, conflitante | integracao experimental de #5 com fase alternativa de hardware |
| #9 | aberto, mergeavel | candidato incremental com Skill Studio, Local Engine e Meu PC |

## Branches Auditadas

| Branch remota | Papel identificado | Decisao |
| --- | --- | --- |
| `main` | versao estavel antes desta limpeza | base obrigatoria |
| `claude/ailu-refactor-skills-quant-p49AR` | candidato funcional atual / PR #9 | branch canonica desta entrega |
| `feature/terax-awesome-llm-upgrade` | AI Workspace + GitHub polish / PR #4 | preservar para extracao seletiva |
| `antigravity/v1-operador-local-real` | rebuild experimental / PR #5 | preservar em draft |
| `codex/audit-repository-for-inconsistencies` | alternativa hardware / PR #6 | PR fechado, branch preservada |
| `test/pr6-phase1-on-antigravity` | combinacao experimental / PR #8 | PR fechado, branch preservada |
| `codex-cloud-end4-ui-v2` | redesign antigo / PR #2 | PR fechado, branch preservada |
| `gemini-audit-end4-ui-v2` | auditoria antiga / PR #3 | PR fechado, branch preservada |
| `ux-core-refactor-v1` | historico do PR #1 merged | preservar como historico |

## Branch Canonica E Correcao Bloqueante

O PR #9 foi escolhido como caminho para `main` porque acrescenta as features
atuais sobre a base incremental ja aceita em #7, sem substituir em massa a
aplicacao existente:

- `src/components/panels/SkillStudioModal.tsx` e `SkillsPanel.tsx`;
- `src/features/local-engine/LocalEnginePage.tsx`, rotulada `Meu PC`;
- `src-tauri/src/services/local_engine/` e contratos associados.

Durante a revisao, foi encontrado um bloqueio: o novo Local Engine marcava
`Cloud (fallback)` como `Ready` sem verificar provider ou credencial. Isso foi
corrigido no commit `4e46cd4`:

- fallback cloud agora fica `Unknown` ate validacao real;
- a UI diferencia `Pronto verificado` de `Configuracao nao validada`;
- testes cobrem o contrato de readiness;
- o arquivo vazio `CLAUDE.md` foi removido como artefato sem funcao.

A candidata foi atualizada com `main` sem conflito pelo merge local `8484c04`.

## Decisao Dos PRs

| PR | Acao executada | Motivo |
| --- | --- | --- |
| #2 | fechado com comentario | redesign antigo, conflitante e superado por correcoes posteriores |
| #3 | fechado com comentario | auditoria antiga, sem representar o app atual |
| #4 | convertido para draft com comentario | contem material util ainda nao consolidado; nao fechar nem mergear no escuro |
| #5 | convertido para draft com comentario | rebuild experimental com bloqueio funcional registrado; exige decisao seletiva |
| #6 | fechado com comentario | funcionalidade principal substituida por #7 e evolucao em #9 |
| #8 | fechado com comentario | integracao experimental conflitante e sem validacao marcada |
| #9 | escolhido como PR principal | caminho incremental com as features atuais e correcao de readiness |

Nenhuma branch remota foi deletada. Os PRs fechados continuam disponiveis como
referencia de historico e para eventual port seletivo.

## Validacao

No head original do PR #9 (`9cc1fad`), antes da correcao:

- `npm install`: concluido; reportou 2 vulnerabilidades moderadas de
  dependencias, sem auto-fix aplicado;
- `npm run lint`: passou;
- `npm run typecheck`: passou;
- `npm test -- --run`: passou, 25 arquivos e 115 testes;
- `npm run build`: passou;
- `cargo fmt --check`: passou;
- `env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target-pr9 cargo check`:
  passou com warnings de dead code em `services/skills.rs`;
- `env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target-pr9 cargo test`:
  passou, 103 testes da lib e 5 do helper;
- `git diff --check`: passou.

Validacao focal da correcao `4e46cd4`:

- `npm test -- --run tests/local-engine-page.test.tsx`: passou, 9 testes;
- `env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target-pr9 cargo test services::local_engine`:
  passou, 26 testes;
- `cargo fmt --check`: passou;
- `git diff --check`: passou.

Matriz final na branch sincronizada com `main`, incluindo este relatorio:

- `npm run lint`: passou;
- `npm run typecheck`: passou;
- `npm test -- --run`: passou, 25 arquivos e 116 testes;
- `npm run build`: passou;
- `npm run icons:validate`: passou;
- `npm run screenshots`: passou, 6 testes visuais;
- `npm run test:visual`: passou, 6 testes visuais;
- `cargo fmt --check`: passou;
- `env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target-pr9 cargo check`:
  passou com os warnings de dead code ja registrados;
- `env CARGO_TARGET_DIR=/tmp/ailu-ai-studio-cargo-target-pr9 cargo test`:
  passou, 104 testes da lib e 5 do helper;
- `git diff --check`: passou.

O primeiro `npm run screenshots` falhou porque o browser
`chromium_headless_shell-1217` ainda nao estava no cache local do Playwright.
O pacote headless foi baixado, sua integridade foi confirmada com `unzip -t`,
extraido no cache e o smoke foi repetido com sucesso. A execucao visual tambem
emite um aviso deprecado de `module.register()` vindo do tooling Playwright,
sem falha de teste.

## Convencao Futura

- `main` representa sempre o app estavel e validado.
- Features usam `feature/...`; correcoes usam `fix/...`.
- Experimentos usam `experiment/...` e nao ficam como PR de merge aberto sem
  decisao explicita.
- Cada feature deve ter um unico PR ativo para `main`.
- Todo PR deve registrar validacao executada e rollback.
- Apos merge ou abandono justificado, o PR deve ser fechado; exclusao de
  branch remota exige confirmacao explicita.

## Pendencias Controladas

- Executar a matriz final e aguardar CI verde do PR #9 antes do merge em
  `main`.
- Avaliar extracao seletiva do GitHub polish/AI Workspace do draft #4 depois
  que a linha funcional atual estiver estavel.
- Decidir se algum conceito do rebuild experimental #5 merece port isolado;
  ele nao deve ser mergeado integralmente sem nova validacao.
- Tratar em follow-up os warnings de dead code em `services/skills.rs` e as
  duas vulnerabilidades moderadas reportadas por `npm install`.

## Rollback

- A correcao de readiness pode ser revertida por `git revert 4e46cd4`.
- Se o PR #9 for mergeado e precisar ser desfeito, usar revert do merge pelo
  fluxo normal de PR, preservando historico.
- PRs fechados podem ser reabertos; drafts #4 e #5 podem voltar a revisao
  somente apos decisao e validacao explicitas.
