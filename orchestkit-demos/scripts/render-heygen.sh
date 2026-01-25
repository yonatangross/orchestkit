#!/bin/bash
# scripts/render-heygen.sh
# Render the HeyGenDemo composition with avatar video

set -e

AVATAR_VIDEO="public/videos/avatar-presenter.mp4"
OUTPUT_DIR="output"
OUTPUT_FILE="$OUTPUT_DIR/heygen-demo.mp4"

echo "============================================"
echo "   HeyGenDemo Render Script"
echo "============================================"
echo ""

# Check if avatar video exists
if [ ! -f "$AVATAR_VIDEO" ]; then
  echo "Avatar video not found at: $AVATAR_VIDEO"
  echo ""
  echo "Options:"
  echo "  1. Generate avatar video: npm run heygen:generate"
  echo "  2. Render with placeholder: npm run render:heygen -- --placeholder"
  echo ""

  if [[ "$*" == *"--placeholder"* ]]; then
    echo "Rendering with placeholder..."
    PROPS='{"avatarVideoUrl":"","showPlaceholder":true}'
  else
    exit 1
  fi
else
  echo "Avatar video found: $AVATAR_VIDEO"
  PROPS="{\"avatarVideoUrl\":\"$AVATAR_VIDEO\",\"showPlaceholder\":false}"
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo ""
echo "Rendering HeyGenDemo..."
echo "  Props: $PROPS"
echo "  Output: $OUTPUT_FILE"
echo ""

# Render the composition
npx remotion render HeyGenDemo \
  --props="$PROPS" \
  --output="$OUTPUT_FILE" \
  --codec=h264 \
  --crf=18

echo ""
echo "============================================"
echo "   Render Complete!"
echo "============================================"
echo ""
echo "Output: $OUTPUT_FILE"
echo ""

# Show file size
if [ -f "$OUTPUT_FILE" ]; then
  SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
  echo "File size: $SIZE"
fi
