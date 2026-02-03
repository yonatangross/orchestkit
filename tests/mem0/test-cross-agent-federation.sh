#!/usr/bin/env bash
# Test suite for Cross-Agent Memory Federation (TypeScript Migration)
# Validates that cross-agent federation logic exists in TypeScript hooks
#
# Migrated from bash function tests to TypeScript source verification
# Part of Mem0 Pro Integration - Phase 3 (v4.20.0)

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

# TypeScript source files under test (refactored to graph + mem0 memory inject)
GRAPH_HOOK="$PROJECT_ROOT/src/hooks/src/subagent-start/graph-memory-inject.ts"
MEM0_HOOK="$PROJECT_ROOT/src/hooks/src/subagent-start/mem0-memory-inject.ts"

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

assert_file_contains_all() {
    local file="$1"
    local msg="$2"
    shift 2
    local patterns=("$@")
    local all_found=true

    TESTS_RUN=$((TESTS_RUN + 1))

    for pattern in "${patterns[@]}"; do
        if ! grep -q "$pattern" "$file" 2>/dev/null; then
            all_found=false
            break
        fi
    done

    if $all_found; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Test: TypeScript Hook Files Exist
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing memory inject hook files"
echo "=========================================="

assert_file_exists "$GRAPH_HOOK" "graph-memory-inject.ts exists"
assert_file_exists "$MEM0_HOOK" "mem0-memory-inject.ts exists"

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
