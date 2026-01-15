#!/usr/bin/env bash
# ============================================================================
# SQLite Injection Prevention Tests
# ============================================================================
# Tests for SQL injection prevention in coordination system
# CC 2.1.7 Security Compliance
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

COMMON_LIB="$PROJECT_ROOT/hooks/_lib/common.sh"
MULTI_LOCK_HOOK="$PROJECT_ROOT/hooks/pretool/write-edit/multi-instance-lock.sh"

# ============================================================================
# SQLITE_ESCAPE FUNCTION TESTS
# ============================================================================

describe "Security: SQLite Escape Function"

test_sqlite_escape_exists() {
    source "$COMMON_LIB"

    declare -f sqlite_escape >/dev/null 2>&1
}

test_sqlite_escape_single_quotes() {
    source "$COMMON_LIB"

    local input="test'value"
    local result=$(sqlite_escape "$input")

    # After escaping, single quote becomes two single quotes
    [[ "$result" == "test''value" ]]
}

test_sqlite_escape_multiple_quotes() {
    source "$COMMON_LIB"

    local input="it's a 'test' value"
    local result=$(sqlite_escape "$input")

    # Each single quote should be doubled
    [[ "$result" == "it''s a ''test'' value" ]]
}

test_sqlite_escape_no_quotes() {
    source "$COMMON_LIB"

    local input="normal_value"
    local result=$(sqlite_escape "$input")

    [[ "$result" == "normal_value" ]]
}

test_sqlite_escape_empty_string() {
    source "$COMMON_LIB"

    local input=""
    local result=$(sqlite_escape "$input")

    [[ "$result" == "" ]]
}

# ============================================================================
# INJECTION ATTEMPT TESTS
# ============================================================================

describe "Security: SQL Injection Prevention"

test_injection_in_file_path() {
    source "$COMMON_LIB"

    # Simulated attack: file path with SQL injection
    local malicious_path="test'; DROP TABLE file_locks; --"
    local escaped=$(sqlite_escape "$malicious_path")

    # After escaping, the quote should be doubled, making the SQL safe
    [[ "$escaped" == *"''"* ]]
}

test_injection_in_instance_id() {
    source "$COMMON_LIB"

    # Simulated attack: instance ID with SQL injection
    local malicious_id="inst-123'; DELETE FROM file_locks WHERE '1'='1"
    local escaped=$(sqlite_escape "$malicious_id")

    # All single quotes should be escaped
    # Original has 4 single quotes, escaped should have 8 single quotes total
    local escaped_count=$(echo "$escaped" | grep -o "''" | wc -l | tr -d ' ')

    # Should have 4 occurrences of '' (8 single quotes total = 4 pairs)
    [[ "$escaped_count" -eq 4 ]]
}

test_injection_unicode_bypass() {
    source "$COMMON_LIB"

    # Unicode bypass attempt
    local unicode_injection="test\u0027; DROP TABLE--"
    local escaped=$(sqlite_escape "$unicode_injection")

    # Should handle without crashing
    [[ -n "$escaped" ]]
}

# ============================================================================
# HOOK INTEGRATION TESTS
# ============================================================================

describe "Security: Multi-Instance Lock SQL Safety"

test_multi_instance_lock_uses_escaping() {
    [[ ! -f "$MULTI_LOCK_HOOK" ]] && skip "multi-instance-lock.sh not found"

    # Check that the hook uses sqlite_escape
    grep -q "sqlite_escape" "$MULTI_LOCK_HOOK"
}

test_multi_instance_lock_escapes_file_path() {
    [[ ! -f "$MULTI_LOCK_HOOK" ]] && skip "multi-instance-lock.sh not found"

    # Check that file_path is escaped before SQL
    grep -q 'escaped_path=$(sqlite_escape' "$MULTI_LOCK_HOOK"
}

test_multi_instance_lock_escapes_instance_id() {
    [[ ! -f "$MULTI_LOCK_HOOK" ]] && skip "multi-instance-lock.sh not found"

    # Check that instance_id is escaped
    grep -q 'escaped_instance=$(sqlite_escape' "$MULTI_LOCK_HOOK"
}

# ============================================================================
# RUN TESTS
# ============================================================================

setup_test_env
run_tests
exit $((TESTS_FAILED > 0 ? 1 : 0))