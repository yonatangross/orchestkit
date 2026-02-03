#!/usr/bin/env bash
# scripts/ci/discover-tests.sh
# List all discoverable tests for verification
#
# Usage: discover-tests.sh [test-dir] [--count] [--by-category]
#
# Lists all test scripts that would be discovered by run-tests.sh.
# Useful for verifying test coverage before/after changes.

set -euo pipefail

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Configuration
TEST_DIR="${1:-tests}"
COUNT_ONLY=false
BY_CATEGORY=false
PATTERN="test-*.sh"

# Parse optional arguments
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --count)
      COUNT_ONLY=true
      shift
      ;;
    --by-category)
      BY_CATEGORY=true
      shift
      ;;
    --pattern)
      PATTERN="${2:-test-*.sh}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Find all test scripts
if [[ -d "$TEST_DIR" ]]; then
  mapfile -t TEST_FILES < <(find "$TEST_DIR" -name "$PATTERN" -type f | sort)
else
  echo "Directory not found: $TEST_DIR"
  exit 1
fi

if [[ "$COUNT_ONLY" == "true" ]]; then
  echo "${#TEST_FILES[@]}"
  exit 0
fi

if [[ "$BY_CATEGORY" == "true" ]]; then
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  Test Discovery by Category${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""

  # Group by parent directory
  declare -A CATEGORIES
  for test_file in "${TEST_FILES[@]}"; do
    category=$(dirname "$test_file" | sed "s|^$TEST_DIR/||")
    if [[ -z "${CATEGORIES[$category]:-}" ]]; then
      CATEGORIES[$category]=0
    fi
    CATEGORIES[$category]=$((CATEGORIES[$category] + 1))
  done

  # Print by category
  for category in $(echo "${!CATEGORIES[@]}" | tr ' ' '\n' | sort); do
    count=${CATEGORIES[$category]}
    echo -e "${GREEN}$category${NC}: $count tests"

    # List tests in this category
    for test_file in "${TEST_FILES[@]}"; do
      file_category=$(dirname "$test_file" | sed "s|^$TEST_DIR/||")
      if [[ "$file_category" == "$category" ]]; then
        echo "  - $(basename "$test_file")"
      fi
    done
    echo ""
  done

  echo -e "${BLUE}----------------------------------------${NC}"
  echo -e "Total: ${GREEN}${#TEST_FILES[@]}${NC} tests in ${GREEN}${#CATEGORIES[@]}${NC} categories"
else
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  Discovered Tests in $TEST_DIR${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""

  for test_file in "${TEST_FILES[@]}"; do
    echo "$test_file"
  done

  echo ""
  echo -e "${BLUE}----------------------------------------${NC}"
  echo -e "Total: ${GREEN}${#TEST_FILES[@]}${NC} tests"
fi
