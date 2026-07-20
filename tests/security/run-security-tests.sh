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

run_test "Command Injection Tests" "$SCRIPT_DIR/test-command-injection.sh"
run_test "JQ Injection Tests" "$SCRIPT_DIR/test-jq-injection.sh"
run_test "Path Traversal Tests" "$SCRIPT_DIR/test-path-traversal.sh"
run_test "Unicode Attack Tests" "$SCRIPT_DIR/test-unicode-attacks.sh"
run_test "Symlink Attack Tests" "$SCRIPT_DIR/test-symlink-attacks.sh"
run_test "Input Validation Tests" "$SCRIPT_DIR/test-input-validation.sh"
run_test "Additional Security Tests" "$SCRIPT_DIR/test-additional-security.sh"
run_test "Compound Command Tests" "$SCRIPT_DIR/test-compound-commands.sh"
run_test "Network Egress Guard Tests" "$SCRIPT_DIR/test-egress-guard.sh"
run_test "Line Continuation Bypass Tests" "$SCRIPT_DIR/test-line-continuation-bypass.sh"
run_test "SQLite Injection Tests" "$SCRIPT_DIR/test-sqlite-injection.sh"
run_test "JSON Island Breakout Tests" "$SCRIPT_DIR/test-json-island-breakout.sh"
run_test "Secret Scanning Tests" "$SCRIPT_DIR/test-secret-scanning.sh"
run_test "MCP Deny Case Guidance" "$SCRIPT_DIR/test-mcp-deny-case.sh"
run_test "Packaging Leak Prevention" "$SCRIPT_DIR/test-packaging-leaks.sh"
run_test "npm audit gate" "$SCRIPT_DIR/test-npm-audit.sh"
run_test "Dependency-Confusion Package Refs" "$SCRIPT_DIR/test-dependency-confusion.sh"

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
