#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ok() { printf "OK        %s\n" "$1"; }
warn() { printf "ATTENTION %s\n" "$1"; }
err() { printf "ERROR     %s\n" "$1"; }

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

print_cmd() {
  local name="$1"
  if has_cmd "$name"; then
    ok "$name: $(command -v "$name")"
  else
    warn "$name: not found"
  fi
}

print_version() {
  local label="$1"
  shift
  if "$@" >/tmp/ailu-doctor-version 2>/dev/null; then
    ok "$label: $(sed -n '1p' /tmp/ailu-doctor-version)"
  else
    warn "$label: unavailable"
  fi
  rm -f /tmp/ailu-doctor-version
}

systemd_user_unit() {
  local unit="$1"
  if ! has_cmd systemctl; then
    warn "$unit: systemctl not found"
    return
  fi
  local output
  output="$(systemctl --user is-active "$unit" 2>&1 || true)"
  if [ "$output" = "active" ]; then
    ok "$unit: active"
  elif printf "%s" "$output" | grep -qiE "operation not permitted|failed to connect"; then
    warn "$unit: user bus not readable from this shell; verify in the desktop session"
  else
    warn "$unit: inactive or unavailable"
  fi
}

arch_pkg() {
  local package="$1"
  if ! has_cmd pacman; then
    warn "$package: pacman not available on this distro"
    return
  fi
  if pacman -Q "$package" >/dev/null 2>&1; then
    ok "$package: installed"
  else
    warn "$package: missing"
  fi
}

section() {
  printf "\n== %s ==\n" "$1"
}

section "Project"
printf "Root      %s\n" "$ROOT_DIR"
if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ok "git branch: $(git -C "$ROOT_DIR" branch --show-current 2>/dev/null || true)"
  ok "git remote: $(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null || printf 'none')"
else
  err "not a git repository"
fi

section "Node and Rust"
print_cmd node
print_cmd npm
print_cmd rustup
print_cmd cargo
print_version "node" node --version
print_version "npm" npm --version
print_version "cargo" cargo --version

section "Tauri Linux dependencies"
for package in webkit2gtk-4.1 gtk3 libayatana-appindicator librsvg base-devel pkgconf openssl; do
  arch_pkg "$package"
done

section "Ollama local AI"
print_cmd ollama
if has_cmd ollama; then
  ollama --version 2>/dev/null | sed -n '1p' || true
  ollama list 2>/dev/null | sed -n '1,8p' || warn "ollama list failed"
else
  warn "Install Ollama before using Local models"
fi
if has_cmd curl; then
  if curl -fsS http://127.0.0.1:11434/api/tags >/tmp/ailu-ollama-tags.json 2>/dev/null; then
    ok "Ollama API: http://127.0.0.1:11434/api/tags reachable"
  else
    warn "Ollama API: not reachable on 127.0.0.1:11434"
  fi
  rm -f /tmp/ailu-ollama-tags.json
else
  warn "curl: not found"
fi

section "STT and microphone"
print_cmd ffmpeg
if has_cmd whisper-cli; then
  ok "whisper-cli: $(command -v whisper-cli)"
else
  warn "whisper-cli: not found (Arch package usually: whisper.cpp)"
fi
if has_cmd whisper.cpp; then
  ok "whisper.cpp: $(command -v whisper.cpp)"
elif has_cmd whisper-cli; then
  ok "whisper.cpp: optional, whisper-cli is available"
else
  warn "whisper.cpp: not found"
fi
print_cmd pw-record
print_cmd parecord
print_cmd arecord
MODEL_PATH=""
for candidate in \
  "${WHISPER_MODEL:-}" \
  "${WHISPER_CPP_MODEL:-}" \
  "${HOME}/.codex/models/ggml-base.bin" \
  "${HOME}/.codex/models/ggml-small.bin" \
  "${HOME}/.codex/models/ggml-tiny.bin"; do
  if [ -n "$candidate" ] && [ -f "$candidate" ]; then
    MODEL_PATH="$candidate"
    break
  fi
done
if [ -n "$MODEL_PATH" ]; then
  ok "STT model: $MODEL_PATH"
else
  warn "STT model missing: expected ~/.codex/models/ggml-base.bin or WHISPER_MODEL"
fi
systemd_user_unit pipewire.service
systemd_user_unit wireplumber.service
systemd_user_unit xdg-desktop-portal.service

section "Icons and desktop entry"
if npm --prefix "$ROOT_DIR" run icons:validate >/tmp/ailu-icons-check.log 2>&1; then
  ok "icons: alpha validation passed"
else
  warn "icons: validation failed, run npm run icons:validate"
fi
if [ -f "$ROOT_DIR/assets/ailu-ai-studio.desktop" ]; then
  ok "desktop template: assets/ailu-ai-studio.desktop"
else
  err "desktop template missing"
fi
if [ -f "$HOME/.local/share/applications/ailu-ai-studio.desktop" ]; then
  ok "user desktop entry installed"
else
  warn "user desktop entry not installed, run bash scripts/install-desktop-entry.sh"
fi

section "Next commands"
printf "npm install\n"
printf "npm run tauri:dev\n"
printf "npm run lint && npm run typecheck && npm run test -- --run\n"
