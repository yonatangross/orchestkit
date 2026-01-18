#!/usr/bin/env bash
# deployment-safety-check.sh - Validates deployment commands for safety
#
# Used by: deployment-manager
#
# Purpose: Prevent dangerous deployment operations without verification
#
# CC 2.1.7 compliant output format

set -euo pipefail

# Get command from hook context
COMMAND="${CLAUDE_TOOL_INPUT_COMMAND:-}"
AGENT_ID="${CLAUDE_AGENT_ID:-deployment-manager}"

# Block production deployments without explicit markers
PRODUCTION_PATTERNS=(
    "prod\b"
    "production"
    "--env.*prod"
    "ENV=prod"
    "ENVIRONMENT=prod"
    "deploy.*main"
    "deploy.*master"
)

for pattern in "${PRODUCTION_PATTERNS[@]}"; do
    if echo "$COMMAND" | grep -qiE "$pattern"; then
        cat <<EOF
{
  "continue": false,
  "message": "BLOCKED: Production deployment detected. Pattern: '$pattern'. Production deployments require explicit user approval and should go through proper release processes.",
  "suppressOutput": false
}
EOF
        exit 0
    fi
done

# Warn on rollback operations
if echo "$COMMAND" | grep -qiE "(rollback|revert|downgrade)"; then
    cat <<EOF
{
  "continue": true,
  "suppressOutput": false,
  "hookSpecificOutput": {
    "additionalContext": "Deployment Safety: Rollback operation detected. Verify the target version and ensure proper change management procedures are followed."
  }
}
EOF
    exit 0
fi

# Warn on infrastructure changes
if echo "$COMMAND" | grep -qiE "(terraform|kubectl|helm|docker.*push)"; then
    cat <<EOF
{
  "continue": true,
  "suppressOutput": false,
  "hookSpecificOutput": {
    "additionalContext": "Deployment Safety: Infrastructure change detected. Verify changes in staging before production deployment."
  }
}
EOF
    exit 0
fi

# Allow other commands
cat <<EOF
{
  "continue": true,
  "suppressOutput": true
}
EOF
exit 0
