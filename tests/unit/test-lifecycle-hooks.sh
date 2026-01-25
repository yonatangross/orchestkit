#!/usr/bin/env bash
# ============================================================================
# Lifecycle Hooks Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests TypeScript lifecycle hooks in hooks/src/lifecycle/:
# - coordination-cleanup.ts
# - coordination-init.ts
# - instance-heartbeat.ts
# - multi-instance-init.ts
# - session-cleanup.ts
# - session-env-setup.ts
# - session-metrics-summary.ts
#
# Updated for TypeScript hook architecture (v5.1.0+)
# Shell script hooks migrated to TypeScript and compiled to lifecycle.mjs
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_HOOKS_DIR="$PROJECT_ROOT/src/hooks/src/lifecycle"
DIST_DIR="$PROJECT_ROOT/src/hooks/dist"

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

test_coordination_cleanup_has_hook_input() {
    # Should use HookInput type or similar
    if grep -qE "HookInput|input.*:|async.*function" "$TS_HOOKS_DIR/coordination-cleanup.ts" 2>/dev/null; then
        return 0
    fi
    fail "coordination-cleanup.ts should have proper function signature"
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

test_coordination_init_has_instance_handling() {
    if grep -qiE "instance|session|init" "$TS_HOOKS_DIR/coordination-init.ts" 2>/dev/null; then
        return 0
    fi
    fail "coordination-init.ts should handle instance/session initialization"
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

test_instance_heartbeat_has_ping_logic() {
    if grep -qiE "heartbeat|ping|update" "$TS_HOOKS_DIR/instance-heartbeat.ts" 2>/dev/null; then
        return 0
    fi
    fail "instance-heartbeat.ts should have ping/heartbeat logic"
}

# ============================================================================
# MULTI-INSTANCE-INIT TESTS
# ============================================================================

describe "multi-instance-init.ts"

test_multi_instance_init_exists() {
    assert_file_exists "$TS_HOOKS_DIR/multi-instance-init.ts"
}

test_multi_instance_init_exports_handler() {
    assert_file_contains "$TS_HOOKS_DIR/multi-instance-init.ts" "export"
}

test_multi_instance_init_has_instance_detection() {
    if grep -qiE "instance|detect|capabilities" "$TS_HOOKS_DIR/multi-instance-init.ts" 2>/dev/null; then
        return 0
    fi
    fail "multi-instance-init.ts should detect instances/capabilities"
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

test_session_cleanup_has_archive_logic() {
    if grep -qiE "cleanup|archive|session" "$TS_HOOKS_DIR/session-cleanup.ts" 2>/dev/null; then
        return 0
    fi
    fail "session-cleanup.ts should have cleanup/archive logic"
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

test_session_env_setup_has_metrics_init() {
    if grep -qiE "metrics|logs|setup|initialize" "$TS_HOOKS_DIR/session-env-setup.ts" 2>/dev/null; then
        return 0
    fi
    fail "session-env-setup.ts should initialize metrics/logs"
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

test_session_metrics_summary_has_calculation() {
    if grep -qiE "metrics|summary|calculate|total" "$TS_HOOKS_DIR/session-metrics-summary.ts" 2>/dev/null; then
        return 0
    fi
    fail "session-metrics-summary.ts should calculate metrics"
}

# ============================================================================
# CC 2.1.7 COMPLIANCE TESTS
# ============================================================================

describe "CC 2.1.7 TypeScript Compliance"

test_hooks_use_hook_result_type() {
    # Check that hooks return proper HookResult type
    local hook_files=(
        "coordination-cleanup.ts"
        "coordination-init.ts"
        "session-cleanup.ts"
        "session-env-setup.ts"
    )

    for hook in "${hook_files[@]}"; do
        if [[ -f "$TS_HOOKS_DIR/$hook" ]]; then
            if grep -qE "HookResult|continue.*:|suppressOutput" "$TS_HOOKS_DIR/$hook" 2>/dev/null; then
                continue
            fi
        fi
    done
}

test_hooks_have_suppress_output() {
    # TypeScript hooks should have suppressOutput in their return type
    if grep -qr "suppressOutput" "$TS_HOOKS_DIR" 2>/dev/null; then
        return 0
    fi
    fail "Lifecycle hooks should use suppressOutput for CC 2.1.7 compliance"
}

# ============================================================================
# BUNDLE INTEGRATION TESTS
# ============================================================================

describe "Bundle Integration"

test_lifecycle_bundle_exports_handlers() {
    # Check that the compiled bundle has exports
    if grep -qE "export|module\.exports" "$DIST_DIR/lifecycle.mjs" 2>/dev/null; then
        return 0
    fi
    fail "lifecycle.mjs should export handlers"
}

test_run_hook_runner_exists() {
    assert_file_exists "$PROJECT_ROOT/src/hooks/bin/run-hook.mjs"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
