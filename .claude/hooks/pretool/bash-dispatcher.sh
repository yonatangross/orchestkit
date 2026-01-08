#!/bin/bash
# Bash PreToolUse Dispatcher - Combines defaults, protection, and validation
set -euo pipefail

_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Extract command for analysis
COMMAND=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.command // ""')
TIMEOUT=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.timeout // "null"')
DESCRIPTION=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.description // ""')

CHECKS=()

# Helper to block with specific error
block() {
  local check="$1"
  local reason="$2"
  jq -n --arg check "$check" --arg reason "$reason" \
    '{systemMessage: ("✗ " + $check + ": " + $reason), hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

# 1. Dangerous command check
DANGEROUS_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \$HOME"
  "> /dev/sda"
  "dd if=/dev/zero"
  "mkfs\."
  ":(){ :\|:& };:"
  "chmod -R 777 /"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if [[ "$COMMAND" == *"$pattern"* ]]; then
    block "Dangerous" "Command matches dangerous pattern: $pattern"
  fi
done
CHECKS+=("Safe")

# 2. Git branch protection
PROTECTED_BRANCHES=("main" "master" "production" "prod")
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [[ "$COMMAND" =~ ^git\ push.*--force ]] || [[ "$COMMAND" =~ ^git\ push.*-f ]]; then
  for branch in "${PROTECTED_BRANCHES[@]}"; do
    if [[ "$COMMAND" == *"$branch"* ]] || [[ "$CURRENT_BRANCH" == "$branch" ]]; then
      block "Git" "Force push to protected branch '$branch' is not allowed"
    fi
  done
fi

if [[ "$COMMAND" =~ ^git\ (push|commit|merge|rebase) ]]; then
  CHECKS+=("Git")
fi

# 3. Add default timeout if not specified
if [[ "$TIMEOUT" == "null" ]]; then
  TIMEOUT=120000
fi
CHECKS+=("Defaults")

# Build updated params
UPDATED_PARAMS=$(jq -n \
  --arg command "$COMMAND" \
  --argjson timeout "$TIMEOUT" \
  --arg description "$DESCRIPTION" \
  '{command: $command, timeout: $timeout} + (if $description != "" then {description: $description} else {} end)')

# Output combined success message with updated input
MSG=$(IFS=", "; echo "${CHECKS[*]}")
jq -n \
  --arg msg "$MSG" \
  --argjson params "$UPDATED_PARAMS" \
  '{systemMessage: $msg, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: $params}}'
