#!/bin/bash
# Skill and Subagent Test Runner
# Master test runner for all skill and subagent tests
#
# Usage: ./run-skill-tests.sh [OPTIONS]
#
# Options:
#   --verbose         Show detailed output
#   --quick           Skip slow tests (integration)
#   --category NAME   Run only specific category (structure, progressive-loading,
#                     semantic-matching, integration, definition, spawn, quality-gates, tools)
#   --list            List all available tests without running
#   --help            Show this help message
#
# Exit codes: 0 = all pass, 1 = failures found
#
# Test Categories:
#   SKILLS:
#     - structure           Validate skill directory structure
#     - progressive-loading Test tiered loading protocol
#     - semantic-matching   Test capability-based discovery
#     - integration         Full skill workflow tests
#
#   SUBAGENTS:
#     - definition          Validate agent definitions
#     - spawn               Test agent spawn mechanisms
#     - quality-gates       Test completion quality gates
#     - tools               Test tool access restrictions
#
# Version: 1.0.0 - Initial skill/subagent test runner

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TESTS_DIR="$SCRIPT_DIR/.."
SKILLS_TESTS_DIR="$SCRIPT_DIR"
SUBAGENTS_TESTS_DIR="$TESTS_DIR/subagents"

# Test execution order (dependencies first)
declare -a TEST_ORDER=(
    "structure"
    "definition"
    "progressive-loading"
    "semantic-matching"
    "scripts"
    "spawn"
    "tools"
    "quality-gates"
    "integration"
)

# Parse arguments
VERBOSE=""
QUICK=""
CATEGORY_FILTER=""
LIST_ONLY=""
PREV_ARG=""

for arg in "$@"; do
    case $arg in
        --verbose|-v)
            VERBOSE="true"
            ;;
        --quick|-q)
            QUICK="true"
            ;;
        --category=*)
            CATEGORY_FILTER="${arg#*=}"
            ;;
        --list|-l)
            LIST_ONLY="true"
            ;;
        --help|-h)
            echo "Skill and Subagent Test Runner"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --verbose, -v       Show detailed output"
            echo "  --quick, -q         Skip slow tests (integration)"
            echo "  --category NAME     Run only specific category"
            echo "  --list, -l          List all available tests"
            echo "  --help, -h          Show this help"
            echo ""
            echo "Categories:"
            echo "  Skills:    structure, progressive-loading, semantic-matching, scripts, integration"
            echo "  Subagents: definition, spawn, quality-gates, tools"
            echo ""
            echo "Examples:"
            echo "  $0                          # Run all tests"
            echo "  $0 --quick                  # Skip slow tests"
            echo "  $0 --category structure     # Run only structure tests"
            echo "  $0 --list                   # List available tests"
            exit 0
            ;;
        *)
            # Handle --category as separate argument
            if [[ "$PREV_ARG" == "--category" ]]; then
                CATEGORY_FILTER="$arg"
            fi
            ;;
    esac
    PREV_ARG="$arg"
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Results tracking
RESULTS_FILE=$(mktemp)
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0
START_TIME=$(date +%s)

trap "rm -f $RESULTS_FILE" EXIT

# Export for test scripts
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
export ORCHESTKIT_TEST_MODE=1

# Make all test scripts executable
find "$SKILLS_TESTS_DIR" -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true
find "$SUBAGENTS_TESTS_DIR" -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Get milliseconds (macOS compatible)
get_ms() {
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS: use perl for milliseconds
        perl -MTime::HiRes=time -e 'printf "%.0f\n", time * 1000' 2>/dev/null || echo $(($(date +%s) * 1000))
    else
        # Linux: use date +%s%3N
        date +%s%3N 2>/dev/null || echo $(($(date +%s) * 1000))
    fi
}

# ============================================================================
# TEST DISCOVERY
# ============================================================================

# Discover all test files in a directory
discover_tests() {
    local dir="$1"
    local pattern="${2:-test-*.sh}"

    if [[ -d "$dir" ]]; then
        find "$dir" -maxdepth 1 -name "$pattern" -type f 2>/dev/null | sort
    fi
}

# Get category directory
get_category_dir() {
    local category="$1"

    case "$category" in
        structure|progressive-loading|semantic-matching)
            echo "$SKILLS_TESTS_DIR/$category"
            ;;
        scripts)
            # Script-enhanced skills tests
            echo "$SKILLS_TESTS_DIR/scripts"
            ;;
        integration)
            # Skills integration tests
            echo "$SKILLS_TESTS_DIR/integration"
            ;;
        definition|spawn|quality-gates|tools)
            echo "$SUBAGENTS_TESTS_DIR/$category"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Get category type (skills or subagents)
get_category_type() {
    local category="$1"

    case "$category" in
        structure|progressive-loading|semantic-matching|scripts|integration)
            echo "skills"
            ;;
        definition|spawn|quality-gates|tools)
            echo "subagents"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# List all available tests
list_tests() {
    echo -e "${BOLD}Available Skill and Subagent Tests${NC}"
    echo ""
    echo -e "${CYAN}SKILLS TESTS:${NC}"
    echo "================================================================"

    local found_skills=0
    local category
    for category in structure progressive-loading semantic-matching scripts integration; do
        local dir
        dir=$(get_category_dir "$category")
        if [[ -n "$dir" && -d "$dir" ]]; then
            local tests
            tests=$(discover_tests "$dir")
            if [[ -n "$tests" ]]; then
                echo -e "  ${BOLD}$category/${NC}"
                local test_file
                while IFS= read -r test_file; do
                    if [[ -n "$test_file" ]]; then
                        local test_name
                        test_name=$(basename "$test_file")
                        echo "    - $test_name"
                        found_skills=$((found_skills + 1))
                    fi
                done <<< "$tests"
            else
                echo -e "  ${DIM}$category/ (no tests)${NC}"
            fi
        fi
    done

    if [[ $found_skills -eq 0 ]]; then
        echo -e "  ${DIM}(no skill tests found)${NC}"
    fi

    echo ""
    echo -e "${CYAN}SUBAGENT TESTS:${NC}"
    echo "================================================================"

    local found_subagents=0
    for category in definition spawn quality-gates tools; do
        local dir
        dir=$(get_category_dir "$category")
        if [[ -n "$dir" && -d "$dir" ]]; then
            local tests
            tests=$(discover_tests "$dir")
            if [[ -n "$tests" ]]; then
                echo -e "  ${BOLD}$category/${NC}"
                local test_file
                while IFS= read -r test_file; do
                    if [[ -n "$test_file" ]]; then
                        local test_name
                        test_name=$(basename "$test_file")
                        echo "    - $test_name"
                        found_subagents=$((found_subagents + 1))
                    fi
                done <<< "$tests"
            else
                echo -e "  ${DIM}$category/ (no tests)${NC}"
            fi
        fi
    done

    if [[ $found_subagents -eq 0 ]]; then
        echo -e "  ${DIM}(no subagent tests found)${NC}"
    fi

    echo ""
    echo "================================================================"
    echo "Total: $((found_skills + found_subagents)) test files discovered"
}

# ============================================================================
# TEST EXECUTION
# ============================================================================

# Run a single test file
run_test_file() {
    local test_file="$1"
    local category="$2"

    local test_name
    test_name=$(basename "$test_file" .sh)
    local display_name="${category}/${test_name}"

    if [[ -n "$VERBOSE" ]]; then
        echo -e "${CYAN}================================================================${NC}"
        echo -e "${BOLD}Running: $display_name${NC}"
        echo -e "${CYAN}================================================================${NC}"
    fi

    local output_file
    output_file=$(mktemp)
    local start
    start=$(get_ms)
    local exit_code=0

    # Run the test
    if [[ -n "$VERBOSE" ]]; then
        bash "$test_file" --verbose 2>&1 | tee "$output_file" || exit_code=$?
    else
        bash "$test_file" > "$output_file" 2>&1 || exit_code=$?
    fi

    local end
    end=$(get_ms)
    local duration=$((end - start))

    # Parse output for pass/fail counts if available
    local passed=0
    local failed=0
    local skipped=0

    # Try to extract counts from test output (various formats)
    if grep -qE '[0-9]+ passed' "$output_file" 2>/dev/null; then
        passed=$(grep -oE '[0-9]+ passed' "$output_file" 2>/dev/null | head -1 | grep -oE '[0-9]+' || echo "0")
    fi
    if grep -qE '[0-9]+ failed' "$output_file" 2>/dev/null; then
        failed=$(grep -oE '[0-9]+ failed' "$output_file" 2>/dev/null | head -1 | grep -oE '[0-9]+' || echo "0")
    fi
    if grep -qE '[0-9]+ skipped' "$output_file" 2>/dev/null; then
        skipped=$(grep -oE '[0-9]+ skipped' "$output_file" 2>/dev/null | head -1 | grep -oE '[0-9]+' || echo "0")
    fi

    # Alternative format: "Passed: X"
    if [[ "$passed" == "0" ]]; then
        if grep -qE 'Passed:[[:space:]]*[0-9]+' "$output_file" 2>/dev/null; then
            passed=$(grep -oE 'Passed:[[:space:]]*[0-9]+' "$output_file" 2>/dev/null | head -1 | grep -oE '[0-9]+' || echo "0")
        fi
    fi
    if [[ "$failed" == "0" ]]; then
        if grep -qE 'Failed:[[:space:]]*[0-9]+' "$output_file" 2>/dev/null; then
            failed=$(grep -oE 'Failed:[[:space:]]*[0-9]+' "$output_file" 2>/dev/null | head -1 | grep -oE '[0-9]+' || echo "0")
        fi
    fi

    # If no counts found, use exit code
    if [[ "$passed" == "0" && "$failed" == "0" ]]; then
        if [[ $exit_code -eq 0 ]]; then
            passed=1
        else
            failed=1
        fi
    fi

    # Ensure passed and failed are integers
    passed=${passed:-0}
    failed=${failed:-0}
    skipped=${skipped:-0}

    # Record result
    local status="PASS"
    if [[ $exit_code -ne 0 ]]; then
        status="FAIL"
    elif [[ "$skipped" -gt 0 && "$passed" -eq 0 && "$failed" -eq 0 ]]; then
        status="SKIP"
    fi

    echo "${display_name}:${status}:${duration}:${passed}:${failed}:${skipped}" >> "$RESULTS_FILE"

    # Update totals
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    TOTAL_PASSED=$((TOTAL_PASSED + passed))
    TOTAL_FAILED=$((TOTAL_FAILED + failed))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + skipped))

    # Show inline result if not verbose
    if [[ -z "$VERBOSE" ]]; then
        case "$status" in
            PASS)
                echo -e "  ${GREEN}PASS${NC}  $display_name ${DIM}(${duration}ms)${NC}"
                ;;
            FAIL)
                echo -e "  ${RED}FAIL${NC}  $display_name ${DIM}(${duration}ms)${NC}"
                # Show first few lines of error
                head -5 "$output_file" | sed 's/^/       /'
                ;;
            SKIP)
                echo -e "  ${YELLOW}SKIP${NC}  $display_name"
                ;;
        esac
    fi

    rm -f "$output_file"

    if [[ "$status" == "FAIL" ]]; then
        return 1
    fi
    return 0
}

# Run all tests in a category
run_category() {
    local category="$1"
    local dir
    dir=$(get_category_dir "$category")

    if [[ -z "$dir" || ! -d "$dir" ]]; then
        if [[ -n "$VERBOSE" ]]; then
            echo -e "${YELLOW}SKIP: Category '$category' directory not found${NC}"
        fi
        return 0
    fi

    local tests
    tests=$(discover_tests "$dir")

    if [[ -z "$tests" ]]; then
        if [[ -n "$VERBOSE" ]]; then
            echo -e "${DIM}No tests found in $category${NC}"
        fi
        return 0
    fi

    local category_failed=0
    local test_file

    while IFS= read -r test_file; do
        if [[ -n "$test_file" ]]; then
            run_test_file "$test_file" "$category" || category_failed=1
        fi
    done <<< "$tests"

    return $category_failed
}

# Print results table
print_results() {
    # Results table header
    printf "%-45s %-8s %-10s\n" "Test" "Status" "Duration"
    echo "================================================================"

    # Print results
    local test_name status duration passed failed skipped color
    while IFS=: read -r test_name status duration passed failed skipped; do
        color="${NC}"
        case "$status" in
            PASS) color="${GREEN}" ;;
            FAIL) color="${RED}" ;;
            SKIP) color="${YELLOW}" ;;
        esac

        printf "%-45s ${color}%-8s${NC} %sms\n" "$test_name" "$status" "$duration"
    done < "$RESULTS_FILE"

    echo "================================================================"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

# Handle list mode
if [[ -n "$LIST_ONLY" ]]; then
    list_tests
    exit 0
fi

# Print header
echo ""
echo -e "${BOLD}========================================================================${NC}"
echo -e "${BOLD}         Skill and Subagent Test Suite v1.0                            ${NC}"
echo -e "${BOLD}========================================================================${NC}"
echo ""

if [[ -n "$QUICK" ]]; then
    echo -e "${YELLOW}Quick mode: Skipping slow tests (integration)${NC}"
    echo ""
fi

if [[ -n "$CATEGORY_FILTER" ]]; then
    echo -e "${CYAN}Running category: $CATEGORY_FILTER${NC}"
    echo ""
fi

# Determine which categories to run
declare -a CATEGORIES_TO_RUN

if [[ -n "$CATEGORY_FILTER" ]]; then
    CATEGORIES_TO_RUN=("$CATEGORY_FILTER")
else
    # Run in dependency order
    CATEGORIES_TO_RUN=("${TEST_ORDER[@]}")
fi

# Filter out slow tests in quick mode
if [[ -n "$QUICK" ]]; then
    declare -a FILTERED_CATEGORIES=()
    for cat in "${CATEGORIES_TO_RUN[@]}"; do
        if [[ "$cat" != "integration" ]]; then
            FILTERED_CATEGORIES+=("$cat")
        fi
    done
    CATEGORIES_TO_RUN=("${FILTERED_CATEGORIES[@]}")
fi

# Track overall status
OVERALL_FAILED=0

# Run skills tests
echo -e "${BOLD}${CYAN}SKILLS TESTS${NC}"
echo "================================================================"

for category in "${CATEGORIES_TO_RUN[@]}"; do
    if [[ $(get_category_type "$category") == "skills" ]]; then
        if [[ -n "$VERBOSE" ]]; then
            echo ""
            echo -e "${BOLD}Category: $category${NC}"
        fi
        run_category "$category" || OVERALL_FAILED=1
    fi
done

echo ""

# Run subagent tests
echo -e "${BOLD}${CYAN}SUBAGENT TESTS${NC}"
echo "================================================================"

for category in "${CATEGORIES_TO_RUN[@]}"; do
    if [[ $(get_category_type "$category") == "subagents" ]]; then
        if [[ -n "$VERBOSE" ]]; then
            echo ""
            echo -e "${BOLD}Category: $category${NC}"
        fi
        run_category "$category" || OVERALL_FAILED=1
    fi
done

# ============================================================================
# SUMMARY
# ============================================================================

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BOLD}========================================================================${NC}"
echo -e "${BOLD}                           TEST SUMMARY                                 ${NC}"
echo -e "${BOLD}========================================================================${NC}"
echo ""

# Print results table
print_results

echo ""

# Statistics
echo -e "${BOLD}Statistics:${NC}"
echo "  Test files executed: $TOTAL_TESTS"
echo -e "  ${GREEN}Passed:${NC}  $TOTAL_PASSED"
echo -e "  ${RED}Failed:${NC}  $TOTAL_FAILED"
echo -e "  ${YELLOW}Skipped:${NC} $TOTAL_SKIPPED"
echo "  Total time: ${TOTAL_DURATION}s"
echo ""

# Final status
if [[ $TOTAL_FAILED -gt 0 || $OVERALL_FAILED -eq 1 ]]; then
    echo -e "${RED}${BOLD}TESTS FAILED${NC}"
    echo ""
    exit 1
else
    if [[ $TOTAL_TESTS -eq 0 ]]; then
        echo -e "${YELLOW}${BOLD}NO TESTS FOUND${NC}"
        echo ""
        echo "Create test files in:"
        echo "  - tests/skills/{structure,progressive-loading,semantic-matching,integration}/"
        echo "  - tests/subagents/{definition,spawn,quality-gates,tools}/"
        echo ""
        echo "Test files should be named test-*.sh"
        exit 0
    else
        echo -e "${GREEN}${BOLD}ALL TESTS PASSED${NC}"
        echo ""
        exit 0
    fi
fi