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
PASS=0
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

# Prints "<file>:<line>: launch missing <flags>" for every launch line
# missing a keychain flag. awk has no /re/i flag literal: `/chrom/i` is
# always true, so the Chrome match lowercases first (a planted
# `npx playwright test --headless` line proves a non-Chrome tool passes).
check_lines() {
  awk '
    {
      if (buf == "") start = NR
      buf = buf " " $0
      if ($0 ~ /\\[[:space:]]*$/) next
      line = buf
      buf = ""
      if (line ~ /^[[:space:]]*#/) next
      if (tolower(line) ~ /chrom/ && (line ~ /--headless/ || line ~ /--dump-dom/)) {
        missing = ""
        if (line !~ /--use-mock-keychain/) missing = missing " --use-mock-keychain"
        if (line !~ /--password-store=basic/) missing = missing " --password-store=basic"
        if (missing != "") printf "%s:%d: launch missing%s\n", FILENAME, start, missing
      }
    }' "$1"
}

# Self-check arms: the filter must flag a Chrome launch without the flags
# and must leave a non-Chrome tool carrying --headless alone.
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-chrome-lint.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
printf 'npx playwright test --headless\n' > "$WORK/not-chrome.sh"
printf '"$CHROME" --headless=new --dump-dom "file:///x" >/dev/null 2>&1\n' > "$WORK/bad-launch.sh"
[[ -z "$(check_lines "$WORK/not-chrome.sh")" ]] \
  || fail "non-Chrome --headless line was flagged: $(check_lines "$WORK/not-chrome.sh")"
[[ -n "$(check_lines "$WORK/bad-launch.sh")" ]] \
  || fail "a Chrome --dump-dom launch without keychain flags was not flagged"
ok "self-check: non-Chrome tool ignored, bare Chrome launch flagged"

bad=0
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  [[ "$file" == "$SELF" ]] && continue
  while IFS= read -r hit; do
    [[ -n "$hit" ]] || continue
    echo "✗ $hit"
    bad=1
  done < <(check_lines "$file")
done < <(git grep -l -e '--headless' -e '--dump-dom' -- tests bin 2>/dev/null || true)

[[ "$bad" == 0 ]] || fail "a headless Chrome launch lacks keychain suppression flags"
echo "  ✓ every headless Chrome launch in tests/ and bin/ suppresses the keychain"
ok "all repo launch lines carry the keychain flags"
echo "  $PASS passed"
