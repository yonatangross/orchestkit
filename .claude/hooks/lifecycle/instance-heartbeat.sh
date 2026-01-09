#!/bin/bash
# Instance Heartbeat - Lifecycle Hook
# Updates heartbeat timestamp and cleans up stale instances
#
# Runs periodically to:
# 1. Update this instance's heartbeat
# 2. Clean up stale instances (no heartbeat > 5 min)
# 3. Release orphaned locks
#
# Version: 1.0.0
# Part of Multi-Worktree Coordination System

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/coordination.sh" 2>/dev/null || {
    # If coordination lib not available, skip
    exit 0
}

LOG_FILE="$SCRIPT_DIR/../logs/heartbeat.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

main() {
    local instance_id=$(get_instance_id)

    # Check if we're registered
    local info=$(get_instance_info "$instance_id")

    if [[ "$info" == "null" || -z "$info" ]]; then
        # Not registered yet, register now
        register_instance ""
        log "Registered instance: $instance_id"
    else
        # Update heartbeat
        update_heartbeat
        log "Updated heartbeat for: $instance_id"
    fi

    # Clean up stale instances
    local cleanup_result=$(cleanup_stale_instances)
    if [[ -n "$cleanup_result" ]]; then
        log "$cleanup_result"
    fi
}

# Output systemMessage for user visibility
echo '{"systemMessage":"Heartbeat sent","continue":true}'
main
