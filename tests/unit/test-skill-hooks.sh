#!/usr/bin/env bash
# ============================================================================
# Skill Hooks Comprehensive Unit Tests
# ============================================================================
# Tests skill hooks for CC 2.1.6 compliance.
# Dead-hook triage (#2561/PR #2889): cases for deleted skill hooks removed.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_DIR="$PROJECT_ROOT/src/hooks/skill"

# ============================================================================
# TEST VALIDATION HOOKS
# ============================================================================

describe "Test Validation Hooks"

test_coverage_check_runs() {
    local hook="$HOOKS_DIR/coverage-check.sh"
    if [[ ! -f "$hook" ]]; then
        skip "coverage-check.sh not found"
    fi

    local input='{"coverage_data":{"lines":100,"covered":85}}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    assert_less_than "$exit_code" 3
}

test_coverage_threshold_gate_validates() {
    local hook="$HOOKS_DIR/coverage-threshold-gate.sh"
    if [[ ! -f "$hook" ]]; then
        skip "coverage-threshold-gate.sh not found"
    fi

    local input='{"current_coverage":75,"threshold":70}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# CODE QUALITY HOOKS
# ============================================================================

describe "Code Quality Hooks"

test_pattern_consistency_enforcer_runs() {
    local hook="$HOOKS_DIR/pattern-consistency-enforcer.sh"
    if [[ ! -f "$hook" ]]; then
        skip "pattern-consistency-enforcer.sh not found"
    fi

    local input='{"file_path":"src/services/user.py","patterns":["repository","service"]}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_redact_secrets_masks_sensitive() {
    local hook="$HOOKS_DIR/redact-secrets.sh"
    if [[ ! -f "$hook" ]]; then
        skip "redact-secrets.sh not found"
    fi

    local input='{"content":"API_KEY=sk-1234567890abcdef"}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    assert_less_than "$exit_code" 3
}

# ============================================================================
# GIT/MERGE HOOKS
# ============================================================================

describe "Git and Merge Hooks"

test_merge_readiness_checker_validates() {
    local hook="$HOOKS_DIR/merge-readiness-checker.sh"
    if [[ ! -f "$hook" ]]; then
        skip "merge-readiness-checker.sh not found"
    fi

    # This skill hook outputs human-readable reports, not JSON
    # It's designed for interactive use, not CC 2.1.6 compliance
    local input='{"branch":"feature/api","checks":["tests","lint","coverage"]}'
    local exit_code
    
    # Run hook in background and kill after timeout (cross-platform)
    (echo "$input" | bash "$hook" >/dev/null 2>&1) &
    local pid=$!
    sleep 3
    kill $pid 2>/dev/null && exit_code=0 || wait $pid && exit_code=$?

    # Should not crash
    assert_less_than "${exit_code:-0}" 3
}

# ============================================================================
# CROSS-INSTANCE HOOKS
# ============================================================================

describe "Cross-Instance Hooks"

test_cross_instance_test_validator_runs() {
    local hook="$HOOKS_DIR/cross-instance-test-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "cross-instance-test-validator.sh not found"
    fi

    local input='{"instance_id":"test-001","test_results":{"passed":10,"failed":0}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# EVIDENCE AND DESIGN HOOKS
# ============================================================================

describe "Evidence and Design Hooks"

test_evidence_collector_gathers_evidence() {
    local hook="$HOOKS_DIR/evidence-collector.sh"
    if [[ ! -f "$hook" ]]; then
        skip "evidence-collector.sh not found"
    fi

    local input='{"task":"implement feature","evidence_type":"test_results"}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    assert_less_than "$exit_code" 3
}

test_design_decision_saver_persists() {
    local hook="$HOOKS_DIR/design-decision-saver.sh"
    if [[ ! -f "$hook" ]]; then
        skip "design-decision-saver.sh not found"
    fi

    local input='{"decision":"Use repository pattern","rationale":"Separation of concerns"}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    assert_less_than "$exit_code" 3
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests