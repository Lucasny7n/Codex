# Operação e Rollback

## Arquivos principais

- App: `/home/lucas/Codex`
- Runtime: `~/.codex/codex-ui`
- Prompt base de agentes: `~/.codex/AGENTS.md`

## Rollback rápido

1. Restaurar `~/.codex/AGENTS.md` a partir do backup em `~/.codex/codex-ui/backups/`
2. Remover pasta `~/.codex/codex-ui` caso queira resetar apenas dados do app
3. Manter `~/.codex/memories`, `~/.codex/sessions` e bancos sqlite originais intactos

## Instalar .desktop

```bash
cd /home/lucas/Codex
bash scripts/install-desktop-entry.sh
```
