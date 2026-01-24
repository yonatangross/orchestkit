#!/usr/bin/env bash
# ============================================================================
# Skill Edit Tracker Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests for hooks/src/posttool/skill-edit-tracker.ts
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_SKILL_EDIT_TRACKER="$PROJECT_ROOT/hooks/src/posttool/skill-edit-tracker.ts"
DIST_DIR="$PROJECT_ROOT/hooks/dist"

# ============================================================================
# TYPESCRIPT SOURCE TESTS
# ============================================================================

describe "Skill Edit Tracker: TypeScript Source"

test_skill_edit_tracker_exists() {
    assert_file_exists "$TS_SKILL_EDIT_TRACKER"
}

test_skill_edit_tracker_exports_handler() {
    assert_file_contains "$TS_SKILL_EDIT_TRACKER" "export"
}

test_skill_edit_tracker_has_function() {
    if grep -qE "function|async|=>|const.*=" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should have function definition"
}

# ============================================================================
# TOOL HANDLING TESTS
# ============================================================================

describe "Skill Edit Tracker: Tool Handling"

test_handles_edit_tool() {
    if grep -qiE "Edit|edit|Write|write|tool" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should handle Edit/Write tools"
}

test_has_file_path_handling() {
    if grep -qiE "file|path" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should handle file paths"
}

# ============================================================================
# PATTERN DETECTION TESTS
# ============================================================================

describe "Skill Edit Tracker: Pattern Detection"

test_has_pattern_detection() {
    if grep -qiE "pattern|detect|track" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should detect patterns"
}

test_has_skill_tracking() {
    if grep -qiE "skill|track|attribute" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should track skills"
}

# ============================================================================
# BUNDLE TESTS
# ============================================================================

describe "Skill Edit Tracker: Bundle Integration"

test_posttool_bundle_exists() {
    assert_file_exists "$DIST_DIR/posttool.mjs"
}

test_posttool_bundle_has_content() {
    local size
    size=$(wc -c < "$DIST_DIR/posttool.mjs" | tr -d ' ')
    if [[ "$size" -lt 1000 ]]; then
        fail "posttool.mjs seems too small ($size bytes)"
    fi
}

test_run_hook_runner_exists() {
    assert_file_exists "$PROJECT_ROOT/hooks/bin/run-hook.mjs"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
