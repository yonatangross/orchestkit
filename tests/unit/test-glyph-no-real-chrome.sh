#!/usr/bin/env bash
# The glyph triage gate never starts the operator's Google Chrome.
#
# On 2026-10-02 sandboxed agents started /Applications/Google Chrome.app 7
# times. Each start aborted in HIServices _RegisterApplication (SIGABRT) and
# macOS showed the operator a crash dialog. The gate now picks
# chrome-headless-shell or Chrome for Testing and refuses the real Chrome,
# also when ORK_GLYPH_CHROME names it or a symlink resolves to it.
#
# This suite never starts a real browser: the "real Chrome" here is a stub
# that only sits at a path ending in Google Chrome.app/Contents/MacOS.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GATE="$ROOT/tests/unit/test-glyph-triage-template.sh"
PASS=0
fail() { echo "✗ $1"; exit 1; }
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

[[ -f "$GATE" ]] || fail "missing the gate under test: $GATE"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

STUB_DIR="$WORK/Google Chrome.app/Contents/MacOS"
mkdir -p "$STUB_DIR" "$WORK/bin"
STUB="$STUB_DIR/Google Chrome"
# Records a launch, so a refusal is proven by the absence of this file.
printf '#!/bin/sh\ntouch "%s/launched"\nexit 0\n' "$WORK" > "$STUB"
chmod +x "$STUB"
ln -s "$STUB" "$WORK/bin/chrome"

run_gate() {
  local pin="$1"
  set +e
  env -u CI ORK_GLYPH_CHROME="$pin" bash "$GATE" > "$WORK/out" 2>&1
  echo $? > "$WORK/rc"
  set -e
}

echo "glyph gate refuses the real Google Chrome"

run_gate "$STUB"
[[ "$(cat "$WORK/rc")" != 0 ]] || fail "a pin to Google Chrome.app passed: $(tail -3 "$WORK/out")"
grep -q "operator's Google Chrome" "$WORK/out" || fail "refusal does not name the reason: $(tail -3 "$WORK/out")"
[[ ! -e "$WORK/launched" ]] || fail "the Google Chrome.app stub was started"
ok "ORK_GLYPH_CHROME=.../Google Chrome.app/... is refused before launch"

run_gate "$WORK/bin/chrome"
[[ "$(cat "$WORK/rc")" != 0 ]] || fail "a symlink to Google Chrome.app passed: $(tail -3 "$WORK/out")"
grep -q "operator's Google Chrome" "$WORK/out" || fail "symlink refusal does not name the reason"
[[ ! -e "$WORK/launched" ]] || fail "the Google Chrome.app stub was started through a symlink"
ok "a symlink that resolves into Google Chrome.app is refused"

if grep -n '"/Applications/Google Chrome.app' "$GATE"; then
  fail "the gate still lists /Applications/Google Chrome.app as a candidate"
fi
ok "no candidate in the gate names /Applications/Google Chrome.app"

echo "  $PASS passed"
