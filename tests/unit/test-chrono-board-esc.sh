#!/usr/bin/env bash
# #4220 CodeQL: esc() must map " and ' (js/incomplete-html-attribute-sanitization).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# The PR source dir was archived off main by prune-playgrounds (#4571);
# the committed Lab copy is the page the site serves.
FILES=(
  "$ROOT/docs/site/public/lab/chrono-board-release.html"
)
for FILE in "${FILES[@]}"; do
  if ! grep -F 'esc = s => String(s).replace(/[&<>"'"'"']/g' "$FILE" >/dev/null; then
    echo "FAIL: esc() map missing quote characters in $FILE"
    exit 1
  fi
  # Assert escaped output for both quote characters (map keys use the other quote).
  if ! grep -F "'\"': \"&quot;\"" "$FILE" >/dev/null; then
    echo "FAIL: esc() missing double-quote -> &quot; mapping in $FILE"
    exit 1
  fi
  if ! grep -F "\"'\": \"&#39;\"" "$FILE" >/dev/null; then
    echo "FAIL: esc() missing single-quote -> &#39; mapping in $FILE"
    exit 1
  fi
done
echo "PASS: esc() includes quote sanitization (lab copy)"
