#!/usr/bin/env bash
# Skill: repair-audio (hardware / audio)
# Restarts the user PipeWire stack. HARDWARE skill -> never VM-tested.
# Requires dry-run preview + explicit manual approval on the host.
# Supports --dry-run (required for every skill).
#
# Usage: repair-audio.sh [--dry-run]
set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "argumento desconhecido: $arg" >&2; exit 64 ;;
  esac
done

SERVICES=(pipewire pipewire-pulse wireplumber)

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[dry-run] reiniciaria os serviços de usuário: ${SERVICES[*]}"
  echo "[dry-run] comando: systemctl --user restart ${SERVICES[*]}"
  echo "[dry-run] estado atual:"
  systemctl --user --no-pager is-active "${SERVICES[@]}" || true
  exit 0
fi

systemctl --user restart "${SERVICES[@]}"

# Functional check: the PipeWire daemon must be active again.
systemctl --user --quiet is-active pipewire
echo "ok: stack de áudio reiniciado"
