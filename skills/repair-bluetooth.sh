#!/usr/bin/env bash
# Skill: repair-bluetooth (hardware / bluetooth)
# Restarts the system Bluetooth stack and re-enables the controller.
#
# HARDWARE skill -> NEVER VM-tested. The physical Bluetooth radio does not
# exist inside a libvirt VM, so the only safe flow is: dry-run preview +
# explicit manual approval on the host (click + spoken summary). There is NO
# full rollback for hardware: the radio/controller state cannot be captured by
# a snapshot. If Bluetooth is still wrong afterwards, re-run this skill or
# toggle the controller manually.
#
# Supports --dry-run (required for every skill). Deterministic and auditable:
# fixed, ordered steps (unblock -> restart service -> power on), no installs.
#
# Usage: repair-bluetooth.sh [--dry-run]
set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "argumento desconhecido: $arg" >&2; exit 64 ;;
  esac
done

SERVICE=bluetooth.service

report_state() {
  echo "serviço ${SERVICE}: $(systemctl is-active "$SERVICE" 2>/dev/null || echo desconhecido)"
  if command -v rfkill >/dev/null 2>&1; then
    echo "rfkill (bluetooth):"
    rfkill list bluetooth 2>/dev/null | sed 's/^/  /' || echo "  sem dados"
  else
    echo "rfkill: indisponível"
  fi
  if command -v bluetoothctl >/dev/null 2>&1; then
    echo "controladores:"
    bluetoothctl list 2>/dev/null | sed 's/^/  /' || echo "  nenhum controlador listado"
  else
    echo "bluetoothctl: indisponível"
  fi
}

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[dry-run] Skill: reparar Bluetooth (hardware)"
  echo "[dry-run] Ações que seriam executadas (somente após aprovação no host):"
  echo "[dry-run]   1. sudo rfkill unblock bluetooth"
  echo "[dry-run]   2. sudo systemctl restart ${SERVICE}"
  echo "[dry-run]   3. bluetoothctl power on"
  echo "[dry-run] Estado atual:"
  report_state
  echo "[dry-run] Não testável em VM: o rádio Bluetooth físico não existe na VM;"
  echo "[dry-run]   esta skill só pode ser validada no host real, com aprovação manual."
  echo "[dry-run] Sem rollback total: o estado do rádio não é capturável por snapshot."
  exit 0
fi

echo "Reparando Bluetooth..."
sudo rfkill unblock bluetooth
sudo systemctl restart "$SERVICE"
bluetoothctl power on >/dev/null 2>&1 || true

# Functional check: the bluetooth service must be active again.
systemctl --quiet is-active "$SERVICE"

echo "Relatório:"
report_state
echo "ok: stack Bluetooth reiniciado"
