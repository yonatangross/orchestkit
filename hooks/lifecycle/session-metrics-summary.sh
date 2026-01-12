#!/bin/bash
set -euo pipefail
# Session Metrics Summary - Shows summary at session end
# Hook: SessionEnd

source "$(dirname "$0")/../_lib/common.sh"

log_hook "Session ending - generating summary"

METRICS_FILE="/tmp/claude-session-metrics.json"

if [[ -f "$METRICS_FILE" ]]; then
  TOTAL_TOOLS=$(jq '[.tools | to_entries[].value] | add // 0' "$METRICS_FILE")
  TOP_TOOLS=$(jq -r '[.tools | to_entries | sort_by(-.value) | .[:3][] | "\(.key): \(.value)"] | join(", ")' "$METRICS_FILE")
  ERRORS=$(jq -r '.errors // 0' "$METRICS_FILE")

  log_hook "Session stats: $TOTAL_TOOLS tool calls, $ERRORS errors"

  if [[ "$TOTAL_TOOLS" -gt 0 ]]; then
    info "Session Summary: $TOTAL_TOOLS tool calls ($TOP_TOOLS)"
  fi
fi

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0
