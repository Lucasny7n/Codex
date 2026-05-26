#!/usr/bin/env bash
# Skill: repair-audio (hardware / audio)
# Restarts the user PipeWire audio stack.
#
# HARDWARE skill -> NEVER VM-tested. Audio devices do not exist inside a
# libvirt VM, so the only safe flow is: dry-run preview + explicit manual
# approval on the host (click + spoken summary). There is NO full rollback for
# hardware: restarting services is not undoable by a snapshot. If audio is
# still wrong afterwards, re-run this skill or restart your session manually.
#
# Supports --dry-run (required for every skill). Deterministic and auditable:
# it only ever restarts three fixed user services and never installs anything.
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

report_state() {
  echo "serviços de áudio (usuário):"
  for svc in "${SERVICES[@]}"; do
    echo "  ${svc}: $(systemctl --user is-active "$svc" 2>/dev/null || echo desconhecido)"
  done
}

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[dry-run] Skill: reparar áudio (hardware)"
  echo "[dry-run] Ação que seria executada (somente após aprovação no host):"
  echo "[dry-run]   systemctl --user restart ${SERVICES[*]}"
  echo "[dry-run] Estado atual:"
  report_state
  echo "[dry-run] Não testável em VM: não há dispositivos de áudio na VM;"
  echo "[dry-run]   esta skill só pode ser validada no host real, com aprovação manual."
  echo "[dry-run] Sem rollback total: reiniciar serviços não é revertível por snapshot."
  exit 0
fi

echo "Reparando áudio: reiniciando ${SERVICES[*]}..."
systemctl --user restart "${SERVICES[@]}"

# Functional check: the PipeWire daemon must be active again.
systemctl --user --quiet is-active pipewire

echo "Relatório:"
report_state
echo "ok: stack de áudio reiniciado"
