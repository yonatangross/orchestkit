#!/bin/bash
# test-feedback-system.sh - Tests for the feedback and analytics system
# Part of OrchestKit Claude Plugin comprehensive test suite
# CC 2.1.7 Compliant
#
# Tests:
# - Consent management (opt-in, opt-out, revoke)
# - PII validation and scrubbing
# - Satisfaction detection
# - Agent performance tracking
# - Skill evolution engine
# - Privacy compliance

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# Save real root before setup() overwrites PROJECT_ROOT via sourced scripts
readonly REAL_PROJECT_ROOT="$PROJECT_ROOT"

# Export for hooks
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Temp directory for test data
TEST_TEMP_DIR=""

# =============================================================================
# Setup / Teardown
# =============================================================================

setup() {
    TEST_TEMP_DIR=$(mktemp -d)
    export CLAUDE_PROJECT_DIR="$TEST_TEMP_DIR"
    mkdir -p "$TEST_TEMP_DIR/.claude/feedback"
    mkdir -p "$TEST_TEMP_DIR/.claude/scripts"

    # Copy necessary scripts
    if [[ -f "$PROJECT_ROOT/.claude/scripts/consent-manager.sh" ]]; then
        cp "$PROJECT_ROOT/.claude/scripts/consent-manager.sh" "$TEST_TEMP_DIR/.claude/scripts/"
    fi
    if [[ -f "$PROJECT_ROOT/.claude/scripts/feedback-lib.sh" ]]; then
        cp "$PROJECT_ROOT/.claude/scripts/feedback-lib.sh" "$TEST_TEMP_DIR/.claude/scripts/"
    fi
}

teardown() {
    if [[ -n "$TEST_TEMP_DIR" && -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

trap teardown EXIT

# =============================================================================
# Test Helper Functions
# =============================================================================

test_start() {
    local name="$1"
    echo -n "  ○ $name... "
    ((++TESTS_RUN))
}

test_pass() {
    echo -e "\033[0;32mPASS\033[0m"
    ((++TESTS_PASSED))
}

test_fail() {
    local reason="${1:-}"
    echo -e "\033[0;31mFAIL\033[0m"
    [[ -n "$reason" ]] && echo "    └─ $reason"
    ((++TESTS_FAILED))
}

test_skip() {
    local reason="${1:-}"
    echo -e "\033[1;33mSKIP\033[0m"
    [[ -n "$reason" ]] && echo "    └─ $reason"
    ((--TESTS_RUN)) || true  # Don't count skipped tests
}

# =============================================================================
# Test: Consent Manager
# =============================================================================

test_consent_initial_state() {
    test_start "consent manager initial state is not consented"

    local consent_manager="$PROJECT_ROOT/.claude/scripts/consent-manager.sh"

    if [[ ! -f "$consent_manager" ]]; then
        test_skip "consent-manager.sh not found"
        return
    fi

    source "$consent_manager"

    # Fresh state should not have consent
    if ! has_consent 2>/dev/null; then
        test_pass
    else
        test_fail "Should not have consent initially"
    fi
}

test_consent_opt_in() {
    test_start "consent opt-in works correctly"

    local consent_manager="$PROJECT_ROOT/.claude/scripts/consent-manager.sh"

    if [[ ! -f "$consent_manager" ]]; then
        test_skip "consent-manager.sh not found"
        return
    fi

    source "$consent_manager"

    # Opt in
    if record_consent 2>/dev/null; then
        if has_consent 2>/dev/null; then
            test_pass
        else
            test_fail "Consent not recorded after opt-in"
        fi
    else
        test_fail "record_consent failed"
    fi
}

test_consent_opt_out() {
    test_start "consent opt-out works correctly"

    local consent_manager="$PROJECT_ROOT/.claude/scripts/consent-manager.sh"

    if [[ ! -f "$consent_manager" ]]; then
        test_skip "consent-manager.sh not found"
        return
    fi

    source "$consent_manager"

    # First opt in, then opt out
    record_consent 2>/dev/null || true

    if revoke_consent 2>/dev/null; then
        if ! has_consent 2>/dev/null; then
            test_pass
        else
            test_fail "Consent still present after opt-out"
        fi
    else
        test_fail "revoke_consent failed"
    fi
}

test_consent_log_created() {
    test_start "consent log records events"

    local consent_manager="$PROJECT_ROOT/.claude/scripts/consent-manager.sh"

    if [[ ! -f "$consent_manager" ]]; then
        test_skip "consent-manager.sh not found"
        return
    fi

    source "$consent_manager"

    record_consent 2>/dev/null || true

    local consent_log="$CLAUDE_PROJECT_DIR/.claude/feedback/consent-log.json"

    if [[ -f "$consent_log" ]]; then
        # Check it's valid JSON with events
        if jq -e '.events' "$consent_log" >/dev/null 2>&1; then
            test_pass
        else
            test_fail "Consent log missing events array"
        fi
    else
        test_fail "Consent log not created"
    fi
}

# =============================================================================
# Test: PII Validation
# =============================================================================

# analytics-lib sourced lazily before PII tests (has readonly vars + side effects)
_PII_AVAILABLE=false
_source_analytics_lib() {
    if [[ "$_PII_AVAILABLE" == "true" ]]; then return 0; fi
    local lib="$REAL_PROJECT_ROOT/.claude/scripts/analytics-lib.sh"
    if [[ -f "$lib" ]]; then
        source "$lib" 2>/dev/null && _PII_AVAILABLE=true
    fi
}

test_pii_detection_email() {
    test_start "PII detection catches email addresses"
    _source_analytics_lib

    if [[ "$_PII_AVAILABLE" != "true" ]] || ! type validate_no_pii &>/dev/null; then
        test_skip "analytics-lib.sh not available"
        return
    fi

    local test_text="Contact me at user@example.com for details"
    # validate_no_pii returns 1 when PII IS detected
    if ! validate_no_pii "$test_text" 2>/dev/null; then
        test_pass
    else
        test_fail "Should detect email as PII"
    fi
}

test_pii_detection_ip_address() {
    test_start "PII detection catches IP addresses"
    _source_analytics_lib

    if [[ "$_PII_AVAILABLE" != "true" ]] || ! type validate_no_pii &>/dev/null; then
        test_skip "analytics-lib.sh not available"
        return
    fi

    local test_text="Server at 192.168.1.100 responded"
    # validate_no_pii returns 1 when PII IS detected
    if ! validate_no_pii "$test_text" 2>/dev/null; then
        test_pass
    else
        test_fail "Should detect IP address as PII"
    fi
}

test_pii_safe_text() {
    test_start "PII detection allows safe text"
    _source_analytics_lib

    if [[ "$_PII_AVAILABLE" != "true" ]] || ! type validate_no_pii &>/dev/null; then
        test_skip "analytics-lib.sh not available"
        return
    fi

    local test_text="User completed task successfully with 95 percent coverage"
    # validate_no_pii returns 0 when text is clean
    if validate_no_pii "$test_text" 2>/dev/null; then
        test_pass
    else
        test_fail "Should not flag safe text as PII"
    fi
}

# =============================================================================
# Test: Satisfaction Detection
# =============================================================================

test_satisfaction_positive_detection() {
    test_start "satisfaction detection identifies positive signals"

    local feedback_lib="$PROJECT_ROOT/.claude/scripts/feedback-lib.sh"

    if [[ ! -f "$feedback_lib" ]]; then
        test_skip "feedback-lib.sh not found"
        return
    fi

    source "$feedback_lib"

    if type detect_satisfaction &>/dev/null; then
        local result
        result=$(detect_satisfaction "perfect, exactly what I needed!" 2>/dev/null || echo "neutral")

        if [[ "$result" == "positive" || "$result" == "satisfied" ]]; then
            test_pass
        else
            test_fail "Expected positive, got '$result'"
        fi
    else
        test_skip "detect_satisfaction function not found"
    fi
}

test_satisfaction_negative_detection() {
    test_start "satisfaction detection identifies negative signals"

    local feedback_lib="$PROJECT_ROOT/.claude/scripts/feedback-lib.sh"

    if [[ ! -f "$feedback_lib" ]]; then
        test_skip "feedback-lib.sh not found"
        return
    fi

    source "$feedback_lib"

    if type detect_satisfaction &>/dev/null; then
        local result
        result=$(detect_satisfaction "this is wrong, not what I asked for" 2>/dev/null || echo "neutral")

        if [[ "$result" == "negative" || "$result" == "unsatisfied" ]]; then
            test_pass
        else
            test_fail "Expected negative, got '$result'"
        fi
    else
        test_skip "detect_satisfaction function not found"
    fi
}

# =============================================================================
# Test: Agent Performance Tracking
# =============================================================================

test_agent_performance_logging() {
    test_start "agent performance tracks agent spawns in metrics"

    local feedback_lib="$PROJECT_ROOT/.claude/scripts/feedback-lib.sh"

    if [[ ! -f "$feedback_lib" ]]; then
        test_skip "feedback-lib.sh not found"
        return
    fi

    source "$feedback_lib"

    if type log_agent_performance &>/dev/null; then
        # Enable feedback and set up metrics file
        mkdir -p "$CLAUDE_PROJECT_DIR/.claude/feedback" 2>/dev/null || true
        export FEEDBACK_ENABLED="true"
        local metrics="$CLAUDE_PROJECT_DIR/.claude/feedback/metrics.json"
        export METRICS_FILE="$metrics"
        echo '{"agents":{}}' > "$metrics"

        log_agent_performance "test-agent" "true" "5000" 2>/dev/null || true

        # Verify the agent was tracked in the metrics file
        if jq -e '.agents["test-agent"].spawns >= 1' "$metrics" >/dev/null 2>&1; then
            test_pass
        else
            test_fail "log_agent_performance did not write agent spawn to metrics"
        fi
    else
        test_skip "log_agent_performance function not found"
    fi
}

test_agent_performance_metrics() {
    test_start "skill tracking writes session state"

    local feedback_lib="$PROJECT_ROOT/.claude/scripts/feedback-lib.sh"

    if [[ ! -f "$feedback_lib" ]]; then
        test_skip "feedback-lib.sh not found"
        return
    fi

    source "$feedback_lib"

    if type track_skill_for_evolution &>/dev/null; then
        # Set up feedback dir for session file
        export FEEDBACK_DIR="$CLAUDE_PROJECT_DIR/.claude/feedback"
        mkdir -p "$FEEDBACK_DIR/../session" 2>/dev/null || true

        track_skill_for_evolution "backend-system-architect" 2>/dev/null || true

        # Verify the session state file was created with the skill entry
        local session_file="$FEEDBACK_DIR/../session/state.json"
        if [[ -f "$session_file" ]] && jq -e '.recentSkills | length > 0' "$session_file" >/dev/null 2>&1; then
            test_pass
        else
            test_fail "track_skill_for_evolution did not write session state"
        fi
    else
        test_skip "track_skill_for_evolution function not found"
    fi
}

# =============================================================================
# Test: Privacy Compliance
# =============================================================================

test_no_metrics_without_consent() {
    test_start "no metrics collected without consent"

    local feedback_lib="$PROJECT_ROOT/.claude/scripts/feedback-lib.sh"
    local consent_manager="$PROJECT_ROOT/.claude/scripts/consent-manager.sh"

    if [[ ! -f "$feedback_lib" ]] || [[ ! -f "$consent_manager" ]]; then
        test_skip "Required scripts not found"
        return
    fi

    source "$consent_manager"
    source "$feedback_lib"

    # Ensure no consent
    revoke_consent 2>/dev/null || true

    if type should_collect_metrics &>/dev/null; then
        if ! should_collect_metrics 2>/dev/null; then
            test_pass
        else
            test_fail "Should not collect metrics without consent"
        fi
    else
        # Fallback check
        if ! has_consent 2>/dev/null; then
            test_pass
        else
            test_fail "Consent check failed"
        fi
    fi
}

test_metrics_with_consent() {
    test_start "metrics collected with consent"

    local feedback_lib="$PROJECT_ROOT/.claude/scripts/feedback-lib.sh"
    local consent_manager="$PROJECT_ROOT/.claude/scripts/consent-manager.sh"

    if [[ ! -f "$feedback_lib" ]] || [[ ! -f "$consent_manager" ]]; then
        test_skip "Required scripts not found"
        return
    fi

    source "$consent_manager"
    source "$feedback_lib"

    # Grant consent
    record_consent 2>/dev/null || true

    if type should_collect_metrics &>/dev/null; then
        if should_collect_metrics 2>/dev/null; then
            test_pass
        else
            test_fail "Should collect metrics with consent"
        fi
    else
        # Fallback check
        if has_consent 2>/dev/null; then
            test_pass
        else
            test_fail "Consent check failed"
        fi
    fi
}

# =============================================================================
# Run All Tests
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Feedback System Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup
setup

echo "▶ Consent Manager"
echo "────────────────────────────────────────"
test_consent_initial_state
test_consent_opt_in
test_consent_opt_out
test_consent_log_created

echo ""
echo "▶ PII Validation"
echo "────────────────────────────────────────"
test_pii_detection_email
test_pii_detection_ip_address
test_pii_safe_text

echo ""
echo "▶ Satisfaction Detection"
echo "────────────────────────────────────────"
test_satisfaction_positive_detection
test_satisfaction_negative_detection

echo ""
echo "▶ Agent Performance"
echo "────────────────────────────────────────"
test_agent_performance_logging
test_agent_performance_metrics

echo ""
echo "▶ Privacy Compliance"
echo "────────────────────────────────────────"
test_no_metrics_without_consent
test_metrics_with_consent

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  Total:   $TESTS_RUN"
echo "  Passed:  $TESTS_PASSED"
echo "  Failed:  $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "  \033[0;32mALL TESTS PASSED!\033[0m"
    exit 0
else
    echo -e "  \033[0;31mSOME TESTS FAILED\033[0m"
    exit 1
fi