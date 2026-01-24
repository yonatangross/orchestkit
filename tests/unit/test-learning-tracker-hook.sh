#!/usr/bin/env bash
# ============================================================================
# Learning Tracker Hook Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests for hooks/src/permission/learning-tracker.ts
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_LEARNING_TRACKER="$PROJECT_ROOT/hooks/src/permission/learning-tracker.ts"
DIST_DIR="$PROJECT_ROOT/hooks/dist"

# ============================================================================
# TYPESCRIPT SOURCE TESTS
# ============================================================================

describe "Learning Tracker Hook: TypeScript Source"

test_learning_tracker_exists() {
    assert_file_exists "$TS_LEARNING_TRACKER"
}

test_learning_tracker_exports_handler() {
    assert_file_contains "$TS_LEARNING_TRACKER" "export"
}

test_learning_tracker_has_function() {
    if grep -qE "function|async|=>|const.*=" "$TS_LEARNING_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "learning-tracker.ts should have function definition"
}

# ============================================================================
# PERMISSION HANDLING TESTS
# ============================================================================

describe "Learning Tracker: Permission Handling"

test_handles_permission_input() {
    if grep -qiE "permission|approval|allow|deny" "$TS_LEARNING_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "learning-tracker.ts should handle permission input"
}

test_has_learning_logic() {
    if grep -qiE "learn|track|record|store" "$TS_LEARNING_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "learning-tracker.ts should have learning logic"
}

# ============================================================================
# BUNDLE TESTS
# ============================================================================

describe "Bundle Integration"

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
# LIB INTEGRATION TESTS
# ============================================================================

describe "Library Integration"

test_lib_directory_has_utilities() {
    local lib_dir="$PROJECT_ROOT/hooks/src/lib"
    [[ -d "$lib_dir" ]] || fail "Directory missing: $lib_dir"

    local file_count
    file_count=$(ls -1 "$lib_dir"/*.ts 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$file_count" -lt 1 ]]; then
        fail "lib directory should have utility files"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
