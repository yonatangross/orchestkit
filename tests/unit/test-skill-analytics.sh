#!/usr/bin/env bash
# ============================================================================
# Skill Analytics Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests for hooks/src/pretool/skill/skill-tracker.ts
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

# ============================================================================
# SKILL TRACKER FUNCTIONALITY
# ============================================================================

describe "Skill Tracker: Functionality"

test_has_logging_functionality() {
    if grep -qiE "log|track|record" "$TS_SKILL_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-tracker.ts should have logging functionality"
}

test_logs_skill_usage() {
    if grep -qiE "skill|usage|invoke" "$TS_SKILL_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-tracker.ts should log skill usage"
}

test_has_analytics() {
    if grep -qiE "analytics|metric|count" "$TS_SKILL_TRACKER" 2>/dev/null; then
        return 0
    fi
    fail "skill-tracker.ts should have analytics"
}

# ============================================================================
# SKILL ANALYZER TESTS
# ============================================================================

describe "Skill Analyzer Script"

test_skill_analyzer_exists() {
    assert_file_exists "$SKILL_ANALYZER"
}

test_skill_analyzer_executable() {
    [[ -x "$SKILL_ANALYZER" ]]
}

test_skill_analyzer_syntax() {
    bash -n "$SKILL_ANALYZER"
}

# ============================================================================
# BUNDLE TESTS
# ============================================================================

describe "Bundle Integration"

test_pretool_bundle_exists() {
    assert_file_exists "$DIST_DIR/pretool.mjs"
}

test_pretool_bundle_has_content() {
    local size
    size=$(wc -c < "$DIST_DIR/pretool.mjs" | tr -d ' ')
    if [[ "$size" -lt 1000 ]]; then
        fail "pretool.mjs seems too small ($size bytes)"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
