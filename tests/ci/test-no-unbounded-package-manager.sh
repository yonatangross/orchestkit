#!/usr/bin/env bash
# Test: no raw package-manager call survives on the CI-executed surface.
#
# Why this gate exists (#3557):
#
# #3550 removed every unbounded `apt-get update` it could find and its commit
# message recorded the result as "no raw apt-get call remains in .github/"
# (4c4c25cb1). That statement was true and the fix worked -- the job log for the
# fork PR that then hung shows the new helper doing its job in under a second:
#
#     ensure-system-deps: all requested tools present, skipping package manager
#
# Six seconds later the same job stalled for its entire cap inside a SECOND,
# unbounded `sudo apt-get update -qq` living in bin/ci-setup.sh. bin/ is outside
# `.github/`, so the sweep never looked there. Three jobs died at exactly their
# own `timeout-minutes` (15m16s, 15m16s, 30m15s) and an external contributor's
# first pull request could not merge.
#
# The lesson is not "we missed a file". It is that a sweep scoped by DIRECTORY
# cannot prove it covered the surface, and nothing failed when it hadn't. This
# test is the coverage proof: it greps the whole CI-executed surface, so the
# next call site added anywhere in it fails here instead of at a job cap.
#
# The allowlist is exactly one file: the helper that owns the bounded call.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Directories whose contents CI actually executes.
SEARCH_DIRS=(".github" "bin" "scripts")

# The one file allowed to call a package manager, because it bounds the call.
HELPER_REL=".github/scripts/ensure-system-deps.sh"

# Package-manager invocations that can block on a network mirror.
PATTERN='(apt-get|apt|yum|dnf|apk|brew|choco|pacman)[[:space:]]+(update|upgrade|install|add)'

FAILED=0
echo "=== Unbounded Package-Manager Call Test ==="
echo ""
echo "  surface   : ${SEARCH_DIRS[*]}"
echo "  allowlist : $HELPER_REL"
echo ""

# --- 1. the helper must exist ----------------------------------------------
echo "--- 1: the bounded helper is present ---"
if [ -f "$REPO_ROOT/$HELPER_REL" ]; then
    echo "  PASS: $HELPER_REL"
else
    echo "  FAIL: $HELPER_REL is missing — nothing bounds package installs"
    echo "RESULT: FAIL"
    exit 1
fi

# --- 2. that helper actually bounds its calls -------------------------------
# A helper that stopped using `timeout` would pass a naive grep gate while
# reintroducing the exact hang, so assert the watchdog rather than the filename.
echo ""
echo "--- 2: the helper bounds its package-manager calls ---"
if grep -qE '\b(timeout|gtimeout)\b' "$REPO_ROOT/$HELPER_REL"; then
    echo "  PASS: helper resolves a timeout watchdog"
else
    echo "  FAIL: helper no longer uses timeout/gtimeout — the bound is gone"
    FAILED=1
fi

# --- 3. no raw call anywhere else on the surface ----------------------------
# Collected into a file rather than piped into `while`: with `set -e` +
# `pipefail`, a `grep -v` that filters out every line of a directory exits 1 and
# kills the whole collection subshell. That is not hypothetical -- the first cut
# of this gate did exactly that, .github was the first directory searched, and
# the gate reported "0 raw call sites" against a tree that had one. A gate that
# cannot fail is worth less than no gate, so this path stays dumb and explicit.
echo ""
echo "--- 3: no raw package-manager call outside the helper ---"
HITS_FILE="$(mktemp)"
trap 'rm -f "$HITS_FILE"' EXIT

{
    cd "$REPO_ROOT" || exit 1
    for d in "${SEARCH_DIRS[@]}"; do
        [ -d "$d" ] || continue
        # -I skips binaries. Failure here means "no match", never "broken".
        grep -rInE "$PATTERN" "$d" 2>/dev/null || true
    done
} | grep -vE "^${HELPER_REL}:" \
  | awk -F: '{
        line = $0
        sub(/^[^:]*:[^:]*:/, "", line)          # drop path:lineno prefix
        if (line ~ /^[[:space:]]*#/) next        # a comment about apt is not a call
        if (line ~ /(echo|printf)[[:space:]]/) next  # help text naming a command is not a call
        print
    }' > "$HITS_FILE" || true

HITS="$(wc -l < "$HITS_FILE" | tr -d " ")"
if [ "$HITS" -eq 0 ]; then
    echo "  PASS: no raw package-manager call found"
else
    while IFS= read -r hit; do
        [ -n "$hit" ] || continue
        echo "  FAIL: $hit"
    done < "$HITS_FILE"
    FAILED=1
fi

echo ""
echo "=== Summary ==="
echo "  raw call sites found : $HITS"
echo ""

if [ "$FAILED" -ne 0 ]; then
    echo "RESULT: FAIL"
    echo ""
    echo "Route the install through the bounded helper instead:"
    echo "    bash $HELPER_REL <command> [<command>...]"
    echo ""
    echo "It skips the package manager when the tools are already installed and"
    echo "bounds the call with \`timeout\` when they are not, so a dead mirror"
    echo "fails in ~90s with a named cause instead of at the job's timeout cap."
    exit 1
fi

echo "RESULT: PASS"
exit 0
