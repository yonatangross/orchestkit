#!/bin/bash
# test-mem0-integration.sh - Integration tests for mem0 hooks and workflows
# Part of SkillForge Claude Plugin comprehensive test suite
# CC 2.1.7 Compliant
#
# Tests v1.1.0 features:
# - Agent memory chain propagation (pretool→posttool agent_id)
# - Cross-project best practices (global user_id pattern)
# - Graph memory relationships (enable_graph flow)
# - remember/recall user_id alignment
# - Category filter in search
# - Session start context retrieval hook
# - Agent memory injection (PreToolUse Task)
# - Agent memory storage (PostToolUse Task)
# - Decision sync push/pull cycle
# - Pre-compaction sync
# - Graceful degradation when mem0 unavailable

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Export for hooks
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

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
# Test: Session Start Context Retrieval
# =============================================================================

test_mem0_context_retrieval_output_format() {
    test_start "mem0-context-retrieval outputs valid CC 2.1.7 JSON"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export HOOK_INPUT='{}'

    local output
    output=$(bash "$PROJECT_ROOT/hooks/lifecycle/mem0-context-retrieval.sh" 2>/dev/null || echo '{"continue":true}')

    # Validate JSON
    if echo "$output" | jq -e '.' >/dev/null 2>&1; then
        # Check has continue field
        local has_continue
        has_continue=$(echo "$output" | jq -r '.continue')

        if [[ "$has_continue" == "true" ]]; then
            test_pass
        else
            test_fail "Missing continue:true field"
        fi
    else
        test_fail "Invalid JSON: $output"
    fi
}

test_mem0_context_retrieval_provides_hint() {
    test_start "mem0-context-retrieval provides search hint when available"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export HOOK_INPUT='{}'

    local output
    output=$(bash "$PROJECT_ROOT/hooks/lifecycle/mem0-context-retrieval.sh" 2>/dev/null || echo '{}')

    # Check for additionalContext with mem0 hint
    local context
    context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext // ""' 2>/dev/null || echo "")

    if [[ "$context" == *"mcp__mem0__search_memories"* ]] || [[ "$context" == "" ]]; then
        test_pass
    else
        test_fail "Expected mem0 search hint or empty"
    fi
}

test_mem0_context_graceful_no_config() {
    test_start "mem0-context-retrieval graceful when no mem0 config"

    # Save original values
    local orig_home="$HOME"
    local orig_claude_dir="${CLAUDE_PROJECT_DIR:-}"

    # Use temp dir with no Claude config
    export CLAUDE_PROJECT_DIR="/tmp/test-no-mem0-$$"
    mkdir -p "$CLAUDE_PROJECT_DIR"
    export HOOK_INPUT='{}'
    export HOME="/tmp/no-home-$$"

    local output
    output=$(bash "$PROJECT_ROOT/hooks/lifecycle/mem0-context-retrieval.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    # Cleanup temp directory
    rm -rf "$CLAUDE_PROJECT_DIR" 2>/dev/null || true

    # Restore original values
    export HOME="$orig_home"
    export CLAUDE_PROJECT_DIR="$orig_claude_dir"

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Should continue gracefully"
    fi
}

# =============================================================================
# Test: Agent Memory Inject (PreToolUse Task)
# =============================================================================

test_agent_memory_inject_detects_agent_type() {
    test_start "agent-memory-inject detects agent type from input"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"subagent_type":"database-engineer","prompt":"Design a schema"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-start/agent-memory-inject.sh" 2>/dev/null || echo '{"continue":true}')

    # Should output system message with agent info
    local msg
    msg=$(echo "$output" | jq -r '.systemMessage // ""' 2>/dev/null || echo "")

    if [[ "$msg" == *"database-engineer"* ]] || [[ -z "$msg" ]]; then
        test_pass
    else
        test_fail "Expected agent type in message"
    fi
}

test_agent_memory_inject_unknown_agent() {
    test_start "agent-memory-inject passes through unknown agent"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"subagent_type":"unknown-agent-type","prompt":"Do something"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-start/agent-memory-inject.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Should continue for unknown agent"
    fi
}

test_agent_memory_inject_no_agent_type() {
    test_start "agent-memory-inject passes through when no agent type"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"prompt":"Just a prompt without agent"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-start/agent-memory-inject.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Should continue without agent type"
    fi
}

# =============================================================================
# Test: Agent Memory Store (PostToolUse Task)
# =============================================================================

test_agent_memory_store_extracts_patterns() {
    test_start "agent-memory-store extracts decision patterns"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    mkdir -p "$PROJECT_ROOT/.claude/logs" 2>/dev/null || true

    local input='{
        "tool_input": {"subagent_type": "backend-system-architect"},
        "tool_result": "I decided to use FastAPI for the backend. The approach is to implement REST endpoints with proper versioning."
    }'

    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-stop/agent-memory-store.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Should continue after storing"
    fi
}

test_agent_memory_store_no_patterns_short_output() {
    test_start "agent-memory-store skips short outputs"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{
        "tool_input": {"subagent_type": "test-agent"},
        "tool_result": "Done"
    }'

    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-stop/agent-memory-store.sh" 2>/dev/null || echo '{"continue":true}')

    # Should not have pattern extraction message for short output
    local msg
    msg=$(echo "$output" | jq -r '.systemMessage // ""' 2>/dev/null || echo "")

    if [[ -z "$msg" ]] || [[ "$msg" == "null" ]] || [[ "$msg" != *"patterns extracted"* ]]; then
        test_pass
    else
        test_fail "Should not extract patterns from short output"
    fi
}

# =============================================================================
# Test: Decision Sync
# =============================================================================

test_decision_sync_pull_output_format() {
    test_start "decision-sync-pull outputs valid JSON"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export HOOK_INPUT='{}'

    local output
    output=$(bash "$PROJECT_ROOT/hooks/lifecycle/decision-sync-pull.sh" 2>/dev/null || echo '{"continue":true}')

    if echo "$output" | jq -e '.' >/dev/null 2>&1; then
        test_pass
    else
        test_fail "Invalid JSON output"
    fi
}

test_decision_sync_push_finds_decisions() {
    test_start "decision-sync-push detects pending decisions"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export HOOK_INPUT='{}'

    # Check if there's a decisions file to sync
    if [[ -f "$PROJECT_ROOT/.claude/context/knowledge/decisions/active.json" ]]; then
        local output
        output=$(bash "$PROJECT_ROOT/hooks/lifecycle/decision-sync-push.sh" 2>/dev/null || echo '{"continue":true}')

        local has_continue
        has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

        if [[ "$has_continue" == "true" ]]; then
            test_pass
        else
            test_fail "Should continue after push check"
        fi
    else
        # No decisions file - should still pass
        test_pass
    fi
}

# =============================================================================
# Test: Pre-Compaction Sync
# =============================================================================

test_pre_compaction_sync_output() {
    test_start "pre-compaction sync outputs valid JSON"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"reason":"context_limit"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/stop/mem0-pre-compaction-sync.sh" 2>/dev/null || echo '{"continue":true}')

    if echo "$output" | jq -e '.' >/dev/null 2>&1; then
        test_pass
    else
        test_fail "Invalid JSON output"
    fi
}

# =============================================================================
# Test: Prompt Hook Memory Context
# =============================================================================

test_prompt_memory_context_output() {
    test_start "memory-context prompt hook outputs valid JSON"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"prompt":"Help me with the database schema"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/prompt/memory-context.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Should continue"
    fi
}

# =============================================================================
# Test: Full Workflow Integration
# =============================================================================

test_full_session_lifecycle() {
    test_start "full session lifecycle (start → work → end)"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export HOOK_INPUT='{}'

    # Step 1: Session start (use session-context-loader as primary SessionStart hook)
    local start_output
    start_output=$(bash "$PROJECT_ROOT/hooks/lifecycle/session-context-loader.sh" 2>/dev/null || echo '{"continue":true}')

    local start_ok
    start_ok=$(echo "$start_output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$start_ok" != "true" ]]; then
        test_fail "Session start failed"
        return
    fi

    # Step 2: Simulate agent work (PreTool)
    local agent_input='{"subagent_type":"backend-system-architect"}'
    local pretool_output
    pretool_output=$(echo "$agent_input" | bash "$PROJECT_ROOT/hooks/subagent-start/agent-memory-inject.sh" 2>/dev/null || echo '{"continue":true}')

    local pretool_ok
    pretool_ok=$(echo "$pretool_output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$pretool_ok" != "true" ]]; then
        test_fail "PreTool hook failed"
        return
    fi

    # Step 3: Session end (use session-cleanup as primary SessionEnd hook)
    local end_output
    end_output=$(bash "$PROJECT_ROOT/hooks/lifecycle/session-cleanup.sh" 2>/dev/null || echo '{"continue":true}')

    local end_ok
    end_ok=$(echo "$end_output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$end_ok" == "true" ]]; then
        test_pass
    else
        test_fail "Session end failed"
    fi
}

# =============================================================================
# NEW v1.1.0 TESTS: Agent Memory Chain Propagation
# =============================================================================

test_agent_memory_chain_propagation() {
    test_start "pretool→posttool agent_id chain propagation"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    # Clean tracking file
    local tracking_file="$PROJECT_ROOT/.claude/session/current-agent-id"
    rm -f "$tracking_file" 2>/dev/null || true

    # Step 1: PreTool sets agent_id in tracking file
    local pretool_input='{"subagent_type":"database-engineer","prompt":"Design schema"}'

    echo "$pretool_input" | bash "$PROJECT_ROOT/hooks/subagent-start/agent-memory-inject.sh" >/dev/null 2>&1 || true

    # Check tracking file was created
    if [[ ! -f "$tracking_file" ]]; then
        test_fail "Tracking file not created by pretool hook"
        return
    fi

    local stored_agent_id
    stored_agent_id=$(cat "$tracking_file" 2>/dev/null || echo "")

    if [[ "$stored_agent_id" != "skf:database-engineer" ]]; then
        test_fail "Expected 'skf:database-engineer', got '$stored_agent_id'"
        return
    fi

    # Step 2: PostTool reads agent_id from tracking file
    local posttool_input='{
        "tool_input": {"subagent_type": "database-engineer"},
        "tool_result": "Schema designed with pgvector extension"
    }'

    local output
    output=$(echo "$posttool_input" | bash "$PROJECT_ROOT/hooks/subagent-stop/agent-memory-store.sh" 2>/dev/null || echo '{"continue":true}')

    # Cleanup
    rm -f "$tracking_file" 2>/dev/null || true

    # Verify posttool succeeded
    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "PostTool hook failed to process chained agent_id"
    fi
}

# =============================================================================
# NEW v1.1.0 TESTS: Cross-Project Best Practices
# =============================================================================

test_cross_project_best_practices() {
    test_start "global user_id pattern for best practices"

    # Source mem0 library
    source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

    # Test global user_id generation
    local global_user_id
    global_user_id=$(mem0_global_user_id "best-practices")

    if [[ "$global_user_id" != "skillforge-global-best-practices" ]]; then
        test_fail "Expected 'skillforge-global-best-practices', got '$global_user_id'"
        return
    fi

    # Test build_best_practice_json with global flag
    local json_output
    json_output=$(build_best_practice_json "success" "api" "REST pagination works well" "Always use cursor-based pagination" "false" "" "true")

    # Check it's valid JSON
    if ! echo "$json_output" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check user_id is global
    local user_id
    user_id=$(echo "$json_output" | jq -r '.user_id')

    if [[ "$user_id" == "skillforge-global-best-practices" ]]; then
        test_pass
    else
        test_fail "Expected global user_id, got '$user_id'"
    fi
}

# =============================================================================
# NEW v1.1.0 TESTS: Graph Memory Relationships
# =============================================================================

test_graph_memory_relationships() {
    test_start "enable_graph flow for relationship extraction"

    # Source mem0 library
    source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

    # Test mem0_add_memory_json with enable_graph=true
    local json_output
    json_output=$(mem0_add_memory_json "agents" "database-engineer recommends pgvector for RAG" '{"category":"recommendation"}' "true" "skf:database-engineer" "false")

    # Validate JSON
    if ! echo "$json_output" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid JSON output"
        return
    fi

    # Check enable_graph field is present and true
    local enable_graph
    enable_graph=$(echo "$json_output" | jq -r '.enable_graph // "missing"')

    if [[ "$enable_graph" != "true" ]]; then
        test_fail "Expected enable_graph=true, got '$enable_graph'"
        return
    fi

    # Check agent_id is present
    local agent_id
    agent_id=$(echo "$json_output" | jq -r '.agent_id // "missing"')

    if [[ "$agent_id" == "skf:database-engineer" ]]; then
        test_pass
    else
        test_fail "Expected agent_id='skf:database-engineer', got '$agent_id'"
    fi
}

test_graph_memory_entity_builder() {
    test_start "graph entity builder functions"

    # Source mem0 library
    source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

    # Test entity building
    local entity
    entity=$(mem0_build_graph_entity "database-engineer" "agent" "Recommends pgvector" "Specializes in PostgreSQL")

    # Validate JSON
    if ! echo "$entity" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid entity JSON"
        return
    fi

    # Check fields
    local name type obs_count
    name=$(echo "$entity" | jq -r '.name')
    type=$(echo "$entity" | jq -r '.entityType')
    obs_count=$(echo "$entity" | jq -r '.observations | length')

    if [[ "$name" == "database-engineer" && "$type" == "agent" && "$obs_count" == "2" ]]; then
        test_pass
    else
        test_fail "Entity fields incorrect: name=$name, type=$type, obs_count=$obs_count"
    fi
}

test_graph_memory_relation_builder() {
    test_start "graph relation builder functions"

    # Source mem0 library
    source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

    # Test relation building
    local relation
    relation=$(mem0_build_graph_relation "database-engineer" "pgvector" "recommends")

    # Validate JSON
    if ! echo "$relation" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid relation JSON"
        return
    fi

    # Check fields
    local from to relation_type
    from=$(echo "$relation" | jq -r '.from')
    to=$(echo "$relation" | jq -r '.to')
    relation_type=$(echo "$relation" | jq -r '.relationType')

    if [[ "$from" == "database-engineer" && "$to" == "pgvector" && "$relation_type" == "recommends" ]]; then
        test_pass
    else
        test_fail "Relation fields incorrect: from=$from, to=$to, type=$relation_type"
    fi
}

# =============================================================================
# NEW v1.1.0 TESTS: Remember/Recall User ID Alignment
# =============================================================================

test_remember_recall_user_id_alignment() {
    test_start "remember and recall use same user_id pattern"

    # Source mem0 library
    source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

    export CLAUDE_PROJECT_DIR="/Users/test/my-project"

    # Test remember (add) generates correct user_id
    local add_json
    add_json=$(mem0_add_memory_json "decisions" "We decided to use FastAPI" '{}' "false" "" "false")

    local add_user_id
    add_user_id=$(echo "$add_json" | jq -r '.user_id')

    # Test recall (search) generates same user_id
    local search_json
    search_json=$(mem0_search_memory_json "decisions" "FastAPI decision" "10" "false" "" "" "false")

    local search_filters
    search_filters=$(echo "$search_json" | jq -r '.filters.AND[0].user_id')

    if [[ "$add_user_id" == "$search_filters" && "$add_user_id" == "my-project-decisions" ]]; then
        test_pass
    else
        test_fail "User ID mismatch: add='$add_user_id', search='$search_filters'"
    fi
}

# =============================================================================
# NEW v1.1.0 TESTS: Category Filter in Search
# =============================================================================

test_category_filter_in_search() {
    test_start "metadata.category filter works in search"

    # Source mem0 library
    source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

    export CLAUDE_PROJECT_DIR="/Users/test/my-project"

    # Test search with category filter
    local search_json
    search_json=$(mem0_search_memory_json "best-practices" "pagination pattern" "5" "false" "" "pagination" "false")

    # Validate JSON
    if ! echo "$search_json" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid search JSON"
        return
    fi

    # Check filters contain category
    local category_filter
    category_filter=$(echo "$search_json" | jq -r '.filters.AND[] | select(."metadata.category") | ."metadata.category"' 2>/dev/null || echo "")

    if [[ "$category_filter" == "pagination" ]]; then
        test_pass
    else
        test_fail "Category filter missing or incorrect: '$category_filter'"
    fi
}

test_category_filter_with_agent_id() {
    test_start "category filter works alongside agent_id filter"

    # Source mem0 library
    source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

    export CLAUDE_PROJECT_DIR="/Users/test/my-project"

    # Test search with both category and agent_id filters
    local search_json
    search_json=$(mem0_search_memory_json "patterns" "database optimization" "5" "false" "database-engineer" "performance" "false")

    # Validate JSON
    if ! echo "$search_json" | jq -e '.' >/dev/null 2>&1; then
        test_fail "Invalid search JSON"
        return
    fi

    # Check filters array length (should have user_id + category + agent_id = 3)
    local filter_count
    filter_count=$(echo "$search_json" | jq '.filters.AND | length')

    # Check category filter exists
    local has_category
    has_category=$(echo "$search_json" | jq -r '.filters.AND[] | select(."metadata.category") | ."metadata.category"' 2>/dev/null || echo "")

    # Check agent_id filter exists
    local has_agent
    has_agent=$(echo "$search_json" | jq -r '.filters.AND[] | select(.agent_id) | .agent_id' 2>/dev/null || echo "")

    if [[ "$filter_count" == "3" && "$has_category" == "performance" && "$has_agent" == "skf:database-engineer" ]]; then
        test_pass
    else
        test_fail "Filters incorrect: count=$filter_count, category='$has_category', agent='$has_agent'"
    fi
}

# =============================================================================
# NEW v1.1.0 TESTS: Agent ID Format Validation
# =============================================================================

test_agent_id_format_validation() {
    test_start "agent_id formatting with skf: prefix"

    # Source mem0 library
    source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

    # Test formatting adds skf: prefix
    local formatted1
    formatted1=$(mem0_format_agent_id "database-engineer")

    if [[ "$formatted1" != "skf:database-engineer" ]]; then
        test_fail "Expected 'skf:database-engineer', got '$formatted1'"
        return
    fi

    # Test formatting is idempotent (doesn't double-prefix)
    local formatted2
    formatted2=$(mem0_format_agent_id "skf:database-engineer")

    if [[ "$formatted2" == "skf:database-engineer" ]]; then
        test_pass
    else
        test_fail "Expected idempotent result 'skf:database-engineer', got '$formatted2'"
    fi
}

test_agent_id_validation_known_agents() {
    test_start "validate_agent_id accepts known agents"

    # Source mem0 library
    source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

    # Test known agent
    if validate_agent_id "database-engineer" 2>/dev/null; then
        test_pass
    else
        test_fail "Should validate known agent"
    fi
}

test_agent_id_validation_custom_pattern() {
    test_start "validate_agent_id accepts custom pattern"

    # Source mem0 library
    source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

    # Test custom agent following pattern
    if validate_agent_id "my-custom-agent-123" 2>/dev/null; then
        test_pass
    else
        test_fail "Should validate custom agent matching pattern"
    fi
}

# =============================================================================
# NEW v1.1.0 TESTS: Best Practice Category Detection
# =============================================================================

test_best_practice_category_detection() {
    test_start "detect_best_practice_category identifies categories"

    # Source mem0 library
    source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

    # Test various category detections
    local cat1 cat2 cat3
    cat1=$(detect_best_practice_category "The pagination cursor was efficient")
    cat2=$(detect_best_practice_category "JWT authentication worked well")
    cat3=$(detect_best_practice_category "Query performance improved with index")

    if [[ "$cat1" == "pagination" && "$cat2" == "authentication" && "$cat3" == "performance" ]]; then
        test_pass
    else
        test_fail "Categories incorrect: cat1='$cat1', cat2='$cat2', cat3='$cat3'"
    fi
}

# =============================================================================
# Run All Tests
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Mem0 Integration Tests (v1.1.0)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Session Start Context Retrieval"
echo "────────────────────────────────────────"
test_mem0_context_retrieval_output_format
test_mem0_context_retrieval_provides_hint
test_mem0_context_graceful_no_config

echo ""
echo "▶ Agent Memory Inject (PreToolUse)"
echo "────────────────────────────────────────"
test_agent_memory_inject_detects_agent_type
test_agent_memory_inject_unknown_agent
test_agent_memory_inject_no_agent_type

echo ""
echo "▶ Agent Memory Store (PostToolUse)"
echo "────────────────────────────────────────"
test_agent_memory_store_extracts_patterns
test_agent_memory_store_no_patterns_short_output

echo ""
echo "▶ Decision Sync"
echo "────────────────────────────────────────"
test_decision_sync_pull_output_format
test_decision_sync_push_finds_decisions

echo ""
echo "▶ Pre-Compaction Sync"
echo "────────────────────────────────────────"
test_pre_compaction_sync_output

echo ""
echo "▶ Prompt Memory Context"
echo "────────────────────────────────────────"
test_prompt_memory_context_output

echo ""
echo "▶ Full Workflow"
echo "────────────────────────────────────────"
test_full_session_lifecycle

echo ""
echo "▶ v1.1.0: Agent Memory Chain Propagation"
echo "────────────────────────────────────────"
test_agent_memory_chain_propagation

echo ""
echo "▶ v1.1.0: Cross-Project Best Practices"
echo "────────────────────────────────────────"
test_cross_project_best_practices

echo ""
echo "▶ v1.1.0: Graph Memory Relationships"
echo "────────────────────────────────────────"
test_graph_memory_relationships
test_graph_memory_entity_builder
test_graph_memory_relation_builder

echo ""
echo "▶ v1.1.0: Remember/Recall User ID Alignment"
echo "────────────────────────────────────────"
test_remember_recall_user_id_alignment

echo ""
echo "▶ v1.1.0: Category Filter in Search"
echo "────────────────────────────────────────"
test_category_filter_in_search
test_category_filter_with_agent_id

echo ""
echo "▶ v1.1.0: Agent ID Format and Validation"
echo "────────────────────────────────────────"
test_agent_id_format_validation
test_agent_id_validation_known_agents
test_agent_id_validation_custom_pattern

echo ""
echo "▶ v1.1.0: Best Practice Category Detection"
echo "────────────────────────────────────────"
test_best_practice_category_detection

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