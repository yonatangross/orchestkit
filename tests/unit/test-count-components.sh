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
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_section() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════════"
}

# Cache script outputs to avoid redundant invocations (6x count-components + 2x validate = ~9s wasted)
CACHED_TEXT_OUTPUT=""
CACHED_JSON_OUTPUT=""
CACHED_VALIDATE_EXIT=255
CACHED_VALIDATE_OUTPUT=""

cache_outputs() {
    CACHED_TEXT_OUTPUT=$("${PROJECT_ROOT}/bin/count-components.sh" 2>/dev/null)
    CACHED_JSON_OUTPUT=$("${PROJECT_ROOT}/bin/count-components.sh" --json 2>/dev/null)
    CACHED_VALIDATE_OUTPUT=$("${PROJECT_ROOT}/bin/validate-counts.sh" 2>&1) && CACHED_VALIDATE_EXIT=0 || CACHED_VALIDATE_EXIT=$?
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
    local output="$CACHED_TEXT_OUTPUT"

    # Check for expected lines
    if [[ "$output" == *"Skills:"* ]]; then
        log_pass "count-components.sh outputs Skills count"
    else
        log_fail "count-components.sh missing Skills count"
    fi

    if [[ "$output" == *"Agents:"* ]]; then
        log_pass "count-components.sh outputs Agents count"
    else
        log_fail "count-components.sh missing Agents count"
    fi

    if [[ "$output" == *"Commands:"* ]]; then
        log_pass "count-components.sh outputs Commands count"
    else
        log_fail "count-components.sh missing Commands count"
    fi

    if [[ "$output" == *"Hooks:"* ]]; then
        log_pass "count-components.sh outputs Hooks count"
    else
        log_fail "count-components.sh missing Hooks count"
    fi

    if [[ "$output" == *"Bundles:"* ]]; then
        log_pass "count-components.sh outputs Bundles count"
    else
        log_fail "count-components.sh missing Bundles count"
    fi
}

# Test JSON output mode
test_count_json_output() {
    local output="$CACHED_JSON_OUTPUT"

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "count-components.sh --json outputs valid JSON"
    else
        log_fail "count-components.sh --json invalid JSON: $output"
        return
    fi

    # Verify required fields (single jq call instead of 5)
    local skills agents hooks
    read -r skills agents hooks < <(echo "$output" | jq -r '[.skills // 0, .agents // 0, .hooks // 0] | @tsv' | tr -d '\r')

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

# Test counts match declared values in plugin.json (dynamic validation)
test_count_sanity() {
    # Use cached validate-counts.sh result
    if [[ $CACHED_VALIDATE_EXIT -eq 0 ]]; then
        log_pass "Component counts match plugin.json declarations"
    else
        log_fail "Component counts mismatch - run bin/validate-counts.sh for details"
        return
    fi

    # Additional sanity: ensure counts are non-zero (reuse cached JSON)
    local skills agents hooks
    read -r skills agents hooks < <(echo "$CACHED_JSON_OUTPUT" | jq -r '[.skills // 0, .agents // 0, .hooks // 0] | @tsv' | tr -d '\r')

    # Basic sanity: components exist
    if [[ "$skills" -gt 0 ]]; then
        log_pass "Skills directory has content: $skills skills"
    else
        log_fail "No skills found in src/skills/"
    fi

    if [[ "$agents" -gt 0 ]]; then
        log_pass "Agents directory has content: $agents agents"
    else
        log_fail "No agents found in src/agents/"
    fi

    if [[ "$hooks" -gt 0 ]]; then
        log_pass "Hooks directory has content: $hooks hooks"
    else
        log_fail "No hooks found in src/hooks/"
    fi
}

# Test validate-counts.sh
test_validate_counts() {
    # Reuse cached result
    if [[ $CACHED_VALIDATE_EXIT -eq 0 ]]; then
        log_pass "validate-counts.sh passes (counts match)"
    else
        log_fail "validate-counts.sh fails: $CACHED_VALIDATE_OUTPUT"
    fi
}

# Test update-counts.sh dry-run
test_update_dry_run() {
    local output
    output=$("${PROJECT_ROOT}/bin/update-counts.sh" --dry-run 2>&1)

    if [[ "$output" == *"DRY RUN"* ]]; then
        log_pass "update-counts.sh --dry-run works"
    else
        log_fail "update-counts.sh --dry-run missing DRY RUN indicator"
    fi

    log_pass "update-counts.sh --dry-run completed without error"
}

# Test that counts match actual component directories
test_count_accuracy() {
    log_section "Verifying Count Accuracy"

    # Extract all reported counts from cached JSON in a single jq call
    local reported_skills reported_agents reported_commands reported_hooks
    read -r reported_skills reported_agents reported_commands reported_hooks < <(
        echo "$CACHED_JSON_OUTPUT" | jq -r '[.skills, .agents, .commands, .hooks] | @tsv' | tr -d '\r'
    )

    # Count skills manually
    local actual_skills=$(find "${PROJECT_ROOT}/src/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$actual_skills" -eq "$reported_skills" ]]; then
        log_pass "Skills count matches directory: $actual_skills"
    else
        log_fail "Skills count mismatch: reported=$reported_skills, actual=$actual_skills"
    fi

    # Count agents manually
    local actual_agents=$(find "${PROJECT_ROOT}/src/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$actual_agents" -eq "$reported_agents" ]]; then
        log_pass "Agents count matches directory: $actual_agents"
    else
        log_fail "Agents count mismatch: reported=$reported_agents, actual=$actual_agents"
    fi

    # Count commands manually
    local actual_commands=$(find "${PROJECT_ROOT}/src/commands" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$actual_commands" -eq "$reported_commands" ]]; then
        log_pass "Commands count matches directory: $actual_commands"
    else
        log_fail "Commands count mismatch: reported=$reported_commands, actual=$actual_commands"
    fi

    # Count hooks manually (TypeScript files in hooks/src, excluding __tests__ and lib)
    local actual_hooks=$(find "${PROJECT_ROOT}/src/hooks/src" -name "*.ts" -type f ! -path "*/__tests__/*" ! -path "*/lib/*" ! -name "index.ts" ! -name "types.ts" 2>/dev/null | wc -l | tr -d ' ')
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

    # Cache script outputs upfront (3 calls instead of 9)
    cache_outputs

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