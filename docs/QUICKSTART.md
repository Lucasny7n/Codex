# Quickstart: Codex Command Center

## 1. Abrir o app
```bash
cd /home/lucas/Codex
npm run tauri dev
```

## 2. Verificar ambiente
```bash
cd /home/lucas/Codex
bash scripts/check-environment.sh
```

## 3. Abrir no VS Code
```bash
code /home/lucas/Codex
```

## 4. Testar uma permissão no app
1. Abra `Ação Privilegiada`.
2. Escolha `systemctl_status_service`.
3. Use este JSON:

```json
{"service":"waydroid-container.service"}
```

4. Mantenha `dry-run` marcado.
5. Clique em `Solicitar ação privilegiada`.
6. Aprove no painel `Permissões Pendentes`.

## 5. Instalar helper
Instale só quando quiser ativar o fluxo root real.

```bash
cd /home/lucas/Codex/src-tauri
cargo build --release --bin codex-privileged-helper

cd /home/lucas/Codex
bash scripts/install-privileged-helper.sh
```

## 6. Remover helper
```bash
cd /home/lucas/Codex
bash scripts/uninstall-privileged-helper.sh
```
