#!/bin/bash
# Security Test Runner
# Runs all security tests for OrchestKit
#
# Usage: ./run-security-tests.sh
#
# Exit codes: 0 = all pass, 1 = failures found

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

echo ""
echo -e "${BOLD}OrchestKit Security Tests (CRITICAL - ZERO TOLERANCE)${NC}"
echo "============================================================================"
echo ""

PASSED=0
FAILED=0
TOTAL=0
FAILED_LOGS=()

run_test() {
    local name="$1"
    local script="$2"
    TOTAL=$((TOTAL + 1))

    if [ ! -f "$script" ]; then
        echo -e "  ${RED}SKIP${NC}: $name (script not found: $script)"
        FAILED=$((FAILED + 1))
        return 1
    fi

    # Capture output instead of discarding it. Sending a failing test's output
    # to /dev/null made every failure undiagnosable from the suite: the runner
    # reported a bare "FAIL: <name>" and you had to re-run each script by hand
    # to learn anything. On failure we now echo the tail of the real output.
    local log
    log="$(mktemp -t ork-sec-XXXXXX)"

    if bash "$script" > "$log" 2>&1; then
        echo -e "  ${GREEN}PASS${NC}: $name"
        PASSED=$((PASSED + 1))
        rm -f "$log"
        return 0
    else
        local code=$?
        echo -e "  ${RED}FAIL${NC}: $name (exit $code)"
        echo "  ---- last 20 lines of $(basename "$script") ----"
        sed -e 's/^/  | /' "$log" | tail -20
        echo "  ---- end ----"
        FAILED=$((FAILED + 1))
        FAILED_LOGS+=("$name|$log")
        return 1
    fi
}

# --mutate: after the normal run, also prove each file CAN fail (mutation-gate.sh).
#
# DEFAULT OFF, and parsed before discovery so it never reaches the glob. A green
# suite is not evidence a test bites, but the proof costs a second process per
# file, so `npm run test:security` keeps its current cost and CI runs the gate as
# its own step (.github/workflows/ci.yml, security-tests job).
MUTATE=0
for arg in "$@"; do
    case "$arg" in
        --mutate) MUTATE=1 ;;
        *) echo "unknown argument: $arg" >&2; exit 2 ;;
    esac
done

# Discover test files by glob rather than a hand-maintained list.
#
# The list this replaces named 17 of the 18 files on disk. test-npm-audit-coverage.sh
# was never added, so local pre-push never ran it while CI did — CI discovers the
# directory with a glob (.github/workflows/ci.yml:419 -> scripts/ci/run-tests.sh).
# A file that exists but is in no roster is a gate that silently does not run, and
# a hand-list guarantees the 19th file repeats it. Globbing here makes local and CI
# read the same source of truth: the filesystem.
#
# Sorted for a stable, reproducible run order.
shopt -s nullglob
SECURITY_TESTS=("$SCRIPT_DIR"/test-*.sh)
shopt -u nullglob

if [ ${#SECURITY_TESTS[@]} -eq 0 ]; then
    echo -e "${RED}No test-*.sh files found in $SCRIPT_DIR — refusing to report success${NC}"
    exit 1
fi

for test_file in $(printf '%s\n' "${SECURITY_TESTS[@]}" | sort); do
    # Derive a readable name: test-command-injection.sh -> "command injection"
    test_name="$(basename "$test_file" .sh)"
    test_name="${test_name#test-}"
    test_name="${test_name//-/ }"
    run_test "$test_name" "$test_file"
done

if [ "$MUTATE" -eq 1 ]; then
    if ! bash "$SCRIPT_DIR/mutation-gate.sh"; then
        FAILED=$((FAILED + 1))
    fi
fi

echo ""
echo "============================================================================"
echo -e "  Total: $TOTAL  |  Passed: ${GREEN}$PASSED${NC}  |  Failed: ${RED}$FAILED${NC}"

if [ "$FAILED" -gt 0 ]; then
    echo ""
    echo -e "  ${RED}${BOLD}SECURITY TESTS FAILED - DO NOT MERGE${NC}"
    echo "============================================================================"
    exit 1
else
    echo ""
    echo -e "  ${GREEN}${BOLD}All security tests passed${NC}"
    echo "============================================================================"
    exit 0
fi
