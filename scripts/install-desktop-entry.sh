#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$HOME/.local/share/applications"
cp /home/lucas/Codex-Codex/assets/codex-command-center.desktop "$HOME/.local/share/applications/codex-command-center.desktop"
echo "Desktop entry instalada em $HOME/.local/share/applications/codex-command-center.desktop"
