#!/usr/bin/env bash
# Test: the release-please.yml "Rebuild hook bundles on the release PR" step
# fails closed (#4174). The step used to be continue-on-error:true and its
# failure arms exited 0 with a ::warning::, so a rebuild that did not happen
# reported success. Every hard failure must now be ::error:: + exit 1; only
# benign outcomes (no open PR, non-bot author, bundles already current, branch
# moved to a newer head) exit 0 with a notice.
#
# Pattern: tests/ci/test-workflow-step-fault-arms.sh, the step body is lifted
# LIVE from the workflow YAML by step name, so this test drifts with the
# shipped step rather than with a pasted copy, and runs under `bash -e` (what
# GitHub uses when no shell: key is set). The step's externals are replaced by
# PATH shims: gh (PR lookup), npm (ci + build), git (push and ls-remote only;
# every other git subcommand delegates to the real binary).
#
# Arms (one line each: rc and the annotation that must be present):
#   guard refusal            rc 1  ::error::   (branch differs outside release-owned paths)
#   build failure            rc 1  ::error::   (npm run build fails)
#   fetch failure            rc 1  ::error::   (git fetch of main and the branch fails)
#   root npm ci never run    rc 0  rebuilt      (#4183 minimal set: no root install exists)
#   hooks npm ci failure     rc 1  ::error::   (npm ci inside src/hooks fails)
#   push fail, head moved    rc 0  ::notice::  (a newer run owns the rebuild)
#   push fail, head same     rc 1  ::error::   (rebuild genuinely did not land)
#   already current          rc 0  ::notice::  (dist matches, nothing to push)
#   rsync mirrors contents   (exec arm: the shipped line, no shim; #4183 fix)
#   push carries --no-verify (text arm; mutation: remove the flag, arm fails)
#   no root-level full build (text arm; mutation: restore it, arm fails)
# Plus one structural arm: the shipped step carries no continue-on-error key
# at all, so a future edit cannot soften the step back to warn-only without
# touching this test (#4174).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WF="$REPO_ROOT/.github/workflows"
BRANCH="release-please--v10.0.1"

echo "=== release rebuild fail-closed arms ==="
echo ""

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-rrfc.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
PASS=0; FAIL=0
ok()  { echo "  PASS: $1"; PASS=$((PASS + 1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# ------------------------------------------------ 0. no continue-on-error
# The step's original failure mode was continue-on-error:true, which turned a
# failed rebuild into a warning nobody reads. Assert the property
# structurally: parse the shipped YAML and require the step to carry no
# continue-on-error key, so softening the step back needs a test change too.
COE="$(python3 - "$WF/release-please.yml" <<'PY'
import sys, yaml
wf = yaml.safe_load(open(sys.argv[1]))
found = None
for job in (wf.get("jobs") or {}).values():
    for st in (job.get("steps") or []):
        if isinstance(st, dict) and st.get("name") == "Rebuild hook bundles on the release PR":
            found = st
            break
if found is None:
    print("step not found")
elif "continue-on-error" in found:
    print("present")
else:
    print("absent")
PY
)" || COE="parse error"
if [ "$COE" = "absent" ]; then
    ok "shipped step carries no continue-on-error key"
else
    bad "shipped step continue-on-error: '$COE' (want absent)"
fi

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
        state == 1 && $0 ~ "^ *- name: " { exit }
        state == 2 {
            if ($0 ~ /^ *$/) { print ""; next }
            if (indent($0) <= runind) exit
            print substr($0, runind + 3)
        }
    ' "$1"
}

# ---- shims ------------------------------------------------------------
SHIMS="$WORK/shims"; mkdir -p "$SHIMS"
REAL_GIT="$(command -v git)"

# gh: reports one open release PR authored by the release bot.
cat > "$SHIMS/gh" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  printf '[{"headRefName":"%s","author":{"login":"app/orchestkit-release-bot"},"number":4174}]\n' "$RRFC_BRANCH"
  exit 0
fi
echo "gh shim: unexpected call: $*" >&2
exit 64
EOF

# npm: ci always succeeds; build writes src/hooks/dist only with
# $RRFC_BUILD_CONTENT (set RRFC_BUILD_FAIL=1 to make the build itself fail).
# The plugin copy is NOT pre-written: since #4183 the step produces
# plugins/ork/hooks/dist by rsyncing src/hooks/dist, and pre-writing it here
# would hide a broken rsync from every arm below. Paths go through RRFC_ROOT
# because the step runs the build with cwd=src/hooks.
# RRFC_NPM_CI_FAIL=root fails the ci outside src/hooks only; =hooks fails
# the ci inside src/hooks only, told apart by the directory the shim runs
# in. With the #4183 minimal set no root ci runs, so =root is a no-op the
# root arm below asserts stays that way.
cat > "$SHIMS/npm" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "ci" ]; then
  case "${RRFC_NPM_CI_FAIL:-}" in
    root)  case "$PWD" in */src/hooks) exit 0 ;; *) exit 1 ;; esac ;;
    hooks) case "$PWD" in */src/hooks) exit 1 ;; *) exit 0 ;; esac ;;
  esac
  exit 0
fi
if [ "${1:-}" = "run" ] && [ "${2:-}" = "build" ]; then
  if [ "${RRFC_BUILD_FAIL:-0}" = "1" ]; then
    echo "npm shim: simulated build failure" >&2
    exit 1
  fi
  mkdir -p "$RRFC_ROOT/src/hooks/dist"
  printf '%s\n' "$RRFC_BUILD_CONTENT" > "$RRFC_ROOT/src/hooks/dist/a.mjs"
  exit 0
fi
echo "npm shim: unexpected call: $*" >&2
exit 64
EOF

# git: intercept push, ls-remote and fetch; delegate the rest. RRFC_PUSH_OK
# makes the push succeed without touching the network, so an arm can assert
# a full end-to-end rebuild (the real remote URL would need auth).
cat > "$SHIMS/git" <<EOF
#!/usr/bin/env bash
if [ "\${1:-}" = "fetch" ] && [ "\${RRFC_FETCH_FAIL:-0}" = "1" ]; then
  echo "git shim: simulated fetch failure" >&2
  exit 1
fi
if [ "\${1:-}" = "push" ] && [ "\${RRFC_PUSH_FAIL:-0}" = "1" ]; then
  echo "git shim: simulated push failure" >&2
  exit 128
fi
if [ "\${1:-}" = "push" ] && [ -n "\${RRFC_PUSH_OK:-}" ]; then
  exit 0
fi
if [ "\${1:-}" = "ls-remote" ] && [ -n "\${RRFC_LS_REMOTE_SHA:-}" ]; then
  printf '%s\t%s\n' "\$RRFC_LS_REMOTE_SHA" "\${3:-refs/heads/x}"
  exit 0
fi
exec "$REAL_GIT" "\$@"
EOF
chmod +x "$SHIMS/gh" "$SHIMS/npm" "$SHIMS/git"

# ---- fixture ----------------------------------------------------------
# make_fixture <dir> [poison-file]: bare origin + clone; main holds dist files
# with content "a"; the release branch changes CHANGELOG.md (a release-owned
# path) and optionally one file OUTSIDE the release-owned allowlist.
make_fixture() {
    local d="$1" poison="${2:-}" r
    git init -q --bare "$d/origin.git"
    git clone -q "$d/origin.git" "$d/repo" 2>/dev/null || true
    r="$d/repo"
    git -C "$r" checkout -qB main   # clone of an empty repo may default to another unborn branch
    git -C "$r" config user.email t@t
    git -C "$r" config user.name t
    git -C "$r" config commit.gpgsign false
    mkdir -p "$r/src/hooks/dist" "$r/plugins/ork/hooks/dist"
    printf 'a\n' > "$r/src/hooks/dist/a.mjs"
    printf 'a\n' > "$r/plugins/ork/hooks/dist/a.mjs"
    printf 'base\n' > "$r/README.md"
    git -C "$r" add -A
    git -C "$r" commit -qm base
    git -C "$r" push -q origin main
    git -C "$r" checkout -qb "$BRANCH"
    printf 'changelog\n' > "$r/CHANGELOG.md"
    git -C "$r" add CHANGELOG.md
    if [ -n "$poison" ]; then
        printf 'evil\n' > "$r/$poison"
        git -C "$r" add "$poison"
    fi
    git -C "$r" commit -qm release
    git -C "$r" push -q origin "$BRANCH"
    git -C "$r" checkout -q main
}

# run_arm <dir> [VAR=value ...] -> rc; output in $1/repo/step.out
run_arm() {
    local d="$1"; shift
    local rc=0
    (
        cd "$d/repo" \
        && env PATH="$SHIMS:$PATH" RRFC_BRANCH="$BRANCH" RRFC_ROOT="$d/repo" GH_TOKEN=fake-token \
           GITHUB_REPOSITORY=yonatangross/orchestkit "$@" \
           bash -e "$B" > "$d/step.out" 2>&1
    ) || rc=$?
    echo "$rc"
}

B="$WORK/step.sh"
extract_step "$WF/release-please.yml" "Rebuild hook bundles on the release PR" > "$B"
if [ ! -s "$B" ]; then
    echo "  FAIL: could not lift step body (renamed?)"
    exit 1
fi

# ---------------------------------------------------- 1. guard refusal
D="$WORK/guard"; make_fixture "$D" "evil.sh"
rc=$(run_arm "$D")
if [ "$rc" = "1" ] && grep -q "::error::" "$D/step.out"; then
    ok "guard refusal rc=1 ::error::"
else
    bad "guard refusal: rc=$rc want 1 with ::error:: $(tail -2 "$D/step.out")"
fi

# ---------------------------------------------------- 2. build failure
D="$WORK/buildfail"; make_fixture "$D"
rc=$(run_arm "$D" RRFC_BUILD_FAIL=1 RRFC_BUILD_CONTENT=b)
if [ "$rc" = "1" ] && grep -q "::error::npm run build failed" "$D/step.out"; then
    ok "build failure rc=1 ::error::"
else
    bad "build failure: rc=$rc want 1 with ::error:: $(tail -2 "$D/step.out")"
fi

# ------------------------------------------------ 2b. fetch failure
D="$WORK/fetchfail"; make_fixture "$D"
rc=$(run_arm "$D" RRFC_FETCH_FAIL=1)
if [ "$rc" = "1" ] && grep -q "::error::git fetch of main and" "$D/step.out"; then
    ok "fetch failure rc=1 ::error::"
else
    bad "fetch failure: rc=$rc want 1 with ::error:: $(tail -2 "$D/step.out")"
fi

# ------------------------------------ root npm ci removed (minimal set)
# The #4183 minimal set deleted the root npm ci (root has zero runtime
# dependencies; its npm prepare hooks were part of the widened window), so a
# ci failure outside src/hooks cannot fire and must not: the arm asserts the
# step still rebuilds normally with the shim's root-fail branch armed.
D="$WORK/ciroot"; make_fixture "$D"
rc=$(run_arm "$D" RRFC_NPM_CI_FAIL=root RRFC_BUILD_CONTENT=b RRFC_PUSH_OK=1)
if [ "$rc" = "0" ] && grep -q "::notice::Rebuilt hook bundles" "$D/step.out"; then
    ok "root npm ci never run (minimal set): root-fail branch is a no-op, rebuilt rc=0"
else
    bad "root npm ci arm: rc=$rc want 0 with rebuilt notice $(tail -2 "$D/step.out")"
fi

# ------------------------------------------- src/hooks npm ci failure
D="$WORK/cihooks"; make_fixture "$D"
rc=$(run_arm "$D" RRFC_NPM_CI_FAIL=hooks)
if [ "$rc" = "1" ] && grep -q "::error::npm ci (src/hooks) failed" "$D/step.out"; then
    ok "src/hooks npm ci failure rc=1 ::error::"
else
    bad "src/hooks npm ci failure: rc=$rc want 1 with ::error:: $(tail -2 "$D/step.out")"
fi

# --------------------------------- 3. push failure, remote head moved
D="$WORK/moved"; make_fixture "$D"
rc=$(run_arm "$D" RRFC_PUSH_FAIL=1 RRFC_BUILD_CONTENT=b RRFC_LS_REMOTE_SHA=0000000000000000000000000000000000000000)
if [ "$rc" = "0" ] && grep -q "::notice::" "$D/step.out" && grep -q "owns the rebuild" "$D/step.out"; then
    ok "push failure, branch moved rc=0 ::notice:: (new head owns the rebuild)"
else
    bad "push failure moved: rc=$rc want 0 with ::notice:: $(tail -2 "$D/step.out")"
fi

# -------------------------------- 4. push failure, remote head same
D="$WORK/samehead"; make_fixture "$D"
head_sha="$(git -C "$D/repo" rev-parse "origin/$BRANCH")"
rc=$(run_arm "$D" RRFC_PUSH_FAIL=1 RRFC_BUILD_CONTENT=b RRFC_LS_REMOTE_SHA="$head_sha")
if [ "$rc" = "1" ] && grep -q "::error::Could not push" "$D/step.out"; then
    ok "push failure, branch unchanged rc=1 ::error::"
else
    bad "push failure unchanged: rc=$rc want 1 with ::error:: $(tail -2 "$D/step.out")"
fi

# ---------------------------------------------------- 5. already current
D="$WORK/current"; make_fixture "$D"
rc=$(run_arm "$D" RRFC_BUILD_CONTENT=a)
if [ "$rc" = "0" ] && grep -q "::notice::Hook bundles already current" "$D/step.out"; then
    ok "already current rc=0 ::notice::"
else
    bad "already current: rc=$rc want 0 with ::notice:: $(tail -2 "$D/step.out")"
fi

# ------------------------- 6. bot push carries --no-verify (#4183, text arm)
# The 204s pre-push suite ran inside the bot's push and widened the race
# window; the step must skip it because the release PR's own CI runs the full
# suite. Mutation check: delete the flag from the workflow and this arm fails.
if grep -q 'git push --no-verify' "$B"; then
    ok "bot dist push carries --no-verify (pre-push hook skipped)"
else
    bad "bot dist push lost --no-verify; the pre-push suite would widen the race window again"
fi

# ------------------------- 7. no root-level full build (#4183, text arm)
# Every npm run build in the step must be scoped to src/hooks; a root-level
# full build is the ~65s the step no longer pays for. echo lines are filtered
# so the failure MESSAGE (which contains the words "npm run build failed") is
# not a false hit. Mutation check: re-add a root-level build line and this
# arm fails.
ROOT_BUILD="$(grep -n 'npm run build' "$B" | grep -v 'echo "::error' | grep -v 'src/hooks' || true)"
if [ -z "$ROOT_BUILD" ]; then
    ok "no root-level npm run build in the step (hooks-only build)"
else
    bad "step still runs a root-level npm run build: $ROOT_BUILD"
fi

# ------------------------- 8. the shipped rsync line mirrors contents (#4183)
# Exec arm, no shim: the line is LIFTED from the shipped step and run against
# a fixture tree. The source MUST carry the trailing slash (rsync copies the
# directory itself into the target otherwise, nesting dist/dist and leaving
# the tracked plugin files stale) and the excludes must match
# build-plugins.sh's dist-facing set (*.map, *.d.mts, *.d.ts). Mutation
# check: drop the source trailing slash and this arm fails.
RSYNC_LINE="$(grep 'rsync -a' "$B" | head -1 | sed 's/^if ! //; s/; then$//')"
if [ -z "$RSYNC_LINE" ]; then
    bad "shipped step carries no rsync line"
else
    D="$WORK/rsyncexec"; mkdir -p "$D/repo/src/hooks/dist" "$D/repo/plugins/ork/hooks/dist"
    # Distinct sizes and a backdated target model the CI reality: esbuild
    # writes fresh mtimes, the plugin copy is the committed file from before.
    # Same-size same-second files would trip rsync's size+mtime quick check
    # and test the fixture instead of the line.
    printf 'new-content-longer\n' > "$D/repo/src/hooks/dist/a.mjs"
    printf 'map\n'  > "$D/repo/src/hooks/dist/a.mjs.map"
    printf 'dmts\n' > "$D/repo/src/hooks/dist/a.d.mts"
    printf 'old\n'  > "$D/repo/plugins/ork/hooks/dist/a.mjs"
    touch -t 202601010000 "$D/repo/plugins/ork/hooks/dist/a.mjs"
    ( cd "$D/repo" && eval "$RSYNC_LINE" ) || true
    if [ "$(cat "$D/repo/plugins/ork/hooks/dist/a.mjs" 2>/dev/null)" = "new-content-longer" ] \
       && [ ! -d "$D/repo/plugins/ork/hooks/dist/dist" ] \
       && [ ! -e "$D/repo/plugins/ork/hooks/dist/a.mjs.map" ] \
       && [ ! -e "$D/repo/plugins/ork/hooks/dist/a.d.mts" ]; then
        ok "shipped rsync line mirrors contents, excludes map/d.mts, no nested dist"
    else
        bad "shipped rsync line did not mirror contents (stale plugin copy, nested dist, or excluded files copied): $RSYNC_LINE"
    fi
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
