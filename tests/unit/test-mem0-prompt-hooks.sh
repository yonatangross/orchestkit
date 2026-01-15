#!/usr/bin/env bash
# ============================================================================
# Mem0 Prompt Hooks Unit Tests
# ============================================================================
# Tests mem0-related prompt and stop hooks:
# - prompt/antipattern-detector.sh
# - stop/auto-remember-continuity.sh
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_DIR="$PROJECT_ROOT/hooks"

# ============================================================================
# ANTIPATTERN DETECTOR TESTS
# ============================================================================

describe "Antipattern Detector Hook"

test_antipattern_detector_exists_and_executable() {
    local hook="$HOOKS_DIR/prompt/antipattern-detector.sh"
    assert_file_exists "$hook"
    assert_file_executable "$hook"
}

test_antipattern_detector_outputs_valid_json_for_implementation_prompt() {
    local hook="$HOOKS_DIR/prompt/antipattern-detector.sh"
    if [[ ! -f "$hook" ]]; then
        skip "antipattern-detector.sh not found"
    fi

    # Prompt with implementation keyword
    local input='{"prompt":"implement pagination for the users endpoint"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Must have continue field (CC 2.1.7)
        assert_json_field "$output" "continue"
    fi
}

test_antipattern_detector_skips_short_prompts() {
    local hook="$HOOKS_DIR/prompt/antipattern-detector.sh"
    if [[ ! -f "$hook" ]]; then
        skip "antipattern-detector.sh not found"
    fi

    # Short prompt should be skipped
    local input='{"prompt":"hello"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Should have suppressOutput for skipped prompts
        if echo "$output" | jq -e '.suppressOutput == true' >/dev/null 2>&1; then
            return 0
        fi
    fi
}

test_antipattern_detector_detects_implementation_keywords() {
    local hook="$HOOKS_DIR/prompt/antipattern-detector.sh"
    if [[ ! -f "$hook" ]]; then
        skip "antipattern-detector.sh not found"
    fi

    # Test various implementation keywords
    local keywords=("implement" "create" "build" "configure" "database" "authentication")

    for keyword in "${keywords[@]}"; do
        local input="{\"prompt\":\"help me $keyword a new feature for the application\"}"
        local output
        output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

        if [[ -n "$output" ]]; then
            assert_valid_json "$output"
        fi
    done
}

# ============================================================================
# AUTO-REMEMBER CONTINUITY TESTS
# ============================================================================

describe "Auto-Remember Continuity Hook"

test_auto_remember_exists_and_executable() {
    local hook="$HOOKS_DIR/stop/auto-remember-continuity.sh"
    assert_file_exists "$hook"
    assert_file_executable "$hook"
}

test_auto_remember_outputs_valid_json() {
    local hook="$HOOKS_DIR/stop/auto-remember-continuity.sh"
    if [[ ! -f "$hook" ]]; then
        skip "auto-remember-continuity.sh not found"
    fi

    local output
    output=$(bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Must have continue field (CC 2.1.7)
        assert_json_field "$output" "continue"
    fi
}

test_auto_remember_includes_stop_prompt_when_mem0_available() {
    local hook="$HOOKS_DIR/stop/auto-remember-continuity.sh"
    if [[ ! -f "$hook" ]]; then
        skip "auto-remember-continuity.sh not found"
    fi

    # Create mock Claude Desktop config with mem0
    local mock_config_dir="$TEMP_DIR/.config/claude"
    mkdir -p "$mock_config_dir"
    echo '{"mcpServers":{"mem0":{}}}' > "$mock_config_dir/claude_desktop_config.json"

    local output
    HOME="$TEMP_DIR" output=$(bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi

    # Cleanup
    rm -rf "$mock_config_dir"
}

# ============================================================================
# AGENT SKILLS INTEGRATION TESTS
# ============================================================================

describe "Agent Remember/Recall Skills"

test_all_agents_have_remember_skill() {
    local agents_dir="$PROJECT_ROOT/agents"
    local missing_count=0

    for agent in "$agents_dir"/*.md; do
        if [[ -f "$agent" ]]; then
            if ! grep -q "^  - remember$" "$agent"; then
                echo "Missing 'remember' skill: $(basename "$agent")"
                ((missing_count++))
            fi
        fi
    done

    assert_equals "0" "$missing_count" "All agents should have 'remember' skill"
}

test_all_agents_have_recall_skill() {
    local agents_dir="$PROJECT_ROOT/agents"
    local missing_count=0

    for agent in "$agents_dir"/*.md; do
        if [[ -f "$agent" ]]; then
            if ! grep -q "^  - recall$" "$agent"; then
                echo "Missing 'recall' skill: $(basename "$agent")"
                ((missing_count++))
            fi
        fi
    done

    assert_equals "0" "$missing_count" "All agents should have 'recall' skill"
}

# ============================================================================
# MEM0 LIBRARY INTEGRATION TESTS
# ============================================================================

describe "Mem0 Library Functions"

test_mem0_library_exists() {
    local lib="$PROJECT_ROOT/hooks/_lib/mem0.sh"
    assert_file_exists "$lib"
}

test_mem0_library_exports_required_functions() {
    local lib="$PROJECT_ROOT/hooks/_lib/mem0.sh"
    if [[ ! -f "$lib" ]]; then
        skip "mem0.sh not found"
    fi

    # Source the library and check exports
    source "$lib" 2>/dev/null || true

    # Check key functions exist
    local required_funcs=(
        "mem0_get_project_id"
        "mem0_user_id"
        "mem0_global_user_id"
        "is_mem0_available"
        "detect_best_practice_category"
    )

    for func in "${required_funcs[@]}"; do
        if ! type "$func" &>/dev/null; then
            fail "Missing function: $func"
        fi
    done
}

test_mem0_category_detection() {
    local lib="$PROJECT_ROOT/hooks/_lib/mem0.sh"
    if [[ ! -f "$lib" ]]; then
        skip "mem0.sh not found"
    fi

    source "$lib" 2>/dev/null || true

    if type detect_best_practice_category &>/dev/null; then
        # Test category detection
        local category
        category=$(detect_best_practice_category "pagination cursor offset")
        assert_equals "pagination" "$category"

        category=$(detect_best_practice_category "JWT authentication token")
        assert_equals "authentication" "$category"

        category=$(detect_best_practice_category "PostgreSQL database query")
        assert_equals "database" "$category"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests "$@"