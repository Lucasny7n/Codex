#!/usr/bin/env bash
set -euo pipefail

report_bin() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    printf '%-14s OK  %s\n' "$name" "$(command -v "$name")"
  else
    printf '%-14s MISSING\n' "$name"
  fi
}

echo "=== Ferramentas ==="
for tool in node npm rustup cargo code pkexec sudo; do
  report_bin "$tool"
done

echo
echo "=== Versões ==="
node -v 2>/dev/null || true
npm -v 2>/dev/null || true
rustc --version 2>/dev/null || true
cargo --version 2>/dev/null || true
code --version 2>/dev/null | sed -n '1,3p' || true

echo
echo "=== Sessão ==="
printf 'XDG_SESSION_TYPE=%s\n' "${XDG_SESSION_TYPE:-unknown}"
printf 'SHELL=%s\n' "${SHELL:-unknown}"

echo
echo "=== Privilégio sem senha ==="
if sudo -n true >/dev/null 2>&1; then
  echo "sudo -n: DISPONÍVEL"
else
  echo "sudo -n: INDISPONÍVEL (senha necessária ou política ausente)"
fi
