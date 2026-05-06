#!/usr/bin/env bash
set -euo pipefail

TARGET_HELPER="/usr/local/libexec/codex-privileged-helper"
TARGET_POLICY="/usr/share/polkit-1/actions/local.lucas.codex-command-center.policy"

ts="$(date +%Y%m%d-%H%M%S)"
backup_dir="$HOME/.codex/codex-ui/backups/privileged-helper-uninstall-$ts"
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
fi

if [[ -f "$policy_backup" ]]; then
  pkexec /usr/bin/install -Dm644 "$policy_backup" "$TARGET_POLICY"
fi

echo "Rollback concluído."
EOF
chmod +x "$rollback_script"

cat <<EOF
Remoção do helper privilegiado do Codex Command Center

Helper alvo : $TARGET_HELPER
Policy alvo : $TARGET_POLICY
Backup local: $backup_dir
Rollback    : $rollback_script
EOF

read -r -p "Confirmar remoção? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Remoção cancelada."
  exit 0
fi

if [[ -e "$TARGET_HELPER" ]]; then
  pkexec /usr/bin/rm -f "$TARGET_HELPER"
fi
if [[ -e "$TARGET_POLICY" ]]; then
  pkexec /usr/bin/rm -f "$TARGET_POLICY"
fi

echo "Remoção concluída."
echo "Se precisar restaurar: bash \"$rollback_script\""
