#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_RELEASE="$ROOT_DIR/src-tauri/target/release/codex-privileged-helper"
HELPER_DEBUG="$ROOT_DIR/src-tauri/target/debug/codex-privileged-helper"
POLICY_SOURCE="$ROOT_DIR/system/polkit/local.lucas.codex-command-center.policy"

TARGET_HELPER="/usr/local/libexec/codex-privileged-helper"
TARGET_POLICY="/usr/share/polkit-1/actions/local.lucas.codex-command-center.policy"
ACTION_ID="local.lucas.codex-command-center.privileged-helper"

if [[ -x "$HELPER_RELEASE" ]]; then
  HELPER_SOURCE="$HELPER_RELEASE"
elif [[ -x "$HELPER_DEBUG" ]]; then
  HELPER_SOURCE="$HELPER_DEBUG"
else
  echo "Helper não encontrado. Compile primeiro:"
  echo "  cd /home/lucas/Codex/src-tauri && cargo build --release --bin codex-privileged-helper"
  exit 1
fi

if [[ ! -f "$POLICY_SOURCE" ]]; then
  echo "Policy não encontrada: $POLICY_SOURCE"
  exit 1
fi

if ! command -v pkexec >/dev/null 2>&1; then
  echo "pkexec não encontrado no host."
  exit 1
fi

ts="$(date +%Y%m%d-%H%M%S)"
backup_dir="$HOME/.codex/codex-ui/backups/privileged-helper-install-$ts"
mkdir -p "$backup_dir"

helper_backup="$backup_dir/codex-privileged-helper.previous"
policy_backup="$backup_dir/local.lucas.codex-command-center.policy.previous"
rollback_script="$backup_dir/rollback.sh"

if [[ -e "$TARGET_HELPER" ]]; then
  cp -a "$TARGET_HELPER" "$helper_backup" || true
fi
if [[ -e "$TARGET_POLICY" ]]; then
  cp -a "$TARGET_POLICY" "$policy_backup" || true
fi

cat >"$rollback_script" <<EOF
#!/usr/bin/env bash
set -euo pipefail

if [[ -f "$helper_backup" ]]; then
  pkexec /usr/bin/install -Dm755 "$helper_backup" "$TARGET_HELPER"
else
  pkexec /usr/bin/rm -f "$TARGET_HELPER"
fi

if [[ -f "$policy_backup" ]]; then
  pkexec /usr/bin/install -Dm644 "$policy_backup" "$TARGET_POLICY"
else
  pkexec /usr/bin/rm -f "$TARGET_POLICY"
fi

echo "Rollback concluído."
EOF
chmod +x "$rollback_script"

cat <<EOF
Instalação do helper privilegiado do Codex Command Center

Origem helper : $HELPER_SOURCE
Origem policy : $POLICY_SOURCE
Destino helper: $TARGET_HELPER
Destino policy: $TARGET_POLICY
Action ID     : $ACTION_ID
Backup local  : $backup_dir
Rollback      : $rollback_script
EOF

read -r -p "Continuar com a instalação? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Instalação cancelada."
  exit 0
fi

pkexec /usr/bin/install -Dm755 "$HELPER_SOURCE" "$TARGET_HELPER"
pkexec /usr/bin/install -Dm644 "$POLICY_SOURCE" "$TARGET_POLICY"

if command -v pkaction >/dev/null 2>&1; then
  if pkaction --action-id "$ACTION_ID" >/dev/null 2>&1; then
    echo "Policy registrada no polkit."
  else
    echo "Aviso: policy ainda não aparece no pkaction (pode exigir restart do polkit)."
  fi
fi

dry_payload='{"requestId":"install-check","sessionId":"install-check","actionId":"waydroid_status","args":{},"dryRun":true,"userHome":"'"$HOME"'","requestedAt":"'"$(date --iso-8601=seconds)"'"}'
if pkexec "$TARGET_HELPER" --request-json "$dry_payload" >/dev/null 2>&1; then
  echo "Validação do helper: OK (dry-run)."
else
  echo "Aviso: validação dry-run falhou; confira policy/logs."
fi

echo "Instalação concluída."
echo "Se precisar desfazer: bash \"$rollback_script\""
