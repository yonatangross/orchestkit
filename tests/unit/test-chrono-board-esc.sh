#!/usr/bin/env bash
# #4220 CodeQL: esc() must map " and ' (js/incomplete-html-attribute-sanitization).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILES=(
  "$ROOT/docs/site/public/lab/chrono-board-release.html"
  "$ROOT/docs/feat--docs-chrono-board-release/chrono-board.html"
)
for FILE in "${FILES[@]}"; do
  if ! grep -F 'esc = s => String(s).replace(/[&<>"'"'"']/g' "$FILE" >/dev/null; then
    echo "FAIL: esc() map missing quote characters in $FILE"
    exit 1
  fi
done
echo "PASS: esc() includes quote sanitization (lab + source)"
