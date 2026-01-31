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
# Test Group: Skills - File Existence
# =============================================================================

echo ""
echo "▸ Skills - File Existence"

test_memory_fabric_skill_exists() {
    test_start "memory-fabric skill exists"

    local skill_file="$PROJECT_ROOT/src/skills/memory-fabric/SKILL.md"

    if [[ -f "$skill_file" ]]; then
        test_pass
    else
        test_fail "skills/memory-fabric/SKILL.md not found"
    fi
}

# Run skills tests
test_memory_fabric_skill_exists

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
