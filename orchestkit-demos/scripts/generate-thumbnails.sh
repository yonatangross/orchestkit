#!/bin/bash
# generate-thumbnails.sh — Batch generate composition thumbnails for the docs site demo gallery
# Captures frame 180 (6s at 30fps) of each composition as a scaled-down PNG.
# NOTE: On Apple Silicon, run with: arch -arm64 bash scripts/generate-thumbnails.sh
#       if /usr/local/bin/bash is x86_64-only (esbuild arch mismatch).
#
# Usage: ./scripts/generate-thumbnails.sh [--force]
#   --force   Regenerate existing thumbnails
#
# Output: docs/site/public/thumbnails/<CompositionId>.png
#         docs/site/public/thumbnails/_manifest.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEMOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
THUMB_DIR="$PROJECT_ROOT/docs/site/public/thumbnails"
MANIFEST="$THUMB_DIR/_manifest.json"

FRAME=180       # 6s at 30fps — past intro animations into main content
SCALE=0.333     # ~640x360 for 1920x1080
FORCE=false

if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi

mkdir -p "$THUMB_DIR"

echo "=== OrchestKit Thumbnail Generator ==="
echo "Output: $THUMB_DIR"
echo ""

# Get all composition IDs from remotion
cd "$DEMOS_DIR"

# Extract composition IDs using npx remotion compositions
COMP_IDS=$(npx remotion compositions --props '{}' 2>/dev/null | grep -E '^\S+\s+[0-9]+\s+[0-9]+x[0-9]+' | awk '{print $1}' || true)

if [[ -z "$COMP_IDS" ]]; then
  echo "ERROR: Could not list compositions. Make sure you're in orchestkit-demos/ and dependencies are installed."
  exit 1
fi

TOTAL=$(echo "$COMP_IDS" | wc -l | tr -d ' ')
SUCCESS=0
SKIPPED=0
FAILED=0
FAILED_IDS=()

echo "Found $TOTAL compositions"
echo ""

for COMP_ID in $COMP_IDS; do
  # Skip experiments
  if [[ "$COMP_ID" == EXP-* ]]; then
    echo "  SKIP  $COMP_ID (experiment)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  OUTPUT="$THUMB_DIR/${COMP_ID}.png"

  # Skip if already exists and not forcing
  if [[ -f "$OUTPUT" && "$FORCE" != "true" ]]; then
    echo "  EXISTS $COMP_ID"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo -n "  GEN   $COMP_ID ... "

  if npx remotion still "$COMP_ID" "$OUTPUT" \
    --frame="$FRAME" \
    --scale="$SCALE" \
    --log=error < /dev/null 2>/dev/null; then
    echo "OK"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "FAILED"
    FAILED=$((FAILED + 1))
    FAILED_IDS+=("$COMP_ID")
    # Don't exit — continue with remaining compositions
  fi
done

# Generate manifest
echo ""
echo "Generating manifest..."

GENERATED_FILES=$(ls "$THUMB_DIR"/*.png 2>/dev/null | xargs -I {} basename {} .png | sort)
MANIFEST_JSON="{\n  \"generated\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\n  \"count\": $SUCCESS,\n  \"thumbnails\": ["
FIRST=true
for F in $GENERATED_FILES; do
  if [[ "$F" == _* ]]; then continue; fi
  if [[ "$FIRST" == "true" ]]; then FIRST=false; else MANIFEST_JSON+=","; fi
  MANIFEST_JSON+="\n    \"$F\""
done
MANIFEST_JSON+="\n  ]\n}"
echo -e "$MANIFEST_JSON" > "$MANIFEST"

echo ""
echo "=== Summary ==="
echo "  Generated: $SUCCESS"
echo "  Skipped:   $SKIPPED"
echo "  Failed:    $FAILED"
if [[ ${#FAILED_IDS[@]} -gt 0 ]]; then
  echo "  Failed IDs: ${FAILED_IDS[*]}"
fi
echo ""
echo "Thumbnails: $THUMB_DIR/"
echo "Manifest:   $MANIFEST"
