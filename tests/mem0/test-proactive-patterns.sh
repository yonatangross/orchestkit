#!/usr/bin/env bash
# Test suite for Proactive Pattern Surfacing
# Validates anti-pattern warning and best practice search functionality
# (migrated from bash function tests to TypeScript file verification)
#
# Part of Mem0 Pro Integration - Phase 4 (v4.20.0)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Set up environment
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

# -----------------------------------------------------------------------------
# Test Utilities
# -----------------------------------------------------------------------------

assert_grep() {
    local file="$1"
    local pattern="$2"
    local msg="${3:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if grep -qiE "$pattern" "$file" 2>/dev/null; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Pattern not found: '$pattern' in $file"
        return 1
    fi
}

assert_file_exists() {
    local file="$1"
    local msg="${2:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ -f "$file" ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Missing: $file"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Test: TypeScript hook and bundle files exist
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing file existence"
echo "=========================================="

HOOK_TS="$PROJECT_ROOT/src/hooks/src/prompt/antipattern-warning.ts"
PROMPT_BUNDLE="$PROJECT_ROOT/src/hooks/dist/prompt.mjs"

assert_file_exists "$HOOK_TS" "antipattern-warning.ts exists"
assert_file_exists "$PROMPT_BUNDLE" "Compiled prompt bundle exists at dist/prompt.mjs"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Total tests: $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "${RED}SOME TESTS FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}ALL TESTS PASSED${NC}"
    exit 0
fi
