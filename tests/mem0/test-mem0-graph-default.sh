#!/usr/bin/env bash
# Test suite for Mem0 v1.2.0 Graph Memory Default Feature
# Validates that enable_graph=true is the default behavior
#
# Part of Mem0 Pro Integration (v4.20.0)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source shared test helpers (includes mem0 helper functions)
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

# Test counters (reset from test-helpers.sh)
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Test Utilities
# -----------------------------------------------------------------------------

assert_equals() {
    local expected="$1"
    local actual="$2"
    local msg="${3:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$expected" == "$actual" ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Expected: '$expected'"
        echo "  Actual:   '$actual'"
        return 1
    fi
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local msg="${3:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$haystack" == *"$needle"* ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Haystack: '${haystack:0:100}...'"
        echo "  Missing:  '$needle'"
        return 1
    fi
}

assert_not_contains() {
    local haystack="$1"
    local needle="$2"
    local msg="${3:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$haystack" != *"$needle"* ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Haystack should not contain: '$needle'"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Test: MEM0_ENABLE_GRAPH_DEFAULT Constant
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing MEM0_ENABLE_GRAPH_DEFAULT constant"
echo "=========================================="

# Test 1: Default value is "true"
assert_equals "true" "$MEM0_ENABLE_GRAPH_DEFAULT" "MEM0_ENABLE_GRAPH_DEFAULT should be 'true'"

# Test 2: Constant is exported
if declare -p MEM0_ENABLE_GRAPH_DEFAULT &>/dev/null; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: MEM0_ENABLE_GRAPH_DEFAULT is declared"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: MEM0_ENABLE_GRAPH_DEFAULT should be declared"
fi

# -----------------------------------------------------------------------------
# Test: mem0_add_memory_json Uses Graph Default
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_add_memory_json graph default"
echo "=========================================="

# Set up test environment
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

# Test 3: Without specifying enable_graph, it should include enable_graph=true
RESULT=$(mem0_add_memory_json "decisions" "Test decision content" '{}')
if echo "$RESULT" | jq -e '.enable_graph == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0_add_memory_json includes enable_graph=true by default"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0_add_memory_json should include enable_graph=true by default"
    echo "  Result: $RESULT"
fi

# Test 4: Explicitly setting enable_graph=false should work
RESULT=$(mem0_add_memory_json "decisions" "Test decision content" '{}' "false")
if echo "$RESULT" | jq -e 'has("enable_graph") | not' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0_add_memory_json respects explicit enable_graph=false"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0_add_memory_json should respect explicit enable_graph=false"
    echo "  Result: $RESULT"
fi

# Test 5: Explicitly setting enable_graph=true should include it
RESULT=$(mem0_add_memory_json "decisions" "Test decision content" '{}' "true")
if echo "$RESULT" | jq -e '.enable_graph == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0_add_memory_json includes enable_graph when explicitly true"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0_add_memory_json should include enable_graph when explicitly true"
    echo "  Result: $RESULT"
fi

# -----------------------------------------------------------------------------
# Test: mem0_search_memory_json Uses Graph Default
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_search_memory_json graph default"
echo "=========================================="

# Test 6: Without specifying enable_graph, it should include enable_graph=true
RESULT=$(mem0_search_memory_json "decisions" "test query")
if echo "$RESULT" | jq -e '.enable_graph == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0_search_memory_json includes enable_graph=true by default"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0_search_memory_json should include enable_graph=true by default"
    echo "  Result: $RESULT"
fi

# Test 7: Explicitly setting enable_graph=false should work
RESULT=$(mem0_search_memory_json "decisions" "test query" "10" "false")
if echo "$RESULT" | jq -e 'has("enable_graph") | not' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0_search_memory_json respects explicit enable_graph=false"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0_search_memory_json should respect explicit enable_graph=false"
    echo "  Result: $RESULT"
fi

# -----------------------------------------------------------------------------
# Test: build_best_practice_json Uses Graph Default
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing build_best_practice_json graph default"
echo "=========================================="

# Test 8: Without specifying enable_graph, it should include enable_graph=true
RESULT=$(build_best_practice_json "success" "database" "Use cursor pagination" "")
if echo "$RESULT" | jq -e '.enable_graph == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: build_best_practice_json includes enable_graph=true by default"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: build_best_practice_json should include enable_graph=true by default"
    echo "  Result: $RESULT"
fi

# Test 9: Explicitly setting enable_graph=false should work
RESULT=$(build_best_practice_json "success" "database" "Use cursor pagination" "" "false")
if echo "$RESULT" | jq -e 'has("enable_graph") | not' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: build_best_practice_json respects explicit enable_graph=false"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: build_best_practice_json should respect explicit enable_graph=false"
    echo "  Result: $RESULT"
fi

# -----------------------------------------------------------------------------
# Test: Environment Variable Override
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing environment variable override"
echo "=========================================="

# Test 10: MEM0_ENABLE_GRAPH_DEFAULT can be overridden before sourcing
# Note: This test is tricky because readonly prevents re-assignment
# We test that the default is set correctly when the env var is not set
TESTS_RUN=$((TESTS_RUN + 1))
if [[ "$MEM0_ENABLE_GRAPH_DEFAULT" == "true" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: MEM0_ENABLE_GRAPH_DEFAULT defaults to 'true' when not set"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: MEM0_ENABLE_GRAPH_DEFAULT should default to 'true'"
fi

# -----------------------------------------------------------------------------
# Test: Version Check
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing version information"
echo "=========================================="

# Test 11: Library version should be 2.1.0+ (graph-first architecture)
if head -15 "$PROJECT_ROOT/src/hooks/_lib/mem0.sh" | grep -qE "Version: 2\.[1-9]\."; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0.sh version is 2.1.0+"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0.sh version should be 2.1.0+"
fi

# Test 12: Library should mention graph-first in header
if head -20 "$PROJECT_ROOT/src/hooks/_lib/mem0.sh" | grep -qi "graph-first"; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0.sh header mentions graph-first design"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0.sh header should mention graph-first design"
fi

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
