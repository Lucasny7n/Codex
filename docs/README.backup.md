# Codex Command Center

App desktop (Tauri v2 + Rust + React/TypeScript) para operar agentes tipo Codex com execução controlada, permissões seguras, integração com VS Code e memória em `~/.codex`.

## Status do projeto
- Núcleo funcional: sessões, chat, tarefas, status, logs, permissões e arquivos alterados.
- Infra privilegiada implementada: helper allowlist + `pkexec` + policy + scripts install/uninstall.
- Onboarding no app implementado: painel `Primeiros Passos` com ações rápidas.

## Visual
O projeto conta com uma interface moderna (Modern UI) baseada em um Design System proprietário com:
- Preto puro e acentos em azul sistema.
- Layout de 3 colunas com scroll independente.
- Seletor de modo de input (Ordem, Terminal, Ação).
- Justificativa técnica integrada nas respostas.

## Funcionalidades
- Sessões com histórico.
- Chat de agente com acompanhamento de status/tarefas.
- Execução de comandos com política de permissão.
- Ações privilegiadas por `action_id` (sem shell root arbitrário).
- Aprovação `Sim/Não` com risco, alvo e reversão.
- Dry-run para simulação segura.
- Logs de execução e resultados (Terminal Moderno).
- Integração direta com VS Code.
- Memórias e prompt base em `~/.codex`.

## Roadmap: Squad IA
O projeto está sendo preparado para suportar múltiplos agentes coordenados (Architect, Builder, Reviewer, Tester). Veja [MULTI_AGENT_PLAN.md](docs/MULTI_AGENT_PLAN.md) para detalhes.

## Rodar em desenvolvimento
Execute a partir da raiz do projeto.

```bash
export WORKSPACE_ROOT="$(pwd)"
npm install
npm run tauri dev
```

## Build
```bash
export WORKSPACE_ROOT="$(pwd)"
npm run tauri build -- --debug
```

- bundles Linux ativos por padrão: `deb` e `rpm`.
- `AppImage` foi removido do alvo padrão por incompatibilidade de `linuxdeploy` com RELR no Arch atual.

## Helper privilegiado (instalação manual)
Instale apenas quando quiser ativar o fluxo root real.

```bash
cd "$WORKSPACE_ROOT/src-tauri"
cargo build --release --bin codex-privileged-helper

cd "$WORKSPACE_ROOT"
bash scripts/install-privileged-helper.sh
```

## Remoção do helper
```bash
cd "$WORKSPACE_ROOT"
bash scripts/uninstall-privileged-helper.sh
```

## Como usar permissões no app
1. Solicite comando/ação.
2. Leia risco, alvo e reversão.
3. `Sim` executa, `Não` cancela.
4. Prefira `dry-run` antes de ação crítica.

## Segurança (importante)
- O app não pede senha na UI.
- Nunca usa `sudo -S`.
- Não há execução root arbitrária no helper.
- Ações fora da allowlist são bloqueadas.
- Não aprove ação crítica sem entender impacto.

## Rollback e auditoria
- Backups: `~/.codex/codex-ui/backups/`
- Log do app: `~/.codex/codex-ui/logs/privileged-actions.log`
- Log do helper: `/var/log/codex-privileged-helper.log` (fallback `/tmp/codex-privileged-helper.log`)

## Documentação
- [GUIA_DE_USO.md](docs/GUIA_DE_USO.md)
- [QUICKSTART.md](docs/QUICKSTART.md)
- [PERMISSIONS.md](docs/PERMISSIONS.md)
- [PRIVILEGED_HELPER_PLAN.md](docs/PRIVILEGED_HELPER_PLAN.md)
- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [ENTREGA_FINAL_MODELO.md](docs/ENTREGA_FINAL_MODELO.md)
