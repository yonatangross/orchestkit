#!/bin/bash
set -euo pipefail
# Git Branch Protection Hook for Claude Code
# Prevents commits and pushes to dev/main branches
# Exit code 2 blocks the command; exit code 0 allows it

set -o pipefail

# Read hook input from stdin
INPUT=$(cat)

# Extract the bash command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Check if this is a git command we should protect
if [[ ! "$COMMAND" =~ ^git ]]; then
  # Not a git command, allow it
  exit 0
fi

# Get the current branch
CURRENT_BRANCH=$(cd "$CLAUDE_PROJECT_DIR" && git branch --show-current 2>/dev/null)

# Check if on a protected branch
if [[ "$CURRENT_BRANCH" == "dev" || "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
  # Check if the command is a commit or push
  if [[ "$COMMAND" =~ git\ commit || "$COMMAND" =~ git\ push ]]; then
    ERROR_MSG="BLOCKED: Cannot commit or push directly to '$CURRENT_BRANCH' branch.

You are currently on branch: $CURRENT_BRANCH

Required workflow:
1. Create a feature branch:
   git checkout -b issue/<number>-<description>

2. Make your changes and commit:
   git add .
   git commit -m \"feat(#<number>): Description\"

3. Push the feature branch:
   git push -u origin issue/<number>-<description>

4. Create a pull request:
   gh pr create --base dev

Aborting command to protect $CURRENT_BRANCH branch."
    echo "$ERROR_MSG" >&2
    exit 2
  fi
fi

# Allow other git operations (fetch, pull, status, etc.)
# Output systemMessage for user visibility
echo '{"systemMessage":"Branch protection checked"}'
exit 0
