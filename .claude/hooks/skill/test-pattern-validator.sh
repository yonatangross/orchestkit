#!/bin/bash
# =============================================================================
# test-pattern-validator.sh
# BLOCKING: Tests must follow AAA pattern and naming conventions
# =============================================================================
set -euo pipefail

# Get inputs
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_OUTPUT_CONTENT:-}"

[[ -z "$FILE_PATH" ]] && exit 0
[[ -z "$CONTENT" ]] && exit 0

# Only validate test files
IS_TEST_FILE=false
if [[ "$FILE_PATH" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]]; then
    IS_TEST_FILE=true
fi
if [[ "$FILE_PATH" =~ (^|/)test_[^/]*\.py$ ]] || [[ "$FILE_PATH" =~ _test\.py$ ]]; then
    IS_TEST_FILE=true
fi

[[ "$IS_TEST_FILE" == "false" ]] && exit 0

ERRORS=()

# =============================================================================
# TypeScript/JavaScript Test Validation
# =============================================================================
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then

    # -------------------------------------------------------------------------
    # Rule: Test names must be descriptive (not too short)
    # -------------------------------------------------------------------------
    # Find test names that are less than 10 characters
    SHORT_TESTS=$(echo "$CONTENT" | grep -oE "(test|it)\(['\"][^'\"]{1,10}['\"]" 2>/dev/null | head -5 || true)
    if [[ -n "$SHORT_TESTS" ]]; then
        # Check if they look like placeholder names
        if echo "$SHORT_TESTS" | grep -qiE "(test[0-9]|works|test|todo)" 2>/dev/null; then
            ERRORS+=("Test names too short or generic. Use descriptive names:")
            ERRORS+=("  BAD:  test('test1'), test('works')")
            ERRORS+=("  GOOD: test('should return user when ID exists')")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: No shared mutable state without beforeEach reset
    # -------------------------------------------------------------------------
    # Check for let declarations at describe level (outside beforeEach)
    if echo "$CONTENT" | grep -qE "^let [a-zA-Z_][a-zA-Z0-9_]* =" 2>/dev/null; then
        # Check if there's a beforeEach that resets it
        if ! echo "$CONTENT" | grep -qE "beforeEach\s*\(\s*(async\s*)?\(\s*\)\s*=>" 2>/dev/null; then
            ERRORS+=("Shared mutable state detected without beforeEach reset:")
            ERRORS+=("  Add beforeEach(() => { /* reset state */ }) to ensure test isolation")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: Avoid multiple unrelated expects in single test
    # -------------------------------------------------------------------------
    # Count expects per test (rough heuristic)
    TOTAL_EXPECTS=$(echo "$CONTENT" | grep -c "expect(" 2>/dev/null || echo "0")
    TOTAL_TESTS=$(echo "$CONTENT" | grep -cE "(test|it)\s*\(" 2>/dev/null || echo "1")

    if [[ $TOTAL_TESTS -gt 0 ]]; then
        AVG_EXPECTS=$((TOTAL_EXPECTS / TOTAL_TESTS))
        if [[ $AVG_EXPECTS -gt 5 ]]; then
            ERRORS+=("High assertion count (avg $AVG_EXPECTS per test):")
            ERRORS+=("  Consider splitting into focused tests with 1-3 assertions each")
            ERRORS+=("  Or add AAA comments (// Arrange, // Act, // Assert)")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: No console.log in tests (use proper assertions)
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "console\.(log|warn|error)\(" 2>/dev/null; then
        ERRORS+=("console.log found in test file:")
        ERRORS+=("  Remove debugging statements before committing")
        ERRORS+=("  Use proper assertions instead")
    fi

    # -------------------------------------------------------------------------
    # Rule: No .only() left in tests
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "(test|it|describe)\.only\(" 2>/dev/null; then
        ERRORS+=(".only() found - this skips other tests:")
        ERRORS+=("  Remove .only() before committing")
    fi

    # -------------------------------------------------------------------------
    # Rule: No .skip() without explanation
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "(test|it|describe)\.skip\(" 2>/dev/null; then
        # Check if there's a TODO or comment explaining why
        if ! echo "$CONTENT" | grep -qiE "(TODO|FIXME|skip.*because|temporarily)" 2>/dev/null; then
            ERRORS+=(".skip() found without explanation:")
            ERRORS+=("  Add a comment explaining why the test is skipped")
            ERRORS+=("  Example: test.skip('reason: waiting for API fix')")
        fi
    fi
fi

# =============================================================================
# Python Test Validation
# =============================================================================
if [[ "$FILE_PATH" =~ \.py$ ]]; then

    # -------------------------------------------------------------------------
    # Rule: Test function naming must use snake_case
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "def test[A-Z]" 2>/dev/null; then
        ERRORS+=("Test names must use snake_case, not camelCase:")
        ERRORS+=("  BAD:  def testUserCreation()")
        ERRORS+=("  GOOD: def test_user_creation()")
    fi

    # -------------------------------------------------------------------------
    # Rule: Use pytest fixtures, not unittest setUp/tearDown
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "def (setUp|tearDown|setUpClass|tearDownClass)\s*\(" 2>/dev/null; then
        ERRORS+=("Use pytest fixtures instead of unittest setUp/tearDown:")
        ERRORS+=("  BAD:  def setUp(self): ...")
        ERRORS+=("  GOOD: @pytest.fixture\\n        def setup_data(): ...")
    fi

    # -------------------------------------------------------------------------
    # Rule: No class-level mutable defaults
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "class Test.*:" 2>/dev/null; then
        # Look for mutable defaults at class level
        if echo "$CONTENT" | grep -qE "^\s+[a-z_]+ = \[\]" 2>/dev/null || \
           echo "$CONTENT" | grep -qE "^\s+[a-z_]+ = \{\}" 2>/dev/null; then
            ERRORS+=("Class-level mutable defaults can cause test pollution:")
            ERRORS+=("  BAD:  class TestUser:\\n            items = []")
            ERRORS+=("  GOOD: Use @pytest.fixture to create fresh instances")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: No print statements in tests
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "^\s+print\(" 2>/dev/null; then
        ERRORS+=("print() found in test file:")
        ERRORS+=("  Remove debugging statements before committing")
        ERRORS+=("  Use proper assertions or pytest's capfd fixture")
    fi

    # -------------------------------------------------------------------------
    # Rule: No @pytest.mark.skip without reason
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "@pytest\.mark\.skip\s*$" 2>/dev/null || \
       echo "$CONTENT" | grep -qE "@pytest\.mark\.skip\(\s*\)" 2>/dev/null; then
        ERRORS+=("@pytest.mark.skip without reason:")
        ERRORS+=("  Add reason: @pytest.mark.skip(reason='waiting for fix')")
    fi

    # -------------------------------------------------------------------------
    # Rule: Async tests should use pytest-asyncio
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "async def test_" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "@pytest\.mark\.asyncio" 2>/dev/null; then
            # Check if there's a pytest.ini or conftest with asyncio_mode
            ERRORS+=("Async test found without @pytest.mark.asyncio:")
            ERRORS+=("  Add: @pytest.mark.asyncio")
            ERRORS+=("  Or set asyncio_mode = auto in pytest.ini")
        fi
    fi
fi

# =============================================================================
# Report errors and block
# =============================================================================
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "BLOCKED: Test pattern violations detected"
    echo ""
    echo "File: $FILE_PATH"
    echo ""
    echo "Violations:"
    for error in "${ERRORS[@]}"; do
        echo "  $error"
    done
    echo ""
    echo "Reference: .claude/skills/test-standards-enforcer/SKILL.md"
    exit 1
fi

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
# echo '{"systemMessage":"Test patterns validated","continue":true}'
exit 0
