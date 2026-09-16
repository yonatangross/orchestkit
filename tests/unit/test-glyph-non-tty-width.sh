#!/usr/bin/env bash
# Fixture test for GH-4159 defect 1.
#
# Renders a 5-row key/value glyph through the repo's render path
# (scripts/render-ascii.sh key-value) in non-TTY mode at the 72-column cap
# and asserts no output line exceeds 72 display columns. Cells are counted
# by tests/fixtures/ascii/display-width-oracle.py (EAW W/F plus the closed
# status-glyph vocabulary), so emoji count as 2 columns.
#
# The fixture is tests/fixtures/ascii/kv-glyph-5row.txt: five key|value rows
# of realistic worker status, the shape the filer's transcript showed.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RENDER="$ROOT/scripts/render-ascii.sh"
FIXTURE="$ROOT/tests/fixtures/ascii/kv-glyph-5row.txt"
ORACLE="$ROOT/tests/fixtures/ascii/display-width-oracle.py"
CAP=72

[ -x "$RENDER" ] || { echo "✗ render-ascii.sh not executable at $RENDER"; exit 1; }
[ -f "$FIXTURE" ] || { echo "✗ fixture missing: $FIXTURE"; exit 1; }
[ -f "$ORACLE" ] || { echo "✗ oracle missing: $ORACLE"; exit 1; }
command -v python3 >/dev/null 2>&1 || {
  echo "✗ python3 required for the display-width oracle (fail-closed: this is a width gate)"
  exit 1
}

# Command substitution means the renderer's stdout is NOT a tty: this is the
# non-TTY host case (CI logs, chat widgets, VS Code chat, web transcripts).
OUT=$("$RENDER" key-value --width "$CAP" < "$FIXTURE")
[ -n "$OUT" ] || { echo "✗ renderer produced no output"; exit 1; }

OUT_FILE=$(mktemp)
trap 'rm -f "$OUT_FILE"' EXIT
printf '%s\n' "$OUT" > "$OUT_FILE"

# Sanity: the render carries the fixture's data, not an empty shell.
# Reads the temp file directly: no pipes, no herestrings (ork#3348).
for key in ingest thumbnailer webhook-fanout reindex api; do
  if ! grep -q "$key" "$OUT_FILE"; then
    echo "✗ rendered output is missing row key: $key"
    exit 1
  fi
done

# Independent display-width gate. The oracle prints its own measured maximum,
# so a red run shows the real number, not just an exit code.
set +e
python3 "$ORACLE" "$CAP" "$OUT_FILE"
RC=$?
set -e

if [ "$RC" -ne 0 ]; then
  echo "✗ key/value glyph in non-TTY mode exceeds the ${CAP}-column cap (GH-4159 defect 1)"
  exit 1
fi
echo "✓ non-TTY key/value glyph stays within the ${CAP}-column cap"
