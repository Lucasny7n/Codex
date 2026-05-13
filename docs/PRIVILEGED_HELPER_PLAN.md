# Infra de Helper Privilegiado (Implementado)

Objetivo: executar ações root aprovadas no app sem pedir senha dentro da UI, sem `sudo -S` e sem shell root arbitrário.

Os comandos de instalação assumem `WORKSPACE_ROOT` apontando para a raiz do projeto.

## Arquitetura implementada

1. Frontend cria `PermissionRequest` com:
- `id`, `actionId`, título e descrição;
- categoria e risco (`low/medium/high/critical`);
- comando planejado (preview), alvo e rollback.

2. Backend valida a ação:
- consulta allowlist em `src-tauri/src/services/privileged_actions.rs`;
- valida argumentos por esquema/regex;
- registra pendência para fluxo `Sim/Não`.

3. Após aprovação:
- backend gera payload seguro (`HelperRequest`);
- chama `pkexec` com helper dedicado;
- recebe resultado estruturado (`success/summary/stdout/stderr/exitCode`);
- emite evento `permission-outcome` para a UI;
- registra log em `~/.codex/ailu-ai-studio/logs/privileged-actions.log`.

4. Helper privilegiado:
- binário: `src-tauri/src/bin/ailu-privileged-helper.rs`;
- aceita apenas `--request-json`;
- **não executa shell livre**;
- executa apenas ações explícitas da allowlist;
- valida argumentos novamente no contexto root;
- gera backup automático para ações críticas (`/boot`, restauração de arquivo etc.).

5. Polkit:
- policy local preparada em `system/polkit/local.lucas.ailu-ai-studio.policy`;
- instalação via script dedicado (não aplicada automaticamente).

## Ações allowlist iniciais

- `systemctl_enable_service`
- `systemctl_disable_service`
- `systemctl_restart_service`
- `systemctl_status_service`
- `bootctl_set_default_kernel`
- `chmod_random_seed`
- `backup_file`
- `restore_file`
- `pacman_install_packages`
- `paccache_keep_versions`
- `waydroid_start`
- `waydroid_stop`
- `waydroid_status`
- `hyprland_verify_config`
- `hyprland_reload_user`

Observações:
- `pacman_install_packages`, `bootctl_set_default_kernel` e `restore_file` exigem confirmação alta.
- serviço fora da allowlist é bloqueado.
- ação desconhecida é bloqueada.
- comandos destrutivos arbitrários como `rm -rf` não existem no protocolo.

## Arquivos principais

- Helper root: `src-tauri/src/bin/ailu-privileged-helper.rs`
- Cliente pkexec: `src-tauri/src/services/privileged_helper_client.rs`
- Catálogo/validação: `src-tauri/src/services/privileged_actions.rs`
- Fluxo de comandos Tauri: `src-tauri/src/commands/mod.rs`
- Policy: `system/polkit/local.lucas.ailu-ai-studio.policy`
- Instalação: `scripts/install-privileged-helper.sh`
- Desinstalação: `scripts/uninstall-privileged-helper.sh`

## Instalação (manual, fora do app)

1. Build do helper:
```bash
cd "$WORKSPACE_ROOT/src-tauri"
cargo build --release --bin ailu-privileged-helper
```

2. Instalar helper + policy:
```bash
cd "$WORKSPACE_ROOT"
bash scripts/install-privileged-helper.sh
```

3. Desinstalar:
```bash
bash scripts/uninstall-privileged-helper.sh
```

Os scripts criam backup e geram caminho de rollback.
