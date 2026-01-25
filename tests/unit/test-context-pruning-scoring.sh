#!/usr/bin/env bash
# ============================================================================
# Context Pruning Advisor - Scoring Algorithm Unit Tests
# ============================================================================
# Tests the scoring functions used by context-pruning-advisor hook:
# - Recency scoring (0-10 points)
# - Frequency scoring (0-10 points)
# - Relevance scoring (0-10 points)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOK_PATH="$PROJECT_ROOT/src/hooks/prompt/context-pruning-advisor.sh"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Source the hook functions without executing main
source_hook_functions() {
    # Extract function definitions from hook (skip main execution)
    sed -n '/^calculate_recency_score/,/^}/p' "$HOOK_PATH" > /tmp/test-recency-func.sh
    sed -n '/^calculate_frequency_score/,/^}/p' "$HOOK_PATH" > /tmp/test-frequency-func.sh
    sed -n '/^calculate_relevance_score/,/^}/p' "$HOOK_PATH" > /tmp/test-relevance-func.sh

    source /tmp/test-recency-func.sh
    source /tmp/test-frequency-func.sh
    source /tmp/test-relevance-func.sh
}

# ============================================================================
# RECENCY SCORING TESTS
# ============================================================================

describe "Recency Scoring"

test_recency_last_5_minutes() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # 2 minutes ago
    local timestamp
    timestamp=$(date -v-2M +%s)
    local score
    score=$(calculate_recency_score "$timestamp")

    assert_equals 10 "$score" "Last 5 minutes should score 10"
}

test_recency_last_15_minutes() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # 10 minutes ago
    local timestamp
    timestamp=$(date -v-10M +%s)
    local score
    score=$(calculate_recency_score "$timestamp")

    assert_equals 8 "$score" "Last 15 minutes should score 8"
}

test_recency_last_30_minutes() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # 25 minutes ago
    local timestamp
    timestamp=$(date -v-25M +%s)
    local score
    score=$(calculate_recency_score "$timestamp")

    assert_equals 6 "$score" "Last 30 minutes should score 6"
}

test_recency_last_hour() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # 45 minutes ago
    local timestamp
    timestamp=$(date -v-45M +%s)
    local score
    score=$(calculate_recency_score "$timestamp")

    assert_equals 4 "$score" "Last hour should score 4"
}

test_recency_last_2_hours() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # 90 minutes ago
    local timestamp
    timestamp=$(date -v-90M +%s)
    local score
    score=$(calculate_recency_score "$timestamp")

    assert_equals 2 "$score" "Last 2 hours should score 2"
}

test_recency_older_than_2_hours() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # 3 hours ago
    local timestamp
    timestamp=$(date -v-3H +%s)
    local score
    score=$(calculate_recency_score "$timestamp")

    assert_equals 0 "$score" "Older than 2 hours should score 0"
}

# ============================================================================
# FREQUENCY SCORING TESTS
# ============================================================================

describe "Frequency Scoring"

test_frequency_10_plus_accesses() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    local score
    score=$(calculate_frequency_score 12)

    assert_equals 10 "$score" "10+ accesses should score 10"
}

test_frequency_7_to_9_accesses() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    local score
    score=$(calculate_frequency_score 8)

    assert_equals 8 "$score" "7-9 accesses should score 8"
}

test_frequency_4_to_6_accesses() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    local score
    score=$(calculate_frequency_score 5)

    assert_equals 6 "$score" "4-6 accesses should score 6"
}

test_frequency_2_to_3_accesses() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    local score
    score=$(calculate_frequency_score 3)

    assert_equals 4 "$score" "2-3 accesses should score 4"
}

test_frequency_1_access() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    local score
    score=$(calculate_frequency_score 1)

    assert_equals 2 "$score" "1 access should score 2"
}

test_frequency_0_accesses() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    local score
    score=$(calculate_frequency_score 0)

    assert_equals 0 "$score" "0 accesses should score 0"
}

# ============================================================================
# RELEVANCE SCORING TESTS
# ============================================================================

describe "Relevance Scoring"

test_relevance_direct_match() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # 100% overlap (4/4)
    local item_keywords="api,rest,fastapi,backend"
    local prompt_keywords="api,rest,fastapi,backend"
    local score
    score=$(calculate_relevance_score "$item_keywords" "$prompt_keywords")

    assert_equals 10 "$score" "Direct keyword match (100% overlap) should score 10"
}

test_relevance_related_patterns() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # 50% overlap (2/4)
    local item_keywords="api,rest,graphql,endpoint"
    local prompt_keywords="api,rest,authentication,jwt"
    local score
    score=$(calculate_relevance_score "$item_keywords" "$prompt_keywords")

    # Should be 8 (50%+ overlap)
    [[ $score -ge 6 && $score -le 8 ]] || {
        echo "FAIL: Expected score 6-8 for 50% overlap, got $score"
        return 1
    }
}

test_relevance_same_technology() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # 33% overlap (1/3)
    local item_keywords="react,typescript,component"
    local prompt_keywords="react,hooks,state"
    local score
    score=$(calculate_relevance_score "$item_keywords" "$prompt_keywords")

    # Should be 6 (30%+ overlap)
    [[ $score -ge 4 && $score -le 6 ]] || {
        echo "FAIL: Expected score 4-6 for 33% overlap, got $score"
        return 1
    }
}

test_relevance_unrelated() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # 0% overlap
    local item_keywords="frontend,react,ui,design"
    local prompt_keywords="database,sql,postgresql,query"
    local score
    score=$(calculate_relevance_score "$item_keywords" "$prompt_keywords")

    assert_equals 0 "$score" "Unrelated keywords (0% overlap) should score 0"
}

test_relevance_empty_keywords() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    local score
    score=$(calculate_relevance_score "" "api,rest")

    assert_equals 2 "$score" "Empty keywords should default to 2 (generic)"
}

# ============================================================================
# INTEGRATION TESTS
# ============================================================================

describe "Scoring Integration"

test_total_score_high_priority_keep() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # Scenario: Recently used, frequently accessed, relevant
    local timestamp
    timestamp=$(date -v-2M +%s)  # 2 minutes ago
    local recency
    local frequency
    local relevance
    recency=$(calculate_recency_score "$timestamp")
    frequency=$(calculate_frequency_score 8)
    relevance=$(calculate_relevance_score "api,rest,fastapi" "api,rest,endpoint")

    local total=$((recency + frequency + relevance))

    # Total should be > 23 (KEEP threshold)
    [[ $total -ge 23 ]] || {
        echo "FAIL: High priority item should score >= 23, got $total"
        return 1
    }
}

test_total_score_high_priority_prune() {
    if [[ ! -f "$HOOK_PATH" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    source_hook_functions

    # Scenario: Old, rarely used, unrelated
    local timestamp
    timestamp=$(date -v-4H +%s)  # 4 hours ago
    local recency
    local frequency
    local relevance
    recency=$(calculate_recency_score "$timestamp")
    frequency=$(calculate_frequency_score 1)
    relevance=$(calculate_relevance_score "frontend,react" "database,sql")

    local total=$((recency + frequency + relevance))

    # Total should be <= 8 (PRUNE threshold)
    [[ $total -le 8 ]] || {
        echo "FAIL: High priority prune item should score <= 8, got $total"
        return 1
    }
}

# ============================================================================
# CLEANUP
# ============================================================================

cleanup() {
    rm -f /tmp/test-recency-func.sh
    rm -f /tmp/test-frequency-func.sh
    rm -f /tmp/test-relevance-func.sh
}

trap cleanup EXIT

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
