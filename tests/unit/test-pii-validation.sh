#!/usr/bin/env bash
# test-pii-validation.sh - Unit tests for PII detection in analytics-lib.sh
# Part of SkillForge Claude Plugin (#59)
#
# Tests that PII (Personally Identifiable Information) is properly detected
# and blocked from analytics exports.

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

# Create required directories
mkdir -p "$TEST_DIR/.claude/scripts"
mkdir -p "$FEEDBACK_DIR"

# Copy analytics-lib.sh to test location
cp "$PROJECT_ROOT/.claude/scripts/analytics-lib.sh" "$TEST_DIR/.claude/scripts/"

# Also copy feedback-lib.sh if it exists (dependency)
if [[ -f "$PROJECT_ROOT/.claude/scripts/feedback-lib.sh" ]]; then
    cp "$PROJECT_ROOT/.claude/scripts/feedback-lib.sh" "$TEST_DIR/.claude/scripts/"
fi

# Source the analytics library
source "$TEST_DIR/.claude/scripts/analytics-lib.sh"

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

# =============================================================================
# TEST: Clean Data (Should Pass)
# =============================================================================

test_clean_skill_metrics() {
    local data='{"api-design": {"uses": 45, "success_rate": 0.92}}'

    if validate_no_pii "$data" 2>/dev/null; then
        log_test "Clean data: skill metrics" "PASS"
    else
        log_test "Clean data: skill metrics" "FAIL" "Should pass validation"
    fi
}

test_clean_agent_metrics() {
    local data='{"backend-architect": {"spawns": 8, "success_rate": 0.88}}'

    if validate_no_pii "$data" 2>/dev/null; then
        log_test "Clean data: agent metrics" "PASS"
    else
        log_test "Clean data: agent metrics" "FAIL" "Should pass validation"
    fi
}

test_clean_hook_metrics() {
    local data='{"bash-dispatcher": {"triggered": 120, "blocked": 5}}'

    if validate_no_pii "$data" 2>/dev/null; then
        log_test "Clean data: hook metrics" "PASS"
    else
        log_test "Clean data: hook metrics" "FAIL" "Should pass validation"
    fi
}

test_clean_full_report() {
    local data='{
        "timestamp": "2026-01-14",
        "plugin_version": "4.12.0",
        "skill_usage": {"api-design": {"uses": 12, "success_rate": 0.92}},
        "agent_performance": {"backend-architect": {"spawns": 8, "success_rate": 0.88}},
        "hook_metrics": {"bash-dispatcher": {"triggered": 45, "blocked": 3}}
    }'

    if validate_no_pii "$data" 2>/dev/null; then
        log_test "Clean data: full report" "PASS"
    else
        log_test "Clean data: full report" "FAIL" "Should pass validation"
    fi
}

test_empty_data() {
    if validate_no_pii "" 2>/dev/null; then
        log_test "Clean data: empty string" "PASS"
    else
        log_test "Clean data: empty string" "FAIL" "Empty data should pass"
    fi
}

# =============================================================================
# TEST: File Paths (Should Fail)
# =============================================================================

test_detect_users_path() {
    local data='{"path": "/Users/john/projects/myapp"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: /Users/ path" "PASS"
    else
        log_test "Detect PII: /Users/ path" "FAIL" "Should detect /Users/ path"
    fi
}

test_detect_home_path() {
    local data='{"path": "/home/developer/code"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: /home/ path" "PASS"
    else
        log_test "Detect PII: /home/ path" "FAIL" "Should detect /home/ path"
    fi
}

test_detect_windows_path() {
    local data='{"path": "C:\\Users\\john\\Documents"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: Windows C:\\ path" "PASS"
    else
        log_test "Detect PII: Windows C:\\ path" "FAIL" "Should detect Windows path"
    fi
}

test_detect_tmp_path() {
    local data='{"file": "/tmp/sensitive_data.txt"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: /tmp/ path" "PASS"
    else
        log_test "Detect PII: /tmp/ path" "FAIL" "Should detect /tmp/ path"
    fi
}

# =============================================================================
# TEST: Email Addresses (Should Fail)
# =============================================================================

test_detect_email() {
    local data='{"contact": "user@example.com"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: email address" "PASS"
    else
        log_test "Detect PII: email address" "FAIL" "Should detect email"
    fi
}

test_detect_email_in_text() {
    local data='Send to john.doe@company.org for review'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: email in text" "PASS"
    else
        log_test "Detect PII: email in text" "FAIL" "Should detect email in text"
    fi
}

# =============================================================================
# TEST: URLs (Should Fail)
# =============================================================================

test_detect_http_url() {
    local data='{"endpoint": "http://internal-server.local/api"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: HTTP URL" "PASS"
    else
        log_test "Detect PII: HTTP URL" "FAIL" "Should detect HTTP URL"
    fi
}

test_detect_https_url() {
    local data='{"webhook": "https://api.company.com/hook"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: HTTPS URL" "PASS"
    else
        log_test "Detect PII: HTTPS URL" "FAIL" "Should detect HTTPS URL"
    fi
}

# =============================================================================
# TEST: Secrets & Credentials (Should Fail)
# =============================================================================

test_detect_password() {
    local data='{"password": "secret123"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: password field" "PASS"
    else
        log_test "Detect PII: password field" "FAIL" "Should detect password"
    fi
}

test_detect_api_key() {
    local data='{"api_key": "sk-abc123xyz"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: api_key field" "PASS"
    else
        log_test "Detect PII: api_key field" "FAIL" "Should detect api_key"
    fi
}

test_detect_token() {
    local data='{"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: token field" "PASS"
    else
        log_test "Detect PII: token field" "FAIL" "Should detect token"
    fi
}

test_detect_secret() {
    local data='{"client_secret": "super_secret_value"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: secret field" "PASS"
    else
        log_test "Detect PII: secret field" "FAIL" "Should detect secret"
    fi
}

test_detect_credential() {
    local data='{"credential": "db_password_123"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: credential field" "PASS"
    else
        log_test "Detect PII: credential field" "FAIL" "Should detect credential"
    fi
}

# =============================================================================
# TEST: User Identifiers (Should Fail)
# =============================================================================

test_detect_username() {
    local data='{"username": "johndoe"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: username field" "PASS"
    else
        log_test "Detect PII: username field" "FAIL" "Should detect username"
    fi
}

test_detect_user_id() {
    local data='{"user_id": "12345"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: user_id field" "PASS"
    else
        log_test "Detect PII: user_id field" "FAIL" "Should detect user_id"
    fi
}

test_detect_email_field() {
    local data='{"email": "user@test.com"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: email field name" "PASS"
    else
        log_test "Detect PII: email field name" "FAIL" "Should detect email field"
    fi
}

# =============================================================================
# TEST: IP Addresses (Should Fail)
# =============================================================================

test_detect_ipv4() {
    local data='{"client_ip": "192.168.1.100"}'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: IPv4 address" "PASS"
    else
        log_test "Detect PII: IPv4 address" "FAIL" "Should detect IPv4"
    fi
}

test_detect_ip_in_text() {
    local data='Connection from 10.0.0.1 established'

    if ! validate_no_pii "$data" 2>/dev/null; then
        log_test "Detect PII: IP in text" "PASS"
    else
        log_test "Detect PII: IP in text" "FAIL" "Should detect IP in text"
    fi
}

# =============================================================================
# TEST: Sanitize String
# =============================================================================

test_sanitize_removes_path() {
    local input="File at /Users/john/project/file.txt was modified"
    local output
    output=$(sanitize_string "$input")

    if [[ "$output" != *"/Users/"* ]]; then
        log_test "Sanitize: removes file path" "PASS"
    else
        log_test "Sanitize: removes file path" "FAIL" "Path still present: $output"
    fi
}

test_sanitize_removes_email() {
    local input="Contact john@example.com for help"
    local output
    output=$(sanitize_string "$input")

    if [[ "$output" != *"@"* ]]; then
        log_test "Sanitize: removes email" "PASS"
    else
        log_test "Sanitize: removes email" "FAIL" "Email still present: $output"
    fi
}

test_sanitize_removes_url() {
    local input="Visit https://internal.company.com/api"
    local output
    output=$(sanitize_string "$input")

    if [[ "$output" != *"https://"* ]]; then
        log_test "Sanitize: removes URL" "PASS"
    else
        log_test "Sanitize: removes URL" "FAIL" "URL still present: $output"
    fi
}

# =============================================================================
# RUN ALL TESTS
# =============================================================================

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "            PII VALIDATION TESTS (#59)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "Clean Data (Should Pass)"
echo "────────────────────────────────"
test_clean_skill_metrics
test_clean_agent_metrics
test_clean_hook_metrics
test_clean_full_report
test_empty_data
echo ""

echo "File Paths (Should Fail)"
echo "────────────────────────────────"
test_detect_users_path
test_detect_home_path
test_detect_windows_path
test_detect_tmp_path
echo ""

echo "Email Addresses (Should Fail)"
echo "────────────────────────────────"
test_detect_email
test_detect_email_in_text
echo ""

echo "URLs (Should Fail)"
echo "────────────────────────────────"
test_detect_http_url
test_detect_https_url
echo ""

echo "Secrets & Credentials (Should Fail)"
echo "────────────────────────────────"
test_detect_password
test_detect_api_key
test_detect_token
test_detect_secret
test_detect_credential
echo ""

echo "User Identifiers (Should Fail)"
echo "────────────────────────────────"
test_detect_username
test_detect_user_id
test_detect_email_field
echo ""

echo "IP Addresses (Should Fail)"
echo "────────────────────────────────"
test_detect_ipv4
test_detect_ip_in_text
echo ""

echo "Sanitize Function"
echo "────────────────────────────────"
test_sanitize_removes_path
test_sanitize_removes_email
test_sanitize_removes_url
echo ""

# =============================================================================
# SUMMARY
# =============================================================================

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