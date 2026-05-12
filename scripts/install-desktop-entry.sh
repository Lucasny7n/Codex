#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$HOME/.local/share/applications"
ICON_ROOT="$HOME/.local/share/icons/hicolor"
DESKTOP_FILE="$APP_DIR/codex-command-center.desktop"

mkdir -p "$APP_DIR"
if command -v node >/dev/null 2>&1; then
  node "$ROOT_DIR/scripts/validate-icon-alpha.mjs"
fi
sed "s#^Exec=.*#Exec=$ROOT_DIR/scripts/run-codex-command-center.sh#" \
  "$ROOT_DIR/assets/codex-command-center.desktop" > "$DESKTOP_FILE"
chmod 0644 "$DESKTOP_FILE"

install -Dm644 "$ROOT_DIR/src-tauri/icons/32x32.png" "$ICON_ROOT/32x32/apps/codex-command-center.png"
install -Dm644 "$ROOT_DIR/src-tauri/icons/128x128.png" "$ICON_ROOT/128x128/apps/codex-command-center.png"
if [ -f "$ROOT_DIR/src-tauri/icons/256x256.png" ]; then
  install -Dm644 "$ROOT_DIR/src-tauri/icons/256x256.png" "$ICON_ROOT/256x256/apps/codex-command-center.png"
fi
if [ -f "$ROOT_DIR/src-tauri/icons/512x512.png" ]; then
  install -Dm644 "$ROOT_DIR/src-tauri/icons/512x512.png" "$ICON_ROOT/512x512/apps/codex-command-center.png"
fi

if command -v desktop-file-validate >/dev/null 2>&1; then
  desktop-file-validate "$DESKTOP_FILE"
fi
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q "$ICON_ROOT" >/dev/null 2>&1 || true
fi

echo "Desktop entry instalada em $DESKTOP_FILE"
