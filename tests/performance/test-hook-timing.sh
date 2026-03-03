#!/usr/bin/env bash
# ============================================================================
# Hook Timing Performance Test
# ============================================================================
# Verifies that TypeScript hooks execute within acceptable time limits.
# All hooks are now TypeScript, executed via run-hook.mjs.
# CC 2.1.34 Compliant
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
HOOKS_DIR="$PROJECT_ROOT/src/hooks"
HOOKS_BIN="$HOOKS_DIR/bin/run-hook.mjs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARN_COUNT=$((WARN_COUNT + 1)); }
info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

# Timing thresholds (milliseconds)
HOOK_LATENCY_TARGET=300     # Individual TS hook via run-hook.mjs (includes Node startup ~100-200ms)
DISPATCHER_TARGET=500       # Full dispatcher chain (Node startup + dispatch overhead)
LIFECYCLE_TARGET=500        # Lifecycle hooks (more I/O)

# Cross-platform millisecond timer
get_time_ms() {
    if command -v gdate &>/dev/null; then
        gdate +%s%3N
    elif date --version 2>/dev/null | grep -q GNU; then
        date +%s%3N
    else
        python3 -c 'import time; print(int(time.time() * 1000))' 2>/dev/null || echo 0
    fi
}

# Time a command execution
time_command() {
    local start_time end_time duration
    start_time=$(get_time_ms)
    "$@" >/dev/null 2>&1 || true
    end_time=$(get_time_ms)
    duration=$((end_time - start_time))
    echo "$duration"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Hook Timing Performance Tests (TypeScript via run-hook.mjs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Latency Targets (includes Node.js startup ~100ms):"
echo "  - Individual hook: <${HOOK_LATENCY_TARGET}ms"
echo "  - Dispatcher chain: <${DISPATCHER_TARGET}ms"
echo "  - Lifecycle hooks: <${LIFECYCLE_TARGET}ms"
echo ""

# Check run-hook.mjs exists
if [[ ! -f "$HOOKS_BIN" ]]; then
    echo -e "  ${RED}✗ run-hook.mjs not found at $HOOKS_BIN${NC}"
    echo "  Skipping all timing tests."
    exit 0
fi

# ============================================================================
# Test 1: PreToolUse Hook Latency
# ============================================================================
echo "▶ Test 1: PreToolUse Hook Latency"
echo "────────────────────────────────────────"

# Test dangerous-command-blocker (security-critical, must be fast)
test_input='{"tool_name":"Bash","tool_input":{"command":"echo test"}}'
duration=$(time_command bash -c "echo '$test_input' | node '$HOOKS_BIN' pretool/bash/dangerous-command-blocker")

if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
    pass "dangerous-command-blocker: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
elif [[ "$duration" -lt "$DISPATCHER_TARGET" ]]; then
    warn "dangerous-command-blocker: ${duration}ms (acceptable but >target)"
else
    fail "dangerous-command-blocker: ${duration}ms (exceeds ${DISPATCHER_TARGET}ms)"
fi

# Test file-guard (security guard)
test_input='{"tool_name":"Write","tool_input":{"file_path":"/tmp/test.txt","content":"test"}}'
duration=$(time_command bash -c "echo '$test_input' | node '$HOOKS_BIN' pretool/write-edit/file-guard")

if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
    pass "file-guard: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
elif [[ "$duration" -lt "$DISPATCHER_TARGET" ]]; then
    warn "file-guard: ${duration}ms (acceptable but >target)"
else
    fail "file-guard: ${duration}ms (exceeds ${DISPATCHER_TARGET}ms)"
fi

# Test tldr-summary (Read hook)
test_input='{"tool_name":"Read","tool_input":{"file_path":"/tmp/test.txt"}}'
duration=$(time_command bash -c "echo '$test_input' | node '$HOOKS_BIN' pretool/read/tldr-summary")

if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
    pass "tldr-summary: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
elif [[ "$duration" -lt "$DISPATCHER_TARGET" ]]; then
    warn "tldr-summary: ${duration}ms (acceptable but >target)"
else
    fail "tldr-summary: ${duration}ms (exceeds ${DISPATCHER_TARGET}ms)"
fi

echo ""

# ============================================================================
# Test 2: PostToolUse Hook Latency
# ============================================================================
echo "▶ Test 2: PostToolUse Hook Latency"
echo "────────────────────────────────────────"

# Test unified-error-handler (replaced context-budget-monitor — removed in dead code cleanup)
test_input='{"tool_name":"Bash","tool_input":{"command":"echo test"},"tool_result":"test"}'
duration=$(time_command bash -c "echo '$test_input' | node '$HOOKS_BIN' posttool/unified-error-handler")

if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
    pass "unified-error-handler: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
elif [[ "$duration" -lt "$DISPATCHER_TARGET" ]]; then
    warn "unified-error-handler: ${duration}ms (acceptable but >target)"
else
    fail "unified-error-handler: ${duration}ms (exceeds ${DISPATCHER_TARGET}ms)"
fi

# Test unified-error-handler
test_input='{"tool_name":"Bash","tool_input":{"command":"echo test"},"tool_result":"test"}'
duration=$(time_command bash -c "echo '$test_input' | node '$HOOKS_BIN' posttool/unified-error-handler")

if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
    pass "unified-error-handler: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
elif [[ "$duration" -lt "$DISPATCHER_TARGET" ]]; then
    warn "unified-error-handler: ${duration}ms (acceptable but >target)"
else
    fail "unified-error-handler: ${duration}ms (exceeds ${DISPATCHER_TARGET}ms)"
fi

echo ""

# ============================================================================
# Test 3: Permission Hook Latency
# ============================================================================
echo "▶ Test 3: Permission Hook Latency"
echo "────────────────────────────────────────"

# Test auto-approve-safe-bash
test_input='{"tool_name":"Bash","tool_input":{"command":"echo hello"}}'
duration=$(time_command bash -c "echo '$test_input' | node '$HOOKS_BIN' permission/auto-approve-safe-bash")

if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
    pass "auto-approve-safe-bash: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
elif [[ "$duration" -lt "$DISPATCHER_TARGET" ]]; then
    warn "auto-approve-safe-bash: ${duration}ms (acceptable but >target)"
else
    fail "auto-approve-safe-bash: ${duration}ms (exceeds ${DISPATCHER_TARGET}ms)"
fi

# Test auto-approve-project-writes
test_input='{"tool_name":"Write","tool_input":{"file_path":"/tmp/test.txt"}}'
duration=$(time_command bash -c "echo '$test_input' | node '$HOOKS_BIN' permission/auto-approve-project-writes")

if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
    pass "auto-approve-project-writes: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
elif [[ "$duration" -lt "$DISPATCHER_TARGET" ]]; then
    warn "auto-approve-project-writes: ${duration}ms (acceptable but >target)"
else
    fail "auto-approve-project-writes: ${duration}ms (exceeds ${DISPATCHER_TARGET}ms)"
fi

echo ""

# ============================================================================
# Test 4: Aggregate Timing Statistics
# ============================================================================
echo "▶ Test 4: Aggregate Timing Statistics"
echo "────────────────────────────────────────"

# Count all TypeScript hook source files
total_ts_hooks=$(find "$HOOKS_DIR/src" -name "*.ts" -not -name "*.d.ts" -not -name "types.ts" -not -name "index.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
info "Total TypeScript hook source files: $total_ts_hooks"

# Count hooks.json entries
hooks_json_entries=$(python3 -c "
import json, sys
with open('$HOOKS_DIR/hooks.json') as f:
    data = json.load(f)
count = 0
for event_type, entries in data.get('hooks', {}).items():
    for entry in entries:
        hooks = entry.get('hooks', [])
        count += len(hooks)
print(count)
" 2>/dev/null || echo "?")
info "Total hooks.json entries: $hooks_json_entries"

# Count built bundles
total_bundles=$(find "$HOOKS_DIR/dist" -name "*.mjs" -type f 2>/dev/null | wc -l | tr -d ' ')
info "Built bundles: $total_bundles"

pass "Timing statistics collected"

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed, $WARN_COUNT warnings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Exit with failure only if there were actual failures
if [[ $FAIL_COUNT -gt 0 ]]; then
    exit 1
fi

exit 0
