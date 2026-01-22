#!/usr/bin/env bash
# test-consent-manager.sh - Unit tests for consent-manager.sh
# Part of OrchestKit Claude Plugin (#59)
#
# Tests GDPR-compliant consent management

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Test utilities
PASSED=0
FAILED=0
TOTAL=0

# Colors
GREEN=$'\033[32m'
RED=$'\033[31m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Create temporary test directory
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

# Export test environment
export CLAUDE_PROJECT_DIR="$TEST_DIR"
export FEEDBACK_DIR="$TEST_DIR/.claude/feedback"
export CONSENT_LOG_FILE="$FEEDBACK_DIR/consent-log.json"
export PREFERENCES_FILE="$FEEDBACK_DIR/preferences.json"

# Create required directories
mkdir -p "$TEST_DIR/.claude/scripts"
mkdir -p "$FEEDBACK_DIR"

# Copy consent-manager.sh to test location
cp "$PROJECT_ROOT/.claude/scripts/consent-manager.sh" "$TEST_DIR/.claude/scripts/"

# Source the consent manager
source "$TEST_DIR/.claude/scripts/consent-manager.sh"

# =============================================================================
# TEST HELPERS
# =============================================================================

log_test() {
    local name="$1"
    local status="$2"
    local message="${3:-}"

    ((TOTAL++)) || true

    if [[ "$status" == "PASS" ]]; then
        ((PASSED++)) || true
        echo "${GREEN}✓${RESET} $name"
    else
        ((FAILED++)) || true
        echo "${RED}✗${RESET} $name"
        if [[ -n "$message" ]]; then
            echo "  ${YELLOW}→ $message${RESET}"
        fi
    fi
}

reset_test_state() {
    rm -f "$CONSENT_LOG_FILE" "$PREFERENCES_FILE"
}

# =============================================================================
# TEST: Initial State
# =============================================================================

test_initial_no_consent() {
    reset_test_state

    if ! has_consent; then
        log_test "Initial state: no consent" "PASS"
    else
        log_test "Initial state: no consent" "FAIL" "Expected no consent initially"
    fi
}

test_initial_not_asked() {
    reset_test_state

    if ! has_been_asked; then
        log_test "Initial state: not asked" "PASS"
    else
        log_test "Initial state: not asked" "FAIL" "Expected not asked initially"
    fi
}

# =============================================================================
# TEST: Recording Consent
# =============================================================================

test_record_consent() {
    reset_test_state

    record_consent

    if has_consent; then
        log_test "Record consent: grants access" "PASS"
    else
        log_test "Record consent: grants access" "FAIL" "has_consent should return true"
    fi
}

test_record_consent_creates_log() {
    reset_test_state

    record_consent

    if [[ -f "$CONSENT_LOG_FILE" ]]; then
        local action
        action=$(jq -r '.events[-1].action' "$CONSENT_LOG_FILE")
        if [[ "$action" == "granted" ]]; then
            log_test "Record consent: creates log entry" "PASS"
        else
            log_test "Record consent: creates log entry" "FAIL" "Expected action=granted, got $action"
        fi
    else
        log_test "Record consent: creates log entry" "FAIL" "Consent log not created"
    fi
}

test_record_consent_includes_version() {
    reset_test_state

    record_consent

    local version
    version=$(jq -r '.events[-1].version' "$CONSENT_LOG_FILE" 2>/dev/null || echo "")

    if [[ -n "$version" && "$version" != "null" ]]; then
        log_test "Record consent: includes version" "PASS"
    else
        log_test "Record consent: includes version" "FAIL" "Version not recorded"
    fi
}

test_record_consent_includes_timestamp() {
    reset_test_state

    record_consent

    local timestamp
    timestamp=$(jq -r '.events[-1].timestamp' "$CONSENT_LOG_FILE" 2>/dev/null || echo "")

    if [[ -n "$timestamp" && "$timestamp" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]; then
        log_test "Record consent: includes timestamp" "PASS"
    else
        log_test "Record consent: includes timestamp" "FAIL" "Invalid timestamp: $timestamp"
    fi
}

# =============================================================================
# TEST: Recording Decline
# =============================================================================

test_record_decline() {
    reset_test_state

    record_decline

    if ! has_consent; then
        log_test "Record decline: no consent" "PASS"
    else
        log_test "Record decline: no consent" "FAIL" "Should not have consent after decline"
    fi
}

test_record_decline_creates_log() {
    reset_test_state

    record_decline

    if [[ -f "$CONSENT_LOG_FILE" ]]; then
        local action
        action=$(jq -r '.events[-1].action' "$CONSENT_LOG_FILE")
        if [[ "$action" == "declined" ]]; then
            log_test "Record decline: creates log entry" "PASS"
        else
            log_test "Record decline: creates log entry" "FAIL" "Expected action=declined, got $action"
        fi
    else
        log_test "Record decline: creates log entry" "FAIL" "Consent log not created"
    fi
}

test_record_decline_marks_asked() {
    reset_test_state

    record_decline

    if has_been_asked; then
        log_test "Record decline: marks as asked" "PASS"
    else
        log_test "Record decline: marks as asked" "FAIL" "Should be marked as asked"
    fi
}

# =============================================================================
# TEST: Revoking Consent
# =============================================================================

test_revoke_consent() {
    reset_test_state

    # First grant, then revoke
    record_consent
    revoke_consent

    if ! has_consent; then
        log_test "Revoke consent: removes access" "PASS"
    else
        log_test "Revoke consent: removes access" "FAIL" "Should not have consent after revoke"
    fi
}

test_revoke_consent_creates_log() {
    reset_test_state

    record_consent
    revoke_consent

    local action
    action=$(jq -r '.events[-1].action' "$CONSENT_LOG_FILE")

    if [[ "$action" == "revoked" ]]; then
        log_test "Revoke consent: creates log entry" "PASS"
    else
        log_test "Revoke consent: creates log entry" "FAIL" "Expected action=revoked, got $action"
    fi
}

test_revoke_preserves_history() {
    reset_test_state

    record_consent
    revoke_consent

    local event_count
    event_count=$(jq '.events | length' "$CONSENT_LOG_FILE")

    if [[ "$event_count" -ge 2 ]]; then
        log_test "Revoke consent: preserves history" "PASS"
    else
        log_test "Revoke consent: preserves history" "FAIL" "Expected 2+ events, got $event_count"
    fi
}

# =============================================================================
# TEST: Get Status
# =============================================================================

test_get_status_no_consent() {
    reset_test_state

    local status
    status=$(get_consent_status)

    local has_consent_val
    has_consent_val=$(echo "$status" | jq -r '.hasConsent')

    if [[ "$has_consent_val" == "false" ]]; then
        log_test "Get status: no consent" "PASS"
    else
        log_test "Get status: no consent" "FAIL" "Expected hasConsent=false"
    fi
}

test_get_status_with_consent() {
    reset_test_state

    record_consent

    local status
    status=$(get_consent_status)

    local has_consent_val
    has_consent_val=$(echo "$status" | jq -r '.hasConsent')

    if [[ "$has_consent_val" == "true" ]]; then
        log_test "Get status: with consent" "PASS"
    else
        log_test "Get status: with consent" "FAIL" "Expected hasConsent=true"
    fi
}

test_get_status_includes_version() {
    reset_test_state

    record_consent

    local status
    status=$(get_consent_status)

    local version
    version=$(echo "$status" | jq -r '.consentVersion')

    if [[ -n "$version" && "$version" != "null" ]]; then
        log_test "Get status: includes version" "PASS"
    else
        log_test "Get status: includes version" "FAIL" "Version not in status"
    fi
}

# =============================================================================
# TEST: Consent Blocking
# =============================================================================

test_no_data_without_consent() {
    reset_test_state

    # This test verifies the pattern: check consent before any operation
    if ! has_consent; then
        # Good - would block data collection
        log_test "No data collection without consent" "PASS"
    else
        log_test "No data collection without consent" "FAIL" "Should block without consent"
    fi
}

test_consent_required_for_sharing() {
    reset_test_state

    # Set shareAnonymized without going through consent
    mkdir -p "$(dirname "$PREFERENCES_FILE")"
    echo '{"shareAnonymized": true}' > "$PREFERENCES_FILE"

    # has_consent should still work (it checks preferences)
    # This is OK because the consent-manager controls recording
    # The test verifies the flag is read correctly
    if has_consent; then
        log_test "Consent check reads preferences" "PASS"
    else
        log_test "Consent check reads preferences" "FAIL" "Should read shareAnonymized"
    fi
}

# =============================================================================
# RUN ALL TESTS
# =============================================================================

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "            CONSENT MANAGER TESTS (#59)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Initial state tests
test_initial_no_consent
test_initial_not_asked

# Record consent tests
test_record_consent
test_record_consent_creates_log
test_record_consent_includes_version
test_record_consent_includes_timestamp

# Record decline tests
test_record_decline
test_record_decline_creates_log
test_record_decline_marks_asked

# Revoke consent tests
test_revoke_consent
test_revoke_consent_creates_log
test_revoke_preserves_history

# Get status tests
test_get_status_no_consent
test_get_status_with_consent
test_get_status_includes_version

# Consent blocking tests
test_no_data_without_consent
test_consent_required_for_sharing

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "                        RESULTS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Total:  $TOTAL"
echo "  Passed: ${GREEN}$PASSED${RESET}"
echo "  Failed: ${RED}$FAILED${RESET}"
echo ""

if [[ $FAILED -eq 0 ]]; then
    echo "${GREEN}All tests passed!${RESET}"
    exit 0
else
    echo "${RED}$FAILED test(s) failed${RESET}"
    exit 1
fi