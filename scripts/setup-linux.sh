#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

confirm() {
  local prompt="$1"
  read -r -p "$prompt [y/N] " answer
  case "$answer" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

print_step() {
  printf "\n== %s ==\n" "$1"
}

print_step "Ailu AI Studio Linux setup"
printf "Repository: %s\n" "$ROOT_DIR"
printf "This script does not run privileged installs without confirmation.\n"

print_step "Environment doctor"
bash "$ROOT_DIR/scripts/doctor.sh" || true

print_step "JavaScript dependencies"
printf "Recommended command:\n"
printf "  npm install\n"
if confirm "Run npm install now?"; then
  npm install
fi

print_step "Arch Linux native dependencies"
printf "Recommended command:\n"
printf "  sudo pacman -S --needed nodejs npm rustup webkit2gtk-4.1 gtk3 libayatana-appindicator librsvg base-devel pkgconf openssl\n"
if command -v pacman >/dev/null 2>&1 && confirm "Run the Arch dependency command with sudo?"; then
  sudo pacman -S --needed nodejs npm rustup webkit2gtk-4.1 gtk3 libayatana-appindicator librsvg base-devel pkgconf openssl
fi

print_step "Optional STT dependencies"
printf "Ailu uses ffmpeg + whisper-cli + a local model for the primary local STT path.\n"
printf "On Arch, the whisper.cpp package usually provides whisper-cli; whisper.cpp itself is optional when whisper-cli works.\n"
printf "Recommended command:\n"
printf "  sudo pacman -S --needed ffmpeg whisper.cpp\n"
if command -v pacman >/dev/null 2>&1 && confirm "Install optional STT packages with sudo?"; then
  sudo pacman -S --needed ffmpeg whisper.cpp
fi

print_step "Desktop entry"
printf "Recommended command:\n"
printf "  bash scripts/install-desktop-entry.sh\n"
if confirm "Install the user desktop entry and icons now?"; then
  bash "$ROOT_DIR/scripts/install-desktop-entry.sh"
fi

print_step "Done"
printf "Start the app with:\n"
printf "  npm run tauri:dev\n"
