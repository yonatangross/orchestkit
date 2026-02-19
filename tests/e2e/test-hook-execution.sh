#!/usr/bin/env bash
# ============================================================================
# Hook Execution E2E Test
# ============================================================================
# Verifies that the unified hook dispatchers actually fire when called:
#   - posttool/unified-dispatcher (PostToolUse)
#   - subagent-stop/unified-dispatcher (SubagentStop)
#   - prompt/unified-dispatcher (UserPromptSubmit)
#
# Strategy: delegates to the vitest test file
#   src/hooks/src/__tests__/e2e/hook-execution-e2e.test.ts
# which imports and calls each dispatcher with minimal valid HookInput.
# VITEST=1 is set automatically by vitest, preventing real analytics I/O.
#
# Issue #748
# ============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
HOOKS_SRC="$PROJECT_ROOT/src/hooks"
TEST_FILE="$HOOKS_SRC/src/__tests__/e2e/hook-execution-e2e.test.ts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Hook Execution E2E Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# Preconditions
# ============================================================================
echo "▶ Preconditions"
echo "────────────────────────────────────────"

if [ ! -d "$HOOKS_SRC" ]; then
    fail "src/hooks directory not found at $HOOKS_SRC"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi
pass "src/hooks directory found"

if [ ! -d "$HOOKS_SRC/node_modules" ]; then
    fail "node_modules not installed — run: cd src/hooks && npm install"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi
pass "node_modules installed"

if [ ! -f "$TEST_FILE" ]; then
    fail "vitest test file not found: $TEST_FILE"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi
pass "vitest test file found"

echo ""

# ============================================================================
# Test 1: Run all hook execution tests via vitest
# ============================================================================
echo "▶ Test 1: Unified Dispatcher Execution (vitest)"
echo "────────────────────────────────────────"
info "Running: vitest run hook-execution-e2e --reporter=verbose"
echo ""

VITEST_BIN="$HOOKS_SRC/node_modules/.bin/vitest"

# Detect node architecture mismatch (same guard as run-all-tests.sh)
NODE_ARCH=$(node -p "process.arch" 2>/dev/null || echo "unknown")
HAS_ARM64="false"
HAS_X64="false"
[ -d "$HOOKS_SRC/node_modules/@rollup/rollup-darwin-arm64" ] && HAS_ARM64="true"
[ -d "$HOOKS_SRC/node_modules/@rollup/rollup-darwin-x64" ] && HAS_X64="true"

ARCH_MISMATCH="false"
if [[ "$NODE_ARCH" == "arm64" && "$HAS_ARM64" != "true" ]]; then
    ARCH_MISMATCH="true"
elif [[ "$NODE_ARCH" == "x64" && "$HAS_X64" != "true" ]]; then
    ARCH_MISMATCH="true"
fi

if [ "$ARCH_MISMATCH" = "true" ]; then
    echo -e "  ${YELLOW}SKIP: node arch ($NODE_ARCH) mismatches installed rollup native modules${NC}"
    echo -e "  ${YELLOW}      Fix: cd src/hooks && rm -rf node_modules && npm install${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed (1 skipped)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
fi

VITEST_OUTPUT=""
VITEST_EXIT=0
VITEST_OUTPUT=$(cd "$HOOKS_SRC" && "$VITEST_BIN" run "hook-execution-e2e" --reporter=verbose 2>&1) || VITEST_EXIT=$?

# Show vitest output
echo "$VITEST_OUTPUT"
echo ""

if [ $VITEST_EXIT -eq 0 ]; then
    # Parse counts from vitest output
    VITEST_PASSED=$(echo "$VITEST_OUTPUT" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | tail -1 || echo "?")
    pass "All dispatcher execution tests passed ($VITEST_PASSED tests)"
else
    VITEST_FAILED=$(echo "$VITEST_OUTPUT" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | tail -1 || echo "?")
    fail "Dispatcher execution tests failed ($VITEST_FAILED failures)"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi

exit 0
