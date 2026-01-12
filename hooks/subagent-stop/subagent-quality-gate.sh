#!/bin/bash
set -euo pipefail
# Subagent Quality Gate - Validates subagent output quality
# Hook: SubagentStop
# CC 2.1.2 Compliant: includes continue field in all outputs

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

AGENT_ID=$(get_field '.agent_id')
SUBAGENT_TYPE=$(get_field '.subagent_type')
ERROR=$(get_field '.error')

log_hook "Quality gate check: $SUBAGENT_TYPE ($AGENT_ID)"

# Check if subagent had errors
if [[ -n "$ERROR" && "$ERROR" != "null" ]]; then
  warn "Subagent $SUBAGENT_TYPE failed: $ERROR"
  log_hook "ERROR: Subagent failed - $ERROR"

  # Track error count
  METRICS_FILE="/tmp/claude-session-metrics.json"
  if [[ -f "$METRICS_FILE" ]]; then
    ERRORS=$(jq -r '.errors // 0' "$METRICS_FILE")
    jq ".errors = $((ERRORS + 1))" "$METRICS_FILE" > "${METRICS_FILE}.tmp" 2>/dev/null
    mv "${METRICS_FILE}.tmp" "$METRICS_FILE" 2>/dev/null || true
  fi
fi

# Output with CC 2.1.2 compliance
echo '{"continue":true,"suppressOutput":true}'
exit 0