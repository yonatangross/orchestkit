#!/bin/bash
# Coordination Initialization - Register instance at session start
# Hook: SessionStart
# CC 2.1.7 Compliant: Self-guarding - only runs when CLAUDE_MULTI_INSTANCE=1
# Version: 1.1.0
# Optimized with timeout to prevent startup hangs

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
if [[ -t 0 ]]; then
  _HOOK_INPUT=""
else
  _HOOK_INPUT=$(cat 2>/dev/null || true)
fi
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities for timeout and bypass
source "$SCRIPT_DIR/../_lib/common.sh"

# Start timing
start_hook_timing

# Bypass if slow hooks are disabled
if should_skip_slow_hooks; then
    log_hook "Skipping coordination init (ORCHESTKIT_SKIP_SLOW_HOOKS=1)"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# =============================================================================
# SELF-GUARD: Only run when multi-instance mode is enabled
# =============================================================================
if [[ "${CLAUDE_MULTI_INSTANCE:-0}" != "1" ]]; then
    # Multi-instance not enabled - silent exit (CC 2.1.7)
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

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
source "${SCRIPT_DIR}/../../.claude/coordination/lib/coordination.sh" 2>/dev/null || {
    trap - EXIT
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

# Determine task from session state or default
TASK_DESC="General development"
AGENT_ROLE="main"

if [[ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/context/session/state.json" ]]; then
  TASK_DESC=$(jq -r '.current_task.description // "General development"' \
    "${CLAUDE_PROJECT_DIR:-.}/.claude/context/session/state.json" 2>/dev/null || echo "General development")
fi

# Check if we're in a subagent context
if [[ -n "${CLAUDE_SUBAGENT_ROLE:-}" ]]; then
  AGENT_ROLE="${CLAUDE_SUBAGENT_ROLE}"
fi

# Register this instance with timeout
INSTANCE_ID=""
if run_with_timeout 2 bash -c "source '${SCRIPT_DIR}/../../.claude/coordination/lib/coordination.sh' 2>/dev/null && coord_register_instance '${TASK_DESC}' '${AGENT_ROLE}'" 2>/dev/null; then
    INSTANCE_ID=$(source "${SCRIPT_DIR}/../../.claude/coordination/lib/coordination.sh" 2>/dev/null && coord_register_instance "${TASK_DESC}" "${AGENT_ROLE}" 2>/dev/null) || INSTANCE_ID=""
fi

if [[ -n "${INSTANCE_ID}" ]]; then
  # Store instance ID for other hooks
  export CLAUDE_INSTANCE_ID="${INSTANCE_ID}"
  echo "CLAUDE_INSTANCE_ID=${INSTANCE_ID}" >> "${CLAUDE_PROJECT_DIR:-.}/.claude/.instance_env" 2>/dev/null || true

  # Initial heartbeat with timeout
  run_with_timeout 1 bash -c "source '${SCRIPT_DIR}/../../.claude/coordination/lib/coordination.sh' 2>/dev/null && coord_heartbeat" 2>/dev/null || true

  # Clean up any stale instances with timeout (log to file, not stderr)
  STALE_COUNT=$(run_with_timeout 1 bash -c "source '${SCRIPT_DIR}/../../.claude/coordination/lib/coordination.sh' 2>/dev/null && coord_cleanup_stale_instances" 2>/dev/null) || STALE_COUNT="0"
  if [[ ${STALE_COUNT} -gt 0 ]]; then
    log "Cleaned up ${STALE_COUNT} stale instance(s)"
  fi

  # List active instances with timeout (log to file, not stderr)
  ACTIVE_INSTANCES=$(run_with_timeout 1 bash -c "source '${SCRIPT_DIR}/../../.claude/coordination/lib/coordination.sh' 2>/dev/null && coord_list_instances | jq 'length'" 2>/dev/null) || ACTIVE_INSTANCES="1"
  log "Active Claude Code instances: ${ACTIVE_INSTANCES}"

  # Note: Removed "Session started" decision logging - it was just noise
  # Only log meaningful architectural decisions, not session lifecycle events
fi

# Log timing
log_hook_timing "coordination-init"

# Success - output JSON and clear trap
trap - EXIT
echo '{"continue":true,"suppressOutput":true}'
exit 0