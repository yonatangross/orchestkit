#!/bin/bash
set -euo pipefail
# Affected Tests Finder Hook for Claude Code
# Suggests running only affected tests based on git diff
# CC 2.1.9 Enhanced: Uses additionalContext for suggestions
# Hook: PreToolUse (Bash)
# Issue: #138

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

# Self-guard: Only run for non-trivial commands
guard_nontrivial_bash || exit 0

# Get the command being executed
COMMAND=$(get_field '.tool_input.command')

# Skip if empty
if [[ -z "$COMMAND" ]]; then
  output_silent_success
  exit 0
fi

# Check if this is a test command (running all tests)
IS_TEST_ALL=false
TEST_FRAMEWORK=""

# Detect pytest (Python)
if [[ "$COMMAND" =~ ^(pytest|python\ -m\ pytest)\ *$ ]] || \
   [[ "$COMMAND" =~ ^(pytest|python\ -m\ pytest)\ +(--?[a-zA-Z]|tests/?$|backend/tests/?$) ]]; then
  IS_TEST_ALL=true
  TEST_FRAMEWORK="pytest"
fi

# Detect npm/vitest/jest test commands
if [[ "$COMMAND" =~ ^(npm\ test|npm\ run\ test|yarn\ test|pnpm\ test|vitest|jest)\ *$ ]] || \
   [[ "$COMMAND" =~ ^(vitest|jest)\ +(run)?\ *$ ]]; then
  IS_TEST_ALL=true
  TEST_FRAMEWORK="js"
fi

# If not running all tests, allow silently
if [[ "$IS_TEST_ALL" == "false" ]]; then
  output_silent_success
  exit 0
fi

# Get project directory
PROJ_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJ_DIR" 2>/dev/null || {
  output_silent_success
  exit 0
}

# Check if we're in a git repository
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  output_silent_success
  exit 0
fi

# Get changed files since last commit or vs main/dev
CHANGED_FILES=""
COMPARISON_REF=""

# First try: uncommitted changes
UNCOMMITTED=$(git diff --name-only HEAD 2>/dev/null | head -50)
if [[ -n "$UNCOMMITTED" ]]; then
  CHANGED_FILES="$UNCOMMITTED"
  COMPARISON_REF="HEAD (uncommitted)"
fi

# If no uncommitted changes, compare to main/dev branch
if [[ -z "$CHANGED_FILES" ]]; then
  # Try to find the base branch
  BASE_BRANCH=""
  for branch in main dev master; do
    if git rev-parse --verify "$branch" >/dev/null 2>&1; then
      BASE_BRANCH="$branch"
      break
    fi
  done

  if [[ -n "$BASE_BRANCH" ]]; then
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
    if [[ "$CURRENT_BRANCH" != "$BASE_BRANCH" ]]; then
      CHANGED_FILES=$(git diff --name-only "$BASE_BRANCH"...HEAD 2>/dev/null | head -50)
      COMPARISON_REF="$BASE_BRANCH"
    fi
  fi
fi

# If still no changes, nothing to suggest
if [[ -z "$CHANGED_FILES" ]]; then
  output_silent_success
  exit 0
fi

# Map changed files to affected tests
AFFECTED_TESTS=""
AFFECTED_COUNT=0

for file in $CHANGED_FILES; do
  # Skip test files themselves
  case "$file" in
    *test*|*spec*|*__tests__*) continue ;;
  esac

  # Skip non-source files
  case "$file" in
    *.py|*.ts|*.tsx|*.js|*.jsx) ;;
    *) continue ;;
  esac

  # Get basename without extension
  basename_no_ext=$(basename "$file" | sed 's/\.[^.]*$//')

  # Python: module.py -> test_module.py
  if [[ "$file" == *.py ]]; then
    # Look for test file
    test_file=$(find "$PROJ_DIR" -type f \( -name "test_${basename_no_ext}.py" -o -name "${basename_no_ext}_test.py" \) 2>/dev/null | head -1)
    if [[ -n "$test_file" ]]; then
      test_file_rel="${test_file#$PROJ_DIR/}"
      AFFECTED_TESTS="$AFFECTED_TESTS $test_file_rel"
      ((AFFECTED_COUNT++)) || true
    fi
  fi

  # TypeScript/JavaScript: Component.tsx -> Component.test.tsx
  if [[ "$file" == *.ts || "$file" == *.tsx || "$file" == *.js || "$file" == *.jsx ]]; then
    # Look for test file in same directory or __tests__
    dir=$(dirname "$file")
    test_patterns=("${dir}/${basename_no_ext}.test."* "${dir}/${basename_no_ext}.spec."* "${dir}/__tests__/${basename_no_ext}."*)

    for pattern in "${test_patterns[@]}"; do
      test_file=$(find "$PROJ_DIR" -type f -path "*$pattern" 2>/dev/null | head -1)
      if [[ -n "$test_file" ]]; then
        test_file_rel="${test_file#$PROJ_DIR/}"
        AFFECTED_TESTS="$AFFECTED_TESTS $test_file_rel"
        ((AFFECTED_COUNT++)) || true
        break
      fi
    done
  fi
done

# Remove duplicates and trim whitespace
AFFECTED_TESTS=$(echo "$AFFECTED_TESTS" | tr ' ' '\n' | sort -u | tr '\n' ' ' | xargs)

# If we found affected tests, suggest running only those
if [[ -n "$AFFECTED_TESTS" && "$AFFECTED_COUNT" -gt 0 && "$AFFECTED_COUNT" -lt 10 ]]; then
  # Build suggestion based on framework
  if [[ "$TEST_FRAMEWORK" == "pytest" ]]; then
    SUGGESTION="pytest $AFFECTED_TESTS"
  else
    SUGGESTION="Run specific tests: $AFFECTED_TESTS"
  fi

  CONTEXT_MSG="Optimization: $AFFECTED_COUNT test file(s) affected by changes (vs $COMPARISON_REF). Consider: $SUGGESTION"

  # Truncate if too long
  if [[ ${#CONTEXT_MSG} -gt 200 ]]; then
    CONTEXT_MSG="Optimization: $AFFECTED_COUNT test(s) affected. Run specific tests instead of full suite for faster feedback."
  fi

  log_hook "AFFECTED_TESTS: Found $AFFECTED_COUNT affected tests vs $COMPARISON_REF"
  output_with_context "$CONTEXT_MSG"
  exit 0
fi

# If too many affected tests (>10), suggest but don't list all
if [[ "$AFFECTED_COUNT" -ge 10 ]]; then
  CONTEXT_MSG="Note: Many files changed ($AFFECTED_COUNT+ tests affected). Full test run may be appropriate, or use -k flag to filter."
  log_hook "AFFECTED_TESTS: Many changes, suggesting full run"
  output_with_context "$CONTEXT_MSG"
  exit 0
fi

# No specific suggestions - allow silently
log_hook "AFFECTED_TESTS: No specific affected tests found"
output_silent_success
exit 0
