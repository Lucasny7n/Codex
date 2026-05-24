#!/usr/bin/env bash
# Skill: install-package (software / package)
# Deterministic pacman install. Software skill -> safe to test in the VM.
# Supports --dry-run (required for every skill).
#
# Usage: install-package.sh [--dry-run] <package> [<package> ...]
set -euo pipefail

DRY_RUN=0
PACKAGES=()

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -*) echo "argumento desconhecido: $arg" >&2; exit 64 ;;
    *)
      if [[ ! "$arg" =~ ^[a-z0-9@+._-]+$ ]]; then
        echo "nome de pacote inválido: $arg" >&2
        exit 64
      fi
      PACKAGES+=("$arg")
      ;;
  esac
done

if [[ ${#PACKAGES[@]} -eq 0 ]]; then
  echo "informe ao menos um pacote" >&2
  exit 64
fi

CMD=(pacman -S --needed --noconfirm "${PACKAGES[@]}")

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[dry-run] instalaria: ${PACKAGES[*]}"
  echo "[dry-run] comando: sudo ${CMD[*]}"
  # Real planning info without mutating anything.
  pacman -Sp --needed "${PACKAGES[@]}" 2>/dev/null || true
  exit 0
fi

sudo "${CMD[@]}"

# Functional check: confirm each package is now installed.
for pkg in "${PACKAGES[@]}"; do
  pacman -Qq "$pkg" >/dev/null
done
echo "ok: ${PACKAGES[*]} instalado(s)"
