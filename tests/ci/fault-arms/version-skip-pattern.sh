#!/usr/bin/env bash
set -uo pipefail
REPO="${REPO:?set by the fault-arms runner}"
H="${H:?set by the fault-arms runner}"
FIX="$H/fixtures/version-skip-pattern"

# Both consumers of scripts/ci/version-skip-pattern.sh (#1460): the pre-push
# hook and the "Check if version bump required" step of version-check.yml.
#   control: each consumer SKIPS a release-please branch name (exit 0, before
#            any git work, so no fixture repo history is needed).
#   fault:   the pattern file emptied. fault2: the pattern file missing.
# Every fault arm must FAIL: not skip, and not fall through to enforcement,
# which is what an empty ERE does on its own (bash reports it as no-match).

RP_BRANCH="release-please--branches--main"

# The workflow step body, cut from the YAML at the `run: |` under the step's
# name and de-indented, then run the way a runner runs it (bash -eo pipefail).
# awk, not a YAML parser: no dependency, and the step is a plain literal block.
extract_step() {
    awk '
        /^      - name: Check if version bump required$/ { found=1; next }
        found && /^        run: \|$/ { body=1; next }
        body && /^      - name: / { exit }
        body { sub(/^          /, ""); print }
    ' "$REPO/.github/workflows/version-check.yml"
}
mkdir -p "$FIX"
extract_step > "$FIX/step.sh"
if [[ ! -s "$FIX/step.sh" ]]; then
    echo "could not extract the version-check step body" >&2
    printf 'RESULT gate=%s hook_control=na wf_control=1 hook_fault=na wf_fault=na\n' "version-skip-pattern"
    exit 0
fi

# Assert the DECISION, not the hook's exit code (#4024).
#
# This used to be `bash pre-push ...; hook_control=$?`, requiring exit 0. That
# worked only because pre-push:65 exited 0 immediately for any branch matching
# the pattern, so "exit 0" and "the skip fired" were the same observation.
#
# #4024 fixed that early exit: the version gate now stands down while the rest
# of the hook still runs. So the hook's exit code became the exit code of the
# ENTIRE local test suite, and requiring 0 from it would make this arm assert
# "every local test passes inside this CI job" -- which is not what a gate about
# VERSION_SKIP_PATTERN is for, and is not something a manifest-checking job is
# provisioned to satisfy. Measured on a release-please-named branch: exit 0
# locally with all ten phases green, but hook_control=1 in CI with the whole
# 12-probe file finishing in 11s, far too fast for the suite to have run.
#
# So read the skip decision out of the hook's own output. That is exactly what
# this gate protects, it is stable regardless of what the suite does, and it
# still goes red if the pattern file stops being honoured.
SKIP_MARKER='Skipping version check for'

run_hook() {  # $1 = repo root to run in
    local out
    out=$(printf 'refs/heads/%s 0000 refs/heads/%s 0000\n' "$RP_BRANCH" "$RP_BRANCH" \
        | ( cd "$1" && bash bin/git-hooks/pre-push origin https://example.invalid/x.git ) 2>&1)
    printf '%s\n' "$out" >&2
    # 0 = the version gate stood down for this branch, which is the contract.
    printf '%s' "$out" | grep -qF "$SKIP_MARKER"
}
run_step() {  # $1 = checkout root to run in
    ( cd "$1" && BRANCH_NAME="$RP_BRANCH" GITHUB_OUTPUT="$FIX/gh-output" bash -eo pipefail "$FIX/step.sh" ) >&2
}

# control: the real files, in the real checkout.
run_hook "$REPO"; hook_control=$?
run_step "$REPO"; wf_control=$?

# The hook resolves PROJECT_ROOT with `git rev-parse --show-toplevel`, so its
# fixture must be a repository. Neither arm reaches any git command past that.
build_fixture() {  # $1 = dir
    rm -rf "$1"; mkdir -p "$1/scripts/ci" "$1/bin/git-hooks"
    git init -q "$1"
    cp "$REPO/bin/git-hooks/pre-push" "$1/bin/git-hooks/pre-push"
}

# fault: pattern file present but empty.
build_fixture "$FIX/empty"
: > "$FIX/empty/scripts/ci/version-skip-pattern.sh"
run_hook "$FIX/empty"; hook_fault=$?
run_step "$FIX/empty"; wf_fault=$?

# fault2: pattern file missing.
build_fixture "$FIX/missing"
run_hook "$FIX/missing"; hook_fault2=$?
run_step "$FIX/missing"; wf_fault2=$?

printf 'RESULT gate=%s hook_control=%s wf_control=%s hook_fault=%s wf_fault=%s hook_fault2=%s wf_fault2=%s\n' \
    "version-skip-pattern" "$hook_control" "$wf_control" "$hook_fault" "$wf_fault" "$hook_fault2" "$wf_fault2"
