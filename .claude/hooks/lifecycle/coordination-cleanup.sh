#!/bin/bash
set -euo pipefail
# Coordination Cleanup - Unregister instance at session end
# Hook: SessionEnd

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../coordination/lib/coordination.sh"

# Load instance ID
if [[ -f "${CLAUDE_PROJECT_DIR}/.claude/.instance_env" ]]; then
  source "${CLAUDE_PROJECT_DIR}/.claude/.instance_env"
  export INSTANCE_ID="${CLAUDE_INSTANCE_ID}"
fi

# Update heartbeat to "stopping" status
if [[ -n "${INSTANCE_ID}" ]]; then
  HEARTBEAT_FILE="${HEARTBEATS_DIR}/${INSTANCE_ID}.json"
  if [[ -f "${HEARTBEAT_FILE}" ]]; then
    jq '.status = "stopping"' "${HEARTBEAT_FILE}" > "${HEARTBEAT_FILE}.tmp" && \
    mv "${HEARTBEAT_FILE}.tmp" "${HEARTBEAT_FILE}"
  fi
fi

# Unregister instance (releases all locks)
coord_unregister_instance

# Clean up instance env file
rm -f "${CLAUDE_PROJECT_DIR}/.claude/.instance_env"

echo "Coordination cleanup complete" >&2

# Output systemMessage for user visibility
echo '{"systemMessage":"Coordination cleaned up","continue":true}'
exit 0
