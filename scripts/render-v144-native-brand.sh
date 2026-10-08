#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICON_SVG="$ROOT/assets/brand/nexa-mark-v144.svg"
ADAPTIVE_SVG="$ROOT/assets/brand/nexa-adaptive-v144.svg"
ICON_PNG="$ROOT/nexa-mobile/nexa-mobile/assets/icon.png"
ADAPTIVE_PNG="$ROOT/nexa-mobile/nexa-mobile/assets/adaptive-icon.png"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install librsvg
  fi
fi

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "librsvg is required for deterministic Nexa gradient rendering." >&2
  exit 1
fi

rsvg-convert --width 1024 --height 1024 --output "$ICON_PNG" "$ICON_SVG"
rsvg-convert --width 1024 --height 1024 --output "$ADAPTIVE_PNG" "$ADAPTIVE_SVG"

if command -v magick >/dev/null 2>&1; then
  IM=(magick)
elif command -v convert >/dev/null 2>&1; then
  IM=(convert)
else
  echo "ImageMagick is required to validate Nexa native assets." >&2
  exit 1
fi

"${IM[@]}" "$ICON_PNG" -alpha on -colorspace sRGB -type TrueColorAlpha -strip "PNG32:$ICON_PNG"
"${IM[@]}" "$ADAPTIVE_PNG" -alpha on -colorspace sRGB -type TrueColorAlpha -strip "PNG32:$ADAPTIVE_PNG"

identify "$ICON_PNG"
identify "$ADAPTIVE_PNG"

ICON_MEAN="$("${IM[@]}" "$ICON_PNG" -alpha off -colorspace sRGB -format '%[fx:mean]' info:)"
ADAPTIVE_MEAN="$("${IM[@]}" "$ADAPTIVE_PNG" -alpha off -colorspace sRGB -format '%[fx:mean]' info:)"
echo "iOS/legacy icon RGB mean: $ICON_MEAN"
echo "Adaptive icon RGB mean:   $ADAPTIVE_MEAN"

awk -v v="$ICON_MEAN" 'BEGIN { if (!(v > 0.07)) exit 1 }' || {
  echo "Nexa app icon rendered too dark; refusing release." >&2
  exit 1
}
awk -v v="$ADAPTIVE_MEAN" 'BEGIN { if (!(v > 0.02)) exit 1 }' || {
  echo "Nexa adaptive icon rendered too dark; refusing release." >&2
  exit 1
}

node <<'NODE'
const fs = require('fs');
for (const path of [
  'nexa-mobile/nexa-mobile/assets/icon.png',
  'nexa-mobile/nexa-mobile/assets/adaptive-icon.png',
]) {
  const stat = fs.statSync(path);
  if (stat.size < 10000) throw new Error('Rendered asset too small: ' + path);
}
console.log('PASS: Nexa native brand assets rendered with visible color.');
NODE
