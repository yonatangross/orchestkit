#!/usr/bin/env bash
# CC 2.1.7 PreToolUse Hook: Context7 Documentation Tracker
# Tracks context7 library lookups for telemetry and caching
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

# Log permission decision
log_permission_feedback "context7" "allow" "Documentation lookup: $LIBRARY_ID"

# Allow the request
output_silent_success