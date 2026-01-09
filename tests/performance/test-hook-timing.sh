#!/usr/bin/env bash
# ============================================================================
# Hook Timing Performance Test
# ============================================================================
# Verifies that all hooks execute within acceptable time limits.
# This ensures hooks don't introduce noticeable latency to Claude Code.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
HOOKS_DIR="$PROJECT_ROOT/.claude/hooks"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; ((PASS_COUNT++)) || true; }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL_COUNT++)) || true; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; ((WARN_COUNT++)) || true; }
info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

# Timing thresholds (milliseconds)
HOOK_LATENCY_TARGET=50      # Individual hook should complete in <50ms
DISPATCHER_TARGET=100       # Full dispatcher chain should complete in <100ms
LIFECYCLE_TARGET=200        # Lifecycle hooks can be slower (session start/end)

# Cross-platform millisecond timer
get_time_ms() {
    if command -v gdate &>/dev/null; then
        gdate +%s%3N
    elif date --version 2>/dev/null | grep -q GNU; then
        date +%s%3N
    else
        # macOS fallback: use Python
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
echo "  Hook Timing Performance Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Latency Targets:"
echo "  - Individual hook: <${HOOK_LATENCY_TARGET}ms"
echo "  - Dispatcher chain: <${DISPATCHER_TARGET}ms"
echo "  - Lifecycle hooks: <${LIFECYCLE_TARGET}ms"
echo ""

# ============================================================================
# Test 1: PreToolUse Hook Latency
# ============================================================================
echo "▶ Test 1: PreToolUse Hook Latency"
echo "────────────────────────────────────────"

# Test bash dispatcher
if [[ -f "$HOOKS_DIR/pretool/bash-dispatcher.sh" ]]; then
    test_input='{"tool_name":"Bash","tool_input":{"command":"echo test"}}'
    duration=$(time_command bash -c "echo '$test_input' | '$HOOKS_DIR/pretool/bash-dispatcher.sh'")

    if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
        pass "bash-dispatcher: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
    elif [[ "$duration" -lt "$DISPATCHER_TARGET" ]]; then
        warn "bash-dispatcher: ${duration}ms (acceptable but >target)"
    else
        fail "bash-dispatcher: ${duration}ms (exceeds ${DISPATCHER_TARGET}ms)"
    fi
else
    info "bash-dispatcher not found (skipping)"
fi

# Test write dispatcher
if [[ -f "$HOOKS_DIR/pretool/write-dispatcher.sh" ]]; then
    test_input='{"tool_name":"Write","tool_input":{"file_path":"/tmp/test.txt","content":"test"}}'
    duration=$(time_command bash -c "echo '$test_input' | '$HOOKS_DIR/pretool/write-dispatcher.sh'")

    if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
        pass "write-dispatcher: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
    elif [[ "$duration" -lt "$DISPATCHER_TARGET" ]]; then
        warn "write-dispatcher: ${duration}ms (acceptable but >target)"
    else
        fail "write-dispatcher: ${duration}ms (exceeds ${DISPATCHER_TARGET}ms)"
    fi
else
    info "write-dispatcher not found (skipping)"
fi

# Test path normalizer
if [[ -f "$HOOKS_DIR/pretool/read/path-normalizer.sh" ]]; then
    test_input='{"tool_name":"Read","tool_input":{"file_path":"./test.txt"}}'
    duration=$(time_command bash -c "echo '$test_input' | '$HOOKS_DIR/pretool/read/path-normalizer.sh'")

    if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
        pass "path-normalizer: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
    else
        warn "path-normalizer: ${duration}ms (>target)"
    fi
else
    info "path-normalizer not found (skipping)"
fi

echo ""

# ============================================================================
# Test 2: PostToolUse Hook Latency
# ============================================================================
echo "▶ Test 2: PostToolUse Hook Latency"
echo "────────────────────────────────────────"

# Test posttool dispatcher
if [[ -f "$HOOKS_DIR/posttool/dispatcher.sh" ]]; then
    test_input='{"tool_name":"Bash","tool_input":{"command":"echo test"},"tool_result":"test"}'
    duration=$(time_command bash -c "echo '$test_input' | '$HOOKS_DIR/posttool/dispatcher.sh'")

    if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
        pass "posttool-dispatcher: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
    elif [[ "$duration" -lt "$DISPATCHER_TARGET" ]]; then
        warn "posttool-dispatcher: ${duration}ms (acceptable but >target)"
    else
        fail "posttool-dispatcher: ${duration}ms (exceeds ${DISPATCHER_TARGET}ms)"
    fi
else
    info "posttool dispatcher not found (skipping)"
fi

# Test audit logger
if [[ -f "$HOOKS_DIR/posttool/audit/audit-logger.sh" ]]; then
    test_input='{"tool_name":"Read","tool_input":{"file_path":"/tmp/test"},"tool_result":"content"}'
    duration=$(time_command bash -c "echo '$test_input' | '$HOOKS_DIR/posttool/audit/audit-logger.sh'")

    if [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
        pass "audit-logger: ${duration}ms (<${HOOK_LATENCY_TARGET}ms)"
    else
        warn "audit-logger: ${duration}ms (>target)"
    fi
else
    info "audit-logger not found (skipping)"
fi

echo ""

# ============================================================================
# Test 3: Lifecycle Hook Latency
# ============================================================================
echo "▶ Test 3: Lifecycle Hook Latency"
echo "────────────────────────────────────────"

# Test session start hooks
if [[ -f "$HOOKS_DIR/lifecycle/session-start/context-loader.sh" ]]; then
    duration=$(time_command bash "$HOOKS_DIR/lifecycle/session-start/context-loader.sh")

    if [[ "$duration" -lt "$LIFECYCLE_TARGET" ]]; then
        pass "context-loader: ${duration}ms (<${LIFECYCLE_TARGET}ms)"
    else
        warn "context-loader: ${duration}ms (>target)"
    fi
else
    info "context-loader not found (skipping)"
fi

# Test stop hooks
if [[ -f "$HOOKS_DIR/stop/auto-save-context.sh" ]]; then
    duration=$(time_command bash "$HOOKS_DIR/stop/auto-save-context.sh")

    if [[ "$duration" -lt "$LIFECYCLE_TARGET" ]]; then
        pass "auto-save-context: ${duration}ms (<${LIFECYCLE_TARGET}ms)"
    else
        warn "auto-save-context: ${duration}ms (>target)"
    fi
else
    info "auto-save-context not found (skipping)"
fi

echo ""

# ============================================================================
# Test 4: Permission Hook Latency
# ============================================================================
echo "▶ Test 4: Permission Hook Latency"
echo "────────────────────────────────────────"

# Test auto-approve hooks (should be very fast)
if [[ -f "$HOOKS_DIR/permission/auto-approve-readonly.sh" ]]; then
    test_input='{"tool_name":"Read","tool_input":{"file_path":"/tmp/test.txt"}}'
    duration=$(time_command bash -c "echo '$test_input' | '$HOOKS_DIR/permission/auto-approve-readonly.sh'")

    if [[ "$duration" -lt 30 ]]; then
        pass "auto-approve-readonly: ${duration}ms (<30ms)"
    elif [[ "$duration" -lt "$HOOK_LATENCY_TARGET" ]]; then
        warn "auto-approve-readonly: ${duration}ms (slower than expected)"
    else
        fail "auto-approve-readonly: ${duration}ms (too slow)"
    fi
else
    info "auto-approve-readonly not found (skipping)"
fi

echo ""

# ============================================================================
# Test 5: Aggregate Timing Statistics
# ============================================================================
echo "▶ Test 5: Aggregate Timing Statistics"
echo "────────────────────────────────────────"

# Count all hook scripts
total_hooks=$(find "$HOOKS_DIR" -name "*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')
info "Total hook scripts: $total_hooks"

# Calculate rough overhead per tool call
# Typical tool call invokes: pretool + posttool dispatchers
estimated_overhead=$((HOOK_LATENCY_TARGET * 2))
info "Estimated hook overhead per tool call: ~${estimated_overhead}ms (2 dispatchers)"

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