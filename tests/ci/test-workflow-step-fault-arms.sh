#!/usr/bin/env bash
# Test: inline `run:` steps that the 2026-09-06 gate-fault-arm audit found
# passing on ABSENT input now fail on it, and still pass on present input.
#
# Each step body is lifted LIVE from the workflow YAML by step name (the same
# idea as tests/ci/test-playground-gate-inertness.sh lifting INERT), so this
# test drifts with the shipped step rather than with a pasted copy. Bodies run
# under `bash -e` (what GitHub uses when no shell: key is set) or
# `bash -eo pipefail` (explicit shell: bash), matching each step.
#
# Measured before the fix (docs/audits/gate-fault-arm-audit-2026-09-06.md):
#   Validate no symlinks            missing plugins/            exit 0
#   Check for uncommitted build ... roster path missing         exit 0
#   Check hook bundles ...          DIST dirs missing           exit 0
#   Check playground is published   zero .html under DOCS_DIR   exit 0
#   Check hooks.json hook paths     hooks.json is {}            exit 0
#   Check if version bump required  empty diff -> skip=true     exit 0
#   Fail if PR touches governed     empty changed-file list     exit 0
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WF="$REPO_ROOT/.github/workflows"

echo "=== workflow inline-step fault arms ==="
echo ""

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-wf-steps.XXXXXX")"
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
        state == 1 && $0 ~ "^ *- name: " { exit }
        state == 2 {
            if ($0 ~ /^ *$/) { print ""; next }
            if (indent($0) <= runind) exit
            print substr($0, runind + 3)
        }
    ' "$1"
}

# run_step <body-file> <shell-flags> <cwd> [VAR=value ...] -> prints rc
run_step() {
    local body="$1" flags="$2" cwd="$3"; shift 3
    local rc=0
    # shellcheck disable=SC2086  # flags is a deliberate word-split list ("-e", "-eo pipefail")
    ( cd "$cwd" && env "$@" bash $flags "$body" >"$body.out" 2>&1 ) || rc=$?
    echo "$rc"
}

assert_body() { # <name> <file>
    if [[ -s "$2" ]]; then ok "lifted step body: $1"; else bad "could not lift step body: $1 (renamed?)"; return 1; fi
}

git_init() { # <dir>
    git -C "$1" init -q -b main
    git -C "$1" config user.email t@t; git -C "$1" config user.name t
    git -C "$1" config commit.gpgsign false
}

# ---------------------------------------------------------------- 1. symlinks
B="$WORK/symlinks.sh"; extract_step "$WF/ci.yml" "Validate no symlinks" > "$B"
if assert_body "Validate no symlinks" "$B"; then
    mkdir -p "$WORK/sym/control/plugins/ork" "$WORK/sym/fault" "$WORK/sym/fault2/plugins"
    echo x > "$WORK/sym/control/plugins/ork/f"
    ln -s /nonexistent "$WORK/sym/fault2/plugins/link"
    [[ "$(run_step "$B" -e "$WORK/sym/control")" == "0" ]] && ok "symlinks control (clean plugins/) exits 0" || bad "symlinks control should exit 0"
    [[ "$(run_step "$B" -e "$WORK/sym/fault")" != "0" ]] && ok "symlinks fault (plugins/ missing) exits non-zero" || bad "symlinks fault exited 0 on missing plugins/"
    [[ "$(run_step "$B" -e "$WORK/sym/fault2")" != "0" ]] && ok "symlinks fault2 (a symlink) exits non-zero" || bad "symlinks fault2 exited 0 with a symlink present"
fi

# ---------------------------------------------------------- 2. build drift
B="$WORK/drift.sh"; extract_step "$WF/ci.yml" "Check for uncommitted build changes" > "$B"
if assert_body "Check for uncommitted build changes" "$B"; then
    for arm in control fault fault2; do
        # The fixture mirrors the roster: every positive entry must exist, so a
        # roster addition (docs/site/public/lab/, #4049) is a fixture addition.
        d="$WORK/drift/$arm"; mkdir -p "$d/plugins/ork/hooks/dist" "$d/docs/site/lib/generated" "$d/docs/site/public/lab"
        echo r > "$d/README.md"; echo p > "$d/plugin.json"; echo g > "$d/docs/site/lib/generated/x.ts"; echo h > "$d/plugins/ork/hooks/dist/x.mjs"; echo l > "$d/docs/site/public/lab/x.html"
        git_init "$d"; git -C "$d" add -A; git -C "$d" commit -qm init
    done
    rm -rf "$WORK/drift/fault/docs/site/lib/generated"   # roster path gone, index unchanged? no: make it truly absent from both
    git -C "$WORK/drift/fault" rm -rq docs/site/lib/generated && git -C "$WORK/drift/fault" commit -qm "drop generated dir"
    echo changed > "$WORK/drift/fault2/README.md"
    [[ "$(run_step "$B" -e "$WORK/drift/control")" == "0" ]] && ok "build-drift control (clean roster) exits 0" || bad "build-drift control should exit 0"
    [[ "$(run_step "$B" -e "$WORK/drift/fault")" != "0" ]] && ok "build-drift fault (roster path missing) exits non-zero" || bad "build-drift fault exited 0 with a roster path missing"
    [[ "$(run_step "$B" -e "$WORK/drift/fault2")" != "0" ]] && ok "build-drift fault2 (uncommitted change) exits non-zero" || bad "build-drift fault2 exited 0 with drift"
fi

# ------------------------------------------------------- 3. hook bundles
B="$WORK/bundles.sh"; extract_step "$WF/ci.yml" "Check hook bundles are release-owned (#3578)" > "$B"
if assert_body "Check hook bundles are release-owned (#3578)" "$B"; then
    for arm in control fault fault2; do
        d="$WORK/bundles/$arm"; mkdir -p "$d/src/hooks/dist" "$d/plugins/ork/hooks/dist"
        echo a > "$d/src/hooks/dist/a.mjs"; echo a > "$d/plugins/ork/hooks/dist/a.mjs"; echo r > "$d/README.md"
        git_init "$d"; git -C "$d" add -A; git -C "$d" commit -qm base
        echo r2 > "$d/README.md"
        [[ $arm == fault2 ]] && echo b > "$d/src/hooks/dist/a.mjs"
        git -C "$d" add -A; git -C "$d" commit -qm feature
    done
    rm -rf "$WORK/bundles/fault/src/hooks/dist" "$WORK/bundles/fault/plugins/ork/hooks/dist"
    for arm in control fault fault2; do
        d="$WORK/bundles/$arm"; base=$(git -C "$d" rev-parse HEAD~1)
        rc=$(run_step "$B" "-u" "$d" HEAD_REF=feat/x BASE_SHA="$base")
        case $arm in
            control) [[ "$rc" == "0" ]] && ok "hook-bundles control (dist untouched) exits 0" || bad "hook-bundles control exited $rc" ;;
            fault)   [[ "$rc" != "0" ]] && ok "hook-bundles fault (DIST dirs missing) exits non-zero" || bad "hook-bundles fault exited 0 with DIST dirs missing" ;;
            fault2)  [[ "$rc" != "0" ]] && ok "hook-bundles fault2 (bundle changed) exits non-zero" || bad "hook-bundles fault2 exited 0 with a changed bundle" ;;
        esac
    done
fi

# -------------------------------------------------- 4. playground published
B="$WORK/lab.sh"; extract_step "$WF/ci.yml" "Check playground is published to the Lab" > "$B"
if assert_body "Check playground is published to the Lab" "$B"; then
    # One fragment per entry under docs/site/lab-manifest/ (#4049); the step
    # globs the directory, so the fixture writes a fragment, not the old file.
    for arm in control fault fault2; do
        d="$WORK/lab/$arm"; mkdir -p "$d/docs/feat--x" "$d/docs/site/lab-manifest"
        printf '{"slug":"a","source":"docs/feat--x/a.html"}' > "$d/docs/site/lab-manifest/a.json"
        [[ $arm == control ]] && echo '<p>' > "$d/docs/feat--x/a.html"
        [[ $arm == fault2 ]] && echo '<p>' > "$d/docs/feat--x/b.html"
    done
    [[ "$(run_step "$B" -e "$WORK/lab/control" HEAD_REF=feat/x RUNNER_TEMP="$WORK/lab")" == "0" ]] && ok "lab-manifest control (page registered) exits 0" || bad "lab-manifest control should exit 0"
    [[ "$(run_step "$B" -e "$WORK/lab/fault" HEAD_REF=feat/x RUNNER_TEMP="$WORK/lab")" != "0" ]] && ok "lab-manifest fault (zero .html) exits non-zero" || bad "lab-manifest fault exited 0 with zero .html"
    [[ "$(run_step "$B" -e "$WORK/lab/fault2" HEAD_REF=feat/x RUNNER_TEMP="$WORK/lab")" != "0" ]] && ok "lab-manifest fault2 (page with no fragment) exits non-zero" || bad "lab-manifest fault2 exited 0 with an unregistered page"
fi

# -------------------------------------------------- 5. hooks.json hook paths
B="$WORK/hookpaths.sh"; extract_step "$WF/plugin-validation.yml" "Check hooks.json hook paths" > "$B"
if assert_body "Check hooks.json hook paths" "$B"; then
    for arm in control fault fault2; do
        d="$WORK/hp/$arm"; mkdir -p "$d/src/hooks"; echo x > "$d/src/hooks/x.mjs"
        case $arm in
            control) printf '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"node","args":["${CLAUDE_PLUGIN_ROOT}/hooks/x.mjs"]}]}]}}' > "$d/src/hooks/hooks.json" ;;
            fault)   printf '{}' > "$d/src/hooks/hooks.json" ;;
            fault2)  printf '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"node","args":["${CLAUDE_PLUGIN_ROOT}/hooks/missing.mjs"]}]}]}}' > "$d/src/hooks/hooks.json" ;;
        esac
    done
    [[ "$(run_step "$B" "-eo pipefail" "$WORK/hp/control")" == "0" ]] && ok "hook-paths control (one resolvable hook) exits 0" || bad "hook-paths control should exit 0: $(tail -2 "$B.out")"
    [[ "$(run_step "$B" "-eo pipefail" "$WORK/hp/fault")" != "0" ]] && ok "hook-paths fault (hooks.json is {}) exits non-zero" || bad "hook-paths fault exited 0 on an empty hooks.json"
    [[ "$(run_step "$B" "-eo pipefail" "$WORK/hp/fault2")" != "0" ]] && ok "hook-paths fault2 (missing script) exits non-zero" || bad "hook-paths fault2 exited 0 with a missing script"
fi

# ----------------------------------------------- 6. version bump required
B="$WORK/vbump.sh"; extract_step "$WF/version-check.yml" "Check if version bump required" > "$B"
if assert_body "Check if version bump required" "$B"; then
    d="$WORK/vb"; mkdir -p "$d"; git_init "$d"; echo a > "$d/a.js"; git -C "$d" add -A; git -C "$d" commit -qm base
    # The step sources scripts/ci/version-skip-pattern.sh from the checkout
    # (#1460); the emptied and missing states of that file are exercised by
    # tests/ci/fault-arms/version-skip-pattern.sh, so here it is simply present.
    mkdir -p "$d/scripts/ci"; cp "$REPO_ROOT/scripts/ci/version-skip-pattern.sh" "$d/scripts/ci/"
    git -C "$d" update-ref refs/remotes/origin/main HEAD
    git -C "$d" checkout -qb feature/x; echo b > "$d/a.js"; git -C "$d" commit -qam change
    : > "$WORK/vb.out"
    rc=$(run_step "$B" -e "$d" BRANCH_NAME=feature/x GITHUB_OUTPUT="$WORK/vb.out")
    if [[ "$rc" == "0" ]] && grep -q 'skip=false' "$WORK/vb.out"; then ok "version-bump control (code change) exits 0 with skip=false"; else bad "version-bump control: rc=$rc output=$(cat "$WORK/vb.out")"; fi
    git -C "$d" update-ref refs/remotes/origin/main HEAD   # now origin/main == HEAD: empty diff
    : > "$WORK/vb2.out"
    rc=$(run_step "$B" -e "$d" BRANCH_NAME=feature/x GITHUB_OUTPUT="$WORK/vb2.out")
    if [[ "$rc" != "0" ]] && ! grep -q 'skip=true' "$WORK/vb2.out"; then ok "version-bump fault (empty diff) exits non-zero and does not skip"; else bad "version-bump fault: rc=$rc output=$(cat "$WORK/vb2.out")"; fi
fi

# ----------------------------------------------- 7. release-please governed
B="$WORK/rpg.sh"; extract_step "$WF/release-please-guard.yml" "Fail if PR touches governed files" > "$B"
if assert_body "Fail if PR touches governed files" "$B"; then
    # The step writes to literal /tmp/; rewrite to the scratch dir for the sandbox.
    sed -i.bak "s#/tmp/#$WORK/rpg-tmp/#g" "$B"; rm -f "$B.bak"
    d="$WORK/rpg"; mkdir -p "$d" "$WORK/rpg-tmp"; git_init "$d"; echo r > "$d/README.md"; git -C "$d" add -A; git -C "$d" commit -qm base
    git -C "$d" update-ref refs/remotes/origin/main HEAD
    printf 'CHANGELOG.md\nversion.txt\n' > "$WORK/rpg-tmp/governed.txt"; : > "$WORK/rpg-tmp/governed-fields.txt"
    printf 'README.md\n' > "$WORK/rpg-tmp/changed.txt"
    [[ "$(run_step "$B" -e "$d" BASE_REF=main)" == "0" ]] && ok "governed control (README only) exits 0" || bad "governed control should exit 0: $(tail -2 "$B.out")"
    printf 'CHANGELOG.md\n' > "$WORK/rpg-tmp/changed.txt"
    [[ "$(run_step "$B" -e "$d" BASE_REF=main)" != "0" ]] && ok "governed control2 (CHANGELOG.md touched) exits non-zero" || bad "governed control2 exited 0 on a governed file"
    : > "$WORK/rpg-tmp/changed.txt"
    [[ "$(run_step "$B" -e "$d" BASE_REF=main)" != "0" ]] && ok "governed fault (empty changed list) exits non-zero" || bad "governed fault exited 0 on an empty changed-file list"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
