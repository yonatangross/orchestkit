#!/bin/bash
# Coordination Cleanup - Unregister instance at session end
# Hook: SessionEnd
# CC 2.1.6 Compliant: ensures JSON output on all code paths

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

# Ensure JSON output on any exit (trap for safety)
trap 'echo "{\"continue\":true,\"suppressOutput\":true}"' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create log directory
LOG_DIR="$SCRIPT_DIR/../logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
LOG_FILE="$LOG_DIR/coordination-cleanup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true
}

# Source coordination lib with fallback
source "${SCRIPT_DIR}/../../.claude/coordination/lib/coordination.sh" 2>/dev/null || {
    trap - EXIT
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

# Load instance ID
if [[ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/.instance_env" ]]; then
  source "${CLAUDE_PROJECT_DIR:-.}/.claude/.instance_env" 2>/dev/null || true
  export INSTANCE_ID="${CLAUDE_INSTANCE_ID:-}"
fi

# Update heartbeat to "stopping" status
if [[ -n "${INSTANCE_ID:-}" ]]; then
  HEARTBEAT_FILE="${HEARTBEATS_DIR:-}/${INSTANCE_ID}.json"
  if [[ -n "${HEARTBEATS_DIR:-}" && -f "${HEARTBEAT_FILE}" ]]; then
    jq '.status = "stopping"' "${HEARTBEAT_FILE}" > "${HEARTBEAT_FILE}.tmp" 2>/dev/null && \
    mv "${HEARTBEAT_FILE}.tmp" "${HEARTBEAT_FILE}" 2>/dev/null || true
  fi
fi

# Unregister instance (releases all locks)
coord_unregister_instance 2>/dev/null || true

# Clean up instance env file
rm -f "${CLAUDE_PROJECT_DIR:-.}/.claude/.instance_env" 2>/dev/null || true

log "Coordination cleanup complete"

# Success - output JSON and clear trap
trap - EXIT
echo '{"continue":true,"suppressOutput":true}'
exit 0