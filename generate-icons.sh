#!/bin/bash
# Generate icons for AI Treasure Digger
# Requires: ImageMagick (brew install imagemagick on macOS)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICON_DIR="$SCRIPT_DIR/icons"

mkdir -p "$ICON_DIR"

# Create base SVG with pickaxe design (treasure digger theme)
cat > "$ICON_DIR/icon.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="handle" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8B4513"/>
      <stop offset="100%" style="stop-color:#654321"/>
    </linearGradient>
    <linearGradient id="pick-head" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#C0C0C0"/>
      <stop offset="100%" style="stop-color:#808080"/>
    </linearGradient>
  </defs>
  <!-- Background circle -->
  <circle cx="64" cy="64" r="60" fill="#1a1a2e"/>
  <!-- Handle -->
  <rect x="55" y="25" width="18" height="75" rx="3" fill="url(#handle)" transform="rotate(45 64 64)"/>
  <!-- Pick head -->
  <path d="M 30 40 L 55 55 L 50 60 L 25 45 Z" fill="url(#pick-head)"/>
  <path d="M 98 40 L 73 55 L 78 60 L 103 45 Z" fill="url(#pick-head)"/>
  <!-- Metal band -->
  <ellipse cx="64" cy="52" rx="12" ry="8" fill="#A0A0A0"/>
  <!-- Sparkle -->
  <circle cx="35" cy="35" r="3" fill="#FFD700" opacity="0.8"/>
  <circle cx="93" cy="35" r="3" fill="#FFD700" opacity="0.8"/>
</svg>
EOF

echo "✓ Created SVG icon"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "⚠ ImageMagick not found. Install it to generate PNG/ICO files:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu: sudo apt-get install imagemagick"
    echo "  Windows: choco install imagemagick"
    echo ""
    echo "SVG icon created at: $ICON_DIR/icon.svg"
    exit 0
fi

# Generate PNG files
convert "$ICON_DIR/icon.svg" -resize 32x32 "$ICON_DIR/32x32.png"
convert "$ICON_DIR/icon.svg" -resize 128x128 "$ICON_DIR/128x128.png"
convert "$ICON_DIR/icon.svg" -resize 256x256 "$ICON_DIR/128x128@2x.png"

echo "✓ Generated PNG icons (32x32, 128x128, 128x128@2x)"

# Generate ICO (Windows)
convert "$ICON_DIR/icon.svg" -resize 256x256 -define icon:auto-resize=256,128,64,48,32,16 "$ICON_DIR/icon.ico"

echo "✓ Generated Windows ICO icon"

# Generate ICNS (macOS) - requires icns tool or create using iconutil on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Create iconset directory
    mkdir -p "$ICON_DIR/icon.iconset"

    # Generate all required sizes for icns
    convert "$ICON_DIR/icon.svg" -resize 16x16 "$ICON_DIR/icon.iconset/icon_16x16.png"
    convert "$ICON_DIR/icon.svg" -resize 32x32 "$ICON_DIR/icon.iconset/icon_16x16@2x.png"
    convert "$ICON_DIR/icon.svg" -resize 32x32 "$ICON_DIR/icon.iconset/icon_32x32.png"
    convert "$ICON_DIR/icon.svg" -resize 64x64 "$ICON_DIR/icon.iconset/icon_32x32@2x.png"
    convert "$ICON_DIR/icon.svg" -resize 128x128 "$ICON_DIR/icon.iconset/icon_128x128.png"
    convert "$ICON_DIR/icon.svg" -resize 256x256 "$ICON_DIR/icon.iconset/icon_128x128@2x.png"
    convert "$ICON_DIR/icon.svg" -resize 256x256 "$ICON_DIR/icon.iconset/icon_256x256.png"
    convert "$ICON_DIR/icon.svg" -resize 512x512 "$ICON_DIR/icon.iconset/icon_256x256@2x.png"
    convert "$ICON_DIR/icon.svg" -resize 512x512 "$ICON_DIR/icon.iconset/icon_512x512.png"
    convert "$ICON_DIR/icon.svg" -resize 1024x1024 "$ICON_DIR/icon.iconset/icon_512x512@2x.png"

    # Generate icns
    iconutil -c icns "$ICON_DIR/icon.iconset" -o "$ICON_DIR/icon.icns"

    # Cleanup
    rm -rf "$ICON_DIR/icon.iconset"

    echo "✓ Generated macOS ICNS icon"
else
    echo "⚠ Skipping ICNS generation (only available on macOS)"
fi

echo ""
echo "✅ All icons generated successfully in: $ICON_DIR"
echo ""
echo "Files created:"
ls -lh "$ICON_DIR"/*.{png,ico,icns,svg} 2>/dev/null || true
