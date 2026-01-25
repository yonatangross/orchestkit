#!/usr/bin/env bash
# Test suite for Decision Entity Extractor Hook
# Validates entity extraction (Agent, Technology, Pattern, Constraint) from decisions
#
# Part of Mem0 Pro Integration - Phase 2 (v4.20.0)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Hook under test
HOOK="$PROJECT_ROOT/src/hooks/skill/decision-entity-extractor.sh"

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

run_hook_with_input() {
    local input="$1"
    echo "$input" | bash "$HOOK" 2>/dev/null
}

# -----------------------------------------------------------------------------
# Test: Hook Exists and Is Executable
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing hook structure"
echo "=========================================="

TESTS_RUN=$((TESTS_RUN + 1))
if [[ -x "$HOOK" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Hook is executable"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Hook should be executable"
fi

TESTS_RUN=$((TESTS_RUN + 1))
if head -5 "$HOOK" | grep -q "Decision Entity Extractor"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Hook has correct header"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Hook should have 'Decision Entity Extractor' header"
fi

# -----------------------------------------------------------------------------
# Test: Empty/Short Input Handling
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing empty/short input handling"
echo "=========================================="

# Test with empty input
RESULT=$(run_hook_with_input '{}')
assert_json_valid "$RESULT" "Empty input returns valid JSON"
assert_json_field "$RESULT" ".continue" "true" "Empty input returns continue=true"

# Test with short output
SHORT_INPUT='{"skill_name": "test", "tool_result": "short"}'
RESULT=$(run_hook_with_input "$SHORT_INPUT")
assert_json_valid "$RESULT" "Short input returns valid JSON"
assert_json_field "$RESULT" ".continue" "true" "Short input returns continue=true"

# -----------------------------------------------------------------------------
# Test: Agent Extraction
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing agent extraction"
echo "=========================================="

# Input with agent mentions
AGENT_INPUT=$(cat <<'EOF'
{
  "skill_name": "api-design",
  "tool_result": "The database-engineer recommended using PostgreSQL for the data layer. The backend-system-architect agreed and suggested FastAPI for the API framework. This decision was based on performance requirements and team expertise."
}
EOF
)

RESULT=$(run_hook_with_input "$AGENT_INPUT")
assert_json_valid "$RESULT" "Agent input returns valid JSON"
assert_contains "$RESULT" "database-engineer" "Extracts database-engineer agent"
assert_contains "$RESULT" "backend-system-architect" "Extracts backend-system-architect agent"
assert_contains "$RESULT" "Agents:" "Output mentions Agents count"

# -----------------------------------------------------------------------------
# Test: Technology Extraction
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing technology extraction"
echo "=========================================="

# Input with technology mentions
TECH_INPUT=$(cat <<'EOF'
{
  "skill_name": "stack-selection",
  "tool_result": "We decided to use PostgreSQL with pgvector for the database layer. The frontend will be built with React and TypeScript. FastAPI will serve as the backend framework with JWT authentication."
}
EOF
)

RESULT=$(run_hook_with_input "$TECH_INPUT")
assert_json_valid "$RESULT" "Tech input returns valid JSON"
assert_contains "$RESULT" "postgresql" "Extracts postgresql technology"
assert_contains "$RESULT" "pgvector" "Extracts pgvector technology"
assert_contains "$RESULT" "react" "Extracts react technology"
assert_contains "$RESULT" "fastapi" "Extracts fastapi technology"
assert_contains "$RESULT" "jwt" "Extracts jwt technology"
assert_contains "$RESULT" "Technologies:" "Output mentions Technologies count"

# -----------------------------------------------------------------------------
# Test: Pattern Extraction
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing pattern extraction"
echo "=========================================="

# Input with pattern mentions
PATTERN_INPUT=$(cat <<'EOF'
{
  "skill_name": "architecture-review",
  "tool_result": "We recommend cursor-pagination for the API endpoints instead of offset-pagination for better performance. The repository-pattern should be used for data access, and dependency-injection for service composition. Consider implementing caching with cache-aside strategy."
}
EOF
)

RESULT=$(run_hook_with_input "$PATTERN_INPUT")
assert_json_valid "$RESULT" "Pattern input returns valid JSON"
assert_contains "$RESULT" "cursor-pagination" "Extracts cursor-pagination pattern"
assert_contains "$RESULT" "offset-pagination" "Extracts offset-pagination pattern"
assert_contains "$RESULT" "repository-pattern" "Extracts repository-pattern"
assert_contains "$RESULT" "dependency-injection" "Extracts dependency-injection pattern"
assert_contains "$RESULT" "cache-aside" "Extracts cache-aside pattern"
assert_contains "$RESULT" "Patterns:" "Output mentions Patterns count"

# -----------------------------------------------------------------------------
# Test: Relation Type Detection
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing relation type detection"
echo "=========================================="

# RECOMMENDS relation
RECOMMENDS_INPUT=$(cat <<'EOF'
{
  "skill_name": "advice",
  "tool_result": "The database-engineer recommends using cursor-pagination for large datasets with PostgreSQL. This suggests better performance than offset-pagination."
}
EOF
)

RESULT=$(run_hook_with_input "$RECOMMENDS_INPUT")
assert_contains "$RESULT" "RECOMMENDS" "Detects RECOMMENDS relation type"

# CHOSEN_FOR relation
CHOSEN_INPUT=$(cat <<'EOF'
{
  "skill_name": "decision",
  "tool_result": "We decided to use FastAPI for the backend. We selected PostgreSQL as the database. We chose cursor-pagination for the API."
}
EOF
)

RESULT=$(run_hook_with_input "$CHOSEN_INPUT")
assert_contains "$RESULT" "CHOSEN_FOR" "Detects CHOSEN_FOR relation type"

# REPLACES relation
REPLACES_INPUT=$(cat <<'EOF'
{
  "skill_name": "migration",
  "tool_result": "Replace offset-pagination with cursor-pagination. Instead of using global state, we will use dependency-injection. Rather than manual JWT validation, use the python-jose library."
}
EOF
)

RESULT=$(run_hook_with_input "$REPLACES_INPUT")
assert_contains "$RESULT" "REPLACES" "Detects REPLACES relation type"

# -----------------------------------------------------------------------------
# Test: Entity JSON Structure
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing entity JSON structure"
echo "=========================================="

FULL_INPUT=$(cat <<'EOF'
{
  "skill_name": "full-decision",
  "tool_result": "The backend-system-architect decided to implement cursor-pagination using PostgreSQL. This replaces the old offset-pagination approach."
}
EOF
)

RESULT=$(run_hook_with_input "$FULL_INPUT")
assert_json_valid "$RESULT" "Full input returns valid JSON"
assert_contains "$RESULT" "mcp__memory__create_entities" "Suggests create_entities command"
assert_contains "$RESULT" "mcp__memory__create_relations" "Suggests create_relations command"
assert_contains "$RESULT" "entityType" "Includes entityType in entities"
assert_contains "$RESULT" "observations" "Includes observations in entities"

# -----------------------------------------------------------------------------
# Test: CC 2.1.7 Compliance
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing CC 2.1.7 compliance"
echo "=========================================="

COMPLIANCE_INPUT=$(cat <<'EOF'
{
  "skill_name": "test",
  "tool_result": "The database-engineer recommended PostgreSQL with cursor-pagination for better performance in the API layer."
}
EOF
)

RESULT=$(run_hook_with_input "$COMPLIANCE_INPUT")
assert_json_field "$RESULT" ".continue" "true" "Output includes continue=true"

# Check systemMessage is present when entities found
if echo "$RESULT" | jq -e '.systemMessage' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Output includes systemMessage when entities found"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Output should include systemMessage when entities found"
fi

# -----------------------------------------------------------------------------
# Test: No Entities Found
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing no entities found"
echo "=========================================="

NO_ENTITY_INPUT=$(cat <<'EOF'
{
  "skill_name": "general",
  "tool_result": "This is a general comment about the project. It discusses various topics without mentioning specific technologies, patterns, or agents. The discussion continues for a while."
}
EOF
)

RESULT=$(run_hook_with_input "$NO_ENTITY_INPUT")
assert_json_valid "$RESULT" "No-entity input returns valid JSON"
assert_json_field "$RESULT" ".continue" "true" "No-entity input returns continue=true"

# Should have suppressOutput when no entities
if echo "$RESULT" | jq -e '.suppressOutput == true' >/dev/null 2>&1; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Output includes suppressOutput=true when no entities"
else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Output should include suppressOutput=true when no entities"
fi

# -----------------------------------------------------------------------------
# Test: Version Information
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "Testing version information"
echo "=========================================="

TESTS_RUN=$((TESTS_RUN + 1))
if head -30 "$HOOK" | grep -q "Version: 1.0.0"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Hook version is 1.0.0"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Hook version should be 1.0.0"
fi

TESTS_RUN=$((TESTS_RUN + 1))
if head -30 "$HOOK" | grep -q "Mem0 Pro Integration"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}: Hook mentions Mem0 Pro Integration"
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}: Hook should mention Mem0 Pro Integration"
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
