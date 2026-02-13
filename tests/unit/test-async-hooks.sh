#!/bin/bash
# Async Hooks Unit Tests
# Tests async hook configuration in hooks.json
#
# Updated for unified dispatcher architecture (PR #236, #239):
# - Individual async hooks are now consolidated into unified dispatchers
# - SessionStart, PostToolUse, Setup use async dispatchers
# - Dispatchers internally route to multiple hooks via Promise.allSettled
# - Async behavior is indicated by run-hook-silent.mjs or *-fire-and-forget.mjs runners
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
echo "  (Unified Dispatcher Architecture)"
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

# Test 2: Count async hooks (identified by run-hook-silent.mjs or *-fire-and-forget.mjs)
# With dispatcher architecture: ~5-10 async entries (dispatchers, not individual hooks)
echo -n "  Async dispatchers exist (>= 5)... "
ASYNC_COUNT=$(jq '[.. | strings | select(test("run-hook-silent\\.mjs|fire-and-forget\\.mjs"))] | length' "$HOOKS_JSON")
if [[ $ASYNC_COUNT -ge 5 ]]; then
    echo -e "${GREEN}PASS${NC} ($ASYNC_COUNT async dispatchers)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (only $ASYNC_COUNT async dispatchers, expected >= 5)"
    FAILED=$((FAILED + 1))
fi

# Test 3: All async hooks use silent/fire-and-forget runners (no timeout needed since they're fire-and-forget)
echo -n "  Async hooks use fire-and-forget runners... "
ASYNC_RUNNERS=$(jq '[.. | strings | select(test("run-hook-silent\\.mjs|fire-and-forget\\.mjs"))] | length' "$HOOKS_JSON")
if [[ $ASYNC_RUNNERS -ge 1 ]]; then
    echo -e "${GREEN}PASS${NC} ($ASYNC_RUNNERS fire-and-forget runners)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (no fire-and-forget runners found)"
    FAILED=$((FAILED + 1))
fi

# Test 4: PreToolUse hooks are NOT async (critical path) - no silent/fire-and-forget runners
echo -n "  PreToolUse hooks are NOT async... "
PRETOOL_ASYNC=$(jq '[.hooks.PreToolUse[]?.hooks[]?.command // empty | select(test("run-hook-silent\\.mjs|fire-and-forget\\.mjs"))] | length' "$HOOKS_JSON")
if [[ $PRETOOL_ASYNC -eq 0 ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} ($PRETOOL_ASYNC PreToolUse hooks use async runners)"
    FAILED=$((FAILED + 1))
fi

# Test 5: PermissionRequest hooks are NOT async (critical path)
echo -n "  PermissionRequest hooks are NOT async... "
PERMISSION_ASYNC=$(jq '[.hooks.PermissionRequest[]?.hooks[]?.command // empty | select(test("run-hook-silent\\.mjs|fire-and-forget\\.mjs"))] | length' "$HOOKS_JSON")
if [[ $PERMISSION_ASYNC -eq 0 ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} ($PERMISSION_ASYNC PermissionRequest hooks use async runners)"
    FAILED=$((FAILED + 1))
fi

# Test 6: SessionStart has unified dispatcher (async via run-hook-silent.mjs)
echo -n "  SessionStart has async dispatcher... "
SESSIONSTART_ASYNC=$(jq '[.hooks.SessionStart[]?.hooks[]?.command | select(test("run-hook-silent\\.mjs|fire-and-forget\\.mjs"))] | length' "$HOOKS_JSON")
if [[ $SESSIONSTART_ASYNC -ge 1 ]]; then
    echo -e "${GREEN}PASS${NC} ($SESSIONSTART_ASYNC async dispatcher)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (no async dispatcher in SessionStart)"
    FAILED=$((FAILED + 1))
fi

# Test 7: PostToolUse has unified dispatcher (async via run-hook-silent.mjs)
echo -n "  PostToolUse has async dispatcher... "
POSTTOOL_ASYNC=$(jq '[.hooks.PostToolUse[]?.hooks[]?.command | select(test("run-hook-silent\\.mjs|fire-and-forget\\.mjs"))] | length' "$HOOKS_JSON")
if [[ $POSTTOOL_ASYNC -ge 1 ]]; then
    echo -e "${GREEN}PASS${NC} ($POSTTOOL_ASYNC async dispatcher)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (no async dispatcher in PostToolUse)"
    FAILED=$((FAILED + 1))
fi

# Test 8: Setup has unified dispatcher (async via run-hook-silent.mjs) - Issue #239
echo -n "  Setup has async dispatcher... "
SETUP_ASYNC=$(jq '[.hooks.Setup[]?.hooks[]?.command | select(test("run-hook-silent\\.mjs|fire-and-forget\\.mjs"))] | length' "$HOOKS_JSON")
if [[ $SETUP_ASYNC -ge 1 ]]; then
    echo -e "${GREEN}PASS${NC} ($SETUP_ASYNC async dispatcher)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (no async dispatcher in Setup)"
    FAILED=$((FAILED + 1))
fi

# Test 9: Setup dispatcher references unified-dispatcher
echo -n "  Setup uses unified-dispatcher... "
SETUP_UNIFIED=$(jq '[.hooks.Setup[]?.hooks[]?.command | select(contains("setup/unified-dispatcher"))] | length' "$HOOKS_JSON")
if [[ $SETUP_UNIFIED -ge 1 ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (Setup doesn't use unified-dispatcher)"
    FAILED=$((FAILED + 1))
fi

# Test 10: SessionStart dispatcher references unified-dispatcher
echo -n "  SessionStart uses unified-dispatcher... "
SESSIONSTART_UNIFIED=$(jq '[.hooks.SessionStart[]?.hooks[]?.command | select(contains("lifecycle/unified-dispatcher"))] | length' "$HOOKS_JSON")
if [[ $SESSIONSTART_UNIFIED -ge 1 ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (SessionStart doesn't use unified-dispatcher)"
    FAILED=$((FAILED + 1))
fi

# Test 11: PostToolUse dispatcher references unified-dispatcher
echo -n "  PostToolUse uses unified-dispatcher... "
POSTTOOL_UNIFIED=$(jq '[.hooks.PostToolUse[]?.hooks[]?.command | select(contains("posttool/unified-dispatcher"))] | length' "$HOOKS_JSON")
if [[ $POSTTOOL_UNIFIED -ge 1 ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (PostToolUse doesn't use unified-dispatcher)"
    FAILED=$((FAILED + 1))
fi

# Test 12: Valid JSON structure
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
