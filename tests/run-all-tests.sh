#!/bin/bash
# Main Test Runner
# Executes all tests for the SkillForge Claude Plugin
#
# Usage: ./run-all-tests.sh [OPTIONS]
#
# Options:
#   --verbose       Show detailed output
#   --quick         Skip integration tests (faster)
#   --unit          Run only unit tests
#   --security      Run only security tests
#   --integration   Run only integration tests
#   --e2e           Run only E2E tests
#   --performance   Run only performance tests
#   --lint          Run only lint/static analysis
#   --all           Run all tests (default)
#   --coverage      Generate coverage report
#
# Exit codes: 0 = all pass, 1 = failures found
#
# Version: 3.0.0 - Comprehensive Test Suite with CI Integration

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse arguments
VERBOSE=""
QUICK=""
RUN_LINT="true"
RUN_UNIT="true"
RUN_SECURITY="true"
RUN_INTEGRATION="true"
RUN_E2E="true"
RUN_PERFORMANCE="true"
RUN_SKILLS="true"
COVERAGE=""
SPECIFIC_CATEGORY=""

for arg in "$@"; do
    case $arg in
        --verbose) VERBOSE="--verbose" ;;
        --quick) QUICK="true"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false" ;;
        --lint) SPECIFIC_CATEGORY="lint"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false" ;;
        --unit) SPECIFIC_CATEGORY="unit"; RUN_LINT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false" ;;
        --security) SPECIFIC_CATEGORY="security"; RUN_LINT="false"; RUN_UNIT="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false" ;;
        --integration) SPECIFIC_CATEGORY="integration"; RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_E2E="false"; RUN_PERFORMANCE="false" ;;
        --e2e) SPECIFIC_CATEGORY="e2e"; RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_PERFORMANCE="false" ;;
        --performance) SPECIFIC_CATEGORY="performance"; RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_SKILLS="false" ;;
        --skills) SPECIFIC_CATEGORY="skills"; RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false" ;;
        --all) RUN_LINT="true"; RUN_UNIT="true"; RUN_SECURITY="true"; RUN_INTEGRATION="true"; RUN_E2E="true"; RUN_PERFORMANCE="true"; RUN_SKILLS="true" ;;
        --coverage) COVERAGE="true" ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --verbose       Show detailed output"
            echo "  --quick         Skip integration, E2E, and performance tests"
            echo "  --lint          Run only lint/static analysis"
            echo "  --unit          Run only unit tests"
            echo "  --security      Run only security tests (CRITICAL)"
            echo "  --integration   Run only integration tests"
            echo "  --e2e           Run only E2E tests"
            echo "  --performance   Run only performance tests"
            echo "  --skills        Run only skill/subagent tests"
            echo "  --all           Run all tests (default)"
            echo "  --coverage      Generate coverage report"
            echo "  --help          Show this help"
            exit 0
            ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Results tracking (using files for bash 3.x compatibility)
RESULTS_FILE=$(mktemp)
TOTAL_PASSED=0
TOTAL_FAILED=0

trap "rm -f $RESULTS_FILE" EXIT

# Make all test scripts executable
find "$SCRIPT_DIR" -name "*.sh" -exec chmod +x {} \;
find "$PROJECT_ROOT/hooks" -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

# Export for hooks
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║        SkillForge Claude Plugin - Test Suite v3.0                ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

run_test() {
    local name="$1"
    local script="$2"
    local optional="${3:-false}"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}Running: $name${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [[ ! -f "$script" ]]; then
        echo -e "${YELLOW}SKIP: Test script not found${NC}"
        echo "$name:SKIP" >> "$RESULTS_FILE"
        return 0
    fi

    local exit_code=0
    if [[ -n "$VERBOSE" ]]; then
        bash "$script" $VERBOSE || exit_code=$?
    else
        bash "$script" 2>&1 || exit_code=$?
    fi

    echo ""

    if [[ $exit_code -eq 0 ]]; then
        echo "$name:PASS" >> "$RESULTS_FILE"
        TOTAL_PASSED=$((TOTAL_PASSED + 1))
        return 0
    else
        if [[ "$optional" == "true" ]]; then
            echo "$name:WARN" >> "$RESULTS_FILE"
            echo -e "${YELLOW}Optional test failed (non-blocking)${NC}"
            return 0
        else
            echo "$name:FAIL" >> "$RESULTS_FILE"
            TOTAL_FAILED=$((TOTAL_FAILED + 1))
            return 1
        fi
    fi
}

# ============================================================
# LINT / STATIC ANALYSIS
# ============================================================

if [[ "$RUN_LINT" == "true" ]]; then
    echo -e "${BOLD}${CYAN}LINT / STATIC ANALYSIS${NC}"
    echo ""

    run_test "Static Analysis Suite" "$SCRIPT_DIR/ci/lint.sh" || true
fi

# ============================================================
# UNIT TESTS
# ============================================================

if [[ "$RUN_UNIT" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}UNIT TESTS${NC}"
    echo ""

    run_test "Shell Syntax Validation" "$SCRIPT_DIR/unit/test-shell-syntax.sh" || true
    run_test "JSON Validity Check" "$SCRIPT_DIR/unit/test-json-validity.sh" || true
    run_test "Hook Executability" "$SCRIPT_DIR/unit/test-hook-executability.sh" || true
    run_test "Context Schema Validation" "$SCRIPT_DIR/unit/test-context-schemas.sh" || true
    run_test "Hook Unit Tests" "$SCRIPT_DIR/unit/test-hooks-unit.sh" || true
fi

# ============================================================
# SECURITY TESTS (CRITICAL - ZERO TOLERANCE)
# ============================================================

if [[ "$RUN_SECURITY" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${RED}SECURITY TESTS (CRITICAL - ZERO TOLERANCE)${NC}"
    echo ""

    run_test "Command Injection Tests" "$SCRIPT_DIR/security/test-command-injection.sh" || true
    run_test "JQ Injection Tests" "$SCRIPT_DIR/security/test-jq-injection.sh" || true
    run_test "Path Traversal Tests" "$SCRIPT_DIR/security/test-path-traversal.sh" || true
    run_test "Unicode Attack Tests" "$SCRIPT_DIR/security/test-unicode-attacks.sh" || true
    run_test "Symlink Attack Tests" "$SCRIPT_DIR/security/test-symlink-attacks.sh" || true
    run_test "Input Validation Tests" "$SCRIPT_DIR/security/test-input-validation.sh" || true
    run_test "Additional Security Tests" "$SCRIPT_DIR/security/test-additional-security.sh" || true
fi

# ============================================================
# INTEGRATION TESTS
# ============================================================

if [[ "$RUN_INTEGRATION" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}INTEGRATION TESTS${NC}"
    echo ""

    run_test "Hook Chain Integration" "$SCRIPT_DIR/integration/test-hook-chains.sh" || true
    run_test "Context System Integration" "$SCRIPT_DIR/integration/test-context-system.sh" || true
    run_test "Plugin Installation Validation" "$SCRIPT_DIR/integration/test-plugin-installation.sh" || true

    # Mem0 Integration Tests (v4.12.0)
    run_test "Mem0 Library Tests" "$SCRIPT_DIR/mem0/test-mem0-library.sh" || true
    run_test "Mem0 Integration Tests" "$SCRIPT_DIR/mem0/test-mem0-integration.sh" || true

    # External Installation Tests (v4.12.0)
    run_test "External Installation Tests" "$SCRIPT_DIR/external/test-installation.sh" || true

    # Feedback System Tests (v4.12.0)
    run_test "Feedback System Tests" "$SCRIPT_DIR/feedback/test-feedback-system.sh" || true
fi

# ============================================================
# E2E TESTS
# ============================================================

if [[ "$RUN_E2E" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}E2E TESTS${NC}"
    echo ""

    run_test "Agent Lifecycle E2E" "$SCRIPT_DIR/e2e/test-agent-lifecycle.sh" || true
    run_test "Coordination System E2E" "$SCRIPT_DIR/e2e/test-coordination-e2e.sh" || true

    # Agent Lifecycle E2E Tests (v4.12.0)
    run_test "Agent Lifecycle E2E (New)" "$SCRIPT_DIR/agents/test-agent-lifecycle-e2e.sh" || true
fi

# ============================================================
# PERFORMANCE TESTS

# ============================================================
# SKILL / SUBAGENT TESTS
# ============================================================

if [[ "$RUN_SKILLS" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}SKILL / SUBAGENT TESTS${NC}"
    echo ""

    # Run skill tests via the skill test runner (uses quick mode in main runner)
    if [[ -f "$SCRIPT_DIR/skills/run-skill-tests.sh" ]]; then
        run_test "SKILL.md Validation" "$SCRIPT_DIR/skills/structure/test-skill-md.sh" || true
        run_test "Semantic Matching" "$SCRIPT_DIR/skills/semantic-matching/test-skill-discovery.sh" || true
        run_test "Skill-Agent Integration" "$SCRIPT_DIR/skills/integration/test-skill-agent-integration.sh" || true
        run_test "Agent Definitions" "$SCRIPT_DIR/subagents/definition/test-agent-definitions.sh" || true
    fi

    # Commands directory validation (for autocomplete)
    run_test "Commands Structure" "$SCRIPT_DIR/commands/test-commands-structure.sh" || true
fi
# ============================================================

if [[ "$RUN_PERFORMANCE" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}PERFORMANCE TESTS${NC}"
    echo ""

    run_test "Token Budget Validation" "$SCRIPT_DIR/performance/test-token-budget.sh" || true
    run_test "Hook Timing Tests" "$SCRIPT_DIR/performance/test-hook-timing.sh" "true" || true
fi

# ============================================================
# SUMMARY
# ============================================================

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                        TEST SUMMARY                              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

printf "%-40s %s\n" "Test" "Result"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while IFS=: read -r test_name result; do
    case $result in
        PASS) color="${GREEN}" ;;
        FAIL) color="${RED}" ;;
        WARN) color="${YELLOW}" ;;
        SKIP) color="${YELLOW}" ;;
        *) color="${NC}" ;;
    esac
    printf "%-40s ${color}%s${NC}\n" "$test_name" "$result"
done < "$RESULTS_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Total: ${GREEN}$TOTAL_PASSED passed${NC}, ${RED}$TOTAL_FAILED failed${NC}"
echo ""

if [[ $TOTAL_FAILED -gt 0 ]]; then
    echo -e "${RED}${BOLD}TESTS FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}${BOLD}ALL TESTS PASSED${NC}"
    exit 0
fi