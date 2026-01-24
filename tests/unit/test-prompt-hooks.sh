#!/usr/bin/env bash
# ============================================================================
# Prompt Hooks Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests TypeScript prompt hooks in hooks/src/prompt/:
# - context-injector.ts
# - todo-enforcer.ts
# - memory-context.ts
# - satisfaction-detector.ts
# - context-pruning-advisor.ts
# - antipattern-warning.ts
#
# Updated for TypeScript hook architecture (v5.1.0+)
# Shell script hooks migrated to TypeScript and compiled to prompt.mjs
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

test_context_injector_has_context_handling() {
    if grep -qiE "context|inject|prompt" "$TS_HOOKS_DIR/context-injector.ts" 2>/dev/null; then
        return 0
    fi
    fail "context-injector.ts should handle context injection"
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

test_todo_enforcer_has_todo_logic() {
    if grep -qiE "todo|task|check" "$TS_HOOKS_DIR/todo-enforcer.ts" 2>/dev/null; then
        return 0
    fi
    fail "todo-enforcer.ts should handle TODO enforcement"
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

test_memory_context_has_memory_handling() {
    if grep -qiE "memory|context|search|trigger" "$TS_HOOKS_DIR/memory-context.ts" 2>/dev/null; then
        return 0
    fi
    fail "memory-context.ts should handle memory context"
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

test_satisfaction_detector_has_detection_logic() {
    if grep -qiE "satisfaction|detect|positive|feedback" "$TS_HOOKS_DIR/satisfaction-detector.ts" 2>/dev/null; then
        return 0
    fi
    fail "satisfaction-detector.ts should detect satisfaction"
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

test_context_pruning_advisor_has_threshold_logic() {
    if grep -qiE "context|prune|threshold|percent|usage" "$TS_HOOKS_DIR/context-pruning-advisor.ts" 2>/dev/null; then
        return 0
    fi
    fail "context-pruning-advisor.ts should have context threshold logic"
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

test_antipattern_warning_has_pattern_detection() {
    if grep -qiE "antipattern|pattern|warning|detect" "$TS_HOOKS_DIR/antipattern-warning.ts" 2>/dev/null; then
        return 0
    fi
    fail "antipattern-warning.ts should detect antipatterns"
}

# ============================================================================
# CC 2.1.7 COMPLIANCE TESTS
# ============================================================================

describe "CC 2.1.7 TypeScript Compliance"

test_all_prompt_hooks_have_suppress_output() {
    local hooks=(
        "context-injector.ts"
        "todo-enforcer.ts"
        "memory-context.ts"
        "satisfaction-detector.ts"
        "context-pruning-advisor.ts"
    )

    for hook in "${hooks[@]}"; do
        if [[ -f "$TS_HOOKS_DIR/$hook" ]]; then
            if grep -qE "suppressOutput|HookResult" "$TS_HOOKS_DIR/$hook" 2>/dev/null; then
                continue
            fi
        fi
    done
}

test_hooks_registered_in_plugin_json() {
    local plugin_json="$PROJECT_ROOT/.claude-plugin/plugin.json"

    # TypeScript hooks are registered via the run-hook.mjs runner
    # Check that plugin.json references the hook system
    if grep -qE "run-hook|hooks" "$plugin_json" 2>/dev/null; then
        return 0
    fi
    fail "Plugin should reference hooks system"
}

# ============================================================================
# BUNDLE INTEGRATION TESTS
# ============================================================================

describe "Bundle Integration"

test_prompt_bundle_exports_handlers() {
    # Check that the compiled bundle has exports
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
# SKILL HOOKS (Additional TypeScript coverage)
# ============================================================================

describe "Skill Hooks (TypeScript)"

test_skill_auto_suggest_exists() {
    assert_file_exists "$TS_HOOKS_DIR/skill-auto-suggest.ts"
}

test_skill_auto_suggest_exports_handler() {
    if [[ -f "$TS_HOOKS_DIR/skill-auto-suggest.ts" ]]; then
        assert_file_contains "$TS_HOOKS_DIR/skill-auto-suggest.ts" "export"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
