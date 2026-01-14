#!/usr/bin/env bash
# migration-safety-check.sh - Validates database commands are safe
#
# Used by: database-engineer
#
# Purpose: Prevent destructive database operations without explicit confirmation
#
# CC 2.1.7 compliant output format

set -euo pipefail

TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
AGENT_ID="${CLAUDE_AGENT_ID:-unknown}"

# Only check Bash commands
if [[ "$TOOL_NAME" != "Bash" ]]; then
    cat <<EOF
{
  "continue": true,
  "suppressOutput": true
}
EOF
    exit 0
fi

COMMAND="${CLAUDE_TOOL_INPUT_COMMAND:-}"

# Check for dangerous patterns
DANGEROUS_PATTERNS=(
    "DROP TABLE"
    "DROP DATABASE"
    "TRUNCATE"
    "DELETE FROM.*WHERE 1"
    "DELETE FROM [^W]*$"  # DELETE without WHERE
    "--force"
    "alembic downgrade"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if echo "$COMMAND" | grep -qiE "$pattern"; then
        cat <<EOF
{
  "continue": false,
  "message": "BLOCKED: Potentially destructive database command detected. Pattern: '$pattern'. Please confirm this operation is intentional before proceeding.",
  "suppressOutput": false
}
EOF
        exit 0
    fi
done

# Safe to proceed
cat <<EOF
{
  "continue": true,
  "suppressOutput": true
}
EOF