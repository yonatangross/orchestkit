#!/bin/bash
# Renders all production compositions as full-length MP4 clips for CDN upload.
# Output: out/cdn-videos/<CompositionId>.mp4
# Usage: arch -arm64 bash scripts/render-all-videos.sh [--force]
#
# Must run with `arch -arm64` on Apple Silicon (esbuild native module issue).
# VHS-dependent compositions (Hybrid-VHS, Vertical-VHS styles) will fail
# if the VHS recordings aren't present — this is expected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/out/cdn-videos"

FORCE=false
if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi

cd "$PROJECT_DIR"

echo "=== OrchestKit CDN Video Renderer ==="
echo "Output: $OUTPUT_DIR"
echo "Force re-render: $FORCE"
echo ""

mkdir -p "$OUTPUT_DIR"

# Get all composition IDs from Remotion, one per line
COMPOSITIONS=$(npx remotion compositions --props '{}' 2>/dev/null \
  | grep -oE '^[A-Za-z0-9_-]+' \
  | sort)

if [[ -z "$COMPOSITIONS" ]]; then
  echo "ERROR: No compositions found. Is the Remotion project set up?"
  exit 1
fi

TOTAL=0
GENERATED=0
SKIPPED=0
FAILED=0
FAILED_IDS=()

while IFS= read -r COMP_ID; do
  # Skip experiment compositions
  if [[ "$COMP_ID" == EXP-* ]]; then
    continue
  fi

  TOTAL=$((TOTAL + 1))
  OUTPUT_FILE="$OUTPUT_DIR/${COMP_ID}.mp4"

  # Skip existing unless --force
  if [[ -f "$OUTPUT_FILE" && "$FORCE" == "false" ]]; then
    echo "SKIP  $COMP_ID (already exists)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo -n "RENDER $COMP_ID ... "

  # Use < /dev/null to prevent remotion from consuming stdin
  if npx remotion render "$COMP_ID" "$OUTPUT_FILE" \
      --codec=h264 --crf=23 --pixel-format=yuv420p \
      --log=error < /dev/null 2>&1; then
    SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo "OK ($SIZE)"
    GENERATED=$((GENERATED + 1))
  else
    echo "FAILED"
    FAILED=$((FAILED + 1))
    FAILED_IDS+=("$COMP_ID")
    # Clean up partial file
    rm -f "$OUTPUT_FILE"
  fi
done <<< "$COMPOSITIONS"

echo ""
echo "=== Summary ==="
echo "Total:     $TOTAL"
echo "Generated: $GENERATED"
echo "Skipped:   $SKIPPED"
echo "Failed:    $FAILED"

if [[ ${#FAILED_IDS[@]} -gt 0 ]]; then
  echo ""
  echo "Failed compositions:"
  for fid in "${FAILED_IDS[@]}"; do
    echo "  - $fid"
  done
fi

echo ""
echo "Output directory: $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR" 2>/dev/null | tail -5
echo "..."
echo "Total files: $(ls "$OUTPUT_DIR"/*.mp4 2>/dev/null | wc -l | tr -d ' ')"
