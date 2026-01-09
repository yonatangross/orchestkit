#!/bin/bash
set -euo pipefail
# Coordination Initialization - Register instance at session start
# Hook: SessionStart

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../coordination/lib/coordination.sh"

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
INSTANCE_ID=$(coord_register_instance "${TASK_DESC}" "${AGENT_ROLE}")

# Store instance ID for other hooks
export CLAUDE_INSTANCE_ID="${INSTANCE_ID}"
echo "CLAUDE_INSTANCE_ID=${INSTANCE_ID}" >> "${CLAUDE_PROJECT_DIR}/.claude/.instance_env"

# Initial heartbeat
coord_heartbeat

# Clean up any stale instances
STALE_COUNT=$(coord_cleanup_stale_instances)
if [[ ${STALE_COUNT} -gt 0 ]]; then
  echo "Cleaned up ${STALE_COUNT} stale instance(s)" >&2
fi

# List active instances
ACTIVE_INSTANCES=$(coord_list_instances | jq 'length')
echo "Active Claude Code instances: ${ACTIVE_INSTANCES}" >&2

# Log session start decision
coord_log_decision "architecture" "Session started" "New Claude Code session initiated" "local" >/dev/null

# Output systemMessage for user visibility
echo '{"systemMessage":"Coordination initialized","continue":true}'
exit 0
