#!/bin/bash
# test-mem0-v1.1.0-enhancements.sh - Unit tests for mem0.sh v1.1.0 enhancements
# Part of OrchestKit Claude Plugin comprehensive test suite
# CC 2.1.7 Compliant
#
# Tests v1.1.0 features:
# - Graph memory support (enable_graph flag)
# - Agent ID scoping and validation
# - Global user ID generation
# - Graph entity/relation building
# - Agent ID formatting and validation

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Export for hooks
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

# Source the library under test
source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# =============================================================================
# Test Helper Functions
# =============================================================================

test_start() {
    local name="$1"
    echo -n "  ○ $name... "
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_pass() {
    echo -e "\033[0;32mPASS\033[0m"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    local reason="${1:-}"
    echo -e "\033[0;31mFAIL\033[0m"
    [[ -n "$reason" ]] && echo "    └─ $reason"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

# =============================================================================
# Test: mem0_add_memory_json with enable_graph flag
# =============================================================================

test_mem0_add_with_graph_flag() {
    test_start "mem0_add_memory_json includes enable_graph=true"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_add_memory_json "decisions" "Database schema decision" '{}' "true")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check enable_graph field exists and is true
    local has_graph
    has_graph=$(echo "$result" | jq -r '.enable_graph // empty')

    if [[ "$has_graph" == "true" ]]; then
        test_pass
    else
        test_fail "Expected enable_graph=true, got '$has_graph'"
    fi
}

test_mem0_add_without_graph_flag() {
    test_start "mem0_add_memory_json excludes enable_graph when false"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_add_memory_json "decisions" "Database schema decision" '{}' "false")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check enable_graph field is not present or is false
    local has_graph
    has_graph=$(echo "$result" | jq 'has("enable_graph")')

    if [[ "$has_graph" == "false" ]]; then
        test_pass
    else
        test_fail "Expected enable_graph to be absent or false"
    fi
}

# =============================================================================
# Test: mem0_search_memory_json with enable_graph flag
# =============================================================================

test_mem0_search_with_graph_flag() {
    test_start "mem0_search_memory_json includes enable_graph=true"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_search_memory_json "decisions" "database schema" 10 "true")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check enable_graph field exists and is true
    local has_graph
    has_graph=$(echo "$result" | jq -r '.enable_graph // empty')

    if [[ "$has_graph" == "true" ]]; then
        test_pass
    else
        test_fail "Expected enable_graph=true, got '$has_graph'"
    fi
}

test_mem0_search_without_graph_flag() {
    test_start "mem0_search_memory_json excludes enable_graph when false"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_search_memory_json "decisions" "database schema" 10 "false")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check enable_graph field is not present
    local has_graph
    has_graph=$(echo "$result" | jq 'has("enable_graph")')

    if [[ "$has_graph" == "false" ]]; then
        test_pass
    else
        test_fail "Expected enable_graph to be absent"
    fi
}

# =============================================================================
# Test: mem0_add_memory_json with agent_id parameter
# =============================================================================

test_mem0_add_with_agent_id() {
    test_start "mem0_add_memory_json includes agent_id with ork: prefix"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_add_memory_json "agents" "Agent context" '{}' "false" "database-engineer")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check agent_id field exists and has ork: prefix
    local agent_id
    agent_id=$(echo "$result" | jq -r '.agent_id // empty')

    if [[ "$agent_id" == "ork:database-engineer" ]]; then
        test_pass
    else
        test_fail "Expected 'ork:database-engineer', got '$agent_id'"
    fi
}

test_mem0_add_with_prefixed_agent_id() {
    test_start "mem0_add_memory_json handles already-prefixed agent_id"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_add_memory_json "agents" "Agent context" '{}' "false" "ork:database-engineer")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check agent_id doesn't get double-prefixed
    local agent_id
    agent_id=$(echo "$result" | jq -r '.agent_id // empty')

    if [[ "$agent_id" == "ork:database-engineer" ]]; then
        test_pass
    else
        test_fail "Expected 'ork:database-engineer', got '$agent_id' (possible double prefix)"
    fi
}

test_mem0_add_without_agent_id() {
    test_start "mem0_add_memory_json excludes agent_id when not provided"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_add_memory_json "decisions" "Decision content" '{}' "false" "")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check agent_id field is not present
    local has_agent_id
    has_agent_id=$(echo "$result" | jq 'has("agent_id")')

    if [[ "$has_agent_id" == "false" ]]; then
        test_pass
    else
        test_fail "Expected agent_id to be absent"
    fi
}

# =============================================================================
# Test: mem0_search_memory_json with agent_id filter
# =============================================================================

test_mem0_search_with_agent_id() {
    test_start "mem0_search_memory_json adds agent_id filter"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_search_memory_json "agents" "context" 10 "false" "database-engineer")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check filters include agent_id with ork: prefix
    local agent_filter
    agent_filter=$(echo "$result" | jq -r '.filters.AND[] | select(.agent_id) | .agent_id // empty')

    if [[ "$agent_filter" == "ork:database-engineer" ]]; then
        test_pass
    else
        test_fail "Expected agent_id filter 'ork:database-engineer', got '$agent_filter'"
    fi
}

test_mem0_search_with_category_and_agent() {
    test_start "mem0_search_memory_json combines category and agent_id filters"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_search_memory_json "best-practices" "query" 10 "false" "database-engineer" "database")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check filters include both category and agent_id
    local filter_count
    filter_count=$(echo "$result" | jq '.filters.AND | length')

    # Should have: user_id, category, agent_id (3 filters)
    if [[ "$filter_count" -ge 3 ]]; then
        test_pass
    else
        test_fail "Expected at least 3 filters (user_id + category + agent_id), got $filter_count"
    fi
}

# =============================================================================
# Test: mem0_global_user_id function
# =============================================================================

test_mem0_global_user_id() {
    test_start "mem0_global_user_id returns correct format"

    local result
    result=$(mem0_global_user_id "best-practices")

    if [[ "$result" == "orchestkit-global-best-practices" ]]; then
        test_pass
    else
        test_fail "Expected 'orchestkit-global-best-practices', got '$result'"
    fi
}

test_mem0_global_user_id_default() {
    test_start "mem0_global_user_id uses default scope"

    local result
    result=$(mem0_global_user_id)

    if [[ "$result" == "orchestkit-global-best-practices" ]]; then
        test_pass
    else
        test_fail "Expected 'orchestkit-global-best-practices', got '$result'"
    fi
}

test_mem0_add_with_global_flag() {
    test_start "mem0_add_memory_json uses global user_id when global=true"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_add_memory_json "best-practices" "Global practice" '{}' "false" "" "true")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check user_id is global format
    local user_id
    user_id=$(echo "$result" | jq -r '.user_id // empty')

    if [[ "$user_id" == "orchestkit-global-best-practices" ]]; then
        test_pass
    else
        test_fail "Expected 'orchestkit-global-best-practices', got '$user_id'"
    fi
}

# =============================================================================
# Test: mem0_build_graph_entity function
# =============================================================================

test_mem0_build_graph_entity() {
    test_start "mem0_build_graph_entity creates valid entity JSON"

    local result
    result=$(mem0_build_graph_entity "database-engineer" "agent" "Uses pgvector" "Recommends indexes")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check required fields
    local name entity_type obs_count
    name=$(echo "$result" | jq -r '.name // empty')
    entity_type=$(echo "$result" | jq -r '.entityType // empty')
    obs_count=$(echo "$result" | jq '.observations | length')

    if [[ "$name" == "database-engineer" ]] && \
       [[ "$entity_type" == "agent" ]] && \
       [[ "$obs_count" == "2" ]]; then
        test_pass
    else
        test_fail "Entity structure incorrect: name='$name', type='$entity_type', observations=$obs_count"
    fi
}

test_mem0_build_graph_entity_single_observation() {
    test_start "mem0_build_graph_entity handles single observation"

    local result
    result=$(mem0_build_graph_entity "test-entity" "tool" "single observation")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check observations has one item
    local obs_count
    obs_count=$(echo "$result" | jq '.observations | length')

    if [[ "$obs_count" == "1" ]]; then
        test_pass
    else
        test_fail "Expected 1 observation, got $obs_count items"
    fi
}

# =============================================================================
# Test: mem0_build_graph_relation function
# =============================================================================

test_mem0_build_graph_relation() {
    test_start "mem0_build_graph_relation creates valid relation JSON"

    local result
    result=$(mem0_build_graph_relation "database-engineer" "pgvector" "uses")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check required fields
    local from to relation_type
    from=$(echo "$result" | jq -r '.from // empty')
    to=$(echo "$result" | jq -r '.to // empty')
    relation_type=$(echo "$result" | jq -r '.relationType // empty')

    if [[ "$from" == "database-engineer" ]] && \
       [[ "$to" == "pgvector" ]] && \
       [[ "$relation_type" == "uses" ]]; then
        test_pass
    else
        test_fail "Relation structure incorrect: from='$from', to='$to', type='$relation_type'"
    fi
}

# =============================================================================
# Test: Graph array builders
# =============================================================================

test_mem0_build_entities_array() {
    test_start "mem0_build_entities_array creates array from multiple entities"

    local entity1 entity2
    entity1=$(mem0_build_graph_entity "agent1" "agent" "obs1")
    entity2=$(mem0_build_graph_entity "agent2" "agent" "obs2")

    local result
    result=$(mem0_build_entities_array "$entity1" "$entity2")

    # Check JSON is valid array
    if ! echo "$result" | jq -e '. | if type == "array" then . else empty end' >/dev/null 2>&1; then
        test_fail "Invalid array JSON output"
        return
    fi

    # Check array length
    local count
    count=$(echo "$result" | jq 'length')

    if [[ "$count" == "2" ]]; then
        test_pass
    else
        test_fail "Expected array with 2 entities, got $count"
    fi
}

test_mem0_build_relations_array() {
    test_start "mem0_build_relations_array creates array from multiple relations"

    local rel1 rel2
    rel1=$(mem0_build_graph_relation "a" "b" "uses")
    rel2=$(mem0_build_graph_relation "c" "d" "requires")

    local result
    result=$(mem0_build_relations_array "$rel1" "$rel2")

    # Check JSON is valid array
    if ! echo "$result" | jq -e '. | if type == "array" then . else empty end' >/dev/null 2>&1; then
        test_fail "Invalid array JSON output"
        return
    fi

    # Check array length
    local count
    count=$(echo "$result" | jq 'length')

    if [[ "$count" == "2" ]]; then
        test_pass
    else
        test_fail "Expected array with 2 relations, got $count"
    fi
}

# =============================================================================
# Test: validate_agent_id function
# =============================================================================

test_validate_agent_id_known_agent() {
    test_start "validate_agent_id accepts known agents"

    if validate_agent_id "database-engineer" 2>/dev/null; then
        test_pass
    else
        test_fail "Expected validation to pass for 'database-engineer'"
    fi
}

test_validate_agent_id_with_prefix() {
    test_start "validate_agent_id handles ork: prefix"

    if validate_agent_id "ork:database-engineer" 2>/dev/null; then
        test_pass
    else
        test_fail "Expected validation to pass for 'ork:database-engineer'"
    fi
}

test_validate_agent_id_custom_pattern() {
    test_start "validate_agent_id accepts custom agent IDs matching pattern"

    if validate_agent_id "my-custom-agent" 2>/dev/null; then
        test_pass
    else
        test_fail "Expected validation to pass for valid custom pattern"
    fi
}

test_validate_agent_id_invalid_pattern() {
    test_start "validate_agent_id rejects invalid patterns"

    # Should fail for agent IDs with uppercase or special chars
    if ! validate_agent_id "Invalid_Agent!" 2>/dev/null; then
        test_pass
    else
        test_fail "Expected validation to fail for 'Invalid_Agent!'"
    fi
}

test_validate_agent_id_multiple_agents() {
    test_start "validate_agent_id accepts all known agents"

    local agents=("backend-system-architect" "frontend-ui-developer" "security-auditor" "test-generator")
    local all_passed=true

    for agent in "${agents[@]}"; do
        if ! validate_agent_id "$agent" 2>/dev/null; then
            all_passed=false
            break
        fi
    done

    if [[ "$all_passed" == "true" ]]; then
        test_pass
    else
        test_fail "Some known agents failed validation"
    fi
}

# =============================================================================
# Test: Agent ID formatting
# =============================================================================

test_mem0_format_agent_id() {
    test_start "mem0_format_agent_id adds ork: prefix"

    local result
    result=$(mem0_format_agent_id "database-engineer")

    if [[ "$result" == "ork:database-engineer" ]]; then
        test_pass
    else
        test_fail "Expected 'ork:database-engineer', got '$result'"
    fi
}

test_mem0_format_agent_id_idempotent() {
    test_start "mem0_format_agent_id is idempotent"

    local result
    result=$(mem0_format_agent_id "ork:database-engineer")

    if [[ "$result" == "ork:database-engineer" ]]; then
        test_pass
    else
        test_fail "Expected 'ork:database-engineer', got '$result' (double prefix?)"
    fi
}

# =============================================================================
# Test: Graph + Agent ID combination
# =============================================================================

test_mem0_add_with_graph_and_agent() {
    test_start "mem0_add_memory_json combines enable_graph and agent_id"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_add_memory_json "agents" "Agent uses tool" '{}' "true" "database-engineer")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check both enable_graph and agent_id are present
    local has_graph agent_id
    has_graph=$(echo "$result" | jq -r '.enable_graph // empty')
    agent_id=$(echo "$result" | jq -r '.agent_id // empty')

    if [[ "$has_graph" == "true" ]] && [[ "$agent_id" == "ork:database-engineer" ]]; then
        test_pass
    else
        test_fail "Expected both enable_graph=true and agent_id, got graph='$has_graph', agent='$agent_id'"
    fi
}

test_mem0_search_with_graph_and_agent() {
    test_start "mem0_search_memory_json combines enable_graph and agent_id"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_search_memory_json "agents" "tool usage" 10 "true" "database-engineer")

    # Check JSON is valid
    if ! echo "$result" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check both enable_graph and agent_id filter are present
    local has_graph agent_filter
    has_graph=$(echo "$result" | jq -r '.enable_graph // empty')
    agent_filter=$(echo "$result" | jq -r '.filters.AND[] | select(.agent_id) | .agent_id // empty')

    if [[ "$has_graph" == "true" ]] && [[ "$agent_filter" == "ork:database-engineer" ]]; then
        test_pass
    else
        test_fail "Expected both enable_graph=true and agent_id filter, got graph='$has_graph', agent='$agent_filter'"
    fi
}

# =============================================================================
# Run All Tests
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Mem0 Library v1.1.0 Enhancement Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Graph Memory Support (enable_graph flag)"
echo "────────────────────────────────────────"
test_mem0_add_with_graph_flag
test_mem0_add_without_graph_flag
test_mem0_search_with_graph_flag
test_mem0_search_without_graph_flag

echo ""
echo "▶ Agent ID Support"
echo "────────────────────────────────────────"
test_mem0_add_with_agent_id
test_mem0_add_with_prefixed_agent_id
test_mem0_add_without_agent_id
test_mem0_search_with_agent_id
test_mem0_search_with_category_and_agent

echo ""
echo "▶ Global User ID"
echo "────────────────────────────────────────"
test_mem0_global_user_id
test_mem0_global_user_id_default
test_mem0_add_with_global_flag

echo ""
echo "▶ Graph Entity Building"
echo "────────────────────────────────────────"
test_mem0_build_graph_entity
test_mem0_build_graph_entity_single_observation

echo ""
echo "▶ Graph Relation Building"
echo "────────────────────────────────────────"
test_mem0_build_graph_relation

echo ""
echo "▶ Graph Array Builders"
echo "────────────────────────────────────────"
test_mem0_build_entities_array
test_mem0_build_relations_array

echo ""
echo "▶ Agent ID Validation"
echo "────────────────────────────────────────"
test_validate_agent_id_known_agent
test_validate_agent_id_with_prefix
test_validate_agent_id_custom_pattern
test_validate_agent_id_invalid_pattern
test_validate_agent_id_multiple_agents

echo ""
echo "▶ Agent ID Formatting"
echo "────────────────────────────────────────"
test_mem0_format_agent_id
test_mem0_format_agent_id_idempotent

echo ""
echo "▶ Combined Features"
echo "────────────────────────────────────────"
test_mem0_add_with_graph_and_agent
test_mem0_search_with_graph_and_agent

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  Total:   $TESTS_RUN"
echo "  Passed:  $TESTS_PASSED"
echo "  Failed:  $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "  \033[0;32mALL TESTS PASSED!\033[0m"
    exit 0
else
    echo -e "  \033[0;31mSOME TESTS FAILED\033[0m"
    exit 1
fi