#!/bin/bash
set -euo pipefail
# Session Metrics - Tracks tool usage statistics
# Hook: PostToolUse (*)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

TOOL_NAME=$(get_tool_name)
METRICS_FILE="/tmp/claude-session-metrics.json"
LOCKFILE="${METRICS_FILE}.lock"

# Initialize metrics file if needed (check for missing OR empty file)
if [[ ! -f "$METRICS_FILE" ]] || [[ ! -s "$METRICS_FILE" ]]; then
  echo '{"tools":{},"errors":0,"warnings":0}' > "$METRICS_FILE"
fi

# Use file locking for concurrent access
(
  # Acquire lock (wait up to 2 seconds)
  if command -v flock >/dev/null 2>&1; then
    flock -w 2 200 || exit 0
  fi

  # Re-check file validity inside lock
  if [[ ! -s "$METRICS_FILE" ]] || ! jq empty "$METRICS_FILE" 2>/dev/null; then
    echo '{"tools":{},"errors":0,"warnings":0}' > "$METRICS_FILE"
  fi

  # Increment tool counter
  CURRENT=$(jq -r ".tools.\"$TOOL_NAME\" // 0" "$METRICS_FILE" 2>/dev/null || echo 0)
  CURRENT=${CURRENT:-0}

  if jq ".tools.\"$TOOL_NAME\" = $((CURRENT + 1))" "$METRICS_FILE" > "${METRICS_FILE}.tmp" 2>/dev/null; then
    mv "${METRICS_FILE}.tmp" "$METRICS_FILE" 2>/dev/null || true
  fi
) 200>"$LOCKFILE" 2>/dev/null || true

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
exit 0
