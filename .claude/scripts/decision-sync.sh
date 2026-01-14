#!/bin/bash
set -euo pipefail
# Decision Sync Script
# Synchronizes decision-log.json with mem0 cloud storage
#
# Usage:
#   decision-sync.sh export  - Export local decisions to mem0 format
#   decision-sync.sh status  - Show sync status
#   decision-sync.sh pending - Show decisions pending sync
#
# Version: 1.0.0
# Part of mem0 Semantic Memory Integration (#40, #47)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Source mem0 library if available
MEM0_LIB="${CLAUDE_PLUGIN_ROOT:-$SCRIPT_DIR/../..}/hooks/_lib/mem0.sh"
if [[ -f "$MEM0_LIB" ]]; then
    source "$MEM0_LIB"
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

DECISION_LOG="$PROJECT_ROOT/.claude/coordination/decision-log.json"
SYNC_STATE="$PROJECT_ROOT/.claude/coordination/.decision-sync-state.json"

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

# Initialize sync state file
init_sync_state() {
    if [[ ! -f "$SYNC_STATE" ]]; then
        cat > "$SYNC_STATE" << 'EOF'
{
    "version": "1.0",
    "last_sync": null,
    "synced_decisions": [],
    "pending_count": 0
}
EOF
    fi
}

# Get project ID for mem0 user_id
get_project_id() {
    if type mem0_get_project_id &>/dev/null; then
        mem0_get_project_id
    else
        basename "$PROJECT_ROOT" | tr '[:upper:]' '[:lower:]' | tr ' ' '-'
    fi
}

# Get decisions from local file
get_local_decisions() {
    if [[ ! -f "$DECISION_LOG" ]]; then
        echo '[]'
        return
    fi
    jq '.decisions // []' "$DECISION_LOG" 2>/dev/null || echo '[]'
}

# Get already synced decision IDs
get_synced_ids() {
    if [[ ! -f "$SYNC_STATE" ]]; then
        echo '[]'
        return
    fi
    jq '.synced_decisions // []' "$SYNC_STATE" 2>/dev/null || echo '[]'
}

# Get pending (unsynced) decisions
get_pending_decisions() {
    local decisions
    local synced_ids
    decisions=$(get_local_decisions)
    synced_ids=$(get_synced_ids)

    echo "$decisions" | jq --argjson synced "$synced_ids" '
        [.[] | select(.id as $id | $synced | index($id) | not)]
    '
}

# Mark decision as synced
mark_synced() {
    local decision_id="$1"
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    init_sync_state

    local tmp_file
    tmp_file=$(mktemp)
    jq --arg id "$decision_id" --arg now "$now" '
        .synced_decisions = (.synced_decisions + [$id] | unique) |
        .last_sync = $now |
        .pending_count = ((.pending_count // 0) - 1 | if . < 0 then 0 else . end)
    ' "$SYNC_STATE" > "$tmp_file" && mv "$tmp_file" "$SYNC_STATE"
}

# Format decision for mem0 storage
format_for_mem0() {
    local decision="$1"
    local project_id
    project_id=$(get_project_id)

    # Extract key fields and format as memory content
    echo "$decision" | jq -r '
        "Decision: " + .id + " (" + .date + ")\n" +
        "Status: " + .status + "\n" +
        "Impact: " + (.impact // "unknown") + "\n\n" +
        .summary + "\n\n" +
        "Rationale: " + (.rationale // "Not specified") + "\n" +
        (if .alternatives then "Alternatives considered: " + (.alternatives | join(", ")) else "" end)
    '
}

# -----------------------------------------------------------------------------
# Commands
# -----------------------------------------------------------------------------

cmd_status() {
    init_sync_state

    local total
    local synced
    local pending
    total=$(get_local_decisions | jq 'length')
    synced=$(get_synced_ids | jq 'length')
    pending=$(get_pending_decisions | jq 'length')

    local last_sync
    last_sync=$(jq -r '.last_sync // "never"' "$SYNC_STATE" 2>/dev/null || echo "never")

    local project_id
    project_id=$(get_project_id)
    local user_id="${project_id}-decisions"

    echo "Decision Sync Status"
    echo "===================="
    echo ""
    echo "Project: $project_id"
    echo "User ID: $user_id"
    echo ""
    echo "Local decisions: $total"
    echo "Synced to mem0:  $synced"
    echo "Pending sync:    $pending"
    echo ""
    echo "Last sync: $last_sync"
    echo ""
    echo "Files:"
    echo "  Decision log: $DECISION_LOG"
    echo "  Sync state:   $SYNC_STATE"
}

cmd_pending() {
    local pending
    pending=$(get_pending_decisions)
    local count
    count=$(echo "$pending" | jq 'length')

    if [[ "$count" == "0" ]]; then
        echo "No pending decisions to sync."
        return
    fi

    echo "Pending Decisions ($count)"
    echo "=========================="
    echo ""

    echo "$pending" | jq -r '.[] | "- " + .id + " (" + .date + "): " + (.summary | .[0:60]) + "..."'
}

cmd_export() {
    local pending
    pending=$(get_pending_decisions)
    local count
    count=$(echo "$pending" | jq 'length')

    if [[ "$count" == "0" ]]; then
        echo "No pending decisions to export."
        return
    fi

    local project_id
    project_id=$(get_project_id)
    local user_id="${project_id}-decisions"

    echo "Export Format for mem0"
    echo "======================"
    echo ""
    echo "Use mcp__mem0__add_memory with:"
    echo "  user_id: \"$user_id\""
    echo ""

    echo "$pending" | jq -c '.[]' | while read -r decision; do
        local id
        id=$(echo "$decision" | jq -r '.id')
        echo "--- Decision: $id ---"
        format_for_mem0 "$decision"
        echo ""
    done
}

cmd_help() {
    echo "Decision Sync - Synchronize decisions with mem0"
    echo ""
    echo "Usage: decision-sync.sh <command>"
    echo ""
    echo "Commands:"
    echo "  status   Show sync status"
    echo "  pending  List decisions pending sync"
    echo "  export   Export pending decisions in mem0 format"
    echo "  help     Show this help"
    echo ""
    echo "Files:"
    echo "  Decision log: .claude/coordination/decision-log.json"
    echo "  Sync state:   .claude/coordination/.decision-sync-state.json"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

COMMAND="${1:-help}"

case "$COMMAND" in
    status)
        cmd_status
        ;;
    pending)
        cmd_pending
        ;;
    export)
        cmd_export
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        echo "Unknown command: $COMMAND"
        echo "Run 'decision-sync.sh help' for usage."
        exit 1
        ;;
esac