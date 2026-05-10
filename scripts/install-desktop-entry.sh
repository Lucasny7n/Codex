#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/share/icons/hicolor/32x32/apps"
mkdir -p "$HOME/.local/share/icons/hicolor/128x128/apps"
mkdir -p "$HOME/.local/share/icons/hicolor/256x256/apps"
mkdir -p "$HOME/.local/share/icons/hicolor/512x512/apps"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sed "s#^Exec=.*#Exec=$ROOT_DIR/scripts/run-codex-command-center.sh#" "$ROOT_DIR/assets/codex-command-center.desktop" > "$HOME/.local/share/applications/codex-command-center.desktop"
cp "$ROOT_DIR/src-tauri/icons/32x32.png" "$HOME/.local/share/icons/hicolor/32x32/apps/codex-command-center.png"
cp "$ROOT_DIR/src-tauri/icons/128x128.png" "$HOME/.local/share/icons/hicolor/128x128/apps/codex-command-center.png"
if [ -f "$ROOT_DIR/src-tauri/icons/256x256.png" ]; then
  cp "$ROOT_DIR/src-tauri/icons/256x256.png" "$HOME/.local/share/icons/hicolor/256x256/apps/codex-command-center.png"
fi
if [ -f "$ROOT_DIR/src-tauri/icons/512x512.png" ]; then
  cp "$ROOT_DIR/src-tauri/icons/512x512.png" "$HOME/.local/share/icons/hicolor/512x512/apps/codex-command-center.png"
fi
echo "Desktop entry instalada em $HOME/.local/share/applications/codex-command-center.desktop"
