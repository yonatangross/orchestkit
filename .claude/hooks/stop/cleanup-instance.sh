#!/bin/bash
# Cleanup Instance - Stop Hook
# Releases all locks and unregisters instance when Claude Code exits
#
# Version: 1.0.0
# Part of Multi-Worktree Coordination System

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/coordination.sh" 2>/dev/null || {
    # If coordination lib not available, skip
    exit 0
}

LOG_FILE="$SCRIPT_DIR/../logs/cleanup.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

main() {
    local instance_id=$(get_instance_id)

    log "Cleaning up instance: $instance_id"

    # Get files locked by this instance before cleanup
    local info=$(get_instance_info "$instance_id")
    local locked_files=""

    if [[ "$info" != "null" && -n "$info" ]]; then
        locked_files=$(echo "$info" | jq -r '.files_locked // [] | join(", ")')
    fi

    # Unregister and release all locks
    unregister_instance

    log "Instance unregistered. Released locks on: ${locked_files:-none}"
}

# Output systemMessage for user visibility
echo '{"systemMessage":"Instance cleaned up","continue":true}'
main
