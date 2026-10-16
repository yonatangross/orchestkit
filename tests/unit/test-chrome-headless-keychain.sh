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

PASS=0
FAILS=0
die() { echo "✗ $1"; exit 1; }
fail() { echo "✗ $1"; FAILS=$((FAILS + 1)); }
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

# Prints "<file>:<line>: launch missing <flags>" for every launch line
# missing a keychain flag. awk has no /re/i flag literal: `/chrom/i` is
# always true, so the Chrome match lowercases first (a planted
# `npx playwright test --headless` line proves a non-Chrome tool passes).
#
# Rules (#4753):
# - A comment line never continues in shell, even with a trailing
#   backslash, so it is dropped on its own and cannot swallow the next line.
# - A trailing comment is cut before the flag check: flags named there are
#   never passed to Chrome.
# - A flag value that names Chromium (--project=chromium) is not a binary.
# - --dump-dom and --headless=new|old exist only in Chrome, so a line with
#   either is a launch whatever the binary variable is called.
check_lines() {
  awk '
    {
      raw = $0
      if (buf == "" && raw ~ /^[[:space:]]*#/) next
      if (buf == "") start = NR
      code = raw
      sub(/[[:space:]]#.*$/, "", code)
      buf = buf " " code
      if (code ~ /\\[[:space:]]*$/) next
      line = buf
      buf = ""
      low = tolower(line)
      gsub(/--[a-z-]+=[^[:space:]]*chrom[^[:space:]]*/, "", low)
      chrome_bin = (low ~ /chrom/ && (line ~ /--headless/ || line ~ /--dump-dom/))
      chrome_flag = (line ~ /--dump-dom/ || line ~ /--headless=(new|old)/)
      if (chrome_bin || chrome_flag) {
        missing = ""
        if (line !~ /--use-mock-keychain/) missing = missing " --use-mock-keychain"
        if (line !~ /--password-store=basic/) missing = missing " --password-store=basic"
        if (missing != "") printf "%s:%d: launch missing%s\n", FILENAME, start, missing
      }
    }' "$1"
}

# Lists the files under tests/ and bin/ that mention a headless flag.
# git grep exits 1 for no match, which is a valid empty list; any other
# non-zero exit means git could not search, and a scan of 0 files must not
# read as a pass (#4753).
list_files() {
  local rc=0
  git grep -l -e '--headless' -e '--dump-dom' -- tests bin || rc=$?
  [[ "$rc" -le 1 ]] || { echo "git grep failed (rc=$rc)" >&2; return "$rc"; }
  return 0
}

# Self-check arms: the filter must flag every Chrome launch shape that
# lacks the flags and must leave non-Chrome tools alone (#4753).
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-chrome-lint.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

expect_clean() {
  local name="$1" body="$2"
  printf '%s\n' "$body" > "$WORK/$name.sh"
  local hits
  hits="$(check_lines "$WORK/$name.sh")"
  if [[ -n "$hits" ]]; then fail "$name: flagged a line that is not a bare Chrome launch: $hits"; return 0; fi
  ok "self-check $name: not flagged"
}
expect_flagged() {
  local name="$1" body="$2"
  printf '%s\n' "$body" > "$WORK/$name.sh"
  if [[ -z "$(check_lines "$WORK/$name.sh")" ]]; then fail "$name: a bare Chrome launch was not flagged"; return 0; fi
  ok "self-check $name: flagged"
}

expect_clean not-chrome 'npx playwright test --headless'
# silent: known-noise (the redirect is fixture text the guard reads, never run)
expect_flagged bad-launch '"$CHROME" --headless=new --dump-dom "file:///x" >/dev/null 2>&1'
# A Playwright project named chromium is not a Chrome launch.
expect_clean playwright-project 'npx playwright test --project=chromium --headless'
# A launch through a variable whose name has no "chrom" in it.
expect_flagged variable-binary '"$BROWSER" --headless=new --dump-dom "file:///x"'
# A comment line ending in a backslash does not continue in shell, so it
# must not swallow the launch on the next physical line.
expect_flagged comment-backslash '# old launch, kept for reference \
"$CHROME" --headless=new --dump-dom "file:///x"'
# Flags named only in a trailing comment are not passed to Chrome.
expect_flagged trailing-comment '"$CHROME" --headless=new --dump-dom "file:///x" # --use-mock-keychain --password-store=basic'
# The good form stays clean.
expect_clean good-launch '"$CHROME" --headless=new --use-mock-keychain --password-store=basic --dump-dom "file:///x"'

# The listing must fail loudly when git grep cannot run: a scan of 0 files
# is not a pass (#4753 should 3). The run is expected to fail; its stdout
# and stderr go to files and only the exit code is read.
broken_rc=0
GIT_DIR="$WORK/no-such-git-dir" list_files > "$WORK/broken-list.txt" 2> "$WORK/broken-list.err" || broken_rc=$?
if [[ "$broken_rc" -eq 0 ]]; then
  fail "list_files succeeded with a broken GIT_DIR, so a failed git grep would scan 0 files and pass"
else
  ok "self-check: list_files fails when git grep cannot run (rc=$broken_rc)"
fi

FILES="$WORK/files.txt"
list_files > "$FILES" || die "git grep failed; the scan cannot run"
if grep -qxF 'tests/unit/test-glyph-triage-template.sh' "$FILES"; then
  ok "the scan includes tests/unit/test-glyph-triage-template.sh"
else
  fail "the scan did not include tests/unit/test-glyph-triage-template.sh, the launch this guard exists for"
fi

bad=0
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  [[ "$file" == "$SELF" ]] && continue
  while IFS= read -r hit; do
    [[ -n "$hit" ]] || continue
    echo "✗ $hit"
    bad=1
  done < <(check_lines "$file")
done < "$FILES"

if [[ "$bad" == 0 ]]; then
  ok "every headless Chrome launch in tests/ and bin/ carries the keychain flags"
else
  fail "a headless Chrome launch lacks keychain suppression flags"
fi
echo "  $PASS passed, $FAILS failed"
[[ "$FAILS" == 0 ]] || exit 1
