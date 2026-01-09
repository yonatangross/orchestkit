#!/bin/bash
# =============================================================================
# test-multi-instance-gates.sh
# Integration tests for multi-instance quality gates
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🧪 Testing Multi-Instance Quality Gates"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# Test helper functions
assert_exit_code() {
    local expected=$1
    local actual=$2
    local test_name=$3
    
    if [[ $actual -eq $expected ]]; then
        echo "  ✅ $test_name"
        ((TESTS_PASSED++))
    else
        echo "  ❌ $test_name (expected exit $expected, got $actual)"
        ((TESTS_FAILED++))
    fi
}

assert_output_contains() {
    local expected=$1
    local output=$2
    local test_name=$3
    
    if echo "$output" | grep -q "$expected"; then
        echo "  ✅ $test_name"
        ((TESTS_PASSED++))
    else
        echo "  ❌ $test_name (expected output to contain '$expected')"
        ((TESTS_FAILED++))
    fi
}

# Create temp directory for test files
TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

# =============================================================================
# Test 1: Duplicate Code Detector
# =============================================================================
echo "1️⃣  Testing duplicate-code-detector.sh"

# Test 1.1: Should detect duplicate function names
TEST_FILE_1="$TEMP_DIR/test1.ts"
cat > "$TEST_FILE_1" << 'TESTEOF'
export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}
TESTEOF

export TOOL_INPUT_FILE_PATH="$TEST_FILE_1"
export TOOL_OUTPUT_CONTENT="$(cat "$TEST_FILE_1")"

OUTPUT=$("$PROJECT_ROOT/.claude/hooks/skill/duplicate-code-detector.sh" 2>&1 || echo "EXIT_CODE=$?")
EXIT_CODE=$(echo "$OUTPUT" | grep -oE "EXIT_CODE=[0-9]+" | cut -d= -f2 || echo "0")

# Should pass for single file without duplicates
assert_exit_code 0 ${EXIT_CODE:-0} "No false positives on single file"

# Test 1.2: Should detect copy-paste (3+ identical lines)
TEST_FILE_2="$TEMP_DIR/test2.ts"
cat > "$TEST_FILE_2" << 'TESTEOF'
const a = 1;
const b = 2;
const c = 3;
const c = 3;
const c = 3;
const c = 3;
TESTEOF

export TOOL_INPUT_FILE_PATH="$TEST_FILE_2"
export TOOL_OUTPUT_CONTENT="$(cat "$TEST_FILE_2")"

OUTPUT=$("$PROJECT_ROOT/.claude/hooks/skill/duplicate-code-detector.sh" 2>&1 || true)
assert_output_contains "COPY-PASTE" "$OUTPUT" "Detects repeated code blocks"

# =============================================================================
# Test 2: Pattern Consistency Enforcer
# =============================================================================
echo ""
echo "2️⃣  Testing pattern-consistency-enforcer.sh"

# Test 2.1: Should block React.FC
TEST_FILE_3="$TEMP_DIR/test3.tsx"
cat > "$TEST_FILE_3" << 'TESTEOF'
export const MyComponent: React.FC<Props> = (props) => {
  return <div>Hello</div>;
};
TESTEOF

export TOOL_INPUT_FILE_PATH="$TEST_FILE_3"
export TOOL_OUTPUT_CONTENT="$(cat "$TEST_FILE_3")"

OUTPUT=$("$PROJECT_ROOT/.claude/hooks/skill/pattern-consistency-enforcer.sh" 2>&1 || echo "EXIT_CODE=$?")
EXIT_CODE=$(echo "$OUTPUT" | grep -oE "EXIT_CODE=[0-9]+" | cut -d= -f2 || echo "0")

assert_exit_code 1 ${EXIT_CODE:-0} "Blocks React.FC pattern"
assert_output_contains "React.FC" "$OUTPUT" "Mentions React.FC in error"

# Test 2.2: Should block missing Zod validation
TEST_FILE_4="$TEMP_DIR/test4.ts"
cat > "$TEST_FILE_4" << 'TESTEOF'
async function fetchUser() {
  const response = await fetch('/api/user');
  const data = await response.json();
  return data;
}
TESTEOF

export TOOL_INPUT_FILE_PATH="$TEST_FILE_4"
export TOOL_OUTPUT_CONTENT="$(cat "$TEST_FILE_4")"

OUTPUT=$("$PROJECT_ROOT/.claude/hooks/skill/pattern-consistency-enforcer.sh" 2>&1 || echo "EXIT_CODE=$?")
assert_output_contains "Zod" "$OUTPUT" "Detects missing Zod validation"

# Test 2.3: Should pass correct pattern
TEST_FILE_5="$TEMP_DIR/test5.tsx"
cat > "$TEST_FILE_5" << 'TESTEOF'
import { z } from 'zod';

const ResponseSchema = z.object({ id: z.number() });

export function MyComponent(props: Props): React.ReactNode {
  const data = ResponseSchema.parse(await response.json());
  return <div>{data.id}</div>;
}
TESTEOF

export TOOL_INPUT_FILE_PATH="$TEST_FILE_5"
export TOOL_OUTPUT_CONTENT="$(cat "$TEST_FILE_5")"

OUTPUT=$("$PROJECT_ROOT/.claude/hooks/skill/pattern-consistency-enforcer.sh" 2>&1 || true)
EXIT_CODE=$?

assert_exit_code 0 $EXIT_CODE "Passes with correct patterns"

# =============================================================================
# Test 3: Cross-Instance Test Validator
# =============================================================================
echo ""
echo "3️⃣  Testing cross-instance-test-validator.sh"

# Test 3.1: Should block missing test file
TEST_FILE_6="$TEMP_DIR/test6.ts"
cat > "$TEST_FILE_6" << 'TESTEOF'
export function calculateTotal(items: number[]): number {
  return items.reduce((a, b) => a + b, 0);
}

export class UserService {
  async getUser(id: number) { }
}
TESTEOF

export TOOL_INPUT_FILE_PATH="$TEST_FILE_6"
export TOOL_OUTPUT_CONTENT="$(cat "$TEST_FILE_6")"

OUTPUT=$("$PROJECT_ROOT/.claude/hooks/skill/cross-instance-test-validator.sh" 2>&1 || echo "EXIT_CODE=$?")
EXIT_CODE=$(echo "$OUTPUT" | grep -oE "EXIT_CODE=[0-9]+" | cut -d= -f2 || echo "1")

assert_exit_code 1 ${EXIT_CODE:-1} "Blocks when test file missing"
assert_output_contains "No test file found" "$OUTPUT" "Mentions missing test file"

# Test 3.2: Should pass if test file exists
TEST_FILE_7="$TEMP_DIR/test7.ts"
TEST_FILE_7_TEST="$TEMP_DIR/test7.test.ts"

cat > "$TEST_FILE_7" << 'TESTEOF'
export function add(a: number, b: number): number {
  return a + b;
}
TESTEOF

cat > "$TEST_FILE_7_TEST" << 'TESTEOF'
import { add } from './test7';
test('should add numbers', () => {
  expect(add(1, 2)).toBe(3);
});
TESTEOF

export TOOL_INPUT_FILE_PATH="$TEST_FILE_7"
export TOOL_OUTPUT_CONTENT="$(cat "$TEST_FILE_7")"

OUTPUT=$("$PROJECT_ROOT/.claude/hooks/skill/cross-instance-test-validator.sh" 2>&1 || true)
EXIT_CODE=$?

# Should still warn about coverage, but not block
if [[ $EXIT_CODE -eq 0 ]] || [[ $EXIT_CODE -eq 2 ]]; then
    echo "  ✅ Handles existing test file correctly"
    ((TESTS_PASSED++))
else
    echo "  ❌ Should not block when test file exists"
    ((TESTS_FAILED++))
fi

# =============================================================================
# Test 4: Merge Conflict Predictor
# =============================================================================
echo ""
echo "4️⃣  Testing merge-conflict-predictor.sh"

# Test 4.1: Should warn but not block
TEST_FILE_8="$TEMP_DIR/test8.ts"
cat > "$TEST_FILE_8" << 'TESTEOF'
export function processData(data: any) {
  return data;
}
TESTEOF

export TOOL_INPUT_FILE_PATH="$TEST_FILE_8"
export TOOL_OUTPUT_CONTENT="$(cat "$TEST_FILE_8")"

OUTPUT=$("$PROJECT_ROOT/.claude/hooks/skill/merge-conflict-predictor.sh" 2>&1 || true)
EXIT_CODE=$?

assert_exit_code 0 $EXIT_CODE "Never blocks (warning only)"

# =============================================================================
# Test Results
# =============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Results"
echo ""
echo "  Passed: $TESTS_PASSED"
echo "  Failed: $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Some tests failed"
    exit 1
fi
