#!/usr/bin/env bash
# pre-push must not leave sh-thd-* in the repository root (#5009).
#
# Bash here-strings write sh-thd-<digits> under $TMPDIR. When TMPDIR is the
# repo root (or bash falls back to DEFAULT_TMPDIR "." because /tmp is not
# writable), those files land next to .git and survive. This test fails on
# the pre-fix hook: a planted sh-thd-* stays after the run. After the fix
# the hook redirects TMPDIR off the root and removes any root leftovers.
#
# Hook output goes to a file (ork#3348: a here-string of a whole hook run
# is not provably under PIPE_BUF).

set -euo pipefail

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

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-no-sh-thd.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
OUT="$WORK/hook-out.txt"

source "$ROOT/tests/fixtures/git-isolate.sh"
git_isolate "$WORK"

FIX="$WORK/fixture"
mkdir -p "$FIX/bin/git-hooks" "$FIX/scripts/ci" "$FIX/scripts/lib" \
         "$FIX/tests/unit" "$FIX/tests/agents" "$FIX/tests/skills/structure" \
         "$FIX/tests/performance" "$FIX/tests/security"

cp "$HOOK" "$FIX/bin/git-hooks/pre-push"

printf 'VERSION_SKIP_PATTERN=%s\n' "'^release-please'" > "$FIX/scripts/ci/version-skip-pattern.sh"
printf 'touch agents-ran\nexit 0\n' > "$FIX/tests/agents/test-agent-frontmatter.sh"
printf 'touch skills-ran\nexit 0\n' > "$FIX/tests/skills/structure/test-skill-md.sh"
printf 'touch budget-ran\nexit 0\n' > "$FIX/tests/performance/test-token-overhead.sh"
printf '#!/bin/sh\ntouch unit-tier-ran\nexit 0\n' > "$FIX/tests/unit/test-canary.sh"
printf '#!/bin/sh\ntouch security-ran\nexit 0\n' > "$FIX/tests/security/run-security-tests.sh"
chmod +x "$FIX/tests/security/run-security-tests.sh"
printf '{"name":"fixture","version":"0.0.0","scripts":{"build":"true"}}\n' > "$FIX/package.json"

cat > "$FIX/scripts/lib/pre-push-select.sh" <<'SEL'
pre_push_select_unit_tests() { printf '%s\n' tests/unit/test-canary.sh; }
pre_push_select_wants_security() { return 1; }
pre_push_select_wants_src_stages() { return 1; }
SEL
cat > "$FIX/scripts/lib/test-slot.sh" <<'SLOT'
acquire_test_slot() { :; }
release_test_slot() { :; }
SLOT

git -C "$FIX" init -q
git -C "$FIX" checkout -q -b release-please--branches--main
git -C "$FIX" add -A
git -C "$FIX" commit -qm one
git -C "$FIX" update-ref refs/remotes/origin/main HEAD
printf 'x\n' > "$FIX/a.txt"
git -C "$FIX" add -A
git -C "$FIX" commit -qm two

run_hook() {
  ( cd "$FIX" && env -u CI -u GITHUB_ACTIONS "$@" \
      bash bin/git-hooks/pre-push origin https://example.invalid/x.git </dev/null >"$OUT" 2>&1 )
}

echo "pre-push no sh-thd-* in repo root (#5009)"

# Arm 1: a planted leftover must be gone after a successful run (cleanup
# trap + end guard). Without the fix the file stays and this arm fails.
: > "$FIX/sh-thd-5009planted"
rc=0
run_hook HQ_CI_ONLY=1 ORK_PRE_PUSH_MODE=targeted ORK_TEST_SLOT_NOLOCK=1 || rc=$?
if [[ "$rc" -ne 0 ]]; then
  fail "hook exited $rc with a planted sh-thd (out follows)"
  tail -20 "$OUT"
elif [[ -e "$FIX/sh-thd-5009planted" ]]; then
  fail "planted sh-thd-5009planted still in the fixture root after the hook"
else
  ok "planted sh-thd-* removed on success"
fi

# Arm 2: TMPDIR equal to the repo root (sandbox failure mode) must not
# leave a new sh-thd-* at the root after the here-string stages run.
rm -f "$FIX"/sh-thd-*
rc=0
run_hook TMPDIR="$FIX" HQ_CI_ONLY=1 ORK_PRE_PUSH_MODE=targeted ORK_TEST_SLOT_NOLOCK=1 || rc=$?
left=""
for f in "$FIX"/sh-thd-*; do
  [[ -f "$f" ]] || continue
  left="$left $f"
done
if [[ "$rc" -ne 0 ]]; then
  fail "hook exited $rc with TMPDIR=fixture root (out follows)"
  tail -20 "$OUT"
elif [[ -n "$left" ]]; then
  fail "new sh-thd leftovers with TMPDIR=fixture root:$left"
else
  ok "TMPDIR=repo-root leaves no sh-thd-* in the root"
fi

# Arm 3: ensure_pre_push_tmpdir rejects the repo root (extracted, same
# pattern as test-pre-push-hook.sh function probes).
eval "$(sed -n '/^remove_repo_root_sh_thd()/,/^}/p;/^ensure_pre_push_tmpdir()/,/^}/p' "$HOOK")"
PROJECT_ROOT="$FIX"
TMPDIR="$FIX"
export TMPDIR PROJECT_ROOT
fix_phys=$(cd "$FIX" && pwd -P)
ensure_pre_push_tmpdir || die "ensure_pre_push_tmpdir returned non-zero"
resolved=$(cd "$TMPDIR" && pwd -P)
if [[ "$resolved" == "$fix_phys" ]]; then
  fail "ensure_pre_push_tmpdir left TMPDIR at the repository root ($resolved)"
else
  ok "ensure_pre_push_tmpdir moved TMPDIR off the repository root ($resolved)"
fi

echo ""
if [[ "$FAILS" -gt 0 ]]; then
  echo "FAIL: $FAILS arm(s) failed, $PASS passed"
  exit 1
fi
echo "PASS: $PASS arms, pre-push leaves no sh-thd-* in the repo root (#5009)"
exit 0
