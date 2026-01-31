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

run_test() {
    local name="$1"
    local script="$2"
    TOTAL=$((TOTAL + 1))

    if [ ! -f "$script" ]; then
        echo -e "  ${RED}SKIP${NC}: $name (script not found: $script)"
        FAILED=$((FAILED + 1))
        return 1
    fi

    if bash "$script" > /dev/null 2>&1; then
        echo -e "  ${GREEN}PASS${NC}: $name"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "  ${RED}FAIL${NC}: $name"
        FAILED=$((FAILED + 1))
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
run_test "Mem0 Security Tests" "$SCRIPT_DIR/test-mem0-security.sh"
run_test "Compound Command Tests" "$SCRIPT_DIR/test-compound-commands.sh"
run_test "Line Continuation Bypass Tests" "$SCRIPT_DIR/test-line-continuation-bypass.sh"
run_test "SQLite Injection Tests" "$SCRIPT_DIR/test-sqlite-injection.sh"

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
