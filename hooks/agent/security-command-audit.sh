#!/usr/bin/env bash
# security-command-audit.sh - Extra audit logging for security agent operations
#
# Used by: security-auditor, security-layer-auditor
#
# Purpose: Log all Bash commands executed during security audits for compliance
#
# CC 2.1.7 compliant output format

set -euo pipefail

AGENT_ID="${CLAUDE_AGENT_ID:-unknown}"
TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
SESSION_ID="${CLAUDE_SESSION_ID}"
LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/security-audit.log"

# Only audit Bash commands
if [[ "$TOOL_NAME" != "Bash" ]]; then
    cat <<EOF
{
  "continue": true,
  "suppressOutput": true
}
EOF
    exit 0
fi

# Create log directory if needed
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Log the command execution (from stdin if available)
COMMAND="${CLAUDE_TOOL_INPUT_COMMAND:-}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [[ -n "$COMMAND" ]]; then
    echo "[$TIMESTAMP] [$SESSION_ID] [$AGENT_ID] CMD: $COMMAND" >> "$LOG_FILE" 2>/dev/null || true
fi

# Always continue - this is audit logging only
cat <<EOF
{
  "continue": true,
  "suppressOutput": true
}
EOF