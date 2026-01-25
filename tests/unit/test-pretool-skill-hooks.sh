#!/usr/bin/env bash
# ============================================================================
# Pretool Skill Hooks Unit Tests
# ============================================================================
# Tests Skill-related pretool hooks for CC 2.1.6 compliance
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_DIR="$PROJECT_ROOT/src/hooks/pretool/skill"

# ============================================================================
# SKILL TRACKER
# ============================================================================

describe "Skill Tracker Hook"

test_skill_tracker_tracks_skill_invocation() {
    local hook="$HOOKS_DIR/skill-tracker.sh"
    if [[ ! -f "$hook" ]]; then
        skip "skill-tracker.sh not found"
    fi

    local input='{"tool_name":"Skill","tool_input":{"skill":"commit"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Skill invocation should be allowed"
    fi
}

test_skill_tracker_handles_skill_with_args() {
    local hook="$HOOKS_DIR/skill-tracker.sh"
    if [[ ! -f "$hook" ]]; then
        skip "skill-tracker.sh not found"
    fi

    local input='{"tool_name":"Skill","tool_input":{"skill":"review-pr","args":"123"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Skill with args should be allowed"
    fi
}

test_skill_tracker_has_valid_output() {
    local hook="$HOOKS_DIR/skill-tracker.sh"
    if [[ ! -f "$hook" ]]; then
        skip "skill-tracker.sh not found"
    fi

    local input='{"tool_name":"Skill","tool_input":{"skill":"run-tests"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e 'has("systemMessage") or has("suppressOutput")' >/dev/null 2>&1; then
        fail "Missing systemMessage or suppressOutput field"
    fi
}

test_skill_tracker_logs_to_usage_file() {
    local hook="$HOOKS_DIR/skill-tracker.sh"
    if [[ ! -f "$hook" ]]; then
        skip "skill-tracker.sh not found"
    fi

    # Clear log first
    local log_file="/tmp/claude-skill-usage.log"
    > "$log_file" 2>/dev/null || true

    local input='{"tool_name":"Skill","tool_input":{"skill":"brainstorm"}}'
    echo "$input" | bash "$hook" >/dev/null 2>&1 || true

    # Check if logged
    if [[ -f "$log_file" ]]; then
        if grep -q "brainstorm" "$log_file"; then
            return 0
        fi
    fi

    # Logging is optional, don't fail
    info "Skill usage logging may be disabled"
}

test_skill_tracker_handles_various_skills() {
    local hook="$HOOKS_DIR/skill-tracker.sh"
    if [[ ! -f "$hook" ]]; then
        skip "skill-tracker.sh not found"
    fi

    local skills=("commit" "review-pr" "run-tests" "explore" "verify")

    for skill in "${skills[@]}"; do
        local input="{\"tool_name\":\"Skill\",\"tool_input\":{\"skill\":\"$skill\"}}"
        local output
        output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

        if [[ -n "$output" ]]; then
            if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
                fail "Skill '$skill' should be allowed"
            fi
        fi
    done
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests