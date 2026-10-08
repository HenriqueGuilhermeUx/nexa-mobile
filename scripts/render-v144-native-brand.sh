#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADAPTIVE_SVG="$ROOT/assets/brand/nexa-adaptive-v144.svg"
ICON_PNG="$ROOT/nexa-mobile/nexa-mobile/assets/icon.png"
ADAPTIVE_PNG="$ROOT/nexa-mobile/nexa-mobile/assets/adaptive-icon.png"

if command -v magick >/dev/null 2>&1; then
  IM=(magick)
elif command -v convert >/dev/null 2>&1; then
  IM=(convert)
else
  echo "ImageMagick is required to validate Nexa native assets." >&2
  exit 1
fi

if command -v rsvg-convert >/dev/null 2>&1; then
  echo "Rendering Nexa launcher mark with librsvg."
  rsvg-convert --width 1024 --height 1024 --output "$ADAPTIVE_PNG" "$ADAPTIVE_SVG"
else
  echo "librsvg unavailable; falling back to ImageMagick SVG renderer."
  "${IM[@]}" -background none "$ADAPTIVE_SVG" -resize 1024x1024 -alpha on -colorspace sRGB -type TrueColorAlpha -strip "PNG32:$ADAPTIVE_PNG"
fi

# Legacy/pre-adaptive launcher icon: same bright mark on Nexa dark background.
"${IM[@]}" -size 1024x1024 xc:'#06111F' "$ADAPTIVE_PNG" -compose over -composite   -alpha on -colorspace sRGB -type TrueColorAlpha -strip "PNG32:$ICON_PNG"

# Normalize adaptive PNG without touching the rendered RGB values.
"${IM[@]}" "$ADAPTIVE_PNG" -alpha on -colorspace sRGB -type TrueColorAlpha -strip "PNG32:$ADAPTIVE_PNG"

identify "$ICON_PNG"
identify "$ADAPTIVE_PNG"

ADAPTIVE_INFO="$(identify -format '%[colorspace] %[type] %[channels]' "$ADAPTIVE_PNG")"
echo "Adaptive icon: $ADAPTIVE_INFO"

# The v146 regression was not grayscale metadata: its compiled foreground had RGB=0
# everywhere. Guard actual visible color, not only PNG type metadata.
ADAPTIVE_MEAN="$("${IM[@]}" "$ADAPTIVE_PNG" -alpha off -colorspace sRGB -format '%[fx:mean]' info:)"
ICON_MEAN="$("${IM[@]}" "$ICON_PNG" -alpha off -colorspace sRGB -format '%[fx:mean]' info:)"
echo "Adaptive RGB mean: $ADAPTIVE_MEAN"
echo "Legacy RGB mean:   $ICON_MEAN"

awk -v v="$ADAPTIVE_MEAN" 'BEGIN { if (!(v > 0.02)) exit 1 }' || {
  echo "Adaptive icon is effectively black; refusing release." >&2
  exit 1
}
awk -v v="$ICON_MEAN" 'BEGIN { if (!(v > 0.02)) exit 1 }' || {
  echo "Legacy icon is effectively black; refusing release." >&2
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
console.log('Nexa native launcher assets rendered with visible RGB color.');
NODE
