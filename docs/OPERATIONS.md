# Operação e Rollback

## Arquivos principais

- App: raiz definida por `settings.workspaceRoot`
- Runtime: `~/.codex/ailu-ai-studio`
- Prompt base de agentes: `~/.codex/AGENTS.md`

## Rollback rápido

1. Restaurar `~/.codex/AGENTS.md` a partir do backup em `~/.codex/ailu-ai-studio/backups/`
2. Remover pasta `~/.codex/ailu-ai-studio` caso queira resetar apenas dados do app
3. Manter `~/.codex/memories`, `~/.codex/sessions` e bancos sqlite originais intactos

## Instalar .desktop

```bash
cd "$WORKSPACE_ROOT"
bash scripts/install-desktop-entry.sh
```
