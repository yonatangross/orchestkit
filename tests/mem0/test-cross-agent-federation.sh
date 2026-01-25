#!/usr/bin/env bash
# Test suite for Cross-Agent Memory Federation
# Validates cross-agent knowledge sharing functionality
#
# Part of Mem0 Pro Integration - Phase 3 (v4.20.0)

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
        echo "  Missing: '$needle'"
        return 1
    fi
}

assert_not_empty() {
    local value="$1"
    local msg="${2:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ -n "$value" ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Value should not be empty"
        return 1
    fi
}

assert_empty() {
    local value="$1"
    local msg="${2:-}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ -z "$value" ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}PASS${NC}: $msg"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}FAIL${NC}: $msg"
        echo "  Value should be empty but was: '$value'"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Test: mem0_get_related_agents Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_get_related_agents"
echo "=========================================="

# Test database-engineer relationships
RESULT=$(mem0_get_related_agents "database-engineer")
assert_contains "$RESULT" "backend-system-architect" "database-engineer relates to backend-system-architect"
assert_contains "$RESULT" "security-auditor" "database-engineer relates to security-auditor"
assert_contains "$RESULT" "data-pipeline-engineer" "database-engineer relates to data-pipeline-engineer"

# Test backend-system-architect relationships
RESULT=$(mem0_get_related_agents "backend-system-architect")
assert_contains "$RESULT" "database-engineer" "backend-system-architect relates to database-engineer"
assert_contains "$RESULT" "frontend-ui-developer" "backend-system-architect relates to frontend-ui-developer"
assert_contains "$RESULT" "security-auditor" "backend-system-architect relates to security-auditor"
assert_contains "$RESULT" "llm-integrator" "backend-system-architect relates to llm-integrator"

# Test frontend-ui-developer relationships
RESULT=$(mem0_get_related_agents "frontend-ui-developer")
assert_contains "$RESULT" "backend-system-architect" "frontend-ui-developer relates to backend-system-architect"
assert_contains "$RESULT" "ux-researcher" "frontend-ui-developer relates to ux-researcher"
assert_contains "$RESULT" "accessibility-specialist" "frontend-ui-developer relates to accessibility-specialist"

# Test unknown agent returns empty
RESULT=$(mem0_get_related_agents "unknown-agent")
assert_empty "$RESULT" "Unknown agent returns empty list"

# Test workflow-architect relationships
RESULT=$(mem0_get_related_agents "workflow-architect")
assert_contains "$RESULT" "llm-integrator" "workflow-architect relates to llm-integrator"
assert_contains "$RESULT" "data-pipeline-engineer" "workflow-architect relates to data-pipeline-engineer"

# Test security-auditor relationships
RESULT=$(mem0_get_related_agents "security-auditor")
assert_contains "$RESULT" "backend-system-architect" "security-auditor relates to backend-system-architect"
assert_contains "$RESULT" "database-engineer" "security-auditor relates to database-engineer"
assert_contains "$RESULT" "infrastructure-architect" "security-auditor relates to infrastructure-architect"

# -----------------------------------------------------------------------------
# Test: mem0_cross_agent_search_json Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_cross_agent_search_json"
echo "=========================================="

# Test basic cross-agent search
RESULT=$(mem0_cross_agent_search_json "database-engineer" "pagination patterns")

# Check JSON is valid
if echo "$RESULT" | jq -e '.' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Cross-agent search returns valid JSON"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Cross-agent search should return valid JSON"
fi

# Check query is included
if echo "$RESULT" | jq -e '.query == "pagination patterns"' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Cross-agent search includes query"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Cross-agent search should include query"
fi

# Check enable_graph is true
if echo "$RESULT" | jq -e '.enable_graph == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Cross-agent search has enable_graph=true"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Cross-agent search should have enable_graph=true"
fi

# Check OR filter contains multiple agents
OR_FILTER_COUNT=$(echo "$RESULT" | jq '.filters.AND[1].OR | length')
if [[ "$OR_FILTER_COUNT" -gt 1 ]]; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Cross-agent search has multiple agents in OR filter ($OR_FILTER_COUNT agents)"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Cross-agent search should have multiple agents in OR filter"
fi

# Check primary agent is in filter
assert_contains "$RESULT" "ork:database-engineer" "Cross-agent search includes primary agent"

# Check related agents are in filter
assert_contains "$RESULT" "ork:backend-system-architect" "Cross-agent search includes related backend-system-architect"
assert_contains "$RESULT" "ork:security-auditor" "Cross-agent search includes related security-auditor"

# -----------------------------------------------------------------------------
# Test: mem0_cross_project_search_json Function
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing mem0_cross_project_search_json"
echo "=========================================="

# Test cross-project search for database-engineer
RESULT=$(mem0_cross_project_search_json "database-engineer" "performance tips")

# Check JSON is valid
if echo "$RESULT" | jq -e '.' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Cross-project search returns valid JSON"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Cross-project search should return valid JSON"
fi

# Check global user_id is used
assert_contains "$RESULT" "orchestkit-global-best-practices" "Cross-project search uses global user_id"

# Check enable_graph is true
if echo "$RESULT" | jq -e '.enable_graph == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Cross-project search has enable_graph=true"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Cross-project search should have enable_graph=true"
fi

# Test domain keywords are enhanced for different agents
RESULT=$(mem0_cross_project_search_json "frontend-ui-developer" "state management")
assert_contains "$RESULT" "React" "Frontend agent query enhanced with React keyword"

RESULT=$(mem0_cross_project_search_json "security-auditor" "authentication")
assert_contains "$RESULT" "OWASP" "Security agent query enhanced with OWASP keyword"

# -----------------------------------------------------------------------------
# Test: Agent Memory Inject Hook
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing agent-memory-inject.sh hook"
echo "=========================================="

HOOK="$PROJECT_ROOT/src/hooks/subagent-start/agent-memory-inject.sh"

# Test hook exists and is executable
TESTS_RUN=$((TESTS_RUN + 1))
if [[ -x "$HOOK" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: agent-memory-inject.sh is executable"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: agent-memory-inject.sh should be executable"
fi

# Test hook has version 1.3.0+ (cross-agent federation)
TESTS_RUN=$((TESTS_RUN + 1))
if head -20 "$HOOK" | grep -qE "Version: 1\.[3-9]\.[0-9]|Version: [2-9]\."; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: agent-memory-inject.sh version is 1.3.0+"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: agent-memory-inject.sh version should be 1.3.0+"
fi

# Test hook mentions cross-agent federation
TESTS_RUN=$((TESTS_RUN + 1))
if head -20 "$HOOK" | grep -qi "cross-agent"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: agent-memory-inject.sh mentions cross-agent"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: agent-memory-inject.sh should mention cross-agent"
fi

# Test hook uses mem0_get_related_agents
TESTS_RUN=$((TESTS_RUN + 1))
if grep -q "mem0_get_related_agents" "$HOOK"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: agent-memory-inject.sh uses mem0_get_related_agents"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: agent-memory-inject.sh should use mem0_get_related_agents"
fi

# Test hook uses mem0_cross_agent_search_json
TESTS_RUN=$((TESTS_RUN + 1))
if grep -q "mem0_cross_agent_search_json" "$HOOK"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: agent-memory-inject.sh uses mem0_cross_agent_search_json"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: agent-memory-inject.sh should use mem0_cross_agent_search_json"
fi

# -----------------------------------------------------------------------------
# Test: Relationship Symmetry
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing relationship symmetry"
echo "=========================================="

# Test that relationships are generally bidirectional
# database-engineer -> backend-system-architect
RELATED_FROM_DB=$(mem0_get_related_agents "database-engineer")
# backend-system-architect -> database-engineer
RELATED_FROM_BACKEND=$(mem0_get_related_agents "backend-system-architect")

if [[ "$RELATED_FROM_DB" == *"backend-system-architect"* ]] && [[ "$RELATED_FROM_BACKEND" == *"database-engineer"* ]]; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: database-engineer <-> backend-system-architect relationship is bidirectional"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: database-engineer <-> backend-system-architect should be bidirectional"
fi

# frontend-ui-developer <-> ux-researcher
RELATED_FROM_FRONTEND=$(mem0_get_related_agents "frontend-ui-developer")
RELATED_FROM_UX=$(mem0_get_related_agents "ux-researcher")

if [[ "$RELATED_FROM_FRONTEND" == *"ux-researcher"* ]] && [[ "$RELATED_FROM_UX" == *"frontend-ui-developer"* ]]; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: frontend-ui-developer <-> ux-researcher relationship is bidirectional"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: frontend-ui-developer <-> ux-researcher should be bidirectional"
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
