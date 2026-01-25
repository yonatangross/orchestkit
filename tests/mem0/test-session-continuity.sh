#!/usr/bin/env bash
# Test suite for Session Continuity 2.0
# Validates session summary and time-filtered search functionality
#
# Part of Mem0 Pro Integration - Phase 5 (v4.20.0)

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
# Test: build_session_summary_json Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing build_session_summary_json"
echo "=========================================="

# Test basic session summary
RESULT=$(build_session_summary_json "Implementing API endpoints" "in_progress")
assert_json_valid "$RESULT" "Session summary returns valid JSON"
assert_contains "$RESULT" "Session Summary" "Session summary includes Session Summary text"
assert_contains "$RESULT" "Implementing API endpoints" "Session summary includes task description"
assert_contains "$RESULT" "in_progress" "Session summary includes status"

# Check enable_graph is true
if echo "$RESULT" | jq -e '.enable_graph == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Session summary has enable_graph=true"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Session summary should have enable_graph=true"
fi

# Check metadata type
if echo "$RESULT" | jq -e '.metadata.type == "session_summary"' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Session summary has metadata.type=session_summary"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Session summary should have metadata.type=session_summary"
fi

# Test with blockers
RESULT=$(build_session_summary_json "Working on auth" "in_progress" "JWT validation failing" "")
assert_contains "$RESULT" "Blockers" "Session summary includes blockers when provided"
assert_contains "$RESULT" "JWT validation failing" "Session summary includes blocker text"

# Check has_blockers metadata
if echo "$RESULT" | jq -e '.metadata.has_blockers == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Session summary has has_blockers=true when blockers provided"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Session summary should have has_blockers=true"
fi

# Test with next steps
RESULT=$(build_session_summary_json "Completed API" "completed" "" "Add unit tests; Update docs")
assert_contains "$RESULT" "Next" "Session summary includes next steps when provided"
assert_contains "$RESULT" "Add unit tests" "Session summary includes next steps text"

# Check has_next_steps metadata
if echo "$RESULT" | jq -e '.metadata.has_next_steps == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Session summary has has_next_steps=true when next steps provided"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Session summary should have has_next_steps=true"
fi

# Test user_id format
USER_ID=$(echo "$RESULT" | jq -r '.user_id')
assert_contains "$USER_ID" "continuity" "Session summary uses continuity scope"

# -----------------------------------------------------------------------------
# Test: mem0_search_recent_sessions_json Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_search_recent_sessions_json"
echo "=========================================="

# Test basic recent sessions search
RESULT=$(mem0_search_recent_sessions_json "session context" 7 3)
assert_json_valid "$RESULT" "Recent sessions search returns valid JSON"
assert_contains "$RESULT" "session context" "Recent sessions search includes query"

# Check enable_graph is true
if echo "$RESULT" | jq -e '.enable_graph == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Recent sessions search has enable_graph=true"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Recent sessions search should have enable_graph=true"
fi

# Check created_at filter exists
if echo "$RESULT" | jq -e '.filters.AND[] | select(.created_at)' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Recent sessions search has created_at filter"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Recent sessions search should have created_at filter"
fi

# Check limit is respected
if echo "$RESULT" | jq -e '.limit == 3' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Recent sessions search respects limit parameter"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Recent sessions search should respect limit parameter"
fi

# Test with different days_back
RESULT=$(mem0_search_recent_sessions_json "blockers" 14 5)
assert_json_valid "$RESULT" "Recent sessions search with 14 days returns valid JSON"

# -----------------------------------------------------------------------------
# Test: mem0_search_blocked_sessions_json Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_search_blocked_sessions_json"
echo "=========================================="

# Test blocked sessions search
RESULT=$(mem0_search_blocked_sessions_json "authentication issues" 14 5)
assert_json_valid "$RESULT" "Blocked sessions search returns valid JSON"
assert_contains "$RESULT" "blockers" "Blocked sessions search query includes blockers"

# Check has_blockers filter
if echo "$RESULT" | jq -e '.filters.AND[] | select(.["metadata.has_blockers"] == true)' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Blocked sessions search has has_blockers filter"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Blocked sessions search should have has_blockers filter"
fi

# Check enable_graph is true
if echo "$RESULT" | jq -e '.enable_graph == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Blocked sessions search has enable_graph=true"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Blocked sessions search should have enable_graph=true"
fi

# -----------------------------------------------------------------------------
# Test: mem0_search_pending_work_json Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_search_pending_work_json"
echo "=========================================="

# Test pending work search
RESULT=$(mem0_search_pending_work_json "incomplete tasks" 14 5)
assert_json_valid "$RESULT" "Pending work search returns valid JSON"
assert_contains "$RESULT" "next steps" "Pending work search query includes next steps"

# Check has_next_steps filter
if echo "$RESULT" | jq -e '.filters.AND[] | select(.["metadata.has_next_steps"] == true)' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Pending work search has has_next_steps filter"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Pending work search should have has_next_steps filter"
fi

# Check status filter for in_progress
if echo "$RESULT" | jq -e '.filters.AND[] | select(.["metadata.status"] == "in_progress")' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Pending work search filters for in_progress status"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Pending work search should filter for in_progress status"
fi

# -----------------------------------------------------------------------------
# Test: build_session_retrieval_hint Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing build_session_retrieval_hint"
echo "=========================================="

# Test session retrieval hint
RESULT=$(build_session_retrieval_hint 7)
assert_contains "$RESULT" "Session context available" "Retrieval hint mentions session context"
assert_contains "$RESULT" "Recent session summaries" "Retrieval hint includes recent sessions section"
assert_contains "$RESULT" "Sessions with blockers" "Retrieval hint includes blockers section"
assert_contains "$RESULT" "Project decisions" "Retrieval hint includes decisions section"
assert_contains "$RESULT" "graph memory enabled" "Retrieval hint mentions graph memory"

# Test with different days_back
RESULT=$(build_session_retrieval_hint 14)
assert_contains "$RESULT" "last 14 days" "Retrieval hint respects days_back parameter"

# -----------------------------------------------------------------------------
# Test: mem0-pre-compaction-sync.sh Hook
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0-pre-compaction-sync.sh hook"
echo "=========================================="

HOOK="$PROJECT_ROOT/src/hooks/stop/mem0-pre-compaction-sync.sh"

# Test hook exists and is executable
TESTS_RUN=$((TESTS_RUN + 1))
if [[ -x "$HOOK" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0-pre-compaction-sync.sh is executable"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0-pre-compaction-sync.sh should be executable"
fi

# Test hook version is 1.7.0+ (Stop hook schema compliance + Webhook + Batch + Export)
TESTS_RUN=$((TESTS_RUN + 1))
if head -25 "$HOOK" | grep -qE "Version: 1\.[7-9]\.[0-9]|Version: [2-9]\."; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0-pre-compaction-sync.sh version is 1.7.0+"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0-pre-compaction-sync.sh version should be 1.7.0+"
fi

# Test hook mentions Session Continuity 2.0
TESTS_RUN=$((TESTS_RUN + 1))
if head -10 "$HOOK" | grep -qi "Session Continuity 2.0\|session summar"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0-pre-compaction-sync.sh mentions Session Continuity"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0-pre-compaction-sync.sh should mention Session Continuity"
fi

# Test hook uses build_session_summary_json
TESTS_RUN=$((TESTS_RUN + 1))
if grep -q "build_session_summary_json" "$HOOK"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0-pre-compaction-sync.sh uses build_session_summary_json"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0-pre-compaction-sync.sh should use build_session_summary_json"
fi

# Test hook extracts blockers
TESTS_RUN=$((TESTS_RUN + 1))
if grep -q "BLOCKERS" "$HOOK"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0-pre-compaction-sync.sh extracts blockers"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0-pre-compaction-sync.sh should extract blockers"
fi

# -----------------------------------------------------------------------------
# Test: mem0-context-retrieval.sh Hook
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0-context-retrieval.sh hook"
echo "=========================================="

HOOK="$PROJECT_ROOT/src/hooks/lifecycle/mem0-context-retrieval.sh"

# Test hook exists and is executable
TESTS_RUN=$((TESTS_RUN + 1))
if [[ -x "$HOOK" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0-context-retrieval.sh is executable"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0-context-retrieval.sh should be executable"
fi

# Test hook version is 2.1.0+ (graph-first architecture)
TESTS_RUN=$((TESTS_RUN + 1))
if head -15 "$HOOK" | grep -qE "Version: 2\.[1-9]\.[0-9]|Version: [3-9]\."; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0-context-retrieval.sh version is 2.1.0+"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0-context-retrieval.sh version should be 2.1.0+"
fi

# Test hook mentions time-filtered search
TESTS_RUN=$((TESTS_RUN + 1))
if head -20 "$HOOK" | grep -qi "time-filtered"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0-context-retrieval.sh mentions time-filtered search"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0-context-retrieval.sh should mention time-filtered search"
fi

# Test hook uses build_session_retrieval_hint
TESTS_RUN=$((TESTS_RUN + 1))
if grep -q "build_session_retrieval_hint" "$HOOK"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: mem0-context-retrieval.sh uses build_session_retrieval_hint"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: mem0-context-retrieval.sh should use build_session_retrieval_hint"
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
