#!/usr/bin/env bash
# GH-4296: the glyph triage gate must tell a browser that failed to START
# from a browser that started and rendered nothing. Both leave an empty
# dom.html, and only one of them is an environment verdict.
#
# The technique the issue generalises: pin the dependency to a known-null
# implementation and assert the suite goes red. A stub that exits 0 and
# writes nothing is the probe, because a non-zero exit tests the error path
# people already remember to handle.
#
#   (a) started, no DOM            : hard FAIL, in CI and out of it
#   (b) never launched, out of CI  : "SKIP:" + exit 0, naming the failure
#   (b) never launched, in CI      : hard FAIL, because CI has a Chrome
#
# This suite never starts a real browser. tests/unit/test-glyph-triage-template.sh
# is the real-Chrome half; its five mutation cases are what case (a) protects.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GATE="$ROOT/tests/unit/test-glyph-triage-template.sh"
PASS=0
fail() { echo "✗ $1"; exit 1; }
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

[[ -f "$GATE" ]] || fail "missing the gate under test: $GATE"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork.XXXXXX")"
# The negative-cases-only variant has to sit beside the original, because the
# gate resolves ROOT from its own path. Dot-prefixed so the test runner glob
# (test-*.sh) never picks it up.
NEG="$ROOT/tests/unit/.gh4296-negatives-only.sh"
trap 'rm -rf "$WORK"; rm -f "$NEG"' EXIT

# Exits clean, writes nothing. The #4296 repro verbatim.
printf '#!/bin/sh\nexit 0\n' > "$WORK/clean-null"

# Never gets off the ground. Signatures measured 2026-09-20 from an agent
# process on macOS 27, where Chrome could not start even with headless mode,
# the sandbox disabled and a fresh user data dir all already passed.
cat > "$WORK/no-launch" << 'STUB'
#!/bin/sh
echo "[9001:0920/101112.131415:ERROR:sandbox/mac/sandbox_logging.h:44] sandbox_extension_issue_file_to_process failed for /Applications/Google Chrome.app: Operation not permitted (1)" >&2
echo "[9001:0920/101112.131500:ERROR:chrome/browser/process_singleton_posix.cc:1106] Failed to bind() /tmp/ork.stub/profile/SingletonSocket: Operation not permitted (1)" >&2
echo "[9001:0920/101112.131600:ERROR:chrome/browser/process_singleton_posix.cc:1214] Failed to create a ProcessSingleton for your profile directory. Aborting now." >&2
exit 1
STUB

# Exits non-zero with an EMPTY stderr. This is the silent-renderer case the
# launch_failure_reason guard exists for: no signature is present, so the run
# must take the hard no-DOM failure, never the launch-failure skip.
printf '#!/bin/sh\nexit 1\n' > "$WORK/silent-fail"

chmod +x "$WORK/clean-null" "$WORK/no-launch" "$WORK/silent-fail"

# Run the gate with a pinned browser, recording status and transcript.
# Stderr is folded in because the verdict lines go there. Trailing args are
# the env prelude, either `CI=true` or `-u CI`.
run_gate() {
  local label="$1" stub="$2" script="$3"
  shift 3
  local rc=0
  env "$@" ORK_GLYPH_CHROME="$WORK/$stub" bash "$script" \
    > "$WORK/$label.log" 2>&1 || rc=$?
  echo "$rc" > "$WORK/$label.rc"
}

status() { cat "$WORK/$1.rc"; }
said() { grep -qF -e "$2" "$WORK/$1.log"; }
unsaid() {
  if grep -qF -e "$2" "$WORK/$1.log"; then
    return 1
  fi
  return 0
}

echo "launch-vs-render proofs:"

# 1. A clean exit with no DOM is case (a), not case (b). This is the half
#    that must never weaken: no-escape deletes every escapeHtml call site.
run_gate clean-null clean-null "$GATE" -u CI
[[ "$(status clean-null)" != 0 ]] \
  || fail "a browser that exits 0 and writes nothing was not a failure"
said clean-null 'produced no DOM, so no mutation case can be judged' \
  || fail "the no-DOM failure did not name why no case could be judged"
unsaid clean-null 'ENVIRONMENT UNAVAILABLE' \
  || fail "a clean exit with no output was misread as a launch failure"
unsaid clean-null 'SKIP:' \
  || fail "a clean exit with no output was skipped instead of failed"
unsaid clean-null '✓ mode=' \
  || fail "a browser that rendered nothing still ticked a mutation case"
ok "clean exit, no DOM: hard fail, no tick, not an environment verdict"

# 2. The same stub against the negative cases alone, which is how #4296 was
#    filed: all four used to print a tick and exit 0.
grep -v '^run_case encoded pass$' "$GATE" > "$NEG"
grep -q '^run_case no-escape fail$' "$NEG" \
  || fail "the negatives-only variant lost the no-escape case"
run_gate negatives clean-null "$NEG" -u CI
[[ "$(status negatives)" != 0 ]] \
  || fail "the negative cases alone still pass against a null browser"
unsaid negatives '✓ mode=' \
  || fail "a negative case self-certified against a null browser"
ok "negative cases alone: hard fail, the #4296 vacuous pass stays fixed"

# 3. A real launch failure outside CI takes the repo's skip convention, with
#    a loud line naming the failure. Never a tick.
run_gate unavailable no-launch "$GATE" -u CI
[[ "$(status unavailable)" == 0 ]] \
  || fail "a launch failure outside CI did not take the skip convention"
said unavailable 'ENVIRONMENT UNAVAILABLE' \
  || fail "the skip did not announce that the environment was unavailable"
said unavailable 'SKIP:' \
  || fail "the skip did not print the repo's SKIP line"
said unavailable 'sandbox_extension_issue_file_to_process failed' \
  || fail "the skip did not quote the captured launch-failure reason"
unsaid unavailable '✓ mode=' \
  || fail "a launch failure printed a tick for a mutation case"
ok "launch failure outside CI: SKIP with the captured reason, no tick"

# 4. The same launch failure in CI is a regression, because the CI image has
#    a working Chrome. Never a skip, never a pass.
run_gate ci-hard-fail no-launch "$GATE" CI=true
[[ "$(status ci-hard-fail)" != 0 ]] \
  || fail "a launch failure under CI did not hard fail"
said ci-hard-fail 'regression, not a skip' \
  || fail "the CI failure did not say why a launch failure is not skippable"
unsaid ci-hard-fail 'SKIP:' \
  || fail "a launch failure under CI still printed a SKIP line"
ok "launch failure in CI: hard fail, no SKIP line"

# 5. Absence of output alone must never be enough to claim a launch failure,
#    so the classifier needs a stderr signature, not just a non-zero exit.
grep -q 'LAUNCH_FAILURE_SIGNATURES' "$GATE" \
  || fail "the gate no longer keeps an explicit launch-failure signature list"
grep -q 'launch_failure_reason' "$GATE" \
  || fail "the gate no longer classifies launch failures from stderr"
ok "classification is by stderr signature, not by absent output"

# 6. The behavioural half of proof 5, run outside CI where a launch failure
#    would be skippable: a non-zero exit with an EMPTY stderr must fall
#    through to the hard no-DOM failure. If a future edit let
#    launch_failure_reason succeed on an empty file, this stub would exit 0
#    with a SKIP line and the identifier greps above would still pass.
run_gate silent-fail silent-fail "$GATE" -u CI
[[ "$(status silent-fail)" != 0 ]] \
  || fail "a silent non-zero exit did not fail"
said silent-fail 'produced no DOM, so no mutation case can be judged' \
  || fail "a silent non-zero exit did not take the no-DOM failure"
unsaid silent-fail 'ENVIRONMENT UNAVAILABLE' \
  || fail "a silent non-zero exit was classified as a launch failure"
unsaid silent-fail 'SKIP:' \
  || fail "a silent non-zero exit was skipped instead of failed"
ok "silent non-zero exit: hard no-DOM fail, never a launch-failure skip"

echo "✓ $PASS launch-vs-render proofs hold"
