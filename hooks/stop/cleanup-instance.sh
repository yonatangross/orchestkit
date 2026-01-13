#!/bin/bash
# Cleanup Instance - Stop Hook
# Releases all locks and unregisters instance when Claude Code exits
# CC 2.1.6 Compliant: ensures JSON output on all code paths
#
# Version: 1.0.1
# Part of Multi-Worktree Coordination System

set -euo pipefail

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

LOG_FILE="$SCRIPT_DIR/../logs/cleanup.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true
}

main() {
    local instance_id
    instance_id=$(get_instance_id 2>/dev/null) || instance_id=""

    if [[ -z "$instance_id" ]]; then
        log "No instance ID to clean up"
        return
    fi

    log "Cleaning up instance: $instance_id"

    # Get files locked by this instance before cleanup
    local info
    info=$(get_instance_info "$instance_id" 2>/dev/null) || info=""
    local locked_files=""

    if [[ "$info" != "null" && -n "$info" ]]; then
        locked_files=$(echo "$info" | jq -r '.files_locked // [] | join(", ")' 2>/dev/null) || locked_files=""
    fi

    # Unregister and release all locks
    unregister_instance 2>/dev/null || true

    log "Instance unregistered. Released locks on: ${locked_files:-none}"
}

main

# Success - output JSON and clear trap
trap - EXIT
echo '{"continue":true,"suppressOutput":true}'
exit 0