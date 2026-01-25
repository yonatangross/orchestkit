#!/bin/bash
# Async Hooks Unit Tests
# Tests async hook configuration in hooks.json
#
# Usage: ./test-async-hooks.sh
# Exit codes: 0 = pass, 1 = fail

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_JSON="$PROJECT_ROOT/src/hooks/hooks.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

FAILED=0
PASSED=0

echo "=========================================="
echo "  Async Hooks Unit Tests"
echo "=========================================="
echo ""

# Test 1: Check hooks.json exists
echo -n "  hooks.json exists... "
if [[ -f "$HOOKS_JSON" ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
    exit 1
fi

# Test 2: Count async hooks
echo -n "  Async hooks count >= 31... "
ASYNC_COUNT=$(jq '[.. | objects | select(.async == true)] | length' "$HOOKS_JSON")
if [[ $ASYNC_COUNT -ge 31 ]]; then
    echo -e "${GREEN}PASS${NC} ($ASYNC_COUNT async hooks)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (only $ASYNC_COUNT async hooks, expected >= 31)"
    FAILED=$((FAILED + 1))
fi

# Test 3: All async hooks have timeout
echo -n "  All async hooks have timeout... "
ASYNC_WITHOUT_TIMEOUT=$(jq '[.. | objects | select(.async == true and .timeout == null)] | length' "$HOOKS_JSON")
if [[ $ASYNC_WITHOUT_TIMEOUT -eq 0 ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} ($ASYNC_WITHOUT_TIMEOUT async hooks without timeout)"
    FAILED=$((FAILED + 1))
fi

# Test 4: PreToolUse hooks are NOT async
echo -n "  PreToolUse hooks are NOT async... "
PRETOOL_ASYNC=$(jq '.hooks.PreToolUse[]?.hooks[]? | select(.async == true) | .command' "$HOOKS_JSON" | wc -l)
if [[ $PRETOOL_ASYNC -eq 0 ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} ($PRETOOL_ASYNC PreToolUse hooks have async: true)"
    FAILED=$((FAILED + 1))
fi

# Test 5: PermissionRequest hooks are NOT async
echo -n "  PermissionRequest hooks are NOT async... "
PERMISSION_ASYNC=$(jq '.hooks.PermissionRequest[]?.hooks[]? | select(.async == true) | .command' "$HOOKS_JSON" | wc -l)
if [[ $PERMISSION_ASYNC -eq 0 ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} ($PERMISSION_ASYNC PermissionRequest hooks have async: true)"
    FAILED=$((FAILED + 1))
fi

# Test 6: Notification hooks have short timeout
echo -n "  Notification hooks have 10s timeout... "
NOTIFICATION_TIMEOUT=$(jq '.hooks.Notification[]?.hooks[]? | select(.async == true) | .timeout' "$HOOKS_JSON" | head -1)
if [[ "$NOTIFICATION_TIMEOUT" == "10" ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (timeout is $NOTIFICATION_TIMEOUT, expected 10)"
    FAILED=$((FAILED + 1))
fi

# Test 7: SessionStart async hooks exist
echo -n "  SessionStart has async hooks... "
SESSIONSTART_ASYNC=$(jq '[.hooks.SessionStart[]?.hooks[]? | select(.async == true)] | length' "$HOOKS_JSON")
if [[ $SESSIONSTART_ASYNC -ge 7 ]]; then
    echo -e "${GREEN}PASS${NC} ($SESSIONSTART_ASYNC async hooks)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (only $SESSIONSTART_ASYNC, expected >= 7)"
    FAILED=$((FAILED + 1))
fi

# Test 8: PostToolUse async hooks exist
echo -n "  PostToolUse has async hooks... "
POSTTOOL_ASYNC=$(jq '[.hooks.PostToolUse[]?.hooks[]? | select(.async == true)] | length' "$HOOKS_JSON")
if [[ $POSTTOOL_ASYNC -ge 13 ]]; then
    echo -e "${GREEN}PASS${NC} ($POSTTOOL_ASYNC async hooks)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (only $POSTTOOL_ASYNC, expected >= 13)"
    FAILED=$((FAILED + 1))
fi

# Test 9: issue-work-summary has 60s timeout
echo -n "  issue-work-summary has 60s timeout... "
ISSUE_TIMEOUT=$(jq '.hooks.Stop[]?.hooks[]? | select(.command | contains("issue-work-summary")) | .timeout' "$HOOKS_JSON")
if [[ "$ISSUE_TIMEOUT" == "60" ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (timeout is $ISSUE_TIMEOUT, expected 60)"
    FAILED=$((FAILED + 1))
fi

# Test 10: Valid JSON structure
echo -n "  hooks.json is valid JSON... "
if jq empty "$HOOKS_JSON" 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "=========================================="
echo "  Results: $PASSED passed, $FAILED failed"
echo "=========================================="

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED: Some async hook tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All async hook tests passed${NC}"
    exit 0
fi
