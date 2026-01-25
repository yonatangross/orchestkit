#!/usr/bin/env bash
# Test suite for Proactive Pattern Surfacing
# Validates anti-pattern warning and best practice search functionality
#
# Part of Mem0 Pro Integration - Phase 4 (v4.20.0)

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

# Set up environment
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

# -----------------------------------------------------------------------------
# Test Utilities
# -----------------------------------------------------------------------------

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
        echo "  Missing: '$needle'"
        return 1
    fi
}

assert_json_valid() {
    local json="$1"
    local msg="${2:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$json" | jq -e '.' >/dev/null 2>&1; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Invalid JSON: $json"
        return 1
    fi
}

assert_json_field() {
    local json="$1"
    local field="$2"
    local expected="$3"
    local msg="${4:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    local actual
    actual=$(echo "$json" | jq -r "$field" 2>/dev/null)

    if [[ "$actual" == "$expected" ]]; then
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

# -----------------------------------------------------------------------------
# Test: mem0_search_by_outcome_json Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_search_by_outcome_json"
echo "=========================================="

# Test search for failed outcomes
RESULT=$(mem0_search_by_outcome_json "best-practices" "pagination" "failed")
assert_json_valid "$RESULT" "Search by outcome returns valid JSON"
assert_contains "$RESULT" "outcome" "Search includes outcome filter"
assert_contains "$RESULT" "failed" "Search filters for failed outcome"

if echo "$RESULT" | jq -e '.enable_graph == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Search by outcome has enable_graph=true"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Search by outcome should have enable_graph=true"
fi

# Test search for success outcomes
RESULT=$(mem0_search_by_outcome_json "best-practices" "cursor pagination" "success")
assert_contains "$RESULT" "success" "Search filters for success outcome"

# -----------------------------------------------------------------------------
# Test: mem0_search_antipatterns_json Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_search_antipatterns_json"
echo "=========================================="

# Test basic anti-pattern search
RESULT=$(mem0_search_antipatterns_json "offset pagination")
assert_json_valid "$RESULT" "Antipattern search returns valid JSON"
assert_contains "$RESULT" "failed" "Antipattern search filters for failed outcome"

# Test with category
RESULT=$(mem0_search_antipatterns_json "pagination" "pagination")
assert_contains "$RESULT" "pagination" "Antipattern search includes category filter"
assert_contains "$RESULT" "failed" "Antipattern search with category still filters failed"

# Test limit parameter
RESULT=$(mem0_search_antipatterns_json "test" "" 10)
if echo "$RESULT" | jq -e '.limit == 10' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Antipattern search respects limit parameter"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Antipattern search should respect limit parameter"
fi

# -----------------------------------------------------------------------------
# Test: mem0_search_best_practices_json Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_search_best_practices_json"
echo "=========================================="

# Test basic best practice search
RESULT=$(mem0_search_best_practices_json "cursor pagination")
assert_json_valid "$RESULT" "Best practice search returns valid JSON"
assert_contains "$RESULT" "success" "Best practice search filters for success outcome"

# Test with category
RESULT=$(mem0_search_best_practices_json "pagination" "database")
assert_contains "$RESULT" "database" "Best practice search includes category filter"
assert_contains "$RESULT" "success" "Best practice search with category still filters success"

# Test enable_graph default
if echo "$RESULT" | jq -e '.enable_graph == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Best practice search has enable_graph=true"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Best practice search should have enable_graph=true"
fi

# -----------------------------------------------------------------------------
# Test: mem0_search_global_by_outcome_json Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_search_global_by_outcome_json"
echo "=========================================="

# Test global search for failed
RESULT=$(mem0_search_global_by_outcome_json "authentication" "failed")
assert_json_valid "$RESULT" "Global search returns valid JSON"
assert_contains "$RESULT" "orchestkit-global-best-practices" "Global search uses global user_id"
assert_contains "$RESULT" "failed" "Global search filters for failed outcome"

# Test global search for success
RESULT=$(mem0_search_global_by_outcome_json "jwt" "success")
assert_contains "$RESULT" "success" "Global search can filter for success"
assert_contains "$RESULT" "orchestkit-global" "Global search uses global prefix"

# -----------------------------------------------------------------------------
# Test: antipattern-warning.sh Hook
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing antipattern-warning.sh hook"
echo "=========================================="

HOOK="$PROJECT_ROOT/src/hooks/prompt/antipattern-warning.sh"

# Test hook exists and is executable
TESTS_RUN=$((TESTS_RUN + 1))
if [[ -x "$HOOK" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: antipattern-warning.sh is executable"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: antipattern-warning.sh should be executable"
fi

# Test hook version is 1.2.0
TESTS_RUN=$((TESTS_RUN + 1))
if head -15 "$HOOK" | grep -q "Version: 1.2.0"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: antipattern-warning.sh version is 1.2.0"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: antipattern-warning.sh version should be 1.2.0"
fi

# Test hook mentions Mem0 Pro Integration
TESTS_RUN=$((TESTS_RUN + 1))
if head -15 "$HOOK" | grep -qi "mem0"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: antipattern-warning.sh mentions Mem0"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: antipattern-warning.sh should mention Mem0"
fi

# Test hook uses mem0_search_antipatterns_json
TESTS_RUN=$((TESTS_RUN + 1))
if grep -q "mem0_search_antipatterns_json" "$HOOK"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: antipattern-warning.sh uses mem0_search_antipatterns_json"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: antipattern-warning.sh should use mem0_search_antipatterns_json"
fi

# Test hook uses mem0_search_best_practices_json
TESTS_RUN=$((TESTS_RUN + 1))
if grep -q "mem0_search_best_practices_json" "$HOOK"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: antipattern-warning.sh uses mem0_search_best_practices_json"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: antipattern-warning.sh should use mem0_search_best_practices_json"
fi

# Test hook uses mem0_search_global_by_outcome_json
TESTS_RUN=$((TESTS_RUN + 1))
if grep -q "mem0_search_global_by_outcome_json" "$HOOK"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: antipattern-warning.sh uses mem0_search_global_by_outcome_json"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: antipattern-warning.sh should use mem0_search_global_by_outcome_json"
fi

# -----------------------------------------------------------------------------
# Test: Category Detection Integration
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing category detection integration"
echo "=========================================="

# Test pagination category
CATEGORY=$(detect_best_practice_category "implement cursor pagination")
TESTS_RUN=$((TESTS_RUN + 1))
if [[ "$CATEGORY" == "pagination" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Detects pagination category"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Should detect pagination category (got: $CATEGORY)"
fi

# Test database category
CATEGORY=$(detect_best_practice_category "create postgresql schema")
TESTS_RUN=$((TESTS_RUN + 1))
if [[ "$CATEGORY" == "database" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Detects database category"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Should detect database category (got: $CATEGORY)"
fi

# Test authentication category
CATEGORY=$(detect_best_practice_category "implement jwt authentication")
TESTS_RUN=$((TESTS_RUN + 1))
if [[ "$CATEGORY" == "authentication" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Detects authentication category"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Should detect authentication category (got: $CATEGORY)"
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
