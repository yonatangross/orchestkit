#!/bin/bash
# Instance Heartbeat - Lifecycle Hook
# Updates heartbeat timestamp and cleans up stale instances
# CC 2.1.7 Compliant: Self-guarding - only runs when CLAUDE_MULTI_INSTANCE=1
#
# Runs periodically to:
# 1. Update this instance's heartbeat
# 2. Clean up stale instances (no heartbeat > 5 min)
# 3. Release orphaned locks
#
# Version: 1.1.0
# Part of Multi-Worktree Coordination System
# Optimized with timeout to prevent startup hangs

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
if [[ -t 0 ]]; then
    _HOOK_INPUT=""
else
    _HOOK_INPUT=$(cat 2>/dev/null || true)
fi
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities for timeout and bypass
source "$SCRIPT_DIR/../_lib/common.sh"

# Start timing
start_hook_timing

# Bypass if slow hooks are disabled
if should_skip_slow_hooks; then
    log_hook "Skipping instance heartbeat (ORCHESTKIT_SKIP_SLOW_HOOKS=1)"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# =============================================================================
# SELF-GUARD: Only run when multi-instance mode is enabled
# =============================================================================
if [[ "${CLAUDE_MULTI_INSTANCE:-0}" != "1" ]]; then
    # Multi-instance not enabled - silent exit (CC 2.1.7)
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Ensure JSON output on any exit (trap for safety)
trap 'echo "{\"continue\":true,\"suppressOutput\":true}"' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source coordination lib with fallback
source "$SCRIPT_DIR/../_lib/coordination.sh" 2>/dev/null || {
    # If coordination lib not available, exit cleanly with JSON
    trap - EXIT
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

LOG_FILE="$SCRIPT_DIR/../logs/heartbeat.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true
}

main() {
    local instance_id
    instance_id=$(get_instance_id 2>/dev/null) || instance_id=""

    if [[ -z "$instance_id" ]]; then
        log "No instance ID available"
        return
    fi

    # Check if we're registered with timeout
    local info
    info=$(run_with_timeout 1 bash -c "source '$SCRIPT_DIR/../_lib/coordination.sh' 2>/dev/null && get_instance_info '$instance_id'" 2>/dev/null) || info=""

    if [[ "$info" == "null" || -z "$info" ]]; then
        # Not registered yet, register now with timeout
        run_with_timeout 1 bash -c "source '$SCRIPT_DIR/../_lib/coordination.sh' 2>/dev/null && register_instance ''" 2>/dev/null || true
        log "Registered instance: $instance_id"
    else
        # Update heartbeat with timeout
        run_with_timeout 1 bash -c "source '$SCRIPT_DIR/../_lib/coordination.sh' 2>/dev/null && update_heartbeat" 2>/dev/null || true
        log "Updated heartbeat for: $instance_id"
    fi

    # Clean up stale instances with timeout
    local cleanup_result
    cleanup_result=$(run_with_timeout 1 bash -c "source '$SCRIPT_DIR/../_lib/coordination.sh' 2>/dev/null && cleanup_stale_instances" 2>/dev/null) || cleanup_result=""
    if [[ -n "$cleanup_result" ]]; then
        log "$cleanup_result"
    fi
}

# Run main with timeout (2 seconds max for SessionStart hooks)
if run_with_timeout 2 bash -c "$(declare -f main get_instance_id); source '$SCRIPT_DIR/../_lib/coordination.sh' 2>/dev/null && main"; then
    log_hook_timing "instance-heartbeat"
else
    log "Heartbeat timed out or failed"
fi

# Success - output JSON and clear trap
trap - EXIT
echo '{"continue":true,"suppressOutput":true}'
exit 0