#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT_DIR/assets/icon-source.svg"
ICON_DIR="$ROOT_DIR/src-tauri/icons"

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick não encontrado. Instale o pacote imagemagick para gerar os PNGs." >&2
  exit 1
fi

mkdir -p "$ICON_DIR"

for size in 32 128 256 512; do
  magick -background none "$SOURCE" -resize "${size}x${size}" "$ICON_DIR/${size}x${size}.png"
done

magick -background none "$SOURCE" -resize "256x256" "$ICON_DIR/128x128@2x.png"
bash "$ROOT_DIR/scripts/validate-icons.sh"
