#!/bin/bash
set -euo pipefail
# Coordination Heartbeat - Update heartbeat after each tool use
# Hook: PostToolUse (*)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../coordination/lib/coordination.sh"

# Load instance ID
if [[ -f "${CLAUDE_PROJECT_DIR}/.claude/.instance_env" ]]; then
  source "${CLAUDE_PROJECT_DIR}/.claude/.instance_env"
  export INSTANCE_ID="${CLAUDE_INSTANCE_ID}"
fi

# Update heartbeat (lightweight operation)
coord_heartbeat 2>/dev/null || true

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
exit 0
