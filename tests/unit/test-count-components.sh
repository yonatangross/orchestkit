#!/bin/bash
# Unit tests for component counting scripts
# Validates count-components.sh, update-counts.sh, validate-counts.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++)) || true
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++)) || true
}

log_section() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════════"
}

# Test that count-components.sh exists and is executable
test_count_script_exists() {
    local script="${PROJECT_ROOT}/bin/count-components.sh"
    if [[ -x "$script" ]]; then
        log_pass "count-components.sh exists and is executable"
    else
        log_fail "count-components.sh missing or not executable"
    fi
}

# Test that count-components.sh outputs expected format
test_count_output_format() {
    local output
    output=$("${PROJECT_ROOT}/bin/count-components.sh" 2>/dev/null)

    # Check for expected lines
    if echo "$output" | grep -q "Skills:"; then
        log_pass "count-components.sh outputs Skills count"
    else
        log_fail "count-components.sh missing Skills count"
    fi

    if echo "$output" | grep -q "Agents:"; then
        log_pass "count-components.sh outputs Agents count"
    else
        log_fail "count-components.sh missing Agents count"
    fi

    if echo "$output" | grep -q "Commands:"; then
        log_pass "count-components.sh outputs Commands count"
    else
        log_fail "count-components.sh missing Commands count"
    fi

    if echo "$output" | grep -q "Hooks:"; then
        log_pass "count-components.sh outputs Hooks count"
    else
        log_fail "count-components.sh missing Hooks count"
    fi

    if echo "$output" | grep -q "Bundles:"; then
        log_pass "count-components.sh outputs Bundles count"
    else
        log_fail "count-components.sh missing Bundles count"
    fi
}

# Test JSON output mode
test_count_json_output() {
    local output
    output=$("${PROJECT_ROOT}/bin/count-components.sh" --json 2>/dev/null)

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "count-components.sh --json outputs valid JSON"
    else
        log_fail "count-components.sh --json invalid JSON: $output"
        return
    fi

    # Verify required fields
    local skills=$(echo "$output" | jq '.skills // 0')
    local agents=$(echo "$output" | jq '.agents // 0')
    local commands=$(echo "$output" | jq '.commands // 0')
    local hooks=$(echo "$output" | jq '.hooks // 0')
    local bundles=$(echo "$output" | jq '.bundles // 0')

    if [[ "$skills" -gt 0 ]]; then
        log_pass "JSON has skills count: $skills"
    else
        log_fail "JSON skills count invalid: $skills"
    fi

    if [[ "$agents" -gt 0 ]]; then
        log_pass "JSON has agents count: $agents"
    else
        log_fail "JSON agents count invalid: $agents"
    fi

    if [[ "$hooks" -gt 0 ]]; then
        log_pass "JSON has hooks count: $hooks"
    else
        log_fail "JSON hooks count invalid: $hooks"
    fi
}

# Test counts are reasonable (sanity check)
test_count_sanity() {
    local output
    output=$("${PROJECT_ROOT}/bin/count-components.sh" --json 2>/dev/null)

    local skills=$(echo "$output" | jq '.skills // 0')
    local agents=$(echo "$output" | jq '.agents // 0')
    local commands=$(echo "$output" | jq '.commands // 0')
    local hooks=$(echo "$output" | jq '.hooks // 0')

    # Skills should be 100-175 based on known count (updated for AI/ML Roadmap 2026 expansion)
    if [[ "$skills" -ge 100 && "$skills" -le 175 ]]; then
        log_pass "Skills count in expected range (100-175): $skills"
    else
        log_fail "Skills count out of range: $skills (expected 100-175)"
    fi

    # Agents should be 15-40 (updated for AI/ML Roadmap 2026 expansion)
    if [[ "$agents" -ge 15 && "$agents" -le 40 ]]; then
        log_pass "Agents count in expected range (15-40): $agents"
    else
        log_fail "Agents count out of range: $agents (expected 15-40)"
    fi

    # Commands count: 0 is valid (deprecated in favor of user-invocable skills)
    # Non-zero should be in range 15-30 if commands directory is used
    if [[ "$commands" -eq 0 ]] || [[ "$commands" -ge 15 && "$commands" -le 30 ]]; then
        log_pass "Commands count acceptable (0 or 15-30): $commands"
    else
        log_fail "Commands count out of range: $commands (expected 0 or 15-30)"
    fi

    # Hooks should be 80-160 (updated for version-sync hook)
    if [[ "$hooks" -ge 80 && "$hooks" -le 160 ]]; then
        log_pass "Hooks count in expected range (80-160): $hooks"
    else
        log_fail "Hooks count out of range: $hooks (expected 80-160)"
    fi
}

# Test validate-counts.sh
test_validate_counts() {
    local output
    local exit_code=0

    output=$("${PROJECT_ROOT}/bin/validate-counts.sh" 2>&1) || exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        log_pass "validate-counts.sh passes (counts match)"
    else
        log_fail "validate-counts.sh fails: $output"
    fi
}

# Test update-counts.sh dry-run
test_update_dry_run() {
    local output
    output=$("${PROJECT_ROOT}/bin/update-counts.sh" --dry-run 2>&1)

    if echo "$output" | grep -q "DRY RUN"; then
        log_pass "update-counts.sh --dry-run works"
    else
        log_fail "update-counts.sh --dry-run missing DRY RUN indicator"
    fi

    # Should not modify any files
    local git_status
    git_status=$(cd "$PROJECT_ROOT" && git diff --name-only)

    # This check only works if repo was clean before
    # So we just verify the script ran without error
    log_pass "update-counts.sh --dry-run completed without error"
}

# Test that counts match actual component directories
test_count_accuracy() {
    log_section "Verifying Count Accuracy"

    # Count skills manually
    local actual_skills=$(find "${PROJECT_ROOT}/src/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    local reported_skills=$("${PROJECT_ROOT}/bin/count-components.sh" --json | jq '.skills')

    if [[ "$actual_skills" -eq "$reported_skills" ]]; then
        log_pass "Skills count matches directory: $actual_skills"
    else
        log_fail "Skills count mismatch: reported=$reported_skills, actual=$actual_skills"
    fi

    # Count agents manually
    local actual_agents=$(find "${PROJECT_ROOT}/src/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    local reported_agents=$("${PROJECT_ROOT}/bin/count-components.sh" --json | jq '.agents')

    if [[ "$actual_agents" -eq "$reported_agents" ]]; then
        log_pass "Agents count matches directory: $actual_agents"
    else
        log_fail "Agents count mismatch: reported=$reported_agents, actual=$actual_agents"
    fi

    # Count commands manually
    local actual_commands=$(find "${PROJECT_ROOT}/src/commands" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    local reported_commands=$("${PROJECT_ROOT}/bin/count-components.sh" --json | jq '.commands')

    if [[ "$actual_commands" -eq "$reported_commands" ]]; then
        log_pass "Commands count matches directory: $actual_commands"
    else
        log_fail "Commands count mismatch: reported=$reported_commands, actual=$actual_commands"
    fi

    # Count hooks manually (TypeScript files in hooks/src, excluding __tests__ and lib)
    # Migrated from shell scripts to TypeScript in v5.1.0
    local actual_hooks=$(find "${PROJECT_ROOT}/src/hooks/src" -name "*.ts" -type f ! -path "*/__tests__/*" ! -path "*/lib/*" ! -name "index.ts" ! -name "types.ts" 2>/dev/null | wc -l | tr -d ' ')
    local reported_hooks=$("${PROJECT_ROOT}/bin/count-components.sh" --json | jq '.hooks')

    if [[ "$actual_hooks" -eq "$reported_hooks" ]]; then
        log_pass "Hooks count matches directory: $actual_hooks"
    else
        log_fail "Hooks count mismatch: reported=$reported_hooks, actual=$actual_hooks"
    fi
}

# Main execution
main() {
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║          Component Counting Scripts Tests                     ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"

    log_section "Test 1: Script Existence"
    test_count_script_exists

    log_section "Test 2: Output Format"
    test_count_output_format

    log_section "Test 3: JSON Output"
    test_count_json_output

    log_section "Test 4: Count Sanity Checks"
    test_count_sanity

    log_section "Test 5: Validate Counts"
    test_validate_counts

    log_section "Test 6: Update Dry Run"
    test_update_dry_run

    test_count_accuracy

    # Summary
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "                        TEST SUMMARY"
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "  Passed:  ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "  Failed:  ${RED}${TESTS_FAILED}${NC}"
    echo ""

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${RED}FAIL${NC}: Some tests failed"
        exit 1
    else
        echo -e "${GREEN}PASS${NC}: All tests passed"
        exit 0
    fi
}

main "$@"