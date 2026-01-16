#!/bin/bash
set -euo pipefail
# Git Branch Protection Hook for Claude Code
# Prevents commits and pushes to dev/main branches
# CC 2.1.9 Enhanced: injects additionalContext before git commands

# Read hook input from stdin
INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

# Extract the bash command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Check if this is a git command we should protect
if [[ ! "$COMMAND" =~ ^git ]]; then
  # Not a git command, allow it (silent success)
  output_silent_success
  exit 0
fi

# Get the current branch
CURRENT_BRANCH=$(cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" && git branch --show-current 2>/dev/null || echo "unknown")

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
    log_permission_feedback "deny" "Blocked $COMMAND on protected branch $CURRENT_BRANCH"
    jq -n --arg msg "$ERROR_MSG" '{systemMessage: $msg, continue: false, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Protected branch"}}'
    exit 0
  fi

  # CC 2.1.9: On protected branch but not commit/push - inject warning context
  BRANCH_CONTEXT="Branch: $CURRENT_BRANCH (PROTECTED). Direct commits blocked. Create feature branch for changes: git checkout -b issue/<number>-<desc>"
  log_permission_feedback "allow" "Git command on protected branch: $COMMAND"
  output_with_context "$BRANCH_CONTEXT"
  exit 0
fi

# CC 2.1.9: On feature branch - inject helpful context for git operations
if [[ "$COMMAND" =~ git\ commit || "$COMMAND" =~ git\ push || "$COMMAND" =~ git\ merge ]]; then
  BRANCH_CONTEXT="Branch: $CURRENT_BRANCH. Protected: dev, main, master. PR workflow: push to feature branch, then gh pr create --base dev"
  log_permission_feedback "allow" "Git command allowed: $COMMAND"
  output_with_context "$BRANCH_CONTEXT"
  exit 0
fi

# Allow other git operations (fetch, pull, status, etc.) without context injection
log_permission_feedback "allow" "Git command allowed: $COMMAND"
output_silent_success
exit 0