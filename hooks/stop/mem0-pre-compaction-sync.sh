#!/bin/bash
# Mem0 Pre-Compaction Sync Hook
# Saves session decisions and state to Mem0 BEFORE context compaction loses them
#
# CRITICAL: This hook MUST run FIRST in the Stop hooks chain
# to capture decisions before compress_session() truncates them.
#
# Version: 1.0.0
# Part of SkillForge Plugin - Works across ANY repository
#
# What this hook does:
# 1. Extracts decisions made during this session
# 2. Extracts current task state (for continuity)
# 3. Outputs instructions for Claude to save to Mem0
# 4. Marks sync as pending (for verification at next session start)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source the Mem0 library
if [[ -f "$PLUGIN_ROOT/hooks/_lib/mem0.sh" ]]; then
    source "$PLUGIN_ROOT/hooks/_lib/mem0.sh"
else
    # Library not found - skip gracefully
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Log file for debugging
LOG_DIR="$PLUGIN_ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/mem0-sync.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [pre-compaction] $1" >> "$LOG_FILE"
}

# -----------------------------------------------------------------------------
# Main Sync Logic
# -----------------------------------------------------------------------------

main() {
    log "Starting pre-compaction sync..."

    local project_id
    project_id=$(mem0_get_project_id)
    log "Project: $project_id"

    # Check if we have anything to sync
    local has_decisions=false
    local has_task=false
    local decisions_content=""
    local continuity_content=""

    # Extract session decisions
    local decisions
    decisions=$(extract_session_decisions)
    local decision_count
    decision_count=$(echo "$decisions" | jq 'length')

    if [[ "$decision_count" -gt 0 ]]; then
        has_decisions=true
        decisions_content=$(build_decisions_content)
        log "Found $decision_count decisions to sync"
    fi

    # Extract current task state for continuity
    local current_task
    current_task=$(extract_current_task)

    if [[ "$current_task" != "null" ]]; then
        has_task=true
        continuity_content=$(build_continuity_content)
        log "Found active task state to sync"
    fi

    # If nothing to sync, exit quietly
    if [[ "$has_decisions" != "true" && "$has_task" != "true" ]]; then
        log "Nothing to sync - no decisions or active task"
        echo '{"continue":true,"suppressOutput":true}'
        exit 0
    fi

    # Mark sync as pending (will be verified at next session start)
    local pending_file="$PLUGIN_ROOT/.mem0-sync-pending"
    echo "{\"project\":\"$project_id\",\"timestamp\":\"$(date -Iseconds)\",\"decisions\":$decision_count}" > "$pending_file"
    log "Marked sync as pending"

    # Build the output message for Claude
    local output_parts=()

    output_parts+=("## Mem0 Pre-Compaction Sync")
    output_parts+=("")
    output_parts+=("Before this session ends, please save the following to Mem0 for future context:")
    output_parts+=("")

    if [[ "$has_decisions" == "true" ]]; then
        output_parts+=("### Decisions to Save")
        output_parts+=("Use \`mcp__mem0__add_memory\` with:")
        output_parts+=("\`\`\`json")
        output_parts+=("$(mem0_add_memory_json "$MEM0_SCOPE_DECISIONS" "$decisions_content" "{\"session_end\":true,\"decision_count\":$decision_count}")")
        output_parts+=("\`\`\`")
        output_parts+=("")
    fi

    if [[ "$has_task" == "true" ]]; then
        output_parts+=("### Session Continuity to Save")
        output_parts+=("Use \`mcp__mem0__add_memory\` with:")
        output_parts+=("\`\`\`json")
        output_parts+=("$(mem0_add_memory_json "$MEM0_SCOPE_CONTINUITY" "$continuity_content" "{\"session_end\":true}")")
        output_parts+=("\`\`\`")
        output_parts+=("")
    fi

    output_parts+=("This ensures context is preserved even after session compaction.")

    # Join output parts
    local system_message
    system_message=$(printf '%s\n' "${output_parts[@]}")

    log "Sync instructions generated"

    # Output for Claude to process
    # Use systemMessage to show to Claude, continue to allow further processing
    cat << EOF
{
  "continue": true,
  "systemMessage": $(echo "$system_message" | jq -Rs .)
}
EOF
}

# Execute
main
