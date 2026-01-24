#!/usr/bin/env bash
# ============================================================================
# Prompt Hooks Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests TypeScript prompt hooks in hooks/src/prompt/
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_HOOKS_DIR="$PROJECT_ROOT/hooks/src/prompt"
DIST_DIR="$PROJECT_ROOT/hooks/dist"

# ============================================================================
# TYPESCRIPT SOURCE FILE TESTS
# ============================================================================

describe "Prompt Hooks: TypeScript Source Files"

test_prompt_ts_directory_exists() {
    [[ -d "$TS_HOOKS_DIR" ]] || fail "Directory missing: $TS_HOOKS_DIR"
}

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
# CONTEXT-INJECTOR TESTS
# ============================================================================

describe "context-injector.ts"

test_context_injector_exists() {
    assert_file_exists "$TS_HOOKS_DIR/context-injector.ts"
}

test_context_injector_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/context-injector.ts" "export"
}

# ============================================================================
# TODO-ENFORCER TESTS
# ============================================================================

describe "todo-enforcer.ts"

test_todo_enforcer_exists() {
    assert_file_exists "$TS_HOOKS_DIR/todo-enforcer.ts"
}

test_todo_enforcer_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/todo-enforcer.ts" "export"
}

# ============================================================================
# MEMORY-CONTEXT TESTS
# ============================================================================

describe "memory-context.ts"

test_memory_context_exists() {
    assert_file_exists "$TS_HOOKS_DIR/memory-context.ts"
}

test_memory_context_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/memory-context.ts" "export"
}

# ============================================================================
# SATISFACTION-DETECTOR TESTS
# ============================================================================

describe "satisfaction-detector.ts"

test_satisfaction_detector_exists() {
    assert_file_exists "$TS_HOOKS_DIR/satisfaction-detector.ts"
}

test_satisfaction_detector_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/satisfaction-detector.ts" "export"
}

# ============================================================================
# CONTEXT-PRUNING-ADVISOR TESTS
# ============================================================================

describe "context-pruning-advisor.ts"

test_context_pruning_advisor_exists() {
    assert_file_exists "$TS_HOOKS_DIR/context-pruning-advisor.ts"
}

test_context_pruning_advisor_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/context-pruning-advisor.ts" "export"
}

# ============================================================================
# ANTIPATTERN-WARNING TESTS
# ============================================================================

describe "antipattern-warning.ts"

test_antipattern_warning_exists() {
    assert_file_exists "$TS_HOOKS_DIR/antipattern-warning.ts"
}

test_antipattern_warning_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/antipattern-warning.ts" "export"
}

# ============================================================================
# BUNDLE INTEGRATION TESTS
# ============================================================================

describe "Bundle Integration"

test_prompt_bundle_exports_handlers() {
    if grep -qE "export|module\.exports" "$DIST_DIR/prompt.mjs" 2>/dev/null; then
        return 0
    fi
    fail "prompt.mjs should export handlers"
}

test_prompt_bundle_not_empty() {
    local size
    size=$(wc -c < "$DIST_DIR/prompt.mjs" | tr -d ' ')
    if [[ "$size" -gt 10000 ]]; then
        return 0
    fi
    fail "prompt.mjs should have substantial content (got $size bytes)"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
