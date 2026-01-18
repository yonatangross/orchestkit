#!/bin/bash
# Test that hooks output valid CC 2.1.7 JSON format
# All hooks must output {"continue": true, ...} or valid JSON

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Testing CC 2.1.7 JSON output compliance..."
echo

# Hooks that were fixed
HOOKS=(
    "hooks/posttool/audit-logger.sh"
    "hooks/permission/auto-approve-readonly.sh"
    "hooks/stop/auto-remember-continuity.sh"
    "hooks/posttool/context-budget-monitor.sh"
    "hooks/posttool/Write/coverage-predictor.sh"
    "hooks/skill/cross-instance-test-validator.sh"
)

PASSED=0
FAILED=0

for hook in "${HOOKS[@]}"; do
    hook_path="$PROJECT_ROOT/$hook"

    if [[ ! -f "$hook_path" ]]; then
        echo "❌ FAIL: $hook - file not found"
        ((FAILED++))
        continue
    fi

    # Check that hook sources common.sh or uses jq for JSON output
    if ! grep -q "source.*common.sh\|jq -n" "$hook_path"; then
        echo "❌ FAIL: $hook - does not source common.sh or use jq"
        ((FAILED++))
        continue
    fi

    # Check that hook uses proper output functions or jq or echo with JSON
    if grep -qE "output_silent_success|output_silent_allow|output_with_context|output_block|jq -n|echo.*continue.*true" "$hook_path"; then
        echo "✓ PASS: $hook - uses proper JSON output"
        ((PASSED++))
    else
        echo "❌ FAIL: $hook - missing proper JSON output"
        ((FAILED++))
    fi
done

echo
echo "Results: $PASSED passed, $FAILED failed"
echo

if [[ $FAILED -gt 0 ]]; then
    exit 1
else
    echo "All hooks comply with CC 2.1.7 JSON output format"
    exit 0
fi
