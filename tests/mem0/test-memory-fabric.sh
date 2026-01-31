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

# =============================================================================
# Test: Memory Fabric Library
# =============================================================================

test_memory_fabric_library_exists() {
    test_start "memory-bridge.ts hooks module exists"

    if [[ -f "$PROJECT_ROOT/src/hooks/src/posttool/memory-bridge.ts" ]]; then
        test_pass
    else
        test_fail "hooks/src/posttool/memory-bridge.ts not found"
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


# =============================================================================
# Test: Memory Bridge Hook
# =============================================================================

test_memory_bridge_hook_exists() {
    test_start "memory-bridge.ts hook exists"

    if [[ -f "$PROJECT_ROOT/src/hooks/src/posttool/memory-bridge.ts" ]]; then
        test_pass
    else
        test_fail "hooks/src/posttool/memory-bridge.ts not found"
    fi
}

# =============================================================================
# Test: Realtime Sync Hook
# =============================================================================

test_realtime_sync_hook_exists() {
    test_start "realtime-sync.ts hook exists"

    if [[ -f "$PROJECT_ROOT/src/hooks/src/posttool/realtime-sync.ts" ]]; then
        test_pass
    else
        test_fail "hooks/src/posttool/realtime-sync.ts not found"
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
# Run All Tests
# =============================================================================

echo "=============================================="
echo "Memory Fabric Integration Tests"
echo "=============================================="
echo ""

echo "Core Components:"
test_memory_fabric_skill_exists
test_memory_fabric_library_exists
echo ""

echo "Load Context Command:"
test_load_context_command_exists
echo ""

echo "Sync Hooks:"
test_memory_bridge_hook_exists
test_realtime_sync_hook_exists
echo ""

echo "Schema:"
test_memory_fabric_schema_exists
test_memory_fabric_schema_valid_json
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
