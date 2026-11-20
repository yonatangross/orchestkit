#!/usr/bin/env bash
# HQ_CI_ONLY=1 makes pre-push skip the unit tier; any other value or unset, it runs.
#
# Lane pushes let CI's required checks be the gate. With HQ_CI_ONLY=1 the
# hook prints its skip line and jumps the unit suite (and with it every
# headless Chrome launch, which lives only inside that tier) while the
# stages before and after still run, the security stage included. Without
# it the hook must behave exactly as before.
#
# The tiers here are stubs that only drop marker files, so the test proves
# which stages ran, not that they pass: the real suite is CI's job. Every
# arm is checked and every failure is printed before the test exits, so one
# CI run shows all the arms a change breaks (#4753).
#
# Hook output goes to a file and is read from there: a here-string of a
# whole hook run is not provably under PIPE_BUF (ork#3348).

set -euo pipefail

# The fixture repo is disposable; never let an inherited GIT_* from a hook
# context redirect git into the caller's repository.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR \
    GIT_OBJECT_DIRECTORY

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK="$ROOT/bin/git-hooks/pre-push"
PASS=0
FAILS=0
die() { echo "✗ $1"; exit 1; }
fail() { echo "✗ $1"; FAILS=$((FAILS + 1)); }
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

[[ -f "$HOOK" ]] || die "missing $HOOK"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-hq-ci-only.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
OUT="$WORK/hook-out.txt"

# The fixture commits real objects. Route every git call in this shell
# through a throwaway config so a signed-by-default user config neither
# prompts nor fails the fixture (#4664).
source "$ROOT/tests/fixtures/git-isolate.sh"
git_isolate "$WORK"

FIX="$WORK/fixture"
mkdir -p "$FIX/bin/git-hooks" "$FIX/scripts/ci" "$FIX/scripts/lib" \
         "$FIX/tests/unit" "$FIX/tests/agents" "$FIX/tests/skills/structure" \
         "$FIX/tests/performance" "$FIX/tests/security"

cp "$HOOK" "$FIX/bin/git-hooks/pre-push"

# A non-empty pattern (an empty one fails the hook) matched by the fixture
# branch, so the version gate stands down before the tiers run.
printf 'VERSION_SKIP_PATTERN=%s\n' "'^release-please'" > "$FIX/scripts/ci/version-skip-pattern.sh"

# Stage stubs. Each drops its own marker: presence after the run is the
# proof the stage executed. The unit canary is the tier under test. The
# security stub sits between the unit tier and the agents, skills and
# budget checks, so a skip that widens past the unit tier shows up here
# first (#4753 should 1).
printf 'touch agents-ran\nexit 0\n' > "$FIX/tests/agents/test-agent-frontmatter.sh"
printf 'touch skills-ran\nexit 0\n' > "$FIX/tests/skills/structure/test-skill-md.sh"
printf 'touch budget-ran\nexit 0\n' > "$FIX/tests/performance/test-token-overhead.sh"
printf '#!/bin/sh\ntouch unit-tier-ran\nexit 0\n' > "$FIX/tests/unit/test-canary.sh"
printf '#!/bin/sh\ntouch security-ran\nexit 0\n' > "$FIX/tests/security/run-security-tests.sh"
chmod +x "$FIX/tests/security/run-security-tests.sh"
printf '{"name":"fixture","version":"0.0.0","scripts":{"build":"true"}}\n' > "$FIX/package.json"

# Targeted-mode stubs (#4753 nit): a selector that picks the canary and, by
# default, wants neither security nor the src stages (FIX_WANT_SECURITY=1 and
# FIX_WANT_SRC=1 turn them on per arm), and a slot governor that only records
# that a slot was taken.
cat > "$FIX/scripts/lib/pre-push-select.sh" <<'SEL'
pre_push_select_unit_tests() { printf '%s\n' tests/unit/test-canary.sh; }
pre_push_select_wants_security() { [[ "${FIX_WANT_SECURITY:-0}" == 1 ]]; }
pre_push_select_wants_src_stages() { [[ "${FIX_WANT_SRC:-0}" == 1 ]]; }
SEL
cat > "$FIX/scripts/lib/test-slot.sh" <<'SLOT'
acquire_test_slot() { touch slot-taken; }
release_test_slot() { :; }
SLOT

git -C "$FIX" init -q
git -C "$FIX" checkout -q -b release-please--branches--main
git -C "$FIX" add -A
git -C "$FIX" commit -qm one
# Targeted mode diffs against origin/main; give it a readable base so it
# does not fall back to full.
git -C "$FIX" update-ref refs/remotes/origin/main HEAD
printf 'x\n' > "$FIX/a.txt"
git -C "$FIX" add -A
git -C "$FIX" commit -qm two

SKIP_LINE='pre-push: HQ_CI_ONLY=1, unit tier skipped, CI required checks are the gate'
MARKERS=(unit-tier-ran security-ran agents-ran skills-ran budget-ran slot-taken)

reset_markers() {
  local m
  for m in "${MARKERS[@]}"; do rm -f "$FIX/$m"; done
}

# Runs the hook with the given env changes; output lands in $OUT, the
# return code is the hook's.
run_hook() {
  ( cd "$FIX" && env -u CI -u GITHUB_ACTIONS "$@" \
      bash bin/git-hooks/pre-push origin https://example.invalid/x.git </dev/null >"$OUT" 2>&1 )
}
has() { grep -qF -- "$1" "$OUT"; }
# awk, not grep -c: grep exits 1 on zero matches, awk prints 0 and exits 0.
count() { awk -v s="$1" 'index($0, s) { n++ } END { print n + 0 }' "$OUT"; }
tail_out() { tail -"${1:-10}" "$OUT"; }
ran() { [[ -e "$FIX/$1" ]]; }

echo "pre-push HQ_CI_ONLY unit-tier skip"

# Arm 1: HQ_CI_ONLY=1. The unit tier must not run; security and the fast
# checks after it must.
reset_markers
rc=0
run_hook -u ORK_PRE_PUSH_MODE HQ_CI_ONLY=1 || rc=$?
arm_ok=1
[[ "$rc" -eq 0 ]] || { fail "hook failed with HQ_CI_ONLY=1 (rc=$rc): $(tail_out 15)"; arm_ok=0; }
[[ "$(count "$SKIP_LINE")" == 1 ]] || { fail "skip line absent or duplicated: $(tail_out)"; arm_ok=0; }
ran unit-tier-ran && { fail "unit tier ran under HQ_CI_ONLY=1"; arm_ok=0; }
ran security-ran || { fail "HQ_CI_ONLY=1 skipped the security stage too: $(tail_out)"; arm_ok=0; }
{ ran agents-ran && ran skills-ran && ran budget-ran; } \
  || { fail "HQ_CI_ONLY=1 stopped the fast checks too: $(tail_out)"; arm_ok=0; }
has 'Pre-push validation passed' || { fail "hook did not reach the success line under HQ_CI_ONLY=1"; arm_ok=0; }
[[ "$arm_ok" == 1 ]] && ok "HQ_CI_ONLY=1 skips only the unit tier; security and fast checks run"

# Arms 2 to 4: unset, "0" and empty all mean the default path. A check
# loosened to "is HQ_CI_ONLY set or non-empty" fails here (#4753 should 2).
default_arm() {
  local label="$1"; shift
  local rc=0 arm_ok=1
  reset_markers
  run_hook -u ORK_PRE_PUSH_MODE "$@" || rc=$?
  [[ "$rc" -eq 0 ]] || { fail "$label: hook failed (rc=$rc): $(tail_out 15)"; arm_ok=0; }
  has "$SKIP_LINE" && { fail "$label: skip line printed"; arm_ok=0; }
  ran unit-tier-ran || { fail "$label: unit tier did not run"; arm_ok=0; }
  ran security-ran || { fail "$label: security stage did not run"; arm_ok=0; }
  [[ "$arm_ok" == 1 ]] && ok "$label: the unit tier and security run as before"
  return 0
}
default_arm "HQ_CI_ONLY unset" -u HQ_CI_ONLY
default_arm "HQ_CI_ONLY=0" HQ_CI_ONLY=0
default_arm "HQ_CI_ONLY empty" HQ_CI_ONLY=

# Arm 5: targeted mode with HQ_CI_ONLY=1 and no security-relevant path. No
# unit test runs, so the hook must neither announce a unit selection nor
# take a machine-wide test slot before the skip (#4753 nit).
reset_markers
rc=0
run_hook ORK_PRE_PUSH_MODE=targeted HQ_CI_ONLY=1 || rc=$?
arm_ok=1
[[ "$rc" -eq 0 ]] || { fail "targeted + HQ_CI_ONLY=1: hook failed (rc=$rc): $(tail_out 15)"; arm_ok=0; }
has 'pre-push mode: targeted' \
  || { fail "targeted + HQ_CI_ONLY=1: hook fell back from targeted mode: $(tail_out)"; arm_ok=0; }
has 'unit tests selected:' && { fail "targeted + HQ_CI_ONLY=1: hook announced a unit selection it will not run"; arm_ok=0; }
ran slot-taken && { fail "targeted + HQ_CI_ONLY=1: hook took a test slot with nothing to run"; arm_ok=0; }
ran unit-tier-ran && { fail "targeted + HQ_CI_ONLY=1: unit tier ran"; arm_ok=0; }
[[ "$(count "$SKIP_LINE")" == 1 ]] || { fail "targeted + HQ_CI_ONLY=1: skip line absent or duplicated"; arm_ok=0; }
[[ "$arm_ok" == 1 ]] && ok "targeted + HQ_CI_ONLY=1: no unit selection line, no test slot"

# Arm 6: the control for arm 5, run three ways. Targeted mode with
# HQ_CI_ONLY unset, "0" or empty must announce the selection, take the slot
# and run the unit tier, or arm 5 proves nothing. The "0" and empty copies
# pin the exact "1" checks at the selection line and the slot decision: a
# check loosened to "non-empty" fails them (#4758 review).
targeted_control() {
  local label="$1"; shift
  local rc=0 arm_ok=1
  reset_markers
  # env reads -u options only before the first NAME=value, so the caller's
  # args go first.
  run_hook "$@" ORK_PRE_PUSH_MODE=targeted || rc=$?
  [[ "$rc" -eq 0 ]] || { fail "$label: hook failed (rc=$rc): $(tail_out 15)"; arm_ok=0; }
  has 'unit tests selected: 1' || { fail "$label: no unit selection line: $(tail_out)"; arm_ok=0; }
  has "$SKIP_LINE" && { fail "$label: skip line printed"; arm_ok=0; }
  ran slot-taken || { fail "$label: the slot stub was never reached"; arm_ok=0; }
  ran unit-tier-ran || { fail "$label: unit tier did not run"; arm_ok=0; }
  [[ "$arm_ok" == 1 ]] && ok "$label: selection announced, slot taken, unit tier ran"
  return 0
}
targeted_control "targeted control, HQ_CI_ONLY unset" -u HQ_CI_ONLY
targeted_control "targeted control, HQ_CI_ONLY=0" HQ_CI_ONLY=0
targeted_control "targeted control, HQ_CI_ONLY empty" HQ_CI_ONLY=

# Arms 7 to 9: with HQ_CI_ONLY=1 the slot may be skipped only when nothing
# else runs either. Security on, the src stages on (tsc, build), or a diff
# under src/hooks/ (the hook vitest suite) must each still take the slot
# (#4758 review).
slot_arm() {
  local label="$1"; shift
  local rc=0 arm_ok=1
  reset_markers
  run_hook ORK_PRE_PUSH_MODE=targeted HQ_CI_ONLY=1 "$@" || rc=$?
  [[ "$rc" -eq 0 ]] || { fail "$label: hook failed (rc=$rc): $(tail_out 15)"; arm_ok=0; }
  has 'pre-push mode: targeted' || { fail "$label: hook fell back from targeted mode: $(tail_out)"; arm_ok=0; }
  ran slot-taken || { fail "$label: no test slot taken while a stage still runs"; arm_ok=0; }
  ran unit-tier-ran && { fail "$label: unit tier ran under HQ_CI_ONLY=1"; arm_ok=0; }
  [[ "$arm_ok" == 1 ]] && ok "$label: slot taken, unit tier skipped"
  return 0
}
slot_arm "targeted + HQ_CI_ONLY=1 + security on" FIX_WANT_SECURITY=1
ran security-ran || fail "targeted + HQ_CI_ONLY=1 + security on: security stage did not run"
slot_arm "targeted + HQ_CI_ONLY=1 + src stages on" FIX_WANT_SRC=1

# A diff under src/hooks/ makes the hook vitest stage run. Add one commit for
# this arm only, then drop it so later arms see the original diff.
mkdir -p "$FIX/src/hooks"
printf 'x\n' > "$FIX/src/hooks/touched.txt"
git -C "$FIX" add -A
git -C "$FIX" commit -qm hooks
slot_arm "targeted + HQ_CI_ONLY=1 + src/hooks change"
git -C "$FIX" reset -q --hard HEAD~1

echo "  $PASS passed, $FAILS failed"
[[ "$FAILS" == 0 ]] || exit 1
