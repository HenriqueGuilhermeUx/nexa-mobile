#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICON_SVG="$ROOT/assets/brand/nexa-mark-v144.svg"
ADAPTIVE_SVG="$ROOT/assets/brand/nexa-adaptive-v144.svg"
ICON_PNG="$ROOT/nexa-mobile/nexa-mobile/assets/icon.png"
ADAPTIVE_PNG="$ROOT/nexa-mobile/nexa-mobile/assets/adaptive-icon.png"

if command -v magick >/dev/null 2>&1; then
  IM=(magick)
elif command -v convert >/dev/null 2>&1; then
  IM=(convert)
else
  echo "ImageMagick is required to render Nexa native assets." >&2
  exit 1
fi

"${IM[@]}" -background none "$ICON_SVG" -resize 1024x1024 -strip "$ICON_PNG"
"${IM[@]}" -background none "$ADAPTIVE_SVG" -resize 1024x1024 -strip "$ADAPTIVE_PNG"

if command -v identify >/dev/null 2>&1; then
  identify "$ICON_PNG"
  identify "$ADAPTIVE_PNG"
fi

node <<'NODE'
const fs = require('fs');
for (const path of [
  'nexa-mobile/nexa-mobile/assets/icon.png',
  'nexa-mobile/nexa-mobile/assets/adaptive-icon.png',
]) {
  const stat = fs.statSync(path);
  if (stat.size < 10000) throw new Error('Rendered asset too small: ' + path);
}
console.log('Nexa v144 native brand assets rendered.');
NODE
