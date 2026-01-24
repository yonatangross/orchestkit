#!/usr/bin/env bash
# ============================================================================
# Agent Memory Hooks Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests for hooks/src/subagent-start/ and hooks/src/subagent-stop/
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_SUBAGENT_START_DIR="$PROJECT_ROOT/hooks/src/subagent-start"
TS_SUBAGENT_STOP_DIR="$PROJECT_ROOT/hooks/src/subagent-stop"
DIST_DIR="$PROJECT_ROOT/hooks/dist"

# ============================================================================
# SUBAGENT-START TESTS
# ============================================================================

describe "Subagent Start Hooks (TypeScript)"

test_subagent_start_directory_exists() {
    [[ -d "$TS_SUBAGENT_START_DIR" ]] || fail "Directory missing: $TS_SUBAGENT_START_DIR"
}

test_agent_memory_inject_exists() {
    assert_file_exists "$TS_SUBAGENT_START_DIR/agent-memory-inject.ts"
}

test_agent_memory_inject_exports() {
    assert_file_contains "$TS_SUBAGENT_START_DIR/agent-memory-inject.ts" "export"
}

# ============================================================================
# SUBAGENT-STOP TESTS
# ============================================================================

describe "Subagent Stop Hooks (TypeScript)"

test_subagent_stop_directory_exists() {
    [[ -d "$TS_SUBAGENT_STOP_DIR" ]] || fail "Directory missing: $TS_SUBAGENT_STOP_DIR"
}

test_agent_memory_store_exists() {
    assert_file_exists "$TS_SUBAGENT_STOP_DIR/agent-memory-store.ts"
}

test_agent_memory_store_exports() {
    assert_file_contains "$TS_SUBAGENT_STOP_DIR/agent-memory-store.ts" "export"
}

# ============================================================================
# MEMORY INTEGRATION TESTS
# ============================================================================

describe "Memory Integration"

test_inject_has_memory_logic() {
    if grep -qiE "memory|inject|context|recall" "$TS_SUBAGENT_START_DIR/agent-memory-inject.ts" 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-inject.ts should have memory logic"
}

test_store_has_memory_logic() {
    if grep -qiE "memory|store|save|persist" "$TS_SUBAGENT_STOP_DIR/agent-memory-store.ts" 2>/dev/null; then
        return 0
    fi
    fail "agent-memory-store.ts should have memory logic"
}

# ============================================================================
# BUNDLE TESTS
# ============================================================================

describe "Bundle Integration"

test_subagent_bundle_exists() {
    assert_file_exists "$DIST_DIR/subagent.mjs"
}

test_subagent_bundle_has_content() {
    local size
    size=$(wc -c < "$DIST_DIR/subagent.mjs" | tr -d ' ')
    if [[ "$size" -lt 1000 ]]; then
        fail "subagent.mjs seems too small ($size bytes)"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
