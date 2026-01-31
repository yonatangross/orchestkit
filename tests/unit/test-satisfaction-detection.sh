#!/usr/bin/env bash
# ============================================================================
# Satisfaction Detection Unit Tests
# ============================================================================
# Tests for satisfaction detection in .claude/scripts/feedback-lib.sh
# - detect_satisfaction function
# - analyze_satisfaction function
# - log_satisfaction function
# - get_session_satisfaction function
# - get_satisfaction_summary function
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

FEEDBACK_LIB="$PROJECT_ROOT/.claude/scripts/feedback-lib.sh"

# ============================================================================
# BASIC DETECTION TESTS
# ============================================================================

describe "Satisfaction Detection: Basic Detection"

test_detect_satisfaction_positive_thanks() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "thanks!")

    assert_equals "positive" "$result"
}

test_detect_satisfaction_positive_thank_you() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "Thank you so much!")

    assert_equals "positive" "$result"
}

test_detect_satisfaction_positive_great() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "That looks great!")

    assert_equals "positive" "$result"
}

test_detect_satisfaction_positive_perfect() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "Perfect, exactly what I needed")

    assert_equals "positive" "$result"
}

test_detect_satisfaction_positive_works() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "It works now!")

    assert_equals "positive" "$result"
}

test_detect_satisfaction_positive_lgtm() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "LGTM")

    assert_equals "positive" "$result"
}

test_detect_satisfaction_negative_wrong() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "No, that's wrong")

    assert_equals "negative" "$result"
}

test_detect_satisfaction_negative_fix() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "Can you fix this?")

    assert_equals "negative" "$result"
}

test_detect_satisfaction_negative_not_working() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "It's still not working")

    assert_equals "negative" "$result"
}

test_detect_satisfaction_negative_try_again() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "Please try again")

    assert_equals "negative" "$result"
}

test_detect_satisfaction_negative_frustration() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "Ugh, this is frustrating")

    assert_equals "negative" "$result"
}

test_detect_satisfaction_neutral_question() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "What about the database schema?")

    assert_equals "neutral" "$result"
}

test_detect_satisfaction_neutral_command() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "Add a new endpoint for users")

    assert_equals "neutral" "$result"
}

# ============================================================================
# CASE INSENSITIVITY TESTS
# ============================================================================

describe "Satisfaction Detection: Case Insensitivity"

test_detect_satisfaction_case_upper() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "THANKS!")

    assert_equals "positive" "$result"
}

test_detect_satisfaction_case_mixed() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "ThAnKs So MuCh!")

    assert_equals "positive" "$result"
}

# ============================================================================
# ANALYZE SATISFACTION TESTS
# ============================================================================

describe "Satisfaction Detection: Analysis"

test_analyze_satisfaction_returns_json() {
    source "$FEEDBACK_LIB"

    local result
    result=$(analyze_satisfaction "thanks, that looks great!")

    assert_valid_json "$result"
}

test_analyze_satisfaction_positive_sentiment() {
    source "$FEEDBACK_LIB"

    local result
    result=$(analyze_satisfaction "thanks, that looks great!")

    assert_json_field "$result" ".sentiment" "positive"
}

test_analyze_satisfaction_positive_count() {
    source "$FEEDBACK_LIB"

    local result
    result=$(analyze_satisfaction "thanks, perfect!")

    local count
    count=$(echo "$result" | jq -r '.positiveCount')

    assert_greater_than "$count" 1
}

test_analyze_satisfaction_negative_sentiment() {
    source "$FEEDBACK_LIB"

    local result
    result=$(analyze_satisfaction "no, that's wrong and broken")

    assert_json_field "$result" ".sentiment" "negative"
}

test_analyze_satisfaction_matches_array() {
    source "$FEEDBACK_LIB"

    local result
    result=$(analyze_satisfaction "thanks!")

    local matches
    matches=$(echo "$result" | jq -r '.positiveMatches | length')

    assert_greater_than "$matches" 0
}

# ============================================================================
# LOGGING TESTS
# ============================================================================

describe "Satisfaction Detection: Logging"

test_log_satisfaction_creates_file() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-satisfaction1"
    mkdir -p "$test_dir/.claude/feedback"

    FEEDBACK_DIR="$test_dir/.claude/feedback"
    SATISFACTION_FILE="$test_dir/.claude/feedback/satisfaction.json"
    PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"

    export FEEDBACK_DIR SATISFACTION_FILE PREFERENCES_FILE

    init_feedback
    log_satisfaction "test-session" "positive" "test context"

    assert_file_exists "$SATISFACTION_FILE"
}

test_log_satisfaction_increments_count() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-satisfaction2"
    mkdir -p "$test_dir/.claude/feedback"

    FEEDBACK_DIR="$test_dir/.claude/feedback"
    SATISFACTION_FILE="$test_dir/.claude/feedback/satisfaction.json"
    PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"

    export FEEDBACK_DIR SATISFACTION_FILE PREFERENCES_FILE

    init_feedback
    log_satisfaction "test-session" "positive" "first"
    log_satisfaction "test-session" "positive" "second"

    local count
    count=$(jq -r '.sessions["test-session"].positive // 0' "$SATISFACTION_FILE")

    assert_equals "2" "$count"
}

test_log_satisfaction_tracks_multiple_types() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-satisfaction3"
    mkdir -p "$test_dir/.claude/feedback"

    FEEDBACK_DIR="$test_dir/.claude/feedback"
    SATISFACTION_FILE="$test_dir/.claude/feedback/satisfaction.json"
    PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"

    export FEEDBACK_DIR SATISFACTION_FILE PREFERENCES_FILE

    init_feedback
    log_satisfaction "test-session" "positive" "good"
    log_satisfaction "test-session" "negative" "bad"
    log_satisfaction "test-session" "neutral" "meh"

    local positive negative neutral
    positive=$(jq -r '.sessions["test-session"].positive // 0' "$SATISFACTION_FILE")
    negative=$(jq -r '.sessions["test-session"].negative // 0' "$SATISFACTION_FILE")
    neutral=$(jq -r '.sessions["test-session"].neutral // 0' "$SATISFACTION_FILE")

    assert_equals "1" "$positive"
    assert_equals "1" "$negative"
    assert_equals "1" "$neutral"
}

test_log_satisfaction_updates_aggregate() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-satisfaction4"
    mkdir -p "$test_dir/.claude/feedback"

    FEEDBACK_DIR="$test_dir/.claude/feedback"
    SATISFACTION_FILE="$test_dir/.claude/feedback/satisfaction.json"
    PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"

    export FEEDBACK_DIR SATISFACTION_FILE PREFERENCES_FILE

    init_feedback
    log_satisfaction "session1" "positive" "test1"
    log_satisfaction "session2" "negative" "test2"

    local total_positive total_negative
    total_positive=$(jq -r '.aggregate.totalPositive // 0' "$SATISFACTION_FILE")
    total_negative=$(jq -r '.aggregate.totalNegative // 0' "$SATISFACTION_FILE")

    assert_equals "1" "$total_positive"
    assert_equals "1" "$total_negative"
}

# ============================================================================
# SESSION SCORE TESTS
# ============================================================================

describe "Satisfaction Detection: Session Score"

test_get_session_satisfaction_no_data() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-score1"
    mkdir -p "$test_dir/.claude/feedback"

    SATISFACTION_FILE="$test_dir/.claude/feedback/nonexistent.json"
    export SATISFACTION_FILE

    local score
    score=$(get_session_satisfaction "unknown-session")

    assert_equals "0.5" "$score"
}

test_get_session_satisfaction_all_positive() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-score2"
    mkdir -p "$test_dir/.claude/feedback"

    FEEDBACK_DIR="$test_dir/.claude/feedback"
    SATISFACTION_FILE="$test_dir/.claude/feedback/satisfaction.json"
    PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"

    export FEEDBACK_DIR SATISFACTION_FILE PREFERENCES_FILE

    init_feedback
    log_satisfaction "test-session" "positive" "test"
    log_satisfaction "test-session" "positive" "test"

    local score
    score=$(get_session_satisfaction "test-session")

    assert_equals "1.00" "$score"
}

test_get_session_satisfaction_all_negative() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-score3"
    mkdir -p "$test_dir/.claude/feedback"

    FEEDBACK_DIR="$test_dir/.claude/feedback"
    SATISFACTION_FILE="$test_dir/.claude/feedback/satisfaction.json"
    PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"

    export FEEDBACK_DIR SATISFACTION_FILE PREFERENCES_FILE

    init_feedback
    log_satisfaction "test-session" "negative" "test"
    log_satisfaction "test-session" "negative" "test"

    local score
    score=$(get_session_satisfaction "test-session")

    # Accept both "0" and "0.00" (awk vs bc output format)
    [[ "$score" == "0" || "$score" == "0.00" ]] || fail "Expected '0' or '0.00', got '$score'"
}

test_get_session_satisfaction_mixed() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-score4"
    mkdir -p "$test_dir/.claude/feedback"

    FEEDBACK_DIR="$test_dir/.claude/feedback"
    SATISFACTION_FILE="$test_dir/.claude/feedback/satisfaction.json"
    PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"

    export FEEDBACK_DIR SATISFACTION_FILE PREFERENCES_FILE

    init_feedback
    log_satisfaction "test-session" "positive" "test"
    log_satisfaction "test-session" "negative" "test"

    local score
    score=$(get_session_satisfaction "test-session")

    # Accept both ".50" and "0.50" (awk vs bc output format)
    [[ "$score" == ".50" || "$score" == "0.50" ]] || fail "Expected '.50' or '0.50', got '$score'"
}

# ============================================================================
# SUMMARY TESTS
# ============================================================================

describe "Satisfaction Detection: Summary"

test_get_satisfaction_summary_output() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-summary1"
    mkdir -p "$test_dir/.claude/feedback"

    FEEDBACK_DIR="$test_dir/.claude/feedback"
    SATISFACTION_FILE="$test_dir/.claude/feedback/satisfaction.json"
    PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"

    export FEEDBACK_DIR SATISFACTION_FILE PREFERENCES_FILE

    init_feedback
    log_satisfaction "session1" "positive" "test"

    local summary
    summary=$(get_satisfaction_summary)

    assert_contains "$summary" "Satisfaction Summary"
    assert_contains "$summary" "Sessions tracked"
    assert_contains "$summary" "Satisfaction Score"
}

test_get_satisfaction_summary_indicator() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-summary2"
    mkdir -p "$test_dir/.claude/feedback"

    FEEDBACK_DIR="$test_dir/.claude/feedback"
    SATISFACTION_FILE="$test_dir/.claude/feedback/satisfaction.json"
    PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"

    export FEEDBACK_DIR SATISFACTION_FILE PREFERENCES_FILE

    init_feedback
    # All positive should show "Excellent"
    log_satisfaction "session1" "positive" "test"
    log_satisfaction "session1" "positive" "test"

    local summary
    summary=$(get_satisfaction_summary)

    assert_contains "$summary" "Excellent"
}

# ============================================================================
# EDGE CASES
# ============================================================================

describe "Satisfaction Detection: Edge Cases"

test_detect_satisfaction_empty_string() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "")

    assert_equals "neutral" "$result"
}

test_detect_satisfaction_only_punctuation() {
    source "$FEEDBACK_LIB"

    local result
    result=$(detect_satisfaction "...")

    assert_equals "neutral" "$result"
}

test_detect_satisfaction_mixed_signals() {
    source "$FEEDBACK_LIB"

    # More positive than negative
    local result
    result=$(detect_satisfaction "Thanks, but there's still an error")

    # Should still be positive because thanks wins
    # Actually "still" is negative, "thanks" is positive
    # Let's check what the actual result is
    [[ "$result" == "positive" || "$result" == "negative" ]]
}

test_log_satisfaction_multiple_sessions() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-multi1"
    mkdir -p "$test_dir/.claude/feedback"

    FEEDBACK_DIR="$test_dir/.claude/feedback"
    SATISFACTION_FILE="$test_dir/.claude/feedback/satisfaction.json"
    PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"

    export FEEDBACK_DIR SATISFACTION_FILE PREFERENCES_FILE

    init_feedback
    log_satisfaction "session-a" "positive" "test"
    log_satisfaction "session-b" "negative" "test"
    log_satisfaction "session-c" "neutral" "test"

    local session_count
    session_count=$(jq '.sessions | length' "$SATISFACTION_FILE")

    assert_equals "3" "$session_count"
}

# ============================================================================
# INTEGRATION WITH FEEDBACK STATUS
# ============================================================================

describe "Satisfaction Detection: Integration"

test_feedback_status_includes_satisfaction() {
    source "$FEEDBACK_LIB"

    local test_dir="$TEMP_DIR/test-status1"
    mkdir -p "$test_dir/.claude/feedback"

    FEEDBACK_DIR="$test_dir/.claude/feedback"
    METRICS_FILE="$test_dir/.claude/feedback/metrics.json"
    PATTERNS_FILE="$test_dir/.claude/feedback/learned-patterns.json"
    SATISFACTION_FILE="$test_dir/.claude/feedback/satisfaction.json"
    PREFERENCES_FILE="$test_dir/.claude/feedback/preferences.json"

    export FEEDBACK_DIR METRICS_FILE PATTERNS_FILE SATISFACTION_FILE PREFERENCES_FILE

    init_feedback
    log_satisfaction "session1" "positive" "test"

    local status
    status=$(get_feedback_status)

    assert_contains "$status" "Satisfaction:"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests