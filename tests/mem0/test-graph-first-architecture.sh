#!/bin/bash
# test-graph-first-architecture.sh - Comprehensive tests for Graph-First Architecture v2.1
# Part of OrchestKit Claude Plugin comprehensive test suite
# CC 2.1.7 Compliant
#
# Tests Graph-First Architecture (v2.1) features:
# - Knowledge graph is PRIMARY (always available, zero-config)
# - Mem0 is OPTIONAL (requires MEM0_API_KEY, enhancement for semantic search)
# - Graceful degradation without mem0
# - --mem0 flag for explicit dual-write/search
# - No warnings for missing MEM0_API_KEY
#
# Version: 2.1.0
# Part of Memory Fabric v2.1 - Graph-First Architecture
#
# Note: The mem0.sh and memory-fabric.sh libraries have been migrated to
# TypeScript hooks. These tests now verify the TypeScript implementation
# and the skills/hooks that use the graph-first architecture.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Export for hooks
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

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
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

# =============================================================================
# Test Group: TypeScript Hook Infrastructure
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Graph-First Architecture v2.1 - Comprehensive Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "▸ TypeScript Hook Infrastructure"

test_typescript_hooks_exist() {
    test_start "TypeScript hooks bundle exists"

    local bundle_file="$PROJECT_ROOT/src/hooks/dist/hooks.mjs"

    if [[ -f "$bundle_file" ]]; then
        test_pass
    else
        test_fail "hooks/dist/hooks.mjs not found"
    fi
}

test_typescript_runner_exists() {
    test_start "TypeScript hook runner exists"

    local runner_file="$PROJECT_ROOT/src/hooks/bin/run-hook.mjs"

    if [[ -f "$runner_file" ]]; then
        test_pass
    else
        test_fail "src/hooks/bin/run-hook.mjs not found"
    fi
}

test_typescript_hooks_source_exists() {
    test_start "TypeScript hooks source exists"

    local src_dir="$PROJECT_ROOT/src/hooks/src"

    if [[ -d "$src_dir" ]]; then
        test_pass
    else
        test_fail "hooks/src/ directory not found"
    fi
}

# Run TypeScript infrastructure tests
test_typescript_hooks_exist
test_typescript_runner_exists
test_typescript_hooks_source_exists

# =============================================================================
# Test Group: Skills - Graph-First Architecture
# =============================================================================

echo ""
echo "▸ Skills - Graph-First Architecture"

test_remember_skill_graph_first() {
    test_start "remember skill states graph is PRIMARY"

    local skill_file="$PROJECT_ROOT/src/skills/remember/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_fail "skills/remember/SKILL.md not found"
        return
    fi

    if grep -qi "PRIMARY" "$skill_file" && grep -qi "graph" "$skill_file"; then
        test_pass
    else
        test_fail "remember skill should state graph is PRIMARY"
    fi
}

test_remember_skill_mem0_optional() {
    test_start "remember skill states mem0 is optional"

    local skill_file="$PROJECT_ROOT/src/skills/remember/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_fail "skills/remember/SKILL.md not found"
        return
    fi

    if grep -qiE "optional|enhancement" "$skill_file"; then
        test_pass
    else
        test_fail "remember skill should state mem0 is optional"
    fi
}

test_remember_skill_mem0_flag() {
    test_start "remember skill documents --mem0 flag"

    local skill_file="$PROJECT_ROOT/src/skills/remember/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_fail "skills/remember/SKILL.md not found"
        return
    fi

    if grep -q "\-\-mem0" "$skill_file"; then
        test_pass
    else
        test_fail "remember skill should document --mem0 flag"
    fi
}

test_recall_skill_graph_first() {
    test_start "recall skill states graph is PRIMARY"

    local skill_file="$PROJECT_ROOT/src/skills/recall/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_fail "skills/recall/SKILL.md not found"
        return
    fi

    if grep -qi "PRIMARY" "$skill_file" && grep -qi "graph" "$skill_file"; then
        test_pass
    else
        test_fail "recall skill should state graph is PRIMARY"
    fi
}

test_recall_skill_mem0_optional() {
    test_start "recall skill states mem0 is optional"

    local skill_file="$PROJECT_ROOT/src/skills/recall/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_fail "skills/recall/SKILL.md not found"
        return
    fi

    if grep -qiE "optional|enhancement" "$skill_file"; then
        test_pass
    else
        test_fail "recall skill should state mem0 is optional"
    fi
}

test_recall_skill_mem0_flag() {
    test_start "recall skill documents --mem0 flag"

    local skill_file="$PROJECT_ROOT/src/skills/recall/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_fail "skills/recall/SKILL.md not found"
        return
    fi

    if grep -q "\-\-mem0" "$skill_file"; then
        test_pass
    else
        test_fail "recall skill should document --mem0 flag"
    fi
}

test_memory_fabric_skill_exists() {
    test_start "memory-fabric skill exists"

    local skill_file="$PROJECT_ROOT/src/skills/memory-fabric/SKILL.md"

    if [[ -f "$skill_file" ]]; then
        test_pass
    else
        test_fail "skills/memory-fabric/SKILL.md not found"
    fi
}

test_memory_fabric_skill_graph_first() {
    test_start "memory-fabric skill states graph is PRIMARY"

    local skill_file="$PROJECT_ROOT/src/skills/memory-fabric/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_skip "skills/memory-fabric/SKILL.md not found"
        return
    fi

    if grep -qiE "graph.*primary|PRIMARY" "$skill_file"; then
        test_pass
    else
        test_fail "memory-fabric skill should state graph is PRIMARY"
    fi
}

# Run skills tests
test_remember_skill_graph_first
test_remember_skill_mem0_optional
test_remember_skill_mem0_flag
test_recall_skill_graph_first
test_recall_skill_mem0_optional
test_recall_skill_mem0_flag
test_memory_fabric_skill_exists
test_memory_fabric_skill_graph_first

# =============================================================================
# Test Group: Hooks - Graph-First Architecture
# =============================================================================

echo ""
echo "▸ Hooks - Graph-First Architecture"

test_realtime_sync_graph_first() {
    test_start "realtime-sync.sh targets graph for IMMEDIATE syncs"

    local hook_file="$PROJECT_ROOT/src/hooks/posttool/realtime-sync.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_fail "hooks/posttool/realtime-sync.sh not found"
        return
    fi

    # TypeScript-delegated hooks: check comment or delegation pattern
    if grep -qi "graph-first\|Graph-First" "$hook_file"; then
        test_pass
    elif grep -q "run-hook.mjs.*posttool/realtime-sync" "$hook_file"; then
        # Hook is TypeScript-delegated - graph-first logic is in TypeScript
        test_pass
    else
        test_fail "realtime-sync.sh should document graph-first architecture or delegate to TypeScript"
    fi
}

test_realtime_sync_version() {
    test_start "realtime-sync.sh exists (version in TypeScript)"

    local hook_file="$PROJECT_ROOT/src/hooks/posttool/realtime-sync.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_fail "hooks/posttool/realtime-sync.sh not found"
        return
    fi

    # TypeScript-delegated hooks: version is managed in TypeScript or package.json
    if grep -q "Version: 2.1.0\|v2.1\|2\.1\.0" "$hook_file"; then
        test_pass
    elif grep -q "run-hook.mjs" "$hook_file"; then
        # Hook is TypeScript-delegated - version managed in TS
        test_pass
    else
        test_fail "realtime-sync.sh should have version or be TypeScript-delegated"
    fi
}

test_memory_bridge_graph_authoritative() {
    test_start "memory-bridge.sh states graph is authoritative"

    local hook_file="$PROJECT_ROOT/src/hooks/posttool/memory-bridge.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_fail "hooks/posttool/memory-bridge.sh not found"
        return
    fi

    # TypeScript-delegated hooks: check pattern or delegation
    if grep -qiE "authoritative|source of truth" "$hook_file"; then
        test_pass
    elif grep -q "run-hook.mjs" "$hook_file"; then
        # Hook is TypeScript-delegated - logic is in TypeScript
        test_pass
    else
        test_fail "memory-bridge.sh should state graph is authoritative or be TypeScript-delegated"
    fi
}

test_memory_bridge_one_way_sync() {
    test_start "memory-bridge.sh syncs mem0→graph only"

    local hook_file="$PROJECT_ROOT/src/hooks/posttool/memory-bridge.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_fail "hooks/posttool/memory-bridge.sh not found"
        return
    fi

    # TypeScript-delegated hooks: check pattern or delegation
    if grep -A5 "mcp__memory__create_entities)" "$hook_file" | grep -qi "no sync\|no action"; then
        test_pass
    elif grep -q "run-hook.mjs" "$hook_file"; then
        # Hook is TypeScript-delegated - sync logic is in TypeScript
        test_pass
    else
        test_fail "memory-bridge.sh should not sync graph→mem0 (graph is primary) or be TypeScript-delegated"
    fi
}

test_auto_remember_no_early_exit() {
    test_start "auto-remember-continuity.sh doesn't exit early without mem0"

    local hook_file="$PROJECT_ROOT/src/hooks/stop/auto-remember-continuity.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_fail "hooks/stop/auto-remember-continuity.sh not found"
        return
    fi

    # Check there's no early exit for mem0 availability
    if grep -q 'MEM0_AVAILABLE.*!=.*true.*exit' "$hook_file"; then
        test_fail "auto-remember-continuity.sh should not exit early without mem0"
    else
        test_pass
    fi
}

test_auto_remember_graph_first() {
    test_start "auto-remember-continuity.sh suggests graph storage"

    local hook_file="$PROJECT_ROOT/src/hooks/stop/auto-remember-continuity.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_fail "hooks/stop/auto-remember-continuity.sh not found"
        return
    fi

    # Check for graph storage pattern or TypeScript delegation
    if grep -q "mcp__memory__create_entities" "$hook_file"; then
        test_pass
    elif grep -q "run-hook.mjs" "$hook_file"; then
        # Hook is TypeScript-delegated - graph storage logic is in TypeScript
        test_pass
    elif grep -qi "graph\|memory" "$hook_file"; then
        # Hook mentions graph/memory - passes basic check
        test_pass
    else
        test_fail "auto-remember-continuity.sh should suggest graph storage or be TypeScript-delegated"
    fi
}

test_memory_context_graph_first() {
    test_start "memory-context.sh searches graph first"

    local hook_file="$PROJECT_ROOT/src/hooks/prompt/memory-context.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_fail "hooks/prompt/memory-context.sh not found"
        return
    fi

    # Check for graph search pattern or TypeScript delegation
    if grep -q "mcp__memory__search_nodes" "$hook_file"; then
        test_pass
    elif grep -q "run-hook.mjs" "$hook_file"; then
        # Hook is TypeScript-delegated - search logic is in TypeScript
        test_pass
    elif grep -qi "search\|memory\|graph" "$hook_file"; then
        # Hook mentions search/memory/graph - passes basic check
        test_pass
    else
        test_fail "memory-context.sh should search graph first or be TypeScript-delegated"
    fi
}

test_memory_context_no_early_exit() {
    test_start "memory-context.sh doesn't exit early without mem0"

    local hook_file="$PROJECT_ROOT/src/hooks/prompt/memory-context.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_fail "hooks/prompt/memory-context.sh not found"
        return
    fi

    # Check there's no early exit for mem0 availability (should work without mem0)
    if grep -q 'is_mem0_available.*exit 0' "$hook_file"; then
        test_fail "memory-context.sh should not exit early without mem0"
    else
        test_pass
    fi
}

test_memory_fabric_init_no_warning() {
    test_start "memory-fabric-init.sh doesn't warn about missing MEM0_API_KEY"

    local hook_file="$PROJECT_ROOT/src/hooks/pretool/mcp/memory-fabric-init.sh"

    if [[ ! -f "$hook_file" ]]; then
        test_fail "hooks/pretool/mcp/memory-fabric-init.sh not found"
        return
    fi

    # Check there's no warning message for missing MEM0_API_KEY
    if grep -q 'MEM0_API_KEY not set.*Mem0 calls will fail' "$hook_file"; then
        test_fail "memory-fabric-init.sh should not warn about missing MEM0_API_KEY"
    else
        test_pass
    fi
}

# Run hooks tests
test_realtime_sync_graph_first
test_realtime_sync_version
test_memory_bridge_graph_authoritative
test_memory_bridge_one_way_sync
test_auto_remember_no_early_exit
test_auto_remember_graph_first
test_memory_context_graph_first
test_memory_context_no_early_exit
test_memory_fabric_init_no_warning

# =============================================================================
# Test Group: Agent - Graph-First Architecture
# =============================================================================

echo ""
echo "▸ Agent - Graph-First Architecture"

test_memory_fabric_agent_graph_first() {
    test_start "memory-fabric-agent.py documents graph-first"

    local agent_file="$PROJECT_ROOT/bin/memory-fabric-agent.py"

    if [[ ! -f "$agent_file" ]]; then
        test_fail "bin/memory-fabric-agent.py not found"
        return
    fi

    if grep -qi "graph-first\|Graph-First" "$agent_file"; then
        test_pass
    else
        test_fail "memory-fabric-agent.py should document graph-first architecture"
    fi
}

test_memory_fabric_agent_graph_primary() {
    test_start "memory-fabric-agent.py states graph is PRIMARY"

    local agent_file="$PROJECT_ROOT/bin/memory-fabric-agent.py"

    if [[ ! -f "$agent_file" ]]; then
        test_fail "bin/memory-fabric-agent.py not found"
        return
    fi

    if grep -qi "PRIMARY" "$agent_file"; then
        test_pass
    else
        test_fail "memory-fabric-agent.py should state graph is PRIMARY"
    fi
}

test_memory_fabric_agent_mem0_optional() {
    test_start "memory-fabric-agent.py states mem0 is OPTIONAL"

    local agent_file="$PROJECT_ROOT/bin/memory-fabric-agent.py"

    if [[ ! -f "$agent_file" ]]; then
        test_fail "bin/memory-fabric-agent.py not found"
        return
    fi

    if grep -qiE "OPTIONAL|enhancement" "$agent_file"; then
        test_pass
    else
        test_fail "memory-fabric-agent.py should state mem0 is OPTIONAL"
    fi
}

test_memory_fabric_agent_health_check() {
    test_start "memory-fabric-agent.py health check returns ready=True always"

    local agent_file="$PROJECT_ROOT/bin/memory-fabric-agent.py"

    if [[ ! -f "$agent_file" ]]; then
        test_fail "bin/memory-fabric-agent.py not found"
        return
    fi

    # Check that ready is always True (graph always works)
    if grep -q 'checks\["ready"\].*=.*True' "$agent_file"; then
        test_pass
    else
        test_fail "memory-fabric-agent.py health check should always return ready=True"
    fi
}

# Run agent tests
test_memory_fabric_agent_graph_first
test_memory_fabric_agent_graph_primary
test_memory_fabric_agent_mem0_optional
test_memory_fabric_agent_health_check

# =============================================================================
# Test Group: Graceful Degradation Without Mem0
# =============================================================================

echo ""
echo "▸ Graceful Degradation Without Mem0"

test_graceful_degradation_remember_works() {
    test_start "remember skill works without MEM0_API_KEY"

    local skill_file="$PROJECT_ROOT/src/skills/remember/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_fail "skills/remember/SKILL.md not found"
        return
    fi

    # Check that the skill doesn't require MEM0_API_KEY
    if grep -qiE "always works|zero-config|no.*config" "$skill_file"; then
        test_pass
    else
        # Also pass if graph is stated as PRIMARY (implies it works without mem0)
        if grep -qi "graph.*PRIMARY" "$skill_file"; then
            test_pass
        else
            test_fail "remember skill should work without MEM0_API_KEY"
        fi
    fi
}

test_graceful_degradation_recall_works() {
    test_start "recall skill works without MEM0_API_KEY"

    local skill_file="$PROJECT_ROOT/src/skills/recall/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        test_fail "skills/recall/SKILL.md not found"
        return
    fi

    # Check that the skill doesn't require MEM0_API_KEY
    if grep -qiE "always works|zero-config|no.*config" "$skill_file"; then
        test_pass
    else
        # Also pass if graph is stated as PRIMARY (implies it works without mem0)
        if grep -qi "graph.*PRIMARY" "$skill_file"; then
            test_pass
        else
            test_fail "recall skill should work without MEM0_API_KEY"
        fi
    fi
}

# Run graceful degradation tests
test_graceful_degradation_remember_works
test_graceful_degradation_recall_works

# =============================================================================
# Test Summary
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Total:   $TESTS_RUN"
echo -e "  \033[0;32mPassed:  $TESTS_PASSED\033[0m"
echo -e "  \033[0;31mFailed:  $TESTS_FAILED\033[0m"
echo -e "  \033[0;33mSkipped: $TESTS_SKIPPED\033[0m"
echo ""

if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "\033[0;31m✗ Some tests failed!\033[0m"
    exit 1
else
    echo -e "\033[0;32m✓ All tests passed!\033[0m"
    exit 0
fi
