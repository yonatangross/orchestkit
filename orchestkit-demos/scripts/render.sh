#!/bin/bash
# Render script with automatic versioning
# Usage: ./scripts/render.sh <CompositionId> [format]
# Example: ./scripts/render.sh MarketplaceDemo mp4
#          ./scripts/render.sh MarketplaceDemo gif

set -e

COMPOSITION="${1:-MarketplaceDemo}"
FORMAT="${2:-mp4}"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)

# Create renders directory structure
RENDER_DIR="out/renders/${TIMESTAMP}"
mkdir -p "${RENDER_DIR}"

# Find next version number
VERSION=1
while [ -f "${RENDER_DIR}/${COMPOSITION}_v${VERSION}.${FORMAT}" ]; do
  VERSION=$((VERSION + 1))
done

OUTPUT_FILE="${RENDER_DIR}/${COMPOSITION}_v${VERSION}.${FORMAT}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎬 Rendering: ${COMPOSITION}"
echo "📁 Output:    ${OUTPUT_FILE}"
echo "📅 Session:   ${TIMESTAMP}"
echo "🔢 Version:   v${VERSION}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Render based on format
if [ "$FORMAT" = "gif" ]; then
  npx remotion render "${COMPOSITION}" --output="${OUTPUT_FILE}" --codec=gif
else
  npx remotion render "${COMPOSITION}" --output="${OUTPUT_FILE}"
fi

# Create/update latest symlink
LATEST_LINK="${RENDER_DIR}/${COMPOSITION}_latest.${FORMAT}"
rm -f "${LATEST_LINK}"
ln -s "${COMPOSITION}_v${VERSION}.${FORMAT}" "${LATEST_LINK}"

echo ""
echo "✅ Render complete!"
echo "📍 ${OUTPUT_FILE}"
echo "🔗 Latest: ${LATEST_LINK}"

# Also create a session-independent latest
mkdir -p "out/latest"
cp "${OUTPUT_FILE}" "out/latest/${COMPOSITION}.${FORMAT}"
echo "📌 Copied to: out/latest/${COMPOSITION}.${FORMAT}"
