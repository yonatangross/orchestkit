#!/bin/bash
# test-mem0-performance.sh - Performance benchmark tests for Mem0 hooks and scripts
# Part of OrchestKit Claude Plugin comprehensive test suite
#
# Measures execution latency and throughput of hooks and scripts to establish
# performance baselines. These are smoke tests for performance regression,
# not micro-benchmarks. If a hook takes >2s, something is wrong.
#
# Timing uses python3 for portable millisecond resolution (macOS date lacks %N).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

HOOK_RUNNER="$PROJECT_ROOT/src/hooks/bin/run-hook.mjs"
SCRIPTS_DIR="$PROJECT_ROOT/src/skills/mem0-memory/scripts/crud"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# =============================================================================
# Test Helper Functions
# =============================================================================

test_start() {
    local name="$1"
    echo -n "  o $name... "
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_pass() {
    echo -e "\033[0;32mPASS\033[0m"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    local reason="${1:-}"
    echo -e "\033[0;31mFAIL\033[0m"
    [[ -n "$reason" ]] && echo "    |-- $reason"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

test_skip() {
    local reason="${1:-}"
    echo -e "\033[0;33mSKIP\033[0m"
    [[ -n "$reason" ]] && echo "    |-- $reason"
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

# Portable millisecond timestamp via python3
now_ms() {
    python3 -c "import time; print(int(time.time()*1000))"
}

# Measure execution time of a command in milliseconds.
# Usage: measure_ms <command> [args...]
# Captures stdout/stderr to /dev/null, returns elapsed ms on stdout.
measure_ms() {
    local start_ms
    start_ms=$(now_ms)
    "$@" >/dev/null 2>&1
    local end_ms
    end_ms=$(now_ms)
    echo $((end_ms - start_ms))
}

# Run a command N times, compute the average duration in ms.
# Usage: average_ms <iterations> <command> [args...]
# Prints the average ms to stdout.
average_ms() {
    local iterations="$1"
    shift
    local total=0
    for ((i = 1; i <= iterations; i++)); do
        local elapsed
        elapsed=$(measure_ms "$@")
        total=$((total + elapsed))
    done
    echo $((total / iterations))
}

# Portable timeout: use timeout (Linux) or gtimeout (macOS/coreutils), else fallback
TIMEOUT_CMD=""
if command -v timeout &>/dev/null; then
    TIMEOUT_CMD="timeout"
elif command -v gtimeout &>/dev/null; then
    TIMEOUT_CMD="gtimeout"
fi

# Run a hook with JSON input on stdin.
# Usage: run_hook_timed <hook-name> <json-input>
# Pipes json_input to the hook runner under a 30s timeout.
run_hook_timed() {
    local hook_name="$1"
    local json_input="$2"
    if [[ -n "$TIMEOUT_CMD" ]]; then
        echo "$json_input" | $TIMEOUT_CMD 30 node "$HOOK_RUNNER" "$hook_name" >/dev/null 2>&1
    else
        echo "$json_input" | node "$HOOK_RUNNER" "$hook_name" >/dev/null 2>&1
    fi
}

echo "============================================================================"
echo " Mem0 Performance Benchmark Tests"
echo "============================================================================"
echo ""

# =============================================================================
# Prerequisite Checks
# =============================================================================

if ! command -v node &>/dev/null; then
    echo "ERROR: node is not installed. Cannot run performance tests."
    exit 1
fi

if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 is not installed. Cannot measure timing."
    exit 1
fi

# =============================================================================
# Hook Latency Tests
# =============================================================================

# -----------------------------------------------------------------------------
# test_hook_runner_cold_start_latency
# Measure time to run node run-hook.mjs with no hook name (startup + exit).
# Should complete in <3000ms. Run 3 times, report average.
# -----------------------------------------------------------------------------
test_hook_runner_cold_start_latency() {
    test_start "hook runner cold start latency (<3000ms avg over 3 runs)"

    if [[ ! -f "$HOOK_RUNNER" ]]; then
        test_skip "run-hook.mjs not found"
        return
    fi

    local threshold=3000
    local avg_ms
    avg_ms=$(average_ms 3 node "$HOOK_RUNNER")

    echo ""
    echo "    |-- ${avg_ms}ms (threshold: ${threshold}ms)"

    if [[ $avg_ms -lt $threshold ]]; then
        test_pass
    else
        test_fail "Average ${avg_ms}ms exceeds threshold ${threshold}ms"
    fi
}

# -----------------------------------------------------------------------------
# test_memory_context_hook_latency
# Pipe a UserPromptSubmit input to memory-context hook.
# Should complete in <2000ms. Run 3 times, report average.
# -----------------------------------------------------------------------------
test_memory_context_hook_latency() {
    test_start "memory-context hook latency (<2000ms avg over 3 runs)"

    if [[ ! -f "$HOOK_RUNNER" ]]; then
        test_skip "run-hook.mjs not found"
        return
    fi

    local threshold=2000
    local input='{"hook_event":"UserPromptSubmit","prompt":"implement a new feature for the authentication system","tool_name":"","tool_input":{},"session_id":"perf-test-001","project_dir":"/tmp/perf-test"}'

    local total=0
    for ((i = 1; i <= 3; i++)); do
        local elapsed
        elapsed=$(measure_ms run_hook_timed "prompt/memory-context" "$input")
        total=$((total + elapsed))
    done
    local avg_ms=$((total / 3))

    echo ""
    echo "    |-- ${avg_ms}ms (threshold: ${threshold}ms)"

    if [[ $avg_ms -lt $threshold ]]; then
        test_pass
    else
        test_fail "Average ${avg_ms}ms exceeds threshold ${threshold}ms"
    fi
}

# -----------------------------------------------------------------------------
# test_memory_validator_hook_latency
# Pipe a PreToolUse input for memory validation.
# Should complete in <1000ms. Run 3 times, report average.
# -----------------------------------------------------------------------------
test_memory_validator_hook_latency() {
    test_start "memory-validator hook latency (<1000ms avg over 3 runs)"

    if [[ ! -f "$HOOK_RUNNER" ]]; then
        test_skip "run-hook.mjs not found"
        return
    fi

    local threshold=1000
    local input='{"hook_event":"PreToolUse","tool_name":"mcp__memory__search_nodes","tool_input":{"query":"database patterns"},"session_id":"perf-test-002","project_dir":"/tmp/perf-test"}'

    local total=0
    for ((i = 1; i <= 3; i++)); do
        local elapsed
        elapsed=$(measure_ms run_hook_timed "pretool/mcp/memory-validator" "$input")
        total=$((total + elapsed))
    done
    local avg_ms=$((total / 3))

    echo ""
    echo "    |-- ${avg_ms}ms (threshold: ${threshold}ms)"

    if [[ $avg_ms -lt $threshold ]]; then
        test_pass
    else
        test_fail "Average ${avg_ms}ms exceeds threshold ${threshold}ms"
    fi
}

# -----------------------------------------------------------------------------
# test_webhook_handler_hook_latency
# Pipe a PostToolUse input. Should complete in <1000ms.
# Run 3 times, report average.
# -----------------------------------------------------------------------------
test_webhook_handler_hook_latency() {
    test_start "webhook-handler hook latency (<1000ms avg over 3 runs)"

    if [[ ! -f "$HOOK_RUNNER" ]]; then
        test_skip "run-hook.mjs not found"
        return
    fi

    local threshold=1000
    local input='{"hook_event":"PostToolUse","tool_name":"Bash","tool_input":{"command":"ls -la"},"tool_result":"","session_id":"perf-test-003","project_dir":"/tmp/perf-test"}'

    local total=0
    for ((i = 1; i <= 3; i++)); do
        local elapsed
        elapsed=$(measure_ms run_hook_timed "posttool/mem0-webhook-handler" "$input")
        total=$((total + elapsed))
    done
    local avg_ms=$((total / 3))

    echo ""
    echo "    |-- ${avg_ms}ms (threshold: ${threshold}ms)"

    if [[ $avg_ms -lt $threshold ]]; then
        test_pass
    else
        test_fail "Average ${avg_ms}ms exceeds threshold ${threshold}ms"
    fi
}

# -----------------------------------------------------------------------------
# test_pre_compaction_sync_latency
# Pipe a Stop input to pre-compaction-sync with a temp dir (no pending items).
# Should complete in <2000ms. Run 3 times, report average.
# -----------------------------------------------------------------------------
test_pre_compaction_sync_latency() {
    test_start "pre-compaction-sync hook latency (<2000ms avg over 3 runs)"

    if [[ ! -f "$HOOK_RUNNER" ]]; then
        test_skip "run-hook.mjs not found"
        return
    fi

    local threshold=2000

    local total=0
    for ((i = 1; i <= 3; i++)); do
        local tmp_dir
        tmp_dir=$(mktemp -d)
        mkdir -p "$tmp_dir/.claude/logs"
        mkdir -p "$tmp_dir/.claude/context/session"

        local input
        input=$(printf '{"hook_event":"Stop","tool_name":"","tool_input":{},"session_id":"perf-test-004-%d","project_dir":"%s"}' "$i" "$tmp_dir")

        local orig_plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
        export CLAUDE_PLUGIN_ROOT="$tmp_dir"

        local elapsed
        elapsed=$(measure_ms run_hook_timed "stop/mem0-pre-compaction-sync" "$input")
        total=$((total + elapsed))

        if [[ -n "$orig_plugin_root" ]]; then
            export CLAUDE_PLUGIN_ROOT="$orig_plugin_root"
        else
            unset CLAUDE_PLUGIN_ROOT
        fi
        rm -rf "$tmp_dir"
    done
    local avg_ms=$((total / 3))

    echo ""
    echo "    |-- ${avg_ms}ms (threshold: ${threshold}ms)"

    if [[ $avg_ms -lt $threshold ]]; then
        test_pass
    else
        test_fail "Average ${avg_ms}ms exceeds threshold ${threshold}ms"
    fi
}

# =============================================================================
# Sequential Hook Chain Latency Tests
# =============================================================================

# -----------------------------------------------------------------------------
# test_session_start_chain_latency
# Fire setup + lifecycle hooks in sequence (4 hooks).
# Should complete in <8000ms (2s per hook budget).
# -----------------------------------------------------------------------------
test_session_start_chain_latency() {
    test_start "session start chain latency (4 hooks, <8000ms)"

    if [[ ! -f "$HOOK_RUNNER" ]]; then
        test_skip "run-hook.mjs not found"
        return
    fi

    local threshold=8000

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"

    local setup_input
    setup_input=$(printf '{"hook_event":"Setup","tool_name":"","tool_input":{},"session_id":"perf-chain-001","project_dir":"%s"}' "$tmp_dir")

    local lifecycle_input
    lifecycle_input=$(printf '{"hook_event":"SessionStart","tool_name":"","tool_input":{},"session_id":"perf-chain-001","project_dir":"%s"}' "$tmp_dir")

    local start_ms
    start_ms=$(now_ms)

    # Setup hooks
    run_hook_timed "setup/mem0-backup-setup" "$setup_input"
    run_hook_timed "setup/mem0-cleanup" "$setup_input"

    # Lifecycle hooks
    run_hook_timed "lifecycle/mem0-analytics-tracker" "$lifecycle_input"
    run_hook_timed "lifecycle/mem0-context-retrieval" "$lifecycle_input"

    local end_ms
    end_ms=$(now_ms)
    local elapsed=$((end_ms - start_ms))

    rm -rf "$tmp_dir"

    echo ""
    echo "    |-- ${elapsed}ms (threshold: ${threshold}ms)"

    if [[ $elapsed -lt $threshold ]]; then
        test_pass
    else
        test_fail "Chain took ${elapsed}ms, exceeds threshold ${threshold}ms"
    fi
}

# -----------------------------------------------------------------------------
# test_full_lifecycle_chain_latency
# Fire all 8 hook categories in sequence.
# Should complete in <20000ms (avg 2.5s per hook).
# -----------------------------------------------------------------------------
test_full_lifecycle_chain_latency() {
    test_start "full lifecycle chain latency (8 hooks, <20000ms)"

    if [[ ! -f "$HOOK_RUNNER" ]]; then
        test_skip "run-hook.mjs not found"
        return
    fi

    local threshold=20000

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"
    mkdir -p "$tmp_dir/.claude/context/session"

    local orig_plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
    export CLAUDE_PLUGIN_ROOT="$tmp_dir"

    local start_ms
    start_ms=$(now_ms)

    # 1. Setup
    local setup_input
    setup_input=$(printf '{"hook_event":"Setup","tool_name":"","tool_input":{},"session_id":"perf-full-001","project_dir":"%s"}' "$tmp_dir")
    run_hook_timed "setup/mem0-backup-setup" "$setup_input"

    # 2. Lifecycle (SessionStart)
    local lifecycle_input
    lifecycle_input=$(printf '{"hook_event":"SessionStart","tool_name":"","tool_input":{},"session_id":"perf-full-001","project_dir":"%s"}' "$tmp_dir")
    run_hook_timed "lifecycle/mem0-analytics-tracker" "$lifecycle_input"

    # 3. Prompt (UserPromptSubmit)
    local prompt_input='{"hook_event":"UserPromptSubmit","prompt":"implement a new feature","tool_name":"","tool_input":{},"session_id":"perf-full-001","project_dir":"/tmp/perf-test"}'
    run_hook_timed "prompt/memory-context" "$prompt_input"

    # 4. PreToolUse
    local pretool_input='{"hook_event":"PreToolUse","tool_name":"mcp__memory__search_nodes","tool_input":{"query":"test"},"session_id":"perf-full-001","project_dir":"/tmp/perf-test"}'
    run_hook_timed "pretool/mcp/memory-validator" "$pretool_input"

    # 5. PostToolUse
    local posttool_input='{"hook_event":"PostToolUse","tool_name":"Bash","tool_input":{"command":"echo hello"},"session_id":"perf-full-001","project_dir":"/tmp/perf-test"}'
    run_hook_timed "posttool/mem0-webhook-handler" "$posttool_input"

    # 6. SubagentStart
    local subagent_start_input='{"hook_event":"SubagentStart","tool_name":"Task","tool_input":{"subagent_type":"test-generator","prompt":"generate tests"},"session_id":"perf-full-001","project_dir":"/tmp/perf-test"}'
    run_hook_timed "subagent-start/agent-memory-inject" "$subagent_start_input"

    # 7. SubagentStop
    local subagent_stop_input='{"hook_event":"SubagentStop","tool_name":"Task","tool_input":{"subagent_type":"test-generator"},"tool_result":"tests generated","session_id":"perf-full-001","project_dir":"/tmp/perf-test"}'
    run_hook_timed "subagent-stop/agent-memory-store" "$subagent_stop_input"

    # 8. Stop
    local stop_input
    stop_input=$(printf '{"hook_event":"Stop","tool_name":"","tool_input":{},"session_id":"perf-full-001","project_dir":"%s"}' "$tmp_dir")
    run_hook_timed "stop/mem0-pre-compaction-sync" "$stop_input"

    local end_ms
    end_ms=$(now_ms)
    local elapsed=$((end_ms - start_ms))

    if [[ -n "$orig_plugin_root" ]]; then
        export CLAUDE_PLUGIN_ROOT="$orig_plugin_root"
    else
        unset CLAUDE_PLUGIN_ROOT
    fi
    rm -rf "$tmp_dir"

    echo ""
    echo "    |-- ${elapsed}ms (threshold: ${threshold}ms)"

    if [[ $elapsed -lt $threshold ]]; then
        test_pass
    else
        test_fail "Full chain took ${elapsed}ms, exceeds threshold ${threshold}ms"
    fi
}

# =============================================================================
# Script Latency Tests (requires MEM0_API_KEY)
# =============================================================================

# -----------------------------------------------------------------------------
# test_add_memory_script_latency
# Time add-memory.py execution. Should complete in <10000ms.
# Skip if no API key.
# -----------------------------------------------------------------------------
test_add_memory_script_latency() {
    test_start "add-memory.py script latency (<10000ms)"

    if [[ -z "${MEM0_API_KEY:-}" ]]; then
        test_skip "MEM0_API_KEY not set"
        return
    fi

    if [[ ! -f "$SCRIPTS_DIR/add-memory.py" ]]; then
        test_skip "add-memory.py not found at $SCRIPTS_DIR"
        return
    fi

    local threshold=10000
    local elapsed
    elapsed=$(measure_ms python3 "$SCRIPTS_DIR/add-memory.py" \
        --text "Performance test memory entry $(date +%s)" \
        --user-id "orchestkit-perf-test" \
        --metadata '{"category":"performance-test","source":"benchmark"}')

    echo ""
    echo "    |-- ${elapsed}ms (threshold: ${threshold}ms)"

    if [[ $elapsed -lt $threshold ]]; then
        test_pass
    else
        test_fail "Script took ${elapsed}ms, exceeds threshold ${threshold}ms"
    fi
}

# -----------------------------------------------------------------------------
# test_search_memory_script_latency
# Time search-memories.py execution. Should complete in <10000ms.
# Skip if no API key.
# -----------------------------------------------------------------------------
test_search_memory_script_latency() {
    test_start "search-memories.py script latency (<10000ms)"

    if [[ -z "${MEM0_API_KEY:-}" ]]; then
        test_skip "MEM0_API_KEY not set"
        return
    fi

    if [[ ! -f "$SCRIPTS_DIR/search-memories.py" ]]; then
        test_skip "search-memories.py not found at $SCRIPTS_DIR"
        return
    fi

    local threshold=10000
    local elapsed
    elapsed=$(measure_ms python3 "$SCRIPTS_DIR/search-memories.py" \
        --query "performance test" \
        --user-id "orchestkit-perf-test" \
        --limit 5)

    echo ""
    echo "    |-- ${elapsed}ms (threshold: ${threshold}ms)"

    if [[ $elapsed -lt $threshold ]]; then
        test_pass
    else
        test_fail "Script took ${elapsed}ms, exceeds threshold ${threshold}ms"
    fi
}

# =============================================================================
# Batch Throughput Tests
# =============================================================================

# -----------------------------------------------------------------------------
# test_hook_throughput_10_calls
# Run memory-context hook 10 times sequentially.
# Measure total time. Calculate ops/sec. Should achieve >2 ops/sec.
# -----------------------------------------------------------------------------
test_hook_throughput_10_calls() {
    test_start "hook throughput: 10 sequential memory-context calls (>2 ops/sec)"

    if [[ ! -f "$HOOK_RUNNER" ]]; then
        test_skip "run-hook.mjs not found"
        return
    fi

    local min_ops_per_sec=2
    local iterations=10
    local input='{"hook_event":"UserPromptSubmit","prompt":"implement a new feature for the authentication system","tool_name":"","tool_input":{},"session_id":"perf-throughput-001","project_dir":"/tmp/perf-test"}'

    local start_ms
    start_ms=$(now_ms)

    for ((i = 1; i <= iterations; i++)); do
        run_hook_timed "prompt/memory-context" "$input"
    done

    local end_ms
    end_ms=$(now_ms)
    local total_ms=$((end_ms - start_ms))

    # Calculate ops/sec (avoid division by zero)
    local ops_per_sec=0
    if [[ $total_ms -gt 0 ]]; then
        # Use python3 for floating point division
        ops_per_sec=$(python3 -c "print(round(${iterations} / (${total_ms} / 1000.0), 2))")
    fi

    echo ""
    echo "    |-- ${total_ms}ms total, ${ops_per_sec} ops/sec (threshold: >${min_ops_per_sec} ops/sec)"

    # Compare using python3 for float comparison
    local passed
    passed=$(python3 -c "print('yes' if ${ops_per_sec} > ${min_ops_per_sec} else 'no')")

    if [[ "$passed" == "yes" ]]; then
        test_pass
    else
        test_fail "${ops_per_sec} ops/sec is below minimum ${min_ops_per_sec} ops/sec"
    fi
}

# =============================================================================
# Run All Tests
# =============================================================================

echo "--- Hook Latency Tests ---"
test_hook_runner_cold_start_latency
test_memory_context_hook_latency
test_memory_validator_hook_latency
test_webhook_handler_hook_latency
test_pre_compaction_sync_latency
echo ""

echo "--- Sequential Hook Chain Latency ---"
test_session_start_chain_latency
test_full_lifecycle_chain_latency
echo ""

echo "--- Script Latency (requires MEM0_API_KEY) ---"
test_add_memory_script_latency
test_search_memory_script_latency
echo ""

echo "--- Batch Throughput ---"
test_hook_throughput_10_calls
echo ""

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "============================================================================"
echo " Results: $TESTS_PASSED passed, $TESTS_FAILED failed, $TESTS_SKIPPED skipped (of $TESTS_RUN total)"
echo "============================================================================"

if [[ $TESTS_FAILED -gt 0 ]]; then
    exit 1
fi

exit 0
