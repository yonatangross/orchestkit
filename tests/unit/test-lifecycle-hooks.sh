#!/usr/bin/env bash
# ============================================================================
# Lifecycle Hooks Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests TypeScript lifecycle hooks in hooks/src/lifecycle/
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_HOOKS_DIR="$PROJECT_ROOT/hooks/src/lifecycle"
DIST_DIR="$PROJECT_ROOT/hooks/dist"

# ============================================================================
# TYPESCRIPT SOURCE FILE TESTS
# ============================================================================

describe "Lifecycle Hooks: TypeScript Source Files"

test_lifecycle_ts_directory_exists() {
    [[ -d "$TS_HOOKS_DIR" ]] || fail "Directory missing: $TS_HOOKS_DIR"
}

test_lifecycle_bundle_exists() {
    assert_file_exists "$DIST_DIR/lifecycle.mjs"
}

test_lifecycle_bundle_has_content() {
    local size
    size=$(wc -c < "$DIST_DIR/lifecycle.mjs" | tr -d ' ')
    if [[ "$size" -lt 1000 ]]; then
        fail "lifecycle.mjs seems too small ($size bytes)"
    fi
}

# ============================================================================
# COORDINATION-CLEANUP TESTS
# ============================================================================

describe "coordination-cleanup.ts"

test_coordination_cleanup_exists() {
    assert_file_exists "$TS_HOOKS_DIR/coordination-cleanup.ts"
}

test_coordination_cleanup_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/coordination-cleanup.ts" "export"
}

# ============================================================================
# COORDINATION-INIT TESTS
# ============================================================================

describe "coordination-init.ts"

test_coordination_init_exists() {
    assert_file_exists "$TS_HOOKS_DIR/coordination-init.ts"
}

test_coordination_init_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/coordination-init.ts" "export"
}

# ============================================================================
# INSTANCE-HEARTBEAT TESTS
# ============================================================================

describe "instance-heartbeat.ts"

test_instance_heartbeat_exists() {
    assert_file_exists "$TS_HOOKS_DIR/instance-heartbeat.ts"
}

test_instance_heartbeat_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/instance-heartbeat.ts" "export"
}

# ============================================================================
# SESSION-CLEANUP TESTS
# ============================================================================

describe "session-cleanup.ts"

test_session_cleanup_exists() {
    assert_file_exists "$TS_HOOKS_DIR/session-cleanup.ts"
}

test_session_cleanup_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/session-cleanup.ts" "export"
}

# ============================================================================
# SESSION-ENV-SETUP TESTS
# ============================================================================

describe "session-env-setup.ts"

test_session_env_setup_exists() {
    assert_file_exists "$TS_HOOKS_DIR/session-env-setup.ts"
}

test_session_env_setup_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/session-env-setup.ts" "export"
}

# ============================================================================
# SESSION-METRICS-SUMMARY TESTS
# ============================================================================

describe "session-metrics-summary.ts"

test_session_metrics_summary_exists() {
    assert_file_exists "$TS_HOOKS_DIR/session-metrics-summary.ts"
}

test_session_metrics_summary_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/session-metrics-summary.ts" "export"
}

# ============================================================================
# BUNDLE INTEGRATION TESTS
# ============================================================================

describe "Bundle Integration"

test_lifecycle_bundle_exports_handlers() {
    if grep -qE "export|module\.exports" "$DIST_DIR/lifecycle.mjs" 2>/dev/null; then
        return 0
    fi
    fail "lifecycle.mjs should export handlers"
}

test_run_hook_runner_exists() {
    assert_file_exists "$PROJECT_ROOT/hooks/bin/run-hook.mjs"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
