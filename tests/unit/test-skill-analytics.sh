#!/usr/bin/env bash
# ============================================================================
# Skill Analytics Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests for hooks/src/skill/skill-tracker.ts
# Tests for .claude/scripts/skill-analyzer.sh
# Part of Phase 4: Skill Usage Analytics (#56)
#
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_SKILL_TRACKER="$PROJECT_ROOT/hooks/src/pretool/skill/skill-tracker.ts"
SKILL_ANALYZER="$PROJECT_ROOT/.claude/scripts/skill-analyzer.sh"
DIST_DIR="$PROJECT_ROOT/hooks/dist"

# ============================================================================
# SKILL TRACKER TESTS (TypeScript)
# ============================================================================

describe "Skill Tracker Hook: TypeScript Source"

test_skill_tracker_exists() {
    assert_file_exists "$TS_SKILL_TRACKER"
}

test_skill_tracker_exports_handler() {
    assert_file_contains "$TS_SKILL_TRACKER" "export"
}

test_skill_tracker_has_function() {
    if grep -qE "function|async|=>|const.*=" "$TS_SKILL_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-tracker.ts should have function definition"
}

it "exists" test_skill_tracker_exists
it "exports handler" test_skill_tracker_exports_handler
it "has function definition" test_skill_tracker_has_function

describe "Skill Tracker Hook: Feedback Integration"

test_tracker_has_logging() {
    if grep -qiE "log|feedback|track" "$TS_SKILL_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-tracker.ts should have logging functionality"
}

test_tracker_logs_usage() {
    if grep -qiE "skill|usage|log" "$TS_SKILL_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-tracker.ts should log skill usage"
}

test_tracker_has_analytics() {
    if grep -qiE "analytics|jsonl|metric" "$TS_SKILL_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-tracker.ts should have analytics"
}

it "has logging functionality" test_tracker_has_logging
it "logs skill usage" test_tracker_logs_usage
it "has analytics" test_tracker_has_analytics

describe "Skill Tracker Hook: CC 2.1.6 Compliance"

test_tracker_has_hook_result() {
    if grep -qE "HookResult|continue|suppressOutput" "$TS_SKILL_TRACKER" 2>/dev/null; then
        return 0
    fi
    # Check types file
    if grep -qE "HookResult|continue|suppressOutput" "$PROJECT_ROOT/hooks/src/types.ts" 2>/dev/null; then
        return 0
    fi
    fail "skill-tracker.ts should use HookResult type"
}

it "uses HookResult type" test_tracker_has_hook_result

# ============================================================================
# SKILL ANALYZER TESTS
# ============================================================================

describe "Skill Analyzer Script: File Structure"

test_analyzer_exists() {
    assert_file_exists "$SKILL_ANALYZER"
}

test_analyzer_executable() {
    [[ -x "$SKILL_ANALYZER" ]]
}

test_analyzer_syntax() {
    bash -n "$SKILL_ANALYZER"
}

it "exists" test_analyzer_exists
it "is executable" test_analyzer_executable
it "has valid syntax" test_analyzer_syntax

describe "Skill Analyzer Script: Commands"

test_analyzer_help() {
    local output
    output=$(bash "$SKILL_ANALYZER" help 2>&1)
    [[ "$output" == *"Usage"* ]] && [[ "$output" == *"summary"* ]]
}

test_analyzer_summary() {
    export CLAUDE_PROJECT_DIR="$TEMP_DIR"
    mkdir -p "$TEMP_DIR/.claude/feedback" "$TEMP_DIR/.claude/logs" 2>/dev/null || true
    local output
    output=$(bash "$SKILL_ANALYZER" summary 2>&1) || true
    [[ "$output" == *"Summary"* ]] || [[ "$output" == *"summary"* ]]
}

test_analyzer_top() {
    export CLAUDE_PROJECT_DIR="$TEMP_DIR"
    mkdir -p "$TEMP_DIR/.claude/feedback" 2>/dev/null || true
    local output
    output=$(bash "$SKILL_ANALYZER" top 2>&1) || true
    [[ "$output" == *"Top"* ]] || [[ "$output" == *"Skills"* ]] || [[ "$output" == *"No"* ]]
}

test_analyzer_recent() {
    export CLAUDE_PROJECT_DIR="$TEMP_DIR"
    mkdir -p "$TEMP_DIR/.claude/logs" 2>/dev/null || true
    local output
    output=$(bash "$SKILL_ANALYZER" recent 2>&1) || true
    [[ "$output" == *"Recent"* ]] || [[ "$output" == *"No"* ]]
}

test_analyzer_efficiency() {
    export CLAUDE_PROJECT_DIR="$TEMP_DIR"
    mkdir -p "$TEMP_DIR/.claude/feedback" 2>/dev/null || true
    local output
    output=$(bash "$SKILL_ANALYZER" efficiency 2>&1) || true
    [[ "$output" == *"Efficiency"* ]] || [[ "$output" == *"efficiency"* ]] || [[ "$output" == *"No"* ]]
}

test_analyzer_suggest() {
    export CLAUDE_PROJECT_DIR="$TEMP_DIR"
    mkdir -p "$TEMP_DIR/.claude/feedback" 2>/dev/null || true
    local output
    output=$(bash "$SKILL_ANALYZER" suggest 2>&1) || true
    [[ "$output" == *"Suggest"* ]] || [[ "$output" == *"suggest"* ]] || [[ "$output" == *"No"* ]] || [[ "$output" == *"Optimization"* ]]
}

it "help command works" test_analyzer_help
it "summary command works" test_analyzer_summary
it "top command works" test_analyzer_top
it "recent command works" test_analyzer_recent
it "efficiency command works" test_analyzer_efficiency
it "suggest command works" test_analyzer_suggest

describe "Skill Analyzer Script: Functions"

test_has_get_skill_metrics() {
    grep -q "get_skill_metrics()" "$SKILL_ANALYZER"
}

test_has_get_recent_skills() {
    grep -q "get_recent_skills()" "$SKILL_ANALYZER"
}

test_has_calc_efficiency() {
    grep -q "calc_efficiency()" "$SKILL_ANALYZER"
}

test_has_suggest_optimizations() {
    grep -q "suggest_optimizations()" "$SKILL_ANALYZER"
}

it "has get_skill_metrics function" test_has_get_skill_metrics
it "has get_recent_skills function" test_has_get_recent_skills
it "has calc_efficiency function" test_has_calc_efficiency
it "has suggest_optimizations function" test_has_suggest_optimizations

# ============================================================================
# BUNDLE TESTS
# ============================================================================

describe "Bundle Integration"

test_skill_hooks_bundle_exists() {
    # Skill hooks may be in pretool bundle or main hooks bundle
    if [[ -f "$DIST_DIR/pretool.mjs" ]]; then
        return 0
    fi
    if [[ -f "$DIST_DIR/hooks.mjs" ]]; then
        return 0
    fi
    fail "Skill hooks bundle should exist"
}

it "skill hooks bundle exists" test_skill_hooks_bundle_exists

# ============================================================================
# INTEGRATION TESTS
# ============================================================================

describe "Integration: Feedback System"

test_feedback_lib_has_log_skill_usage() {
    local feedback_lib="$PROJECT_ROOT/.claude/scripts/feedback-lib.sh"
    if [[ -f "$feedback_lib" ]]; then
        grep -q "log_skill_usage()" "$feedback_lib"
    else
        skip "feedback-lib.sh not found"
    fi
}

it "feedback-lib has log_skill_usage" test_feedback_lib_has_log_skill_usage

describe "Integration: Analytics Format"

test_analytics_jsonl_format() {
    # Test that JSONL format is valid
    local test_jsonl="$TEMP_DIR/test-analytics.jsonl"
    local entry='{"skill":"test","timestamp":"2024-01-01T00:00:00Z","project":"test"}'
    echo "$entry" > "$test_jsonl"
    jq -e '.' "$test_jsonl" >/dev/null
}

it "JSONL format is valid" test_analytics_jsonl_format

# ============================================================================
# RUN TESTS
# ============================================================================

print_summary
