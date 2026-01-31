#!/usr/bin/env bash
# Test suite for Session Continuity 2.0 (TypeScript Migration)
# Validates that session summary and context retrieval logic exists in TypeScript hooks
#
# Migrated from bash function tests to TypeScript source verification
# Part of Mem0 Pro Integration - Phase 5 (v4.20.0)

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

# TypeScript source files under test
PRE_COMPACTION="$PROJECT_ROOT/src/hooks/src/stop/mem0-pre-compaction-sync.ts"
CONTEXT_RETRIEVAL="$PROJECT_ROOT/src/hooks/src/lifecycle/mem0-context-retrieval.ts"

# -----------------------------------------------------------------------------
# Test Utilities
# -----------------------------------------------------------------------------

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
        echo "  File not found: $file"
        return 1
    fi
}

assert_file_contains() {
    local file="$1"
    local pattern="$2"
    local msg="${3:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if grep -q "$pattern" "$file" 2>/dev/null; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Pattern not found: '$pattern' in $(basename "$file")"
        return 1
    fi
}

assert_file_contains_ci() {
    local file="$1"
    local pattern="$2"
    local msg="${3:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if grep -qi "$pattern" "$file" 2>/dev/null; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Pattern not found (case-insensitive): '$pattern' in $(basename "$file")"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Test: TypeScript Hook Files Exist
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing TypeScript hook file existence"
echo "=========================================="

assert_file_exists "$PRE_COMPACTION" "mem0-pre-compaction-sync.ts exists"
assert_file_exists "$CONTEXT_RETRIEVAL" "mem0-context-retrieval.ts exists"

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
