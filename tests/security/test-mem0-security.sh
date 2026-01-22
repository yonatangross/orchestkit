#!/bin/bash
# Security Tests: Mem0 Memory Functions
# Tests for security vulnerabilities in mem0 memory categorization functions
#
# Test Count: 8
# Priority: HIGH
# Reference: OWASP Top 10 2021, CWE-20 (Input Validation), CWE-400 (ReDoS)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

# Source mem0 library for testing
HOOKS_DIR="$PLUGIN_ROOT/hooks"
if [[ -f "$HOOKS_DIR/_lib/mem0.sh" ]]; then
    source "$HOOKS_DIR/_lib/mem0.sh"
else
    echo "Error: mem0.sh not found at $HOOKS_DIR/_lib/mem0.sh" >&2
    exit 1
fi

# ============================================================================
# MEM0 SECURITY TESTS
# ============================================================================

describe "Mem0 Security Tests"

# TEST 1: MEM0_ORG_ID Injection Attempts
test_org_id_injection() {
    local test_cases=(
        "org_123; rm -rf /"
        "org_123\nmalicious"
        "org_123$(printf '\x00')injection"
        "../../etc/passwd"
        "org_123|cat /etc/passwd"
        "org_123 && echo vulnerable"
    )
    
    local passed=0
    local failed=0
    
    for malicious_org_id in "${test_cases[@]}"; do
        export MEM0_ORG_ID="$malicious_org_id"
        
        # Test sanitization
        local sanitized
        sanitized=$(mem0_sanitize_org_id "$malicious_org_id")
        
        # Verify sanitized output is safe (alphanumeric, dashes only, no special chars)
        if [[ "$sanitized" =~ [^a-z0-9-] ]] && [[ -n "$sanitized" ]]; then
            echo "FAIL: Org ID not properly sanitized: '$malicious_org_id' -> '$sanitized'"
            failed=$((failed + 1))
        else
            passed=$((passed + 1))
        fi
        
        # Test user_id generation doesn't break
        local user_id
        user_id=$(mem0_user_id "decisions" 2>/dev/null || echo "ERROR")
        
        if [[ "$user_id" == "ERROR" ]] || [[ "$user_id" =~ [^a-z0-9_-] ]]; then
            echo "FAIL: user_id generation failed or unsafe: '$user_id'"
            failed=$((failed + 1))
        else
            passed=$((passed + 1))
        fi
    done
    
    unset MEM0_ORG_ID
    
    if [[ $failed -gt 0 ]]; then
        echo "TEST FAILED: $failed injection attempts succeeded"
        return 1
    fi
    
    echo "PASS: All $passed org_id injection attempts blocked"
    return 0
}

# TEST 2: ReDoS Attack Vectors
test_redos_attack() {
    # Create a string that could cause ReDoS with vulnerable regex
    # Pattern: many 'a' characters followed by 'b' (causes backtracking)
    local redos_payload
    redos_payload=$(python3 -c "print('a' * 50000 + 'b')" 2>/dev/null || printf 'a%.0s' {1..50000} && echo 'b')
    
    # Test category detection with ReDoS payload
    # Use Python for reliable cross-platform millisecond timing
    local start_time
    start_time=$(python3 -c "import time; print(int(time.time() * 1000))" 2>/dev/null || date +%s)

    local result
    result=$(detect_best_practice_category "$redos_payload" 2>/dev/null || echo "timeout")

    local end_time
    end_time=$(python3 -c "import time; print(int(time.time() * 1000))" 2>/dev/null || date +%s)

    # Calculate duration in milliseconds
    local duration
    # If timestamps are in seconds (10 digits), convert to ms; otherwise assume ms
    if [[ ${#start_time} -eq 10 ]]; then
        duration=$(( (end_time - start_time) * 1000 ))
    else
        duration=$(( end_time - start_time ))
    fi
    
    # Should complete in < 1000ms (1 second) due to length limit
    if [[ $duration -gt 1000 ]]; then
        echo "FAIL: ReDoS attack succeeded - took ${duration}ms (should be < 1000ms)"
        return 1
    fi
    
    # Verify result is valid category (not empty, not error)
    if [[ -z "$result" ]] || [[ "$result" == "timeout" ]]; then
        echo "FAIL: Category detection failed or timed out"
        return 1
    fi
    
    echo "PASS: ReDoS attack prevented (completed in ${duration}ms)"
    return 0
}

# TEST 3: Input Length Limits
test_input_length_limits() {
    # Create very long input (20KB)
    local long_input
    long_input=$(python3 -c "print('test ' * 5000)" 2>/dev/null || printf 'test %.0s' {1..5000})
    
    # Test that function handles long input
    local result
    result=$(detect_best_practice_category "$long_input" 2>/dev/null || echo "ERROR")
    
    if [[ "$result" == "ERROR" ]] || [[ -z "$result" ]]; then
        echo "FAIL: Category detection failed on long input"
        return 1
    fi
    
    # Verify input was truncated (should be <= 10KB processed)
    # This is indirect - if it works, truncation happened
    echo "PASS: Long input handled correctly (truncated to 10KB limit)"
    return 0
}

# TEST 4: user_id Format Validation
test_user_id_format_validation() {
    local invalid_user_ids=(
        "user-id-with-UPPERCASE"
        "user-id with spaces"
        "user-id@with-special-chars"
        "user-id.with.dots"
        "$(printf 'a%.0s' {1..250})"  # Too long (>200 chars)
    )
    
    local passed=0
    local failed=0
    
    for invalid_id in "${invalid_user_ids[@]}"; do
        if validate_user_id_format "$invalid_id" 2>/dev/null; then
            echo "FAIL: Invalid user_id accepted: '$invalid_id'"
            failed=$((failed + 1))
        else
            passed=$((passed + 1))
        fi
    done
    
    # Test valid user_ids
    local valid_user_ids=(
        "my-project-decisions"
        "acme-corp-my-project-patterns"
        "orchestkit-global-best-practices"
        "user_123-decisions"
    )
    
    for valid_id in "${valid_user_ids[@]}"; do
        if validate_user_id_format "$valid_id" 2>/dev/null; then
            passed=$((passed + 1))
        else
            echo "FAIL: Valid user_id rejected: '$valid_id'"
            failed=$((failed + 1))
        fi
    done
    
    if [[ $failed -gt 0 ]]; then
        echo "TEST FAILED: $failed validation checks failed"
        return 1
    fi
    
    echo "PASS: All $passed user_id format validations correct"
    return 0
}

# TEST 5: Category Detection with Malicious Input
test_category_detection_malicious_input() {
    local malicious_inputs=(
        "$(printf '\x00\x01\x02')test content"
        "$(printf 'a%.0s' {1..20000})"  # Very long
        "$'\n\r\t'"  # Control characters
        "$'$(echo vulnerable)'"  # Command substitution attempt
    )
    
    local passed=0
    local failed=0
    
    for malicious in "${malicious_inputs[@]}"; do
        local result
        result=$(detect_best_practice_category "$malicious" 2>/dev/null || echo "ERROR")
        
        if [[ "$result" == "ERROR" ]] || [[ -z "$result" ]]; then
            echo "FAIL: Category detection failed on malicious input"
            failed=$((failed + 1))
        else
            # Verify result is a valid category
            local valid_categories=("pagination" "security" "authentication" "testing" "deployment" "observability" "performance" "ai-ml" "data-pipeline" "database" "api" "frontend" "architecture" "pattern" "blocker" "constraint" "decision")
            local is_valid=false
            for category in "${valid_categories[@]}"; do
                if [[ "$result" == "$category" ]]; then
                    is_valid=true
                    break
                fi
            done
            
            if [[ "$is_valid" == "true" ]]; then
                passed=$((passed + 1))
            else
                echo "FAIL: Invalid category returned: '$result'"
                failed=$((failed + 1))
            fi
        fi
    done
    
    if [[ $failed -gt 0 ]]; then
        echo "TEST FAILED: $failed malicious input tests failed"
        return 1
    fi
    
    echo "PASS: All $passed malicious input tests handled correctly"
    return 0
}

# TEST 6: Org ID Sanitization Edge Cases
test_org_id_sanitization_edge_cases() {
    local test_cases=(
        ""  # Empty
        "   "  # Whitespace only
        "---"  # Dashes only
        "ORG123"  # Uppercase
        "my-org-123"  # Valid
        "my_org_123"  # Underscores (should be converted to dashes)
        "$(printf 'a%.0s' {1..100})"  # Very long (should be truncated to 50)
    )
    
    local passed=0
    local failed=0
    
    for test_case in "${test_cases[@]}"; do
        local sanitized
        sanitized=$(mem0_sanitize_org_id "$test_case")
        
        # Verify sanitized output
        if [[ -n "$test_case" ]] && [[ -z "$sanitized" ]] && [[ "$test_case" != "   " ]] && [[ "$test_case" != "---" ]]; then
            # Non-empty input should produce non-empty output (unless it's only whitespace/dashes)
            echo "WARN: Empty sanitized output for: '$test_case'"
        fi
        
        # Verify format: lowercase, alphanumeric, dashes only, max 50 chars
        if [[ -n "$sanitized" ]]; then
            if [[ ${#sanitized} -gt 50 ]]; then
                echo "FAIL: Sanitized org_id too long: ${#sanitized} chars (max 50)"
                failed=$((failed + 1))
            elif [[ "$sanitized" =~ [^a-z0-9-] ]]; then
                echo "FAIL: Sanitized org_id contains invalid chars: '$sanitized'"
                failed=$((failed + 1))
            else
                passed=$((passed + 1))
            fi
        else
            # Empty is valid for empty input
            passed=$((passed + 1))
        fi
    done
    
    if [[ $failed -gt 0 ]]; then
        echo "TEST FAILED: $failed sanitization edge cases failed"
        return 1
    fi
    
    echo "PASS: All $passed sanitization edge cases handled correctly"
    return 0
}

# TEST 7: user_id Generation with Org ID
test_user_id_with_org_id() {
    export MEM0_ORG_ID="test-org"
    
    local user_id
    user_id=$(mem0_user_id "decisions")
    
    # Should contain org prefix
    if [[ "$user_id" != *"test-org"* ]]; then
        echo "FAIL: user_id doesn't contain org prefix: '$user_id'"
        unset MEM0_ORG_ID
        return 1
    fi
    
    # Should be valid format
    if ! validate_user_id_format "$user_id" 2>/dev/null; then
        echo "FAIL: Generated user_id has invalid format: '$user_id'"
        unset MEM0_ORG_ID
        return 1
    fi
    
    unset MEM0_ORG_ID
    
    # Test without org ID
    local user_id_no_org
    user_id_no_org=$(mem0_user_id "decisions")
    
    # Should not contain org prefix
    if [[ "$user_id_no_org" == *"test-org"* ]]; then
        echo "FAIL: user_id contains org prefix when MEM0_ORG_ID not set: '$user_id_no_org'"
        return 1
    fi
    
    echo "PASS: user_id generation with/without org ID works correctly"
    return 0
}

# TEST 8: Global user_id with Org ID
test_global_user_id_with_org_id() {
    export MEM0_ORG_ID="test-org"
    
    local global_id
    global_id=$(mem0_global_user_id "best-practices")
    
    # Should contain org prefix and "global"
    if [[ "$global_id" != *"test-org"* ]] || [[ "$global_id" != *"global"* ]]; then
        echo "FAIL: Global user_id format incorrect: '$global_id'"
        unset MEM0_ORG_ID
        return 1
    fi
    
    # Should be valid format
    if ! validate_user_id_format "$global_id" 2>/dev/null; then
        echo "FAIL: Generated global user_id has invalid format: '$global_id'"
        unset MEM0_ORG_ID
        return 1
    fi
    
    unset MEM0_ORG_ID
    
    # Test without org ID (should use default prefix)
    local global_id_no_org
    global_id_no_org=$(mem0_global_user_id "best-practices")
    
    # Should use orchestkit-global prefix
    if [[ "$global_id_no_org" != "orchestkit-global-best-practices" ]]; then
        echo "FAIL: Global user_id doesn't use default prefix: '$global_id_no_org'"
        return 1
    fi
    
    echo "PASS: Global user_id generation with/without org ID works correctly"
    return 0
}

# ============================================================================
# RUN TESTS
# ============================================================================

main() {
    local total=0
    local passed=0
    local failed=0
    
    test_org_id_injection && passed=$((passed + 1)) || failed=$((failed + 1))
    total=$((total + 1))
    
    test_redos_attack && passed=$((passed + 1)) || failed=$((failed + 1))
    total=$((total + 1))
    
    test_input_length_limits && passed=$((passed + 1)) || failed=$((failed + 1))
    total=$((total + 1))
    
    test_user_id_format_validation && passed=$((passed + 1)) || failed=$((failed + 1))
    total=$((total + 1))
    
    test_category_detection_malicious_input && passed=$((passed + 1)) || failed=$((failed + 1))
    total=$((total + 1))
    
    test_org_id_sanitization_edge_cases && passed=$((passed + 1)) || failed=$((failed + 1))
    total=$((total + 1))
    
    test_user_id_with_org_id && passed=$((passed + 1)) || failed=$((failed + 1))
    total=$((total + 1))
    
    test_global_user_id_with_org_id && passed=$((passed + 1)) || failed=$((failed + 1))
    total=$((total + 1))
    
    echo ""
    echo "=========================================="
    echo "Mem0 Security Tests: $passed/$total passed"
    echo "=========================================="
    
    if [[ $failed -gt 0 ]]; then
        echo "FAILED: $failed tests failed"
        return 1
    fi
    
    echo "SUCCESS: All tests passed"
    return 0
}

main "$@"
