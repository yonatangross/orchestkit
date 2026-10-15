#!/usr/bin/env bash
# HQ_CI_ONLY=1 makes pre-push skip the unit tier; unset, it runs.
#
# Lane pushes let CI's required checks be the gate. With HQ_CI_ONLY=1 the
# hook prints its skip line and jumps the unit suite (and with it every
# headless Chrome launch, which lives only inside that tier) while the
# fast checks before and after still run. Without it the hook must behave
# exactly as before.
#
# The tiers here are stubs that only drop marker files, so the test proves
# which stages ran, not that they pass: the real suite is CI's job.

set -euo pipefail

# The fixture repo is disposable; never let an inherited GIT_* from a hook
# context redirect git into the caller's repository.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR \
    GIT_OBJECT_DIRECTORY

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK="$ROOT/bin/git-hooks/pre-push"
PASS=0
fail() { echo "✗ $1"; exit 1; }
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

[[ -f "$HOOK" ]] || fail "missing $HOOK"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-hq-ci-only.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

# The fixture commits real objects. Route every git call in this shell
# through a throwaway config so a signed-by-default user config neither
# prompts nor fails the fixture (#4664).
source "$ROOT/tests/fixtures/git-isolate.sh"
git_isolate "$WORK"

FIX="$WORK/fixture"
mkdir -p "$FIX/bin/git-hooks" "$FIX/scripts/ci" "$FIX/tests/unit" \
         "$FIX/tests/agents" "$FIX/tests/skills/structure" \
         "$FIX/tests/performance"

cp "$HOOK" "$FIX/bin/git-hooks/pre-push"

# A non-empty pattern (an empty one fails the hook) matched by the fixture
# branch, so the version gate stands down before the tiers run.
printf 'VERSION_SKIP_PATTERN=%s\n' "'^release-please'" > "$FIX/scripts/ci/version-skip-pattern.sh"

# Fast-check stubs. Each drops its own marker: presence after the run is
# the proof the stage executed. The unit canary is the tier under test.
printf 'touch agents-ran\nexit 0\n' > "$FIX/tests/agents/test-agent-frontmatter.sh"
printf 'touch skills-ran\nexit 0\n' > "$FIX/tests/skills/structure/test-skill-md.sh"
printf 'touch budget-ran\nexit 0\n' > "$FIX/tests/performance/test-token-overhead.sh"
printf '#!/bin/sh\ntouch unit-tier-ran\nexit 0\n' > "$FIX/tests/unit/test-canary.sh"
printf '{"name":"fixture","version":"0.0.0","scripts":{"build":"true"}}\n' > "$FIX/package.json"

git -C "$FIX" init -q
git -C "$FIX" checkout -q -b release-please--branches--main
git -C "$FIX" add -A
git -C "$FIX" commit -qm one
printf 'x\n' > "$FIX/a.txt"
git -C "$FIX" add -A
git -C "$FIX" commit -qm two

SKIP_LINE='pre-push: HQ_CI_ONLY=1, unit tier skipped, CI required checks are the gate'

run_hook() {
  ( cd "$FIX" && env "$@" bash bin/git-hooks/pre-push origin https://example.invalid/x.git </dev/null 2>&1 )
}

echo "pre-push HQ_CI_ONLY unit-tier skip"

# Arm 1: HQ_CI_ONLY=1. The unit tier must not run; the fast checks must.
rc=0
out="$(run_hook HQ_CI_ONLY=1)" || rc=$?
[[ "$rc" -eq 0 ]] || fail "hook failed with HQ_CI_ONLY=1 (rc=$rc): $(tail -15 <<<"$out")"
[[ "$(grep -cF "$SKIP_LINE" <<<"$out")" == 1 ]] \
  || fail "skip line absent or duplicated: $(tail -10 <<<"$out")"
[[ ! -e "$FIX/unit-tier-ran" ]] || fail "unit tier ran under HQ_CI_ONLY=1"
[[ -e "$FIX/agents-ran" && -e "$FIX/skills-ran" && -e "$FIX/budget-ran" ]] \
  || fail "HQ_CI_ONLY=1 stopped the fast checks too: $(tail -10 <<<"$out")"
grep -qF 'Pre-push validation passed' <<<"$out" \
  || fail "hook did not reach the success line under HQ_CI_ONLY=1"
ok "HQ_CI_ONLY=1 skips the unit tier and still runs the fast checks"

# Arm 2: the control. No HQ_CI_ONLY means the unit tier runs as before.
rm -f "$FIX/unit-tier-ran" "$FIX/agents-ran" "$FIX/skills-ran" "$FIX/budget-ran"
rc=0
out="$(run_hook -u HQ_CI_ONLY)" || rc=$?
[[ "$rc" -eq 0 ]] || fail "hook failed without HQ_CI_ONLY (rc=$rc): $(tail -15 <<<"$out")"
if grep -qF "$SKIP_LINE" <<<"$out"; then
  fail "skip line printed without HQ_CI_ONLY=1"
fi
[[ -e "$FIX/unit-tier-ran" ]] || fail "unit tier did not run without HQ_CI_ONLY=1"
ok "without HQ_CI_ONLY the unit tier runs as before"

echo "  $PASS passed"
