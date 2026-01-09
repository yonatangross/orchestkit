#!/bin/bash
set -euo pipefail
# Issue Documentation Requirement Hook for Claude Code
# CC 2.1.2 Compliant: includes continue field in all outputs
# Ensures docs/issues/<issue-num>-*/README.md exists before creating issue branches
# Exit code 2 blocks the command; exit code 0 allows it

set -o pipefail

# Read hook input from stdin
INPUT=$(cat)

# Extract the bash command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only check for git checkout -b commands creating issue branches
if [[ ! "$COMMAND" =~ git\ checkout\ -b\ issue/ ]]; then
  # Not creating an issue branch, allow it
  echo '{"continue": true}'
  exit 0
fi

# Extract branch name from command
# Handles: git checkout -b issue/489-description
BRANCH_NAME=$(echo "$COMMAND" | grep -oE 'issue/[0-9]+-[a-zA-Z0-9_-]+' | head -1)

if [[ -z "$BRANCH_NAME" ]]; then
  # Couldn't parse branch name, allow command (might be different format)
  echo '{"continue": true}'
  exit 0
fi

# Extract issue number from branch name
ISSUE_NUM=$(echo "$BRANCH_NAME" | grep -oE '[0-9]+' | head -1)

if [[ -z "$ISSUE_NUM" ]]; then
  # No issue number found, allow command
  echo '{"continue": true}'
  exit 0
fi

# Check if docs/issues/<issue-num>-*/README.md exists
DOCS_PATH="$CLAUDE_PROJECT_DIR/docs/issues"
MATCHING_DOCS=$(find "$DOCS_PATH" -maxdepth 2 -type f -name "README.md" -path "*/${ISSUE_NUM}-*/*" 2>/dev/null | head -1)

if [[ -n "$MATCHING_DOCS" ]]; then
  # Documentation exists, allow branch creation
  echo '{"systemMessage":"Issue docs found","continue": true}'
  exit 0
fi

# Documentation missing - warn but allow branch creation
# User prefers: create branch first, then docs
cat >&2 << EOF
+------------------------------------------------------------------------------+
|  REMINDER: Create issue documentation after branch setup                     |
+------------------------------------------------------------------------------+

Branch:   $BRANCH_NAME
Issue #:  $ISSUE_NUM

TODO: Create docs/issues/${ISSUE_NUM}-<description>/README.md

EOF

# Allow branch creation - docs can be created after
# Output systemMessage for user visibility
echo '{"systemMessage":"Docs requirement checked","continue":true}'
exit 0