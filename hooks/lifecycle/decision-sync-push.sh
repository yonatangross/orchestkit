#!/bin/bash
# Decision Sync Push - SessionEnd Hook
# CC 2.1.7 Compliant: outputs JSON with correct field names
# Pushes pending decisions to mem0 on session end
#
# Part of mem0 Semantic Memory Integration (#47)

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source decision sync script
DECISION_SYNC="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/decision-sync.sh"
if [[ ! -f "$DECISION_SYNC" ]]; then
    # Fallback to plugin root
    DECISION_SYNC="${CLAUDE_PLUGIN_ROOT:-}/.claude/scripts/decision-sync.sh"
    if [[ ! -f "$DECISION_SYNC" ]]; then
        # Script not available - silent pass
        echo '{"continue":true,"suppressOutput":true}'
        exit 0
    fi
fi

# Log to hooks log
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
LOG_FILE="$LOG_DIR/hooks.log"

log_hook() {
    local msg="$1"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [decision-sync-push] $msg" >> "$LOG_FILE" 2>/dev/null || true
}

# Check for pending decisions - extract count from "Pending Decisions (N)"
pending_output=$("$DECISION_SYNC" pending 2>/dev/null || echo "No pending")
pending_count=""

# Parse the count from output like "Pending Decisions (84)"
if echo "$pending_output" | grep -q "Pending Decisions"; then
    pending_count=$(echo "$pending_output" | head -1 | sed -n 's/.*(\([0-9]*\)).*/\1/p')
fi

if [[ -z "$pending_count" ]] || [[ "$pending_count" == "0" ]]; then
    log_hook "No pending decisions to sync"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

log_hook "Found $pending_count pending decisions to sync"

# Output sync instructions for Claude to process
sync_output=$("$DECISION_SYNC" sync 2>/dev/null || echo "")

if [[ -n "$sync_output" ]]; then
    log_hook "Outputting sync instructions for $pending_count decisions"

    # Output as JSON with systemMessage (not message) for Claude
    jq -nc --arg msg "Session ending with $pending_count pending decisions. To sync to mem0, run: decision-sync.sh sync" \
        '{"continue":true,"systemMessage":$msg}'
else
    log_hook "No sync output generated"
    echo '{"continue":true,"suppressOutput":true}'
fi

exit 0