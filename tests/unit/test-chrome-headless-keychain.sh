#!/usr/bin/env bash
# Every headless Chrome launch under tests/ or bin/ must pass
# --use-mock-keychain (and --password-store=basic for Linux).
#
# Without them, Chrome for Testing and chrome-headless-shell ask macOS for
# the "Chromium Safe Storage" keychain item on every launch. The glyph
# triage gate ran a bare --dump-dom launch and each pre-push raised five
# keychain prompts.
#
# A launch line is a logical line (backslash continuations joined) that
# names a Chrome or Chromium binary and carries --headless or --dump-dom.
# Comment lines and files that only mention the flags do not count, and
# this file is excluded so its own patterns never trip it.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SELF="tests/unit/$(basename "$0")"
cd "$ROOT"

fail() { echo "✗ $1"; exit 1; }

bad=0
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  [[ "$file" == "$SELF" ]] && continue
  while IFS= read -r hit; do
    [[ -n "$hit" ]] || continue
    echo "✗ $hit"
    bad=1
  done < <(awk '
    {
      if (buf == "") start = NR
      buf = buf " " $0
      if ($0 ~ /\\[[:space:]]*$/) next
      line = buf
      buf = ""
      if (line ~ /^[[:space:]]*#/) next
      if (line ~ /chrom/i && (line ~ /--headless/ || line ~ /--dump-dom/)) {
        missing = ""
        if (line !~ /--use-mock-keychain/) missing = missing " --use-mock-keychain"
        if (line !~ /--password-store=basic/) missing = missing " --password-store=basic"
        if (missing != "") printf "%s:%d: launch missing%s\n", FILENAME, start, missing
      }
    }' "$file")
done < <(git grep -l -e '--headless' -e '--dump-dom' -- tests bin 2>/dev/null || true)

[[ "$bad" == 0 ]] || fail "a headless Chrome launch lacks keychain suppression flags"
echo "  ✓ every headless Chrome launch in tests/ and bin/ suppresses the keychain"
echo "  1 passed"
