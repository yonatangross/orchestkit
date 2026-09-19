#!/usr/bin/env bash
# Test: the "Check hook bundles are release-owned (#3578)" step in ci.yml
# compares the PR against the CURRENT base tip, not the event's frozen
# base.sha, and skips dist paths whose content is inherited from main.
#
# The step body is lifted LIVE from the workflow YAML by step name (same
# extract_step pattern as test-workflow-step-fault-arms.sh), so this test
# drifts with the shipped step rather than with a pasted copy.
#
# Fixture shape, the real bug this guards:
#   main@v1 -> PR fork -> main rebuilds bundles (v2) -> merge ref
#   diff(frozen base.sha v1, merge ref) on dist/ showed v2 vs v1: RED for a PR
#   that never touched bundles, and the printed remedy (checkout BASE_SHA)
#   would have REVERTED the newer bundles. diff(merge-base vs current tip,
#   merge ref) is empty: GREEN.
#
# Arms:
#   A. PR built before main's bundle rebuild, merge-ref checkout  -> pass
#   B. PR that edits dist itself, merge-ref checkout              -> fail
#   C. PR head carries dist bytes identical to current main tip   -> pass
#      (inherited, not authored: the #4277 exception applied to CI)
#   D. Same authored edit on a head-only checkout                 -> fail
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CI_YML="$REPO_ROOT/.github/workflows/ci.yml"

echo "=== hook bundle release-owned guard (fixture repo) ==="
echo ""

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-bundle-guard.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
PASS=0; FAIL=0
ok()  { echo "  PASS: $1"; PASS=$((PASS + 1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# extract_step <yml> <step name> -> prints the dedented `run: |` body.
extract_step() {
    awk -v want="$2" '
        function indent(s,  m) { match(s, /^ */); return RLENGTH }
        BEGIN { state = 0 }
        state == 0 && $0 ~ "^ *- name: " {
            name = $0; sub(/^ *- name: /, "", name); sub(/ *$/, "", name)
            if (name == want) state = 1
            next
        }
        state == 1 && $0 ~ /^ *run: \|/ { runind = indent($0); state = 2; next }
        state == 1 && $0 ~ /^ *- name: / { exit }
        state == 2 {
            if ($0 ~ /^ *$/) { print ""; next }
            if (indent($0) <= runind) exit
            print substr($0, runind + 3)
        }
    ' "$1"
}

extract_step "$CI_YML" "Check hook bundles are release-owned (#3578)" > "$WORK/step.sh"
if [[ ! -s "$WORK/step.sh" ]]; then
    bad "could not extract the step body from ci.yml (step renamed?)"
    echo ""; echo "  $PASS passed, $FAIL failed"; exit 1
fi

# --- fixture: bare remote + clone -------------------------------------------
REMOTE="$WORK/remote.git"
CLONE="$WORK/clone"
git init --quiet --bare "$REMOTE"
git clone --quiet "$REMOTE" "$CLONE"
cd "$CLONE"
git config user.email "fixture@test" && git config user.name "fixture"
git config commit.gpgsign false
git checkout --quiet -b main

mkdir -p src/hooks/dist plugins/ork/hooks/dist
echo "bundle-v1" > src/hooks/dist/bundle.mjs
echo "bundle-v1" > plugins/ork/hooks/dist/bundle.mjs
echo "app" > src/app.ts
git add -A && git commit --quiet -m "v1"
git push --quiet origin main
V1=$(git rev-parse HEAD)

# run_guard <expected-rc> <label>: runs the lifted step in $CLONE at its
# current HEAD with the feature-PR env.
run_guard() {
    local want="$1" label="$2" rc=0
    ( cd "$CLONE" && env HEAD_REF=feat-x BASE_REF=main GH_TOKEN= bash -e "$WORK/step.sh" ) \
        > "$WORK/out.txt" 2>&1 || rc=$?
    if [[ "$rc" -eq "$want" ]]; then
        ok "$label (rc=$rc)"
    else
        bad "$label (rc=$rc, wanted $want)"
        sed 's/^/      /' "$WORK/out.txt" | tail -8
    fi
}

# --- A: main rebuilds bundles after the PR forked; merge-ref HEAD -----------
git checkout --quiet -b feat-x "$V1"
echo "feature" >> src/app.ts
git add -A && git commit --quiet -m "pr change"
PR_HEAD_A=$(git rev-parse HEAD)

git checkout --quiet main
echo "bundle-v2" > src/hooks/dist/bundle.mjs
echo "bundle-v2" > plugins/ork/hooks/dist/bundle.mjs
git add -A && git commit --quiet -m "bundle rebuild on main"
git push --quiet origin main

# GitHub's pull_request checkout is the merge ref: base tip merged with head.
git checkout --quiet -b merge-ref
git merge --quiet --no-ff -m "merge" "$PR_HEAD_A"
run_guard 0 "A: PR predates main's bundle rebuild (frozen base.sha used to red this)"

# --- B: PR that authors a dist edit stays red --------------------------------
git checkout --quiet -b feat-y "$V1"
echo "hacked" > src/hooks/dist/extra.mjs
git add -A && git commit --quiet -m "pr edits dist"
PR_HEAD_B=$(git rev-parse HEAD)
git checkout --quiet -b merge-ref-b main
git merge --quiet --no-ff -m "merge" "$PR_HEAD_B"
run_guard 1 "B: authored dist change on the merge ref"
if ! grep -q "src/hooks/dist/extra.mjs" "$WORK/out.txt"; then
    bad "B: error output did not name the authored file"
else
    ok "B: error output names the authored file"
fi

# --- C: head carries dist bytes identical to current main tip ----------------
# PR head (not the merge ref) committed bundles that byte-match main's v2:
# authored relative to the v1 fork point, inherited relative to the tip.
git checkout --quiet -b feat-z "$V1"
echo "bundle-v2" > src/hooks/dist/bundle.mjs
echo "bundle-v2" > plugins/ork/hooks/dist/bundle.mjs
git add -A && git commit --quiet -m "pr built bundles matching main"
git checkout --quiet feat-z   # HEAD = PR head, head-only checkout shape
run_guard 0 "C: dist identical to current base tip is inherited, not authored"

# --- D: authored edit on a head-only checkout still reds ---------------------
git checkout --quiet feat-y
run_guard 1 "D: authored dist change on a head-only checkout"

echo ""
echo "  $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
