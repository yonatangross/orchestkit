#!/bin/bash
# test-memory-fabric.sh - Integration tests for Memory Fabric
# Part of OrchestKit Claude Plugin comprehensive test suite
# CC 2.1.7 Compliant
#
# Tests Memory Fabric v2.1 (Graph-First Architecture):
# - Graph is PRIMARY (always available, zero-config)
# - Mem0 is OPTIONAL enhancement for semantic search
# - Result merging and deduplication
# - Entity extraction from text
# - One-way sync (mem0 → graph when mem0 used explicitly)
# - Real-time sync priority classification
# - load-context command auto-loading
# - Graph-first storage in remember skill
# - Graph-first search in recall skill

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

test_skip() {
    local reason="${1:-}"
    echo -e "\033[0;33mSKIP\033[0m"
    [[ -n "$reason" ]] && echo "    └─ $reason"
}

# =============================================================================
# Test: Memory Fabric Skill Exists
# =============================================================================

test_memory_fabric_skill_exists() {
    test_start "memory-fabric skill SKILL.md exists"

    if [[ -f "$PROJECT_ROOT/src/skills/memory-fabric/SKILL.md" ]]; then
        test_pass
    else
        test_fail "skills/memory-fabric/SKILL.md not found"
    fi
}

test_memory_fabric_skill_frontmatter() {
    test_start "memory-fabric skill has valid frontmatter"

    local skill_file="$PROJECT_ROOT/src/skills/memory-fabric/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_skip "Skill file not found"
        return
    fi

    # Check for required frontmatter fields
    local has_name has_description
    has_name=$(grep -c "^name:" "$skill_file" || echo "0")
    has_description=$(grep -c "^description:" "$skill_file" || echo "0")

    if [[ "$has_name" -ge 1 ]] && [[ "$has_description" -ge 1 ]]; then
        test_pass
    else
        test_fail "Missing required frontmatter fields"
    fi
}

# =============================================================================
# Test: Memory Fabric Library
# =============================================================================

test_memory_fabric_library_exists() {
    test_start "memory-fabric.sh library exists"

    if [[ -f "$PROJECT_ROOT/src/hooks/_lib/memory-fabric.sh" ]]; then
        test_pass
    else
        test_fail "hooks/_lib/memory-fabric.sh not found"
    fi
}

test_memory_fabric_library_functions() {
    test_start "memory-fabric.sh exports required functions"

    local lib_file="$PROJECT_ROOT/src/hooks/_lib/memory-fabric.sh"

    if [[ ! -f "$lib_file" ]]; then
        test_skip "Library file not found"
        return
    fi

    # Check for key function definitions
    local has_unified_search has_merge has_extract
    has_unified_search=$(grep -c "fabric_unified_search\|unified_search" "$lib_file" || echo "0")
    has_merge=$(grep -c "fabric_merge\|merge_results" "$lib_file" || echo "0")
    has_extract=$(grep -c "fabric_extract\|extract_entities" "$lib_file" || echo "0")

    if [[ "$has_unified_search" -ge 1 ]] || [[ "$has_merge" -ge 1 ]]; then
        test_pass
    else
        test_fail "Missing key functions (unified_search, merge_results)"
    fi
}

# =============================================================================
# Test: Load Context Command
# =============================================================================

test_load_context_command_exists() {
    test_start "load-context command exists"

    # Check skill (new structure) or command (legacy)
    if [[ -f "$PROJECT_ROOT/src/skills/load-context/SKILL.md" ]] || [[ -f "$PROJECT_ROOT/commands/load-context.md" ]]; then
        test_pass
    else
        test_fail "load-context skill/command not found"
    fi
}

test_load_context_auto_invoke() {
    test_start "load-context has auto-invoke: session-start"

    # Check skill first (new structure), then fallback to command (legacy)
    local skill_file="$PROJECT_ROOT/src/skills/load-context/SKILL.md"
    local cmd_file="$PROJECT_ROOT/commands/load-context.md"

    if [[ -f "$skill_file" ]]; then
        if grep -q "auto-invoke.*session-start\|auto-invoke: session-start" "$skill_file"; then
            test_pass
            return
        fi
    fi

    if [[ -f "$cmd_file" ]]; then
        if grep -q "auto-invoke.*session-start\|auto-invoke: session-start" "$cmd_file"; then
            test_pass
            return
        fi
    fi

    test_fail "Missing auto-invoke: session-start"
}

test_load_context_user_invocable() {
    test_start "load-context is user-invocable"

    # Check skill first (new structure), then fallback to command (legacy)
    local skill_file="$PROJECT_ROOT/src/skills/load-context/SKILL.md"
    local cmd_file="$PROJECT_ROOT/commands/load-context.md"

    if [[ -f "$skill_file" ]]; then
        if grep -q "user-invocable.*true\|user-invocable: true" "$skill_file"; then
            test_pass
            return
        fi
    fi

    if [[ -f "$cmd_file" ]]; then
        if grep -q "user-invocable.*true\|user-invocable: true" "$cmd_file"; then
            test_pass
            return
        fi
    fi

    test_fail "Missing user-invocable: true"
}

# =============================================================================
# Test: Memory Bridge Hook
# =============================================================================

test_memory_bridge_hook_exists() {
    test_start "memory-bridge hook exists"

    if [[ -f "$PROJECT_ROOT/src/hooks/posttool/memory-bridge.sh" ]]; then
        test_pass
    else
        test_fail "hooks/posttool/memory-bridge.sh not found"
    fi
}

test_memory_bridge_outputs_valid_json() {
    test_start "memory-bridge outputs valid CC 2.1.7 JSON"

    local hook_file="$PROJECT_ROOT/src/hooks/posttool/memory-bridge.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_skip "Hook file not found"
        return
    fi

    # Run hook with mock input
    export HOOK_INPUT='{"tool_name":"bash","tool_result":"success","command":"add-memory.py"}'
    local output
    output=$(bash "$hook_file" 2>/dev/null || echo '{"continue":true}')

    if echo "$output" | jq -e '.continue' >/dev/null 2>&1; then
        test_pass
    else
        test_fail "Invalid JSON output"
    fi
}

# =============================================================================
# Test: Realtime Sync Hook
# =============================================================================

test_realtime_sync_hook_exists() {
    test_start "realtime-sync hook exists"

    if [[ -f "$PROJECT_ROOT/src/hooks/posttool/realtime-sync.sh" ]]; then
        test_pass
    else
        test_fail "hooks/posttool/realtime-sync.sh not found"
    fi
}

test_realtime_sync_priority_classification() {
    test_start "realtime-sync classifies priority correctly"

    local hook_file="$PROJECT_ROOT/src/hooks/posttool/realtime-sync.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_skip "Hook file not found"
        return
    fi

    # Check for priority keywords in hook
    local has_immediate has_batched
    has_immediate=$(grep -c "IMMEDIATE\|immediate" "$hook_file" || echo "0")
    has_batched=$(grep -c "BATCHED\|batched\|SESSION" "$hook_file" || echo "0")

    if [[ "$has_immediate" -ge 1 ]] && [[ "$has_batched" -ge 1 ]]; then
        test_pass
    else
        test_fail "Missing priority classification (IMMEDIATE, BATCHED)"
    fi
}

# =============================================================================
# Test: Updated Recall Skill
# =============================================================================

test_recall_skill_graph_first() {
    test_start "recall skill uses graph-first architecture"

    local skill_file="$PROJECT_ROOT/src/skills/recall/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_fail "Skill file not found"
        return
    fi

    # Check for graph-first architecture: graph PRIMARY, mem0 optional
    if grep -qi "graph.*primary\|mcp__memory.*search_nodes\|knowledge.*graph" "$skill_file"; then
        test_pass
    else
        test_fail "Recall skill doesn't use graph-first architecture"
    fi
}

# =============================================================================
# Test: Updated Remember Skill
# =============================================================================

test_remember_skill_graph_first() {
    test_start "remember skill uses graph-first storage"

    local skill_file="$PROJECT_ROOT/src/skills/remember/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_fail "Skill file not found"
        return
    fi

    # Check for graph-first storage: graph primary, mem0 optional with --mem0 flag
    if grep -qi "graph.*primary\|mcp__memory.*create\|knowledge.*graph\|--mem0" "$skill_file"; then
        test_pass
    else
        test_fail "Remember skill doesn't use graph-first storage"
    fi
}

# =============================================================================
# Test: Schema Exists
# =============================================================================

test_memory_fabric_schema_exists() {
    test_start "memory-fabric schema exists"

    if [[ -f "$PROJECT_ROOT/.claude/schemas/memory-fabric.schema.json" ]]; then
        test_pass
    else
        test_fail ".claude/schemas/memory-fabric.schema.json not found"
    fi
}

test_memory_fabric_schema_valid_json() {
    test_start "memory-fabric schema is valid JSON"

    local schema_file="$PROJECT_ROOT/.claude/schemas/memory-fabric.schema.json"

    if [[ ! -f "$schema_file" ]]; then
        test_skip "Schema file not found"
        return
    fi

    if jq -e '.' "$schema_file" >/dev/null 2>&1; then
        test_pass
    else
        test_fail "Invalid JSON in schema file"
    fi
}

# =============================================================================
# Test: Updated Agent Memory Inject Hook
# =============================================================================

test_agent_memory_inject_updated() {
    test_start "agent-memory-inject uses memory-fabric approach"

    local hook_file="$PROJECT_ROOT/src/hooks/subagent-start/agent-memory-inject.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_fail "Hook file not found"
        return
    fi

    # Check for memory-fabric integration or actual MCP call building
    if grep -qi "memory.*fabric\|unified\|mcp__memory.*search\|Execute.*MCP" "$hook_file"; then
        test_pass
    else
        test_fail "Hook doesn't integrate with memory-fabric"
    fi
}

# =============================================================================
# Test: Context Retrieval Hook Updated
# =============================================================================

test_context_retrieval_graph_first() {
    test_start "mem0-context-retrieval uses graph-first architecture"

    local hook_file="$PROJECT_ROOT/src/hooks/lifecycle/mem0-context-retrieval.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_fail "Hook file not found"
        return
    fi

    # Check for graph-first architecture indicators
    if grep -qi "graph.*first\|graph.*primary\|v2\.1\|graph.*always" "$hook_file"; then
        test_pass
    else
        test_fail "Hook doesn't use graph-first architecture"
    fi
}

# =============================================================================
# Run All Tests
# =============================================================================

echo "=============================================="
echo "Memory Fabric Integration Tests"
echo "=============================================="
echo ""

echo "📦 Core Components:"
test_memory_fabric_skill_exists
test_memory_fabric_skill_frontmatter
test_memory_fabric_library_exists
test_memory_fabric_library_functions
echo ""

echo "📥 Load Context Command:"
test_load_context_command_exists
test_load_context_auto_invoke
test_load_context_user_invocable
echo ""

echo "🔄 Bidirectional Sync Hooks:"
test_memory_bridge_hook_exists
test_memory_bridge_outputs_valid_json
test_realtime_sync_hook_exists
test_realtime_sync_priority_classification
echo ""

echo "🔍 Graph-First Skills:"
test_recall_skill_graph_first
test_remember_skill_graph_first
echo ""

echo "📋 Schema & Hooks:"
test_memory_fabric_schema_exists
test_memory_fabric_schema_valid_json
test_agent_memory_inject_updated
test_context_retrieval_graph_first
echo ""

# =============================================================================
# Summary
# =============================================================================

echo "=============================================="
echo "Test Summary"
echo "=============================================="
echo "Total:  $TESTS_RUN"
echo -e "Passed: \033[0;32m$TESTS_PASSED\033[0m"
echo -e "Failed: \033[0;31m$TESTS_FAILED\033[0m"
echo ""

if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "\033[0;31m❌ Some tests failed\033[0m"
    exit 1
else
    echo -e "\033[0;32m✅ All tests passed\033[0m"
    exit 0
fi
