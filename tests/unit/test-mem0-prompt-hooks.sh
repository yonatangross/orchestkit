#!/usr/bin/env bash
# ============================================================================
# Mem0 Prompt Hooks Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests mem0-related TypeScript hooks
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
    if grep -qiE "antipattern|pattern|detect" "$TS_PROMPT_DIR/antipattern-detector.ts" 2>/dev/null; then
        return 0
    fi
    fail "antipattern-detector.ts should have detection logic"
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
# BUNDLE TESTS
# ============================================================================

describe "Bundle Compilation"

test_prompt_bundle_exists() {
    assert_file_exists "$DIST_DIR/prompt.mjs"
}

test_prompt_bundle_has_content() {
    local size
    size=$(wc -c < "$DIST_DIR/prompt.mjs" | tr -d ' ')
    if [[ "$size" -lt 1000 ]]; then
        fail "prompt.mjs seems too small ($size bytes)"
    fi
}

test_stop_bundle_exists() {
    if [[ -f "$DIST_DIR/stop.mjs" ]]; then
        return 0
    fi
    if [[ -f "$DIST_DIR/hooks.mjs" ]] || [[ -f "$DIST_DIR/lifecycle.mjs" ]]; then
        return 0
    fi
    fail "Stop hooks bundle should exist"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests "$@"
