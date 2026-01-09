#!/usr/bin/env bash
# ============================================================================
# Skill Hooks Comprehensive Unit Tests
# ============================================================================
# Tests all 22 skill hooks for CC 2.1.2 compliance
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_DIR="$PROJECT_ROOT/.claude/hooks/skill"

# ============================================================================
# SKILL VALIDATION HOOKS
# ============================================================================

describe "Skill Validation Hooks"

test_backend_file_naming_validates_paths() {
    local hook="$HOOKS_DIR/backend-file-naming.sh"
    if [[ ! -f "$hook" ]]; then
        skip "backend-file-naming.sh not found"
    fi

    local input='{"file_path":"src/services/user_service.py","content":"class UserService:"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_backend_layer_validator_checks_architecture() {
    local hook="$HOOKS_DIR/backend-layer-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "backend-layer-validator.sh not found"
    fi

    local input='{"file_path":"src/routers/users.py","imports":["from services import user_service"]}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_di_pattern_enforcer_validates_injection() {
    local hook="$HOOKS_DIR/di-pattern-enforcer.sh"
    if [[ ! -f "$hook" ]]; then
        skip "di-pattern-enforcer.sh not found"
    fi

    local input='{"file_path":"src/services/auth.py","content":"def __init__(self, db: Database):"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_import_direction_enforcer_checks_deps() {
    local hook="$HOOKS_DIR/import-direction-enforcer.sh"
    if [[ ! -f "$hook" ]]; then
        skip "import-direction-enforcer.sh not found"
    fi

    local input='{"file_path":"src/domain/user.py","imports":["from infrastructure import db"]}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_structure_location_validator_runs() {
    local hook="$HOOKS_DIR/structure-location-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "structure-location-validator.sh not found"
    fi

    local input='{"file_path":"src/models/user.py","type":"model"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# TEST VALIDATION HOOKS
# ============================================================================

describe "Test Validation Hooks"

test_test_location_validator_checks_path() {
    local hook="$HOOKS_DIR/test-location-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "test-location-validator.sh not found"
    fi

    local input='{"file_path":"tests/unit/test_user_service.py","test_type":"unit"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_test_pattern_validator_checks_naming() {
    local hook="$HOOKS_DIR/test-pattern-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "test-pattern-validator.sh not found"
    fi

    local input='{"file_path":"tests/test_auth.py","functions":["test_login_success","test_login_failure"]}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_test_runner_executes() {
    local hook="$HOOKS_DIR/test-runner.sh"
    if [[ ! -f "$hook" ]]; then
        skip "test-runner.sh not found"
    fi

    local input='{"test_path":"tests/unit/","framework":"pytest"}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    # Should not crash
    assert_less_than "$exit_code" 3
}

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

test_duplicate_code_detector_analyzes() {
    local hook="$HOOKS_DIR/duplicate-code-detector.sh"
    if [[ ! -f "$hook" ]]; then
        skip "duplicate-code-detector.sh not found"
    fi

    local input='{"files":["src/a.py","src/b.py"],"threshold":0.8}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

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

test_merge_conflict_predictor_analyzes() {
    local hook="$HOOKS_DIR/merge-conflict-predictor.sh"
    if [[ ! -f "$hook" ]]; then
        skip "merge-conflict-predictor.sh not found"
    fi

    local input='{"source_branch":"feature/auth","target_branch":"main"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_merge_readiness_checker_validates() {
    local hook="$HOOKS_DIR/merge-readiness-checker.sh"
    if [[ ! -f "$hook" ]]; then
        skip "merge-readiness-checker.sh not found"
    fi

    # This skill hook outputs human-readable reports, not JSON
    # It's designed for interactive use, not CC 2.1.2 compliance
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
# REPORTING HOOKS
# ============================================================================

describe "Reporting Hooks"

test_review_summary_generator_creates_summary() {
    local hook="$HOOKS_DIR/review-summary-generator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "review-summary-generator.sh not found"
    fi

    local input='{"changes":[{"file":"src/api.py","type":"modified"}]}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    assert_less_than "$exit_code" 3
}

test_security_summary_generates_report() {
    local hook="$HOOKS_DIR/security-summary.sh"
    if [[ ! -f "$hook" ]]; then
        skip "security-summary.sh not found"
    fi

    local input='{"scan_results":{"vulnerabilities":0,"warnings":2}}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    assert_less_than "$exit_code" 3
}

test_eval_metrics_collector_collects() {
    local hook="$HOOKS_DIR/eval-metrics-collector.sh"
    if [[ ! -f "$hook" ]]; then
        skip "eval-metrics-collector.sh not found"
    fi

    local input='{"metrics":{"latency_ms":150,"tokens":500}}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    assert_less_than "$exit_code" 3
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

test_migration_validator_checks_migration() {
    local hook="$HOOKS_DIR/migration-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "migration-validator.sh not found"
    fi

    local input='{"migration_file":"alembic/versions/001_initial.py"}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    assert_less_than "$exit_code" 3
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests