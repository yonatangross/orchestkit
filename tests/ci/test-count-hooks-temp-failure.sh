#!/usr/bin/env bash
# Test: bin/count-hooks.sh must report the same counts whether or not it can
# create a scratch file, and must still fail loudly on a genuinely broken grep.
#
# Why this exists (#3564):
#
# count_run_hook_lines() redirected grep's stderr into a file from a bare
# `mktemp`. When the system temp dir denied the write, `errfile` came back empty,
# `2>""` failed as a redirect, grep never ran, and rc came back 1 -- which this
# function is REQUIRED to read as "no match" -> 0, because zero agent-scoped
# hooks is a legitimate state. So a real SKILL count of 21 became a silent 0:
#
#     healthy            GLOBAL=150 AGENT=0 SKILL=21 TOTAL=171
#     mktemp denied      GLOBAL=150 AGENT=0 SKILL=0  TOTAL=150
#
# validate-counts.sh then reported "declared 171, actual 150" against a tree with
# no drift, and pre-commit blocked every commit. The dangerous repair is the
# obvious one: edit the manifest down to 150 and introduce real drift.
#
# CI cannot catch this on its own -- its temp dir works. The trigger is a
# sandboxed or hardened environment, so the failure has to be injected. Note that
# `TMPDIR=/unwritable` does NOT work as an injection: macOS `mktemp` called with
# no template ignores TMPDIR entirely and goes to /var/folders. A PATH shim is
# the only portable way to drive it.
#
# The assertion is equality against the healthy run, not a hardcoded 171, so this
# test keeps working as the real hook count changes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COUNTER="$REPO_ROOT/bin/count-hooks.sh"

FAILED=0
echo "=== count-hooks.sh Temp-Failure Test ==="
echo ""

if [ ! -x "$COUNTER" ] && [ ! -f "$COUNTER" ]; then
    echo "FAIL: missing $COUNTER"
    exit 1
fi

# A test about a denied mktemp must not itself die on a denied mktemp. Bare
# `mktemp` writes to the system temp dir; an explicit TEMPLATE is what makes
# TMPDIR effective, because macOS mktemp with no template ignores TMPDIR and
# goes to /var/folders regardless. Falls back beside this script so the suite
# still runs in a sandboxed shell.
scratch_dir() {
    local d
    for base in "${TMPDIR:-/tmp}" /tmp "$SCRIPT_DIR/.tmp"; do
        [ -n "$base" ] || continue
        mkdir -p "$base" 2>/dev/null || continue
        if d=$(mktemp -d "${base%/}/ork-test.XXXXXX" 2>/dev/null) && [ -w "$d" ]; then
            printf '%s' "$d"; return 0
        fi
    done
    echo "FAIL: no writable scratch dir (TMPDIR, /tmp, $SCRIPT_DIR/.tmp)" >&2
    return 1
}

SHIM_DIR="$(scratch_dir)"
trap 'rm -rf "$SHIM_DIR"' EXIT

# --- 1. healthy baseline ----------------------------------------------------
echo "--- 1: healthy run produces a non-zero total ---"
HEALTHY="$(bash "$COUNTER")"
echo "  $HEALTHY"

HEALTHY_TOTAL="$(printf '%s' "$HEALTHY" | sed -n 's/.*TOTAL=\([0-9]*\).*/\1/p')"
if [ -n "$HEALTHY_TOTAL" ] && [ "$HEALTHY_TOTAL" -gt 0 ]; then
    echo "  PASS: TOTAL=$HEALTHY_TOTAL"
else
    echo "  FAIL: could not read a positive TOTAL from the healthy run"
    FAILED=1
fi

# --- 2. identical output when mktemp is denied ------------------------------
echo ""
echo "--- 2: a denied mktemp must not change any subcount ---"
cat > "$SHIM_DIR/mktemp" <<'SHIM'
#!/bin/sh
echo "mktemp: mkstemp failed on /var/folders/x/T/tmp.XXXX: Operation not permitted" >&2
exit 1
SHIM
chmod +x "$SHIM_DIR/mktemp"

DENIED="$(PATH="$SHIM_DIR:$PATH" bash "$COUNTER" 2>/dev/null || true)"
echo "  $DENIED"

if [ "$DENIED" = "$HEALTHY" ]; then
    echo "  PASS: identical to the healthy run"
else
    echo "  FAIL: counts changed when the temp dir was unwritable"
    echo "        healthy: $HEALTHY"
    echo "        denied : $DENIED"
    echo "        This is #3564: a scratch-file failure silently zeroed a subcount."
    FAILED=1
fi

rm -f "$SHIM_DIR/mktemp"

# --- 3. a genuinely broken grep must still fail loudly ----------------------
# The counterpart risk: making the function tolerant of temp failure must not
# make it tolerant of grep itself dying. rc>=2 is a real error and has to
# propagate, or a broken grep becomes the same silent zero by another route.
echo ""
echo "--- 3: grep exiting >=2 still fails loudly ---"
cat > "$SHIM_DIR/grep" <<'SHIM'
#!/bin/sh
echo "grep: simulated catastrophic failure" >&2
exit 2
SHIM
chmod +x "$SHIM_DIR/grep"

set +e
BROKEN_OUT="$(PATH="$SHIM_DIR:$PATH" bash "$COUNTER" 2>&1)"
BROKEN_RC=$?
set -e

if [ "$BROKEN_RC" -ne 0 ]; then
    echo "  PASS: exited $BROKEN_RC instead of reporting a count"
else
    echo "  FAIL: exited 0 with '$BROKEN_OUT' despite grep failing hard"
    FAILED=1
fi

echo ""
echo "=== Summary ==="
echo "  healthy TOTAL : ${HEALTHY_TOTAL:-unknown}"
echo ""

if [ "$FAILED" -ne 0 ]; then
    echo "RESULT: FAIL"
    exit 1
fi

echo "RESULT: PASS"
exit 0
