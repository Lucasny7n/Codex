#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/share/icons/hicolor/128x128/apps"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cp "$ROOT_DIR/assets/codex-command-center.desktop" "$HOME/.local/share/applications/codex-command-center.desktop"
cp "$ROOT_DIR/src-tauri/icons/128x128.png" "$HOME/.local/share/icons/hicolor/128x128/apps/codex-command-center.png"
echo "Desktop entry instalada em $HOME/.local/share/applications/codex-command-center.desktop"
