#!/bin/bash
# Coordination Heartbeat - Update heartbeat after each tool use
# Hook: PostToolUse (*)
# CC 2.1.6 Compliant: ensures JSON output on all code paths

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

# Ensure JSON output on any exit (trap for safety)
trap 'echo "{\"continue\": true}"' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source coordination lib with fallback
source "${SCRIPT_DIR}/../../.claude/coordination/lib/coordination.sh" 2>/dev/null || {
    # Coordination lib not available, exit cleanly with JSON
    trap - EXIT
    echo '{"continue": true, "suppressOutput": true}'
    exit 0
}

# Load instance ID
if [[ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/.instance_env" ]]; then
  source "${CLAUDE_PROJECT_DIR:-.}/.claude/.instance_env"
  export INSTANCE_ID="${CLAUDE_INSTANCE_ID:-}"
fi

# Update heartbeat (lightweight operation)
coord_heartbeat 2>/dev/null || true

# Success - output JSON and clear trap
trap - EXIT
echo '{"continue": true, "suppressOutput": true}'
exit 0