#!/bin/bash
# Coordination Initialization - Register instance at session start
# Hook: SessionStart
# CC 2.1.2 Compliant: ensures JSON output on all code paths

set -euo pipefail

# Ensure JSON output on any exit (trap for safety)
trap 'echo "{\"continue\":true,\"suppressOutput\":true}"' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create log directory
LOG_DIR="$SCRIPT_DIR/../logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
LOG_FILE="$LOG_DIR/coordination-init.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true
}

# Source coordination lib with fallback
source "${SCRIPT_DIR}/../../coordination/lib/coordination.sh" 2>/dev/null || {
    trap - EXIT
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

# Determine task from session state or default
TASK_DESC="General development"
AGENT_ROLE="main"

if [[ -f "${CLAUDE_PROJECT_DIR}/.claude/context/session/state.json" ]]; then
  TASK_DESC=$(jq -r '.current_task.description // "General development"' \
    "${CLAUDE_PROJECT_DIR}/.claude/context/session/state.json" 2>/dev/null || echo "General development")
fi

# Check if we're in a subagent context
if [[ -n "${CLAUDE_SUBAGENT_ROLE:-}" ]]; then
  AGENT_ROLE="${CLAUDE_SUBAGENT_ROLE}"
fi

# Register this instance
INSTANCE_ID=$(coord_register_instance "${TASK_DESC}" "${AGENT_ROLE}" 2>/dev/null) || INSTANCE_ID=""

if [[ -n "${INSTANCE_ID}" ]]; then
  # Store instance ID for other hooks
  export CLAUDE_INSTANCE_ID="${INSTANCE_ID}"
  echo "CLAUDE_INSTANCE_ID=${INSTANCE_ID}" >> "${CLAUDE_PROJECT_DIR}/.claude/.instance_env" 2>/dev/null || true

  # Initial heartbeat
  coord_heartbeat 2>/dev/null || true

  # Clean up any stale instances (log to file, not stderr)
  STALE_COUNT=$(coord_cleanup_stale_instances 2>/dev/null) || STALE_COUNT="0"
  if [[ ${STALE_COUNT} -gt 0 ]]; then
    log "Cleaned up ${STALE_COUNT} stale instance(s)"
  fi

  # List active instances (log to file, not stderr)
  ACTIVE_INSTANCES=$(coord_list_instances 2>/dev/null | jq 'length' 2>/dev/null) || ACTIVE_INSTANCES="1"
  log "Active Claude Code instances: ${ACTIVE_INSTANCES}"

  # Log session start decision
  coord_log_decision "architecture" "Session started" "New Claude Code session initiated" "local" >/dev/null 2>&1 || true
fi

# Success - output JSON and clear trap
trap - EXIT
echo '{"continue":true,"suppressOutput":true}'
exit 0