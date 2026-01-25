#!/usr/bin/env bash
# ============================================================================
# Memory Commands Unit Tests
# ============================================================================
# Tests for memory/feedback slash commands (CC 2.1.3 merged with skills):
# - /remember (skills/remember/SKILL.md)
# - /recall (skills/recall/SKILL.md)
# - /ork:feedback (skills/feedback/SKILL.md)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

# CC 2.1.3: Commands merged with skills
SKILLS_DIR="$PROJECT_ROOT/src/skills"

# ============================================================================
# /remember COMMAND TESTS
# ============================================================================

describe "Command: /remember"

test_remember_command_exists() {
    assert_file_exists "$SKILLS_DIR/remember/SKILL.md"
}

test_remember_has_usage_section() {
    assert_file_contains "$SKILLS_DIR/remember/SKILL.md" "## Usage"
}

test_remember_has_categories() {
    local file="$SKILLS_DIR/remember/SKILL.md"

    assert_file_contains "$file" "decision"
    assert_file_contains "$file" "architecture"
    assert_file_contains "$file" "pattern"
    assert_file_contains "$file" "blocker"
    assert_file_contains "$file" "constraint"
}

test_remember_references_mem0_tool() {
    # Check for script reference instead of MCP
    assert_file_contains "$SKILLS_DIR/remember/SKILL.md" "add-memory.py"
}

test_remember_has_workflow() {
    assert_file_contains "$SKILLS_DIR/remember/SKILL.md" "## Workflow"
}

test_remember_has_when_to_use() {
    # Overview is optional if description has trigger phrases (standardized in #179)
    local file="$SKILLS_DIR/remember/SKILL.md"
    if grep -q "## Overview" "$file"; then
        # Has Overview - OK
        return 0
    elif grep -qiE "description:.*use\s+(when|for|this)" "$file"; then
        # Description has triggers - Overview optional
        return 0
    else
        fail "remember SKILL.md should have Overview section or trigger phrases in description"
    fi
}

test_remember_has_auto_detect_logic() {
    assert_file_contains "$SKILLS_DIR/remember/SKILL.md" "Auto-Detect"
}

test_remember_specifies_user_id_format() {
    # Should specify the user_id format for mem0
    assert_file_contains "$SKILLS_DIR/remember/SKILL.md" "user_id"
}

# ============================================================================
# /recall COMMAND TESTS
# ============================================================================

describe "Command: /recall"

test_recall_command_exists() {
    assert_file_exists "$SKILLS_DIR/recall/SKILL.md"
}

test_recall_has_usage_section() {
    assert_file_contains "$SKILLS_DIR/recall/SKILL.md" "## Usage"
}

test_recall_has_options() {
    local file="$SKILLS_DIR/recall/SKILL.md"

    grep -q "category" "$file" || fail "recall SKILL.md should mention category option"
    grep -q "limit" "$file" || fail "recall SKILL.md should mention limit option"
}

test_recall_references_mem0_search() {
    # Check for script reference instead of MCP
    assert_file_contains "$SKILLS_DIR/recall/SKILL.md" "search-memories.py"
}

test_recall_has_workflow() {
    assert_file_contains "$SKILLS_DIR/recall/SKILL.md" "## Workflow"
}

test_recall_has_when_to_use() {
    # Overview is optional if description has trigger phrases (standardized in #179)
    local file="$SKILLS_DIR/recall/SKILL.md"
    if grep -q "## Overview" "$file"; then
        # Has Overview - OK
        return 0
    elif grep -qiE "description:.*use\s+(when|for|this)" "$file"; then
        # Description has triggers - Overview optional
        return 0
    else
        fail "recall SKILL.md should have Overview section or trigger phrases in description"
    fi
}

test_recall_has_filter_options() {
    local file="$SKILLS_DIR/recall/SKILL.md"
    # Should explain filter construction
    grep -qi "filter" "$file" || fail "recall SKILL.md should mention filters"
}

test_recall_has_advanced_flags() {
    assert_file_contains "$SKILLS_DIR/recall/SKILL.md" "## Advanced Flags"
}

# ============================================================================
# /ork:feedback COMMAND TESTS
# ============================================================================

describe "Command: /ork:feedback"

test_feedback_command_exists() {
    assert_file_exists "$SKILLS_DIR/feedback/SKILL.md"
}

test_feedback_has_usage_section() {
    assert_file_contains "$SKILLS_DIR/feedback/SKILL.md" "## Usage"
}

test_feedback_has_subcommands() {
    local file="$SKILLS_DIR/feedback/SKILL.md"

    assert_file_contains "$file" "status"
    assert_file_contains "$file" "pause"
    assert_file_contains "$file" "resume"
    assert_file_contains "$file" "reset"
    assert_file_contains "$file" "export"
    assert_file_contains "$file" "settings"
    assert_file_contains "$file" "opt-in"
    assert_file_contains "$file" "opt-out"
}

test_feedback_has_subcommand_sections() {
    local file="$SKILLS_DIR/feedback/SKILL.md"

    # Check for subcommand headers (may be ### or other format)
    grep -qi "status" "$file" || fail "feedback SKILL.md should have status section"
    grep -qi "pause" "$file" || fail "feedback SKILL.md should have pause section"
    grep -qi "reset" "$file" || fail "feedback SKILL.md should have reset section"
}

test_feedback_has_when_to_use() {
    # Overview is optional if description has trigger phrases (standardized in #179)
    local file="$SKILLS_DIR/feedback/SKILL.md"
    if grep -q "## Overview" "$file"; then
        # Has Overview - OK
        return 0
    elif grep -qiE "description:.*use\s+(when|for|this)" "$file"; then
        # Description has triggers - Overview optional
        return 0
    else
        fail "feedback SKILL.md should have Overview section or trigger phrases in description"
    fi
}

test_feedback_has_output_examples() {
    grep -qF "Output:" "$SKILLS_DIR/feedback/SKILL.md" || fail "feedback SKILL.md should have Output examples"
}

# ============================================================================
# COMMAND FORMAT VALIDATION
# ============================================================================

describe "Commands: Format Validation"

test_all_commands_have_title() {
    for cmd in remember recall feedback; do
        local file="$SKILLS_DIR/${cmd}/SKILL.md"
        if [[ -f "$file" ]]; then
            # Should have a title with the command name
            if ! grep -q "^# " "$file"; then
                fail "$cmd SKILL.md should have a markdown title"
            fi
        fi
    done
}

test_all_commands_are_readable() {
    for cmd in remember recall feedback; do
        local file="$SKILLS_DIR/${cmd}/SKILL.md"
        if [[ -f "$file" ]]; then
            # Should be readable
            if [[ ! -r "$file" ]]; then
                fail "$cmd SKILL.md should be readable"
            fi
        fi
    done
}

test_commands_have_reasonable_size() {
    for cmd in remember recall feedback; do
        local file="$SKILLS_DIR/${cmd}/SKILL.md"
        if [[ -f "$file" ]]; then
            local size
            size=$(wc -c < "$file" | tr -d ' ')

            # Should be at least 500 bytes (meaningful content)
            if [[ $size -lt 500 ]]; then
                fail "$cmd SKILL.md should have meaningful content (>500 bytes)"
            fi

            # Should not be excessively large (context budget)
            if [[ $size -gt 20000 ]]; then
                fail "$cmd SKILL.md is too large (>20KB)"
            fi
        fi
    done
}

test_all_commands_have_user_invocable_true() {
    for cmd in remember recall feedback; do
        local file="$SKILLS_DIR/${cmd}/SKILL.md"
        if [[ -f "$file" ]]; then
            # CC 2.1.3: Commands should have user-invocable: true
            if ! grep -q "user-invocable: true" "$file"; then
                fail "$cmd SKILL.md should have user-invocable: true"
            fi
        fi
    done
}

# ============================================================================
# SCHEMA VALIDATION TESTS
# ============================================================================

describe "Schemas: Memory and Feedback"

test_feedback_schema_exists() {
    assert_file_exists "$PROJECT_ROOT/.claude/schemas/feedback.schema.json"
}

test_feedback_schema_is_valid_json() {
    jq '.' "$PROJECT_ROOT/.claude/schemas/feedback.schema.json" >/dev/null
}

test_memory_schema_exists() {
    assert_file_exists "$PROJECT_ROOT/.claude/schemas/memory.schema.json"
}

test_memory_schema_is_valid_json() {
    jq '.' "$PROJECT_ROOT/.claude/schemas/memory.schema.json" >/dev/null
}

test_feedback_schema_has_required_properties() {
    local schema="$PROJECT_ROOT/.claude/schemas/feedback.schema.json"

    assert_file_contains "$schema" "metrics"
    assert_file_contains "$schema" "learnedPatterns"
    assert_file_contains "$schema" "preferences"
}

test_memory_schema_has_required_properties() {
    local schema="$PROJECT_ROOT/.claude/schemas/memory.schema.json"

    assert_file_contains "$schema" "user_id"
    assert_file_contains "$schema" "category"
    assert_file_contains "$schema" "text"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
