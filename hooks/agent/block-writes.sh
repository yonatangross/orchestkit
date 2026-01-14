#!/usr/bin/env bash
# block-writes.sh - Blocks Write/Edit operations for read-only agents
#
# Used by: debug-investigator, code-quality-reviewer, ux-researcher,
#          market-intelligence, system-design-reviewer
#
# Purpose: Enforce read-only boundaries for investigation/review agents
#
# CC 2.1.7 compliant output format

set -euo pipefail

# Get tool name from hook context
TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
AGENT_ID="${CLAUDE_AGENT_ID:-unknown}"

# These agents are strictly read-only
case "$TOOL_NAME" in
    Write|Edit|MultiEdit|NotebookEdit)
        # Block write operations
        cat <<EOF
{
  "continue": false,
  "message": "BLOCKED: Agent '$AGENT_ID' is read-only. Write/Edit operations are not permitted. This agent investigates and reports - it does not modify code.",
  "suppressOutput": false
}
EOF
        exit 0
        ;;
    *)
        # Allow all other operations
        cat <<EOF
{
  "continue": true,
  "suppressOutput": true
}
EOF
        exit 0
        ;;
esac