# Codex Command Center

App desktop (Tauri v2 + Rust + React/TypeScript) para operar agentes tipo Codex com execução controlada, permissões seguras, integração com VS Code e memória em `~/.codex`.

## Status do projeto
- Núcleo funcional: sessões, chat, tarefas, status, logs, permissões e arquivos alterados.
- Infra privilegiada implementada: helper allowlist + `pkexec` + policy + scripts install/uninstall.
- Onboarding no app implementado: painel `Primeiros Passos` com ações rápidas.

## Visual
Screenshot pendente: `docs/images/command-center-main.png`.

## Funcionalidades
- Sessões com histórico.
- Chat de agente com acompanhamento de status/tarefas.
- Execução de comandos com política de permissão.
- Ações privilegiadas por `action_id` (sem shell root arbitrário).
- Aprovação `Sim/Não` com risco, alvo e reversão.
- Dry-run para simulação segura.
- Logs de execução e resultados.
- Integração direta com VS Code.
- Memórias e prompt base em `~/.codex`.

## Arquitetura (resumo)
- Frontend: React + Zustand.
- Backend: Rust (Tauri commands + services).
- Camadas: session manager, permission manager, command executor, privileged helper client, provider adapters, memory manager e VS Code bridge.

Detalhes: [ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Rodar em desenvolvimento
```bash
cd /home/lucas/Codex
npm install
npm run tauri dev
```

## Build
```bash
cd /home/lucas/Codex
npm run tauri build -- --debug
```

- bundles Linux ativos por padrão: `deb` e `rpm`.
- `AppImage` foi removido do alvo padrão por incompatibilidade de `linuxdeploy` com RELR no Arch atual.

## Helper privilegiado (instalação manual)
Instale apenas quando quiser ativar o fluxo root real.

```bash
cd /home/lucas/Codex/src-tauri
cargo build --release --bin codex-privileged-helper

cd /home/lucas/Codex
bash scripts/install-privileged-helper.sh
```

## Remoção do helper
```bash
cd /home/lucas/Codex
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
