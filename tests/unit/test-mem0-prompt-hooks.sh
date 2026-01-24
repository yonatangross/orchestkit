#!/usr/bin/env bash
# ============================================================================
# Mem0 Prompt Hooks Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests mem0-related TypeScript hooks:
# - hooks/src/prompt/antipattern-detector.ts
# - hooks/src/stop/auto-remember-continuity.ts
#
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_PROMPT_DIR="$PROJECT_ROOT/hooks/src/prompt"
TS_STOP_DIR="$PROJECT_ROOT/hooks/src/stop"
DIST_DIR="$PROJECT_ROOT/hooks/dist"

# ============================================================================
# ANTIPATTERN DETECTOR TESTS
# ============================================================================

describe "Antipattern Detector Hook (TypeScript)"

test_antipattern_detector_exists() {
    assert_file_exists "$TS_PROMPT_DIR/antipattern-detector.ts"
}

test_antipattern_detector_exports_handler() {
    assert_file_contains "$TS_PROMPT_DIR/antipattern-detector.ts" "export"
}

test_antipattern_detector_has_detection_logic() {
    if grep -qiE "antipattern|pattern|detect|keyword|implement" "$TS_PROMPT_DIR/antipattern-detector.ts" 2>/dev/null; then
        return 0
    fi
    fail "antipattern-detector.ts should have detection logic"
}

test_antipattern_detector_has_prompt_handling() {
    if grep -qiE "prompt|input|HookInput" "$TS_PROMPT_DIR/antipattern-detector.ts" 2>/dev/null; then
        return 0
    fi
    fail "antipattern-detector.ts should handle prompt input"
}

# ============================================================================
# AUTO-REMEMBER CONTINUITY TESTS
# ============================================================================

describe "Auto-Remember Continuity Hook (TypeScript)"

test_auto_remember_exists() {
    assert_file_exists "$TS_STOP_DIR/auto-remember-continuity.ts"
}

test_auto_remember_exports_handler() {
    assert_file_contains "$TS_STOP_DIR/auto-remember-continuity.ts" "export"
}

test_auto_remember_has_mem0_logic() {
    if grep -qiE "mem0|memory|remember|continuity" "$TS_STOP_DIR/auto-remember-continuity.ts" 2>/dev/null; then
        return 0
    fi
    fail "auto-remember-continuity.ts should have mem0/memory logic"
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

describe "Mem0 Library Functions (TypeScript)"

test_mem0_lib_exists() {
    # TypeScript mem0 library should exist in lib directory
    local ts_lib="$PROJECT_ROOT/hooks/src/lib/mem0.ts"

    if [[ -f "$ts_lib" ]]; then
        return 0
    fi

    # May be integrated into other lib files
    if grep -qiE "mem0|memory" "$PROJECT_ROOT/hooks/src/lib/"*.ts 2>/dev/null; then
        return 0
    fi

    skip "mem0 library not found as standalone file"
}

test_mem0_lib_has_required_functions() {
    local ts_lib="$PROJECT_ROOT/hooks/src/lib/mem0.ts"

    if [[ ! -f "$ts_lib" ]]; then
        skip "mem0.ts not found"
    fi

    # Check for key exports/functions
    if grep -qE "mem0|userId|projectId|available" "$ts_lib" 2>/dev/null; then
        return 0
    fi
    fail "mem0.ts should have required functions"
}

# ============================================================================
# BUNDLE TESTS
# ============================================================================

describe "Bundle Compilation"

test_prompt_bundle_exists() {
    assert_file_exists "$DIST_DIR/prompt.mjs"
}

test_stop_bundle_exists() {
    # Stop hooks may be in a separate bundle or main hooks bundle
    if [[ -f "$DIST_DIR/stop.mjs" ]]; then
        return 0
    fi
    # May be part of lifecycle or hooks bundle
    if [[ -f "$DIST_DIR/hooks.mjs" ]] || [[ -f "$DIST_DIR/lifecycle.mjs" ]]; then
        return 0
    fi
    fail "Stop hooks bundle should exist"
}

test_prompt_bundle_has_content() {
    local size
    size=$(wc -c < "$DIST_DIR/prompt.mjs" | tr -d ' ')
    if [[ "$size" -lt 1000 ]]; then
        fail "prompt.mjs seems too small ($size bytes)"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests "$@"
