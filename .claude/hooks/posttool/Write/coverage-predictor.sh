#!/usr/bin/env bash
# Test Coverage Predictor - LLM-powered validation hook
# Predicts if new code has adequate test coverage
# CC 2.1.3 Feature: Post-write analysis

set -euo pipefail

# Get the file path from tool output
FILE_PATH="${TOOL_OUTPUT_FILE_PATH:-$1}"

if [[ -z "$FILE_PATH" ]]; then
    exit 0
fi

# Only analyze source code files (not tests themselves)
case "$FILE_PATH" in
    *test*|*spec*|*__tests__*)
        # Test file - skip prediction
        exit 0
        ;;
    *.py|*.ts|*.tsx|*.js|*.jsx)
        # Source code - analyze
        ;;
    *)
        # Non-code files - skip
        exit 0
        ;;
esac

# Determine corresponding test file location
if [[ "$FILE_PATH" == *.py ]]; then
    # Python: backend/app/services/foo.py -> backend/tests/unit/test_foo.py
    BASENAME=$(basename "$FILE_PATH" .py)
    TEST_PATTERN="**/test_${BASENAME}.py"
elif [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
    # TypeScript: src/components/Foo.tsx -> src/components/__tests__/Foo.test.tsx
    BASENAME=$(basename "$FILE_PATH" | sed 's/\.[^.]*$//')
    TEST_PATTERN="**/${BASENAME}.test.*"
else
    exit 0
fi

# Check if test file exists
PROJ_DIR="${CLAUDE_PROJECT_DIR:-.}"
TEST_EXISTS=$(find "$PROJ_DIR" -type f -name "$(basename "$TEST_PATTERN")" 2>/dev/null | head -1)

# Log results
LOG_DIR="$PROJ_DIR/.claude/hooks/logs"
mkdir -p "$LOG_DIR"

if [[ -n "$TEST_EXISTS" ]]; then
    echo "[$(date -Iseconds)] COVERAGE_OK: $FILE_PATH has tests at $TEST_EXISTS" >> "$LOG_DIR/coverage-predictor.log"
else
    echo "[$(date -Iseconds)] COVERAGE_WARN: $FILE_PATH may lack test coverage (expected: $TEST_PATTERN)" >> "$LOG_DIR/coverage-predictor.log"

    # Subtle reminder (not blocking)
    echo "💡 Consider adding tests for: $FILE_PATH" >&2
fi

exit 0