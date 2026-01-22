#!/bin/bash
set -euo pipefail
# Git Commit Message Validator Hook
# Enforces conventional commit format: type(#issue): description
# CC 2.1.9: Injects guidance via additionalContext

INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only process git commit commands
if [[ ! "$COMMAND" =~ ^git\ commit ]]; then
  output_silent_success
  exit 0
fi

# Extract commit message from command
# Patterns: git commit -m "msg", git commit -m 'msg', git commit -m msg
COMMIT_MSG=""
if [[ "$COMMAND" =~ -m[[:space:]]+[\"\']([^\"\']+)[\"\'] ]]; then
  COMMIT_MSG="${BASH_REMATCH[1]}"
elif [[ "$COMMAND" =~ -m[[:space:]]+([^[:space:]]+) ]]; then
  COMMIT_MSG="${BASH_REMATCH[1]}"
fi

# If using heredoc pattern, extract from that
if [[ "$COMMAND" =~ \<\<[\'\"]?EOF ]]; then
  # Heredoc detected - harder to validate, allow with guidance
  CONTEXT="Commit via heredoc detected. Ensure format: type(#issue): description

Allowed types: feat, fix, refactor, docs, test, chore, style, perf, ci, build
Example: feat(#123): Add user authentication

Commit MUST end with:
Co-Authored-By: Claude <noreply@anthropic.com>"

  log_permission_feedback "allow" "Heredoc commit - injecting format guidance"
  output_allow_with_context "$CONTEXT"
  output_silent_success
  exit 0
fi

# No message found (probably interactive commit) - allow with guidance
if [[ -z "$COMMIT_MSG" ]]; then
  CONTEXT="Interactive commit detected. Use conventional format:
type(#issue): description

Types: feat|fix|refactor|docs|test|chore|style|perf|ci|build"

  log_permission_feedback "allow" "Interactive commit - injecting guidance"
  output_allow_with_context "$CONTEXT"
  output_silent_success
  exit 0
fi

# Validate commit message format
# Pattern: type(#issue): description OR type: description
VALID_TYPES="feat|fix|refactor|docs|test|chore|style|perf|ci|build"
CONVENTIONAL_PATTERN="^($VALID_TYPES)(\(#?[0-9]+\)|(\([a-z-]+\)))?: .+"
SIMPLE_PATTERN="^($VALID_TYPES): .+"

if [[ "$COMMIT_MSG" =~ $CONVENTIONAL_PATTERN ]] || [[ "$COMMIT_MSG" =~ $SIMPLE_PATTERN ]]; then
  # Valid format - check length
  TITLE_LINE="${COMMIT_MSG%%$'\n'*}"
  TITLE_LEN=${#TITLE_LINE}

  if [[ $TITLE_LEN -gt 72 ]]; then
    CONTEXT="Commit message title is $TITLE_LEN chars (recommended: <72).
Consider shortening: ${TITLE_LINE:0:50}..."
    log_permission_feedback "allow" "Valid commit but long title ($TITLE_LEN chars)"
    output_allow_with_context "$CONTEXT"
    output_silent_success
    exit 0
  fi

  # All good
  log_permission_feedback "allow" "Valid conventional commit: $COMMIT_MSG"
  output_silent_success
  exit 0
fi

# Invalid format - BLOCK with guidance
ERROR_MSG="INVALID COMMIT MESSAGE FORMAT

Your message: \"$COMMIT_MSG\"

Required format: type(#issue): description

Allowed types:
  feat     - New feature
  fix      - Bug fix
  refactor - Code restructuring
  docs     - Documentation only
  test     - Adding/updating tests
  chore    - Build process, deps
  style    - Formatting, whitespace
  perf     - Performance improvement
  ci       - CI/CD changes
  build    - Build system changes

Examples:
  feat(#123): Add user authentication
  fix(#456): Resolve login redirect loop
  refactor: Extract validation helpers
  docs: Update API documentation

Please update your commit message to follow conventional format."

log_permission_feedback "deny" "Invalid commit format: $COMMIT_MSG"
jq -n --arg msg "$ERROR_MSG" '{
  systemMessage: $msg,
  continue: false,
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "Invalid conventional commit format"
  }
}'
output_silent_success
exit 0
