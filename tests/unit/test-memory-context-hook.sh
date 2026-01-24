#!/usr/bin/env bash
# ============================================================================
# Memory Context Hook Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests for hooks/src/prompt/memory-context.ts
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_MEMORY_CONTEXT="$PROJECT_ROOT/hooks/src/prompt/memory-context.ts"
DECISION_SYNC="$PROJECT_ROOT/.claude/scripts/decision-sync.sh"
DIST_DIR="$PROJECT_ROOT/hooks/dist"

# ============================================================================
# MEMORY CONTEXT HOOK TESTS (TypeScript)
# ============================================================================

describe "Memory Context Hook: TypeScript Source"

test_memory_context_exists() {
    assert_file_exists "$TS_MEMORY_CONTEXT"
}

test_memory_context_exports_handler() {
    assert_file_contains "$TS_MEMORY_CONTEXT" "export"
}

test_memory_context_has_function() {
    if grep -qE "function|async|=>|const.*=" "$TS_MEMORY_CONTEXT" 2>/dev/null; then
        return 0
    fi
    fail "memory-context.ts should have function definition"
}

# ============================================================================
# MEMORY CONTEXT HOOK CORE LOGIC
# ============================================================================

describe "Memory Context Hook: Core Logic"

test_has_trigger_keywords() {
    if grep -qiE "trigger|keyword|search" "$TS_MEMORY_CONTEXT" 2>/dev/null; then
        return 0
    fi
    fail "memory-context.ts should have trigger keywords"
}

test_has_search_logic() {
    if grep -qiE "search|memory|context" "$TS_MEMORY_CONTEXT" 2>/dev/null; then
        return 0
    fi
    fail "memory-context.ts should have search logic"
}

# ============================================================================
# DECISION SYNC SCRIPT TESTS
# ============================================================================

describe "Decision Sync Script"

test_decision_sync_exists() {
    assert_file_exists "$DECISION_SYNC"
}

test_decision_sync_executable() {
    [[ -x "$DECISION_SYNC" ]]
}

test_decision_sync_syntax() {
    bash -n "$DECISION_SYNC"
}

# ============================================================================
# BUNDLE TESTS
# ============================================================================

describe "Bundle Integration"

test_prompt_bundle_exists() {
    assert_file_exists "$DIST_DIR/prompt.mjs"
}

test_prompt_bundle_has_content() {
    local size
    size=$(wc -c < "$DIST_DIR/prompt.mjs" | tr -d ' ')
    if [[ "$size" -lt 1000 ]]; then
        fail "prompt.mjs seems too small ($size bytes)"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

print_summary
