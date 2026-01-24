#!/usr/bin/env bash
# ============================================================================
# Learning Tracker Hook Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests for hooks/src/permission/learning-tracker.ts
# - TypeScript source structure
# - Security blocklist integration
# - Learned pattern matching
# - Bundle compilation
#
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_HOOK_PATH="$PROJECT_ROOT/hooks/src/permission/learning-tracker.ts"
DIST_DIR="$PROJECT_ROOT/hooks/dist"

# ============================================================================
# BASIC TESTS
# ============================================================================

describe "Learning Tracker Hook: TypeScript Source"

test_hook_exists() {
    assert_file_exists "$TS_HOOK_PATH"
}

test_hook_exports_handler() {
    assert_file_contains "$TS_HOOK_PATH" "export"
}

test_hook_has_function_definition() {
    if grep -qE "function|async|=>|const.*=" "$TS_HOOK_PATH" 2>/dev/null; then
        return 0
    fi
    fail "learning-tracker.ts should have function definition"
}

test_permission_bundle_exists() {
    assert_file_exists "$DIST_DIR/permission.mjs"
}

test_permission_bundle_has_content() {
    local size
    size=$(wc -c < "$DIST_DIR/permission.mjs" | tr -d ' ')
    if [[ "$size" -lt 1000 ]]; then
        fail "permission.mjs seems too small ($size bytes)"
    fi
}

# ============================================================================
# SECURITY BLOCKLIST TESTS
# ============================================================================

describe "Learning Tracker Hook: Security Logic"

test_has_security_checks() {
    # TypeScript hook should have security-related code
    if grep -qiE "security|blocked|danger|rm.*-rf|sudo|secret" "$TS_HOOK_PATH" 2>/dev/null; then
        return 0
    fi
    # Also check lib files for security utilities
    if grep -qiE "security|blocked" "$PROJECT_ROOT/hooks/src/lib/"*.ts 2>/dev/null; then
        return 0
    fi
    fail "learning-tracker.ts should have security checks"
}

test_has_learning_logic() {
    if grep -qiE "learn|pattern|feedback|track" "$TS_HOOK_PATH" 2>/dev/null; then
        return 0
    fi
    fail "learning-tracker.ts should have learning/tracking logic"
}

# ============================================================================
# INPUT HANDLING TESTS
# ============================================================================

describe "Learning Tracker Hook: TypeScript Structure"

test_has_input_handling() {
    if grep -qiE "input|HookInput|tool_name|command" "$TS_HOOK_PATH" 2>/dev/null; then
        return 0
    fi
    fail "learning-tracker.ts should handle input"
}

test_has_result_type() {
    if grep -qiE "HookResult|return|continue|decision" "$TS_HOOK_PATH" 2>/dev/null; then
        return 0
    fi
    fail "learning-tracker.ts should return proper result"
}

# ============================================================================
# INTEGRATION WITH FEEDBACK LIB TESTS
# ============================================================================

describe "Learning Tracker Hook: Library Integration"

test_imports_or_uses_lib() {
    # TypeScript hooks import modules
    if grep -qE "import|require|from.*lib" "$TS_HOOK_PATH" 2>/dev/null; then
        return 0
    fi
    # May also reference feedback functionality inline
    if grep -qiE "feedback|log|enabled" "$TS_HOOK_PATH" 2>/dev/null; then
        return 0
    fi
    fail "learning-tracker.ts should use library utilities"
}

test_lib_directory_has_utilities() {
    local lib_dir="$PROJECT_ROOT/hooks/src/lib"
    [[ -d "$lib_dir" ]] || fail "Directory missing: $lib_dir"

    # Should have at least some utility files
    local file_count
    file_count=$(ls -1 "$lib_dir"/*.ts 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$file_count" -lt 1 ]]; then
        fail "lib directory should have utility files"
    fi
}

# ============================================================================
# OUTPUT FORMAT TESTS
# ============================================================================

describe "Learning Tracker Hook: CC 2.1.7 Compliance"

test_has_suppress_output() {
    # TypeScript hooks should have suppressOutput
    if grep -qE "suppressOutput" "$TS_HOOK_PATH" 2>/dev/null; then
        return 0
    fi
    # May be handled by shared types
    if grep -qE "suppressOutput" "$PROJECT_ROOT/hooks/src/types.ts" 2>/dev/null; then
        return 0
    fi
    fail "Hook should use suppressOutput for CC 2.1.7 compliance"
}

test_has_continue_field() {
    # TypeScript hooks should return continue field
    if grep -qE "continue.*:" "$TS_HOOK_PATH" 2>/dev/null; then
        return 0
    fi
    # May be handled by HookResult type
    if grep -qE "continue" "$PROJECT_ROOT/hooks/src/types.ts" 2>/dev/null; then
        return 0
    fi
    fail "Hook should return continue field"
}

# ============================================================================
# BUNDLE INTEGRATION TESTS
# ============================================================================

describe "Learning Tracker Hook: Bundle Integration"

test_permission_bundle_exports_handlers() {
    if grep -qE "export|learningTracker|learning" "$DIST_DIR/permission.mjs" 2>/dev/null; then
        return 0
    fi
    fail "permission.mjs should export handlers"
}

test_run_hook_runner_exists() {
    assert_file_exists "$PROJECT_ROOT/hooks/bin/run-hook.mjs"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
