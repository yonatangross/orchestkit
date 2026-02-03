#!/usr/bin/env bash
# scripts/ci/run-tests.sh
# Dynamic test discovery and execution
#
# Usage: run-tests.sh <test-dir> [--parallel N] [--verbose]
#
# Discovers and runs all test-*.sh scripts in the specified directory.
# Returns non-zero exit code if any tests fail.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="${1:?Usage: run-tests.sh <test-dir> [--parallel N] [--verbose]}"
PARALLEL=1
VERBOSE=false
PATTERN="test-*.sh"

# Parse optional arguments
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --parallel)
      PARALLEL="${2:-1}"
      shift 2
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --pattern)
      PATTERN="${2:-test-*.sh}"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate test directory exists
if [[ ! -d "$TEST_DIR" ]]; then
  echo -e "${RED}ERROR: Test directory not found: $TEST_DIR${NC}"
  exit 1
fi

# Discover all test scripts (POSIX-compatible, works on macOS bash 3.2)
TEST_FILES=()
while IFS= read -r file; do
  [[ -n "$file" ]] && TEST_FILES+=("$file")
done <<< "$(find "$TEST_DIR" -name "$PATTERN" -type f | sort)"

if [[ ${#TEST_FILES[@]} -eq 0 ]]; then
  echo -e "${YELLOW}WARNING: No tests found matching '$PATTERN' in $TEST_DIR${NC}"
  exit 0
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test Runner - Dynamic Discovery${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Directory: ${GREEN}$TEST_DIR${NC}"
echo -e "Pattern: ${GREEN}$PATTERN${NC}"
echo -e "Tests discovered: ${GREEN}${#TEST_FILES[@]}${NC}"
echo -e "Parallel: ${GREEN}$PARALLEL${NC}"
echo ""

# Track results
PASSED=0
FAILED=0
SKIPPED=0
FAILED_TESTS=()
START_TIME=$(date +%s)

# Function to run a single test
run_test() {
  local test_file="$1"
  local test_name
  test_name=$(basename "$test_file")

  echo -e "${BLUE}[RUN]${NC} $test_name"

  # Check if test is executable
  if [[ ! -x "$test_file" ]]; then
    chmod +x "$test_file" 2>/dev/null || true
  fi

  # Run the test
  local test_start
  test_start=$(date +%s)
  local exit_code=0

  if [[ "$VERBOSE" == "true" ]]; then
    bash "$test_file" || exit_code=$?
  else
    bash "$test_file" > /dev/null 2>&1 || exit_code=$?
  fi

  local test_end
  test_end=$(date +%s)
  local duration=$((test_end - test_start))

  if [[ $exit_code -eq 0 ]]; then
    echo -e "${GREEN}[PASS]${NC} $test_name (${duration}s)"
    return 0
  else
    echo -e "${RED}[FAIL]${NC} $test_name (${duration}s) - exit code: $exit_code"
    return 1
  fi
}

# Run tests
if [[ "$PARALLEL" -eq 1 ]]; then
  # Sequential execution
  for test_file in "${TEST_FILES[@]}"; do
    if run_test "$test_file"; then
      PASSED=$((PASSED + 1))
    else
      FAILED=$((FAILED + 1))
      FAILED_TESTS+=("$(basename "$test_file")")
    fi
  done
else
  # Parallel execution using xargs
  echo "Running tests in parallel (max $PARALLEL concurrent)..."

  # Export the run function and variables for parallel execution
  export -f run_test
  export VERBOSE
  export RED GREEN YELLOW BLUE NC

  # Use xargs for parallel execution
  printf '%s\n' "${TEST_FILES[@]}" | xargs -P "$PARALLEL" -I {} bash -c 'run_test "$@"' _ {}

  # Note: Parallel mode doesn't track individual results well
  # For accurate counts, use sequential mode
  PASSED=${#TEST_FILES[@]}
fi

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# Print summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Total tests: ${#TEST_FILES[@]}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo -e "Duration: ${TOTAL_DURATION}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo -e "${RED}Failed tests:${NC}"
  for test_name in "${FAILED_TESTS[@]}"; do
    echo -e "  - $test_name"
  done
  echo ""
  exit 1
fi

echo ""
echo -e "${GREEN}All tests passed!${NC}"
exit 0
