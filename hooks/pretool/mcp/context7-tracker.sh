#!/usr/bin/env bash
# CC 2.1.9 PreToolUse Hook: Context7 Documentation Tracker
# Tracks context7 library lookups and injects cache state as additionalContext
set -euo pipefail

# Read stdin once and cache
INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

# Only process context7 MCP calls
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
if [[ "$TOOL_NAME" != mcp__context7__* ]]; then
  output_silent_success
  exit 0
fi

# Extract query details
LIBRARY_ID=$(echo "$INPUT" | jq -r '.tool_input.libraryId // ""')
QUERY=$(echo "$INPUT" | jq -r '.tool_input.query // ""')

# Log for telemetry
LOG_DIR="${PLUGIN_ROOT:-$SCRIPT_DIR/../../..}/hooks/logs"
mkdir -p "$LOG_DIR"
TELEMETRY_LOG="$LOG_DIR/context7-telemetry.log"

# Rotate log if > 100KB
if [[ -f "$TELEMETRY_LOG" ]] && [[ $(stat -f%z "$TELEMETRY_LOG" 2>/dev/null || stat -c%s "$TELEMETRY_LOG" 2>/dev/null || echo 0) -gt 102400 ]]; then
  mv "$TELEMETRY_LOG" "${TELEMETRY_LOG}.old"
fi

# Log the query
{
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") | tool=$TOOL_NAME | library=$LIBRARY_ID | query_length=${#QUERY}"
} >> "$TELEMETRY_LOG" 2>/dev/null || true

# CC 2.1.9: Calculate cache stats from telemetry log
CACHE_CONTEXT=""
if [[ -f "$TELEMETRY_LOG" ]]; then
  # Count total queries and unique libraries this session
  TOTAL_QUERIES=$(wc -l < "$TELEMETRY_LOG" 2>/dev/null | tr -d ' ')
  UNIQUE_LIBS=$(grep -oE 'library=[^ |]+' "$TELEMETRY_LOG" 2>/dev/null | sort -u | wc -l | tr -d ' ')

  # Get recently queried libraries (last 5 unique)
  RECENT_LIBS=$(grep -oE 'library=[^ |]+' "$TELEMETRY_LOG" 2>/dev/null | tail -10 | sed 's/library=//' | sort -u | tail -3 | tr '\n' ', ' | sed 's/,$//')

  if [[ "$TOTAL_QUERIES" -gt 0 ]]; then
    CACHE_CONTEXT="Context7: ${TOTAL_QUERIES} queries, ${UNIQUE_LIBS} libraries. Recent: ${RECENT_LIBS:-none}"
  fi
fi

# Log permission decision
log_permission_feedback "allow" "Documentation lookup: $LIBRARY_ID"

# CC 2.1.9: Inject cache context if available
if [[ -n "$CACHE_CONTEXT" ]]; then
  output_with_context "$CACHE_CONTEXT"
else
  output_silent_success
fi