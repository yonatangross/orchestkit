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
TEST_FILES=()
TEST_COUNT=0
if [[ -d "$TEST_DIR" ]]; then
  if [[ "$PATTERN" == "test-*.sh" ]]; then
    FOUND="$(find "$TEST_DIR" \( -name "test-*.sh" -o -name "test-*.mjs" \) -type f | sort)"
  else
    FOUND="$(find "$TEST_DIR" -name "$PATTERN" -type f | sort)"
  fi
  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    TEST_FILES+=("$file")
    TEST_COUNT=$((TEST_COUNT + 1))
  done < <(printf '%s\n' "$FOUND")
else
  echo "Directory not found: $TEST_DIR"
  exit 1
fi

if [[ "$COUNT_ONLY" == "true" ]]; then
  echo "$TEST_COUNT"
  exit 0
fi

if [[ "$BY_CATEGORY" == "true" ]]; then
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  Test Discovery by Category${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""

  # Group by parent directory
  CATEGORY_COUNT=0

  # Print by category
  while IFS= read -r directory; do
    [[ -n "$directory" ]] || continue
    CATEGORY_COUNT=$((CATEGORY_COUNT + 1))
    category="${directory#"$TEST_DIR/"}"
    count=0
    for test_file in ${TEST_FILES[@]+"${TEST_FILES[@]}"}; do
      if [[ "$(dirname "$test_file")" == "$directory" ]]; then
        count=$((count + 1))
      fi
    done
    echo -e "${GREEN}$category${NC}: $count tests"

    # List tests in this category
    for test_file in ${TEST_FILES[@]+"${TEST_FILES[@]}"}; do
      if [[ "$(dirname "$test_file")" == "$directory" ]]; then
        echo "  - $(basename "$test_file")"
      fi
    done
    echo ""
  done < <(for test_file in ${TEST_FILES[@]+"${TEST_FILES[@]}"}; do dirname "$test_file"; done | sort -u)

  echo -e "${BLUE}----------------------------------------${NC}"
  echo -e "Total: ${GREEN}${TEST_COUNT}${NC} tests in ${GREEN}${CATEGORY_COUNT}${NC} categories"
else
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  Discovered Tests in $TEST_DIR${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""

  for test_file in ${TEST_FILES[@]+"${TEST_FILES[@]}"}; do
    echo "$test_file"
  done

  echo ""
  echo -e "${BLUE}----------------------------------------${NC}"
  echo -e "Total: ${GREEN}${TEST_COUNT}${NC} tests"
fi
