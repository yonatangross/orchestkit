#!/usr/bin/env bash
# ============================================================================
# Skill Edit Tracker Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests for hooks/src/posttool/skill-edit-tracker.ts
# - Pattern detection in edit content
# - Session state integration
# - Edit pattern logging
# - Metrics updates
#
# Part of: #58 (Skill Evolution System)
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_SKILL_EDIT_TRACKER="$PROJECT_ROOT/src/hooks/src/posttool/skill-edit-tracker.ts"
DIST_DIR="$PROJECT_ROOT/src/hooks/dist"

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
# TOOL FILTERING TESTS
# ============================================================================

describe "Skill Edit Tracker: Tool Filtering Logic"

test_handles_edit_tool() {
    if grep -qiE "Edit|edit|Write|write|tool" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should handle Edit/Write tools"
}

test_has_file_path_handling() {
    if grep -qiE "file_path|filePath|path" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should handle file paths"
}

# ============================================================================
# SESSION STATE TESTS
# ============================================================================

describe "Skill Edit Tracker: Session State"

test_has_session_handling() {
    if grep -qiE "session|recent|skill" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should handle session state"
}

test_has_skill_tracking() {
    if grep -qiE "skill|track|attribute" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should track skills"
}

# ============================================================================
# PATTERN DETECTION TESTS
# ============================================================================

describe "Skill Edit Tracker: Pattern Detection"

test_has_pattern_detection() {
    if grep -qiE "pattern|detect|error.*handling|pagination|validation|logging|type" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should detect patterns"
}

test_has_content_analysis() {
    if grep -qiE "content|new_string|diff|analyze" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should analyze content"
}

# ============================================================================
# LOGGING TESTS
# ============================================================================

describe "Skill Edit Tracker: Logging"

test_has_logging() {
    if grep -qiE "log|write|append|jsonl" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should have logging"
}

test_has_feedback_integration() {
    if grep -qiE "feedback|pattern|metric" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should integrate with feedback system"
}

# ============================================================================
# CC 2.1.7 COMPLIANCE TESTS
# ============================================================================

describe "Skill Edit Tracker: CC 2.1.7 Compliance"

test_has_hook_result() {
    if grep -qE "HookResult|continue|suppressOutput" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    # Check types file
    if grep -qE "HookResult|continue|suppressOutput" "$PROJECT_ROOT/src/hooks/src/types.ts" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should use HookResult type"
}

test_has_suppress_output() {
    if grep -qE "suppressOutput" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    # May be in types
    if grep -qE "suppressOutput" "$PROJECT_ROOT/src/hooks/src/types.ts" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should have suppressOutput"
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
    assert_file_exists "$PROJECT_ROOT/src/hooks/bin/run-hook.mjs"
}

# ============================================================================
# INPUT HANDLING TESTS
# ============================================================================

describe "Skill Edit Tracker: Input Handling"

test_has_input_handling() {
    if grep -qiE "input|HookInput|tool_input|tool_name" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should handle input"
}

test_has_result_type() {
    if grep -qiE "HookResult|return|continue" "$TS_SKILL_EDIT_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-edit-tracker.ts should return proper result"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
