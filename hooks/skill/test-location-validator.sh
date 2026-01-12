#!/bin/bash
# =============================================================================
# test-location-validator.sh
# BLOCKING: Tests must be in correct location
# =============================================================================
set -euo pipefail

# Get file path from tool input
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
[[ -z "$FILE_PATH" ]] && exit 0

# Source common utilities if available
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$SCRIPT_DIR/../_lib/common.sh" ]] && source "$SCRIPT_DIR/../_lib/common.sh"

# =============================================================================
# Detect if file is a test file
# =============================================================================
IS_TEST_FILE=false

# TypeScript/JavaScript test patterns
if [[ "$FILE_PATH" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]]; then
    IS_TEST_FILE=true
fi

# Python test patterns
if [[ "$FILE_PATH" =~ (^|/)test_[^/]*\.py$ ]] || [[ "$FILE_PATH" =~ _test\.py$ ]]; then
    IS_TEST_FILE=true
fi

# =============================================================================
# Rule 1: Test files MUST be in test directories
# =============================================================================
if [[ "$IS_TEST_FILE" == "true" ]]; then
    # Valid test directories
    if [[ ! "$FILE_PATH" =~ (tests/|__tests__/|/test/|test/) ]]; then
        echo "BLOCKED: Test file must be in tests/, __tests__/, or test/ directory"
        echo ""
        echo "  File: $FILE_PATH"
        echo ""
        echo "  Suggested locations:"
        BASENAME=$(basename "$FILE_PATH")
        echo "    - tests/$BASENAME"
        echo "    - tests/unit/$BASENAME"
        echo "    - __tests__/$BASENAME"
        echo ""
        echo "  Why? Keeping tests separate from source code:"
        echo "    - Makes it clear what is production code vs test code"
        echo "    - Simplifies build/bundle configuration"
        echo "    - Easier to measure and exclude from coverage"
        exit 1
    fi
fi

# =============================================================================
# Rule 2: Source files CANNOT be in test directories
# =============================================================================
if [[ "$IS_TEST_FILE" == "false" ]] && [[ "$FILE_PATH" =~ (tests/|__tests__/|/test/) ]]; then
    # Allow certain files in test directories
    FILENAME=$(basename "$FILE_PATH")

    # Allowed: conftest, fixtures, factories, mocks, __init__, setup
    if [[ "$FILENAME" =~ ^(conftest|fixtures|factories|mocks|__init__|setup|helpers|utils)\.py$ ]] || \
       [[ "$FILENAME" =~ ^(setup|helpers|utils|mocks|fixtures)\.(ts|js)$ ]] || \
       [[ "$FILE_PATH" =~ /(fixtures|mocks|factories|__mocks__)/ ]]; then
        exit 0
    fi

    echo "BLOCKED: Source files cannot be in test directories"
    echo ""
    echo "  File: $FILE_PATH"
    echo ""
    echo "  Test directories should only contain:"
    echo "    - Test files (*.test.ts, test_*.py)"
    echo "    - Test utilities (conftest.py, fixtures/, mocks/)"
    echo "    - Test setup files"
    echo ""
    echo "  Move source code to: src/ or app/"
    exit 1
fi

# =============================================================================
# Rule 3: TypeScript/JavaScript tests must use .test or .spec suffix
# =============================================================================
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]] && [[ "$FILE_PATH" =~ (tests/|__tests__/) ]]; then
    FILENAME=$(basename "$FILE_PATH")

    # Skip setup/utility files
    if [[ "$FILENAME" =~ ^(setup|jest|vitest|config|helpers|utils|mocks)\. ]]; then
        exit 0
    fi

    # Must have .test or .spec suffix
    if [[ ! "$FILENAME" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]]; then
        echo "BLOCKED: Test files must use .test.ts or .spec.ts suffix"
        echo ""
        echo "  File: $FILE_PATH"
        echo "  Got: $FILENAME"
        echo ""
        echo "  Expected patterns:"
        echo "    - *.test.ts / *.test.tsx"
        echo "    - *.spec.ts / *.spec.tsx"
        echo ""
        echo "  Example: user.test.ts, Button.spec.tsx"
        exit 1
    fi
fi

# =============================================================================
# Rule 4: Python tests must follow naming convention
# =============================================================================
if [[ "$FILE_PATH" =~ \.py$ ]] && [[ "$FILE_PATH" =~ (tests/|/test/) ]]; then
    FILENAME=$(basename "$FILE_PATH")

    # Skip utility files
    if [[ "$FILENAME" =~ ^(conftest|__init__|fixtures|factories|mocks|helpers)\.py$ ]]; then
        exit 0
    fi

    # Must start with test_ or end with _test.py
    if [[ ! "$FILENAME" =~ ^test_.*\.py$ ]] && [[ ! "$FILENAME" =~ _test\.py$ ]]; then
        echo "BLOCKED: Python test files must be named test_*.py or *_test.py"
        echo ""
        echo "  File: $FILE_PATH"
        echo "  Got: $FILENAME"
        echo ""
        echo "  Expected patterns:"
        echo "    - test_user.py"
        echo "    - user_test.py"
        echo ""
        echo "  Note: pytest discovers tests matching these patterns"
        exit 1
    fi
fi

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0
