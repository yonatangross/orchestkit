#!/bin/bash
# Bash PreToolUse Dispatcher - Combines defaults, protection, and validation
# CC 2.1.2 Compliant: silent on success, visible on failure
set -euo pipefail

_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ANSI colors
RED=$'\033[31m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Extract command for analysis
COMMAND=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.command // ""')
TIMEOUT=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.timeout // "null"')
DESCRIPTION=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.description // ""')

WARNINGS=()

# Helper to block with specific error
block() {
  local check="$1"
  local reason="$2"
  local msg="${RED}✗ ${check}${RESET}: ${reason}"
  jq -n --arg msg "$msg" --arg reason "$reason" \
    '{systemMessage: $msg, continue: false, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
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

# 3. Add default timeout if not specified
if [[ "$TIMEOUT" == "null" ]]; then
  TIMEOUT=120000
fi

# Build updated params
UPDATED_PARAMS=$(jq -n \
  --arg command "$COMMAND" \
  --argjson timeout "$TIMEOUT" \
  --arg description "$DESCRIPTION" \
  '{command: $command, timeout: $timeout} + (if $description != "" then {description: $description} else {} end)')

# Output: silent on success, show warnings if any
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARN_MSG=$(IFS="; "; echo "${WARNINGS[*]}")
  jq -n \
    --arg msg "${YELLOW}⚠ ${WARN_MSG}${RESET}" \
    --argjson params "$UPDATED_PARAMS" \
    '{systemMessage: $msg, continue: true, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: $params}}'
else
  # Silent success - suppress all output
  jq -n \
    --argjson params "$UPDATED_PARAMS" \
    '{continue: true, suppressOutput: true, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: $params}}'
fi