#!/usr/bin/env bash
# ci-safety-check.sh - Validates CI/CD commands for safety
#
# Used by: ci-cd-engineer
#
# Purpose: Prevent dangerous CI/CD operations without confirmation
#
# CC 2.1.7 compliant output format

set -euo pipefail

# Get command from hook context
COMMAND="${CLAUDE_TOOL_INPUT_COMMAND:-}"
AGENT_ID="${CLAUDE_AGENT_ID:-ci-cd-engineer}"

# Check for dangerous CI/CD patterns
DANGEROUS_PATTERNS=(
    "force.*push"
    "push.*--force"
    "--force-with-lease"
    "workflow_dispatch"
    "delete.*workflow"
    "gh secret delete"
    "gh variable delete"
    "rm.*-rf.*\.github"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if echo "$COMMAND" | grep -qiE "$pattern"; then
        cat <<EOF
{
  "continue": false,
  "message": "BLOCKED: Potentially destructive CI/CD operation detected. Pattern: '$pattern'. This requires explicit user approval.",
  "suppressOutput": false
}
EOF
        exit 0
    fi
done

# Warn on deployment-related commands
if echo "$COMMAND" | grep -qiE "(deploy|release|publish)"; then
    cat <<EOF
{
  "continue": true,
  "suppressOutput": false,
  "hookSpecificOutput": {
    "additionalContext": "CI/CD Safety: Deployment commands detected. Verify target environment and ensure proper approvals are in place."
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
