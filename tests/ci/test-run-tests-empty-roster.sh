#!/usr/bin/env bash
# Test: scripts/ci/run-tests.sh must FAIL on a directory with zero tests.
#
# Why (gate-fault-arm audit, docs/audits/gate-fault-arm-audit-2026-09-06.md):
#
# Every ci.yml job runs `bash scripts/ci/run-tests.sh tests/<dir>` and treats
# exit 0 as "that directory's gates passed". Until 2026-09-06 the engine printed
# "WARNING: No tests found" and exited 0 when the glob matched nothing, so a
# directory emptied by a rename sweep, a moved roster, or a pattern typo read as
# green for a suite that never ran. Measured in the audit: control exit 0,
# fault (empty dir) exit 0. That is the #3933 shape: an empty result that is
# byte-identical to a passing one.
#
# Two arms, both asserted, so the gate cannot drift back:
#   control: a dir with one passing test-*.sh  -> exit 0
#   fault:   a dir that exists but has no tests -> exit non-zero
#   fault2:  a dir that does not exist          -> exit non-zero (was already so)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER="$REPO_ROOT/scripts/ci/run-tests.sh"

echo "=== run-tests.sh empty-roster gate ==="
echo ""

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-empty-roster.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

PASS=0; FAIL=0
ok()  { echo "  PASS: $1"; PASS=$((PASS + 1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# control arm: one passing test
mkdir -p "$WORK/has-one"
printf '#!/usr/bin/env bash\nexit 0\n' > "$WORK/has-one/test-ok.sh"
if bash "$RUNNER" "$WORK/has-one" >/dev/null 2>&1; then
  ok "control: a directory with one passing test exits 0"
else
  bad "control: a directory with one passing test should exit 0"
fi

# fault arm: directory exists, zero test files
mkdir -p "$WORK/empty"
printf 'not a test\n' > "$WORK/empty/README.md"
rc=0
bash "$RUNNER" "$WORK/empty" >"$WORK/empty.out" 2>&1 || rc=$?
if [[ $rc -ne 0 ]] && grep -q "No tests found" "$WORK/empty.out"; then
  ok "fault: an empty directory exits non-zero ($rc) and names the cause"
else
  bad "fault: an empty directory exited $rc (want non-zero with 'No tests found')"
fi

# fault2 arm: directory missing
rc=0
bash "$RUNNER" "$WORK/missing" >/dev/null 2>&1 || rc=$?
if [[ $rc -ne 0 ]]; then
  ok "fault2: a missing directory exits non-zero ($rc)"
else
  bad "fault2: a missing directory exited 0"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
