#!/usr/bin/env bash
# A security test must not grade a hook that ran on an EMPTY payload (#4352).
#
# run-hook.mjs has a 100 ms stdin watchdog (#3415): when no byte arrives in
# time it runs the hook on {} and warns on stderr that the hook "measured
# nothing". On 2026-09-22 a pre-push run at load ~134 failed 3 of 22 that way
# and passed 22/22 on a rerun of the same tree. Two of those suites read the
# starved run as a verdict: test-secret-scanning.sh said "NOT blocked" and the
# session_id probe in test-additional-security.sh said "got ''".
#
# This suite swaps the runner (ORK_HOOK_RUNNER) for a stub that starves one
# hook key the way the watchdog does and delegates every other key to the real
# runner. The suites must then report a HARNESS ERROR, never a result. A
# control arm with nothing starved proves the override changes nothing.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REAL_RUNNER="$ROOT/src/hooks/bin/run-hook.mjs"
STUB="$ROOT/tests/fixtures/starved-stdin-runner.mjs"
SECRET_SUITE="$ROOT/tests/security/test-secret-scanning.sh"
ADDITIONAL_SUITE="$ROOT/tests/security/test-additional-security.sh"
PASS=0
fail() { echo "✗ $1"; exit 1; }
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

for f in "$REAL_RUNNER" "$STUB" "$SECRET_SUITE" "$ADDITIONAL_SUITE"; do
  [[ -f "$f" ]] || fail "missing file under test: $f"
done

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
OUT="$WORK/out"

RC=0
run_suite() { # run_suite <suite> <starve-key or empty>
  RC=0
  ORK_HOOK_RUNNER="$STUB" ORK_STUB_REAL_RUNNER="$REAL_RUNNER" ORK_STUB_STARVE_KEY="$2" \
    bash "$1" >"$OUT" 2>&1 || RC=$?
}

# 1. Secret scanner starved: no "NOT blocked", a HARNESS ERROR, a failed suite.
run_suite "$SECRET_SUITE" 'pretool/write-edit/content-secret-scanner'
if grep -q 'NOT blocked' "$OUT"; then
  grep -E 'NOT blocked' "$OUT" | head -3
  fail "secret scanning graded a starved run as 'NOT blocked'"
fi
grep -q 'HARNESS ERROR' "$OUT" || { tail -15 "$OUT"; fail "secret scanning did not report a HARNESS ERROR for a starved run"; }
(( RC != 0 )) || fail "secret scanning exited 0 on a starved run"
ok "secret scanning: starved run is a HARNESS ERROR and fails the suite"

# 2. Control arm: nothing starved, the override is inert.
run_suite "$SECRET_SUITE" ''
(( RC == 0 )) || { tail -15 "$OUT"; fail "control arm: secret scanning failed with nothing starved"; }
if grep -q 'HARNESS ERROR' "$OUT"; then fail "control arm: HARNESS ERROR with nothing starved"; fi
ok "secret scanning: control arm through the stub passes"

# 3. session_id probe starved: the well-formed id reports a HARNESS ERROR.
run_suite "$ADDITIONAL_SUITE" 'instructions-loaded/instructions-loaded-dispatcher'
if ! grep -aq 'well-formed session_id used verbatim' "$OUT"; then
  tail -15 "$OUT"
  fail "session_id probe printed no line for the well-formed id"
fi
LINE="$(grep -a 'well-formed session_id used verbatim' "$OUT" | head -1)"
case "$LINE" in
  *'expected tmp entry'*) fail "session_id probe graded a starved run as a result: $LINE" ;;
  *'HARNESS ERROR'*) ;;
  *) fail "session_id probe did not report a HARNESS ERROR: $LINE" ;;
esac
(( RC != 0 )) || fail "additional security exited 0 on a starved run"
ok "session_id probe: starved run is a HARNESS ERROR and fails the suite"

echo "$PASS passed, 0 failed"
