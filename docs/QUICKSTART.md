# Quickstart: Codex Command Center

Rode os comandos a partir da raiz do projeto. Quando abrir outro terminal, defina `WORKSPACE_ROOT` novamente com `export WORKSPACE_ROOT="$(pwd)"`.

## 1. Abrir o app
```bash
export WORKSPACE_ROOT="$(pwd)"
npm run tauri dev
```

## 2. Verificar ambiente
```bash
export WORKSPACE_ROOT="$(pwd)"
bash scripts/check-environment.sh
```

## 3. Abrir no VS Code
```bash
code "$WORKSPACE_ROOT"
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
cd "$WORKSPACE_ROOT/src-tauri"
cargo build --release --bin codex-privileged-helper

cd "$WORKSPACE_ROOT"
bash scripts/install-privileged-helper.sh
```

## 6. Remover helper
```bash
cd "$WORKSPACE_ROOT"
bash scripts/uninstall-privileged-helper.sh
```
