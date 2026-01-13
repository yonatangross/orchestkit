#!/bin/bash
# Bash PreToolUse Dispatcher - Combines defaults, protection, and validation
# CC 2.1.6 Compliant: silent on success, visible on failure
# Includes line continuation normalization (CC 2.1.6 security fix)
set -euo pipefail

_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ANSI colors
RED=$'\033[31m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Coordination DB path
COORDINATION_DB="${CLAUDE_PROJECT_DIR:-.}/.claude/coordination/.claude.db"

# Extract command for analysis
COMMAND=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.command // ""')
TIMEOUT=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.timeout // "null"')
DESCRIPTION=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.description // ""')

# CC 2.1.6 Security: Normalize line continuations before pattern matching
# This prevents bypass attempts using backslash-newline sequences
# Example: "git \
#           commit" becomes "git commit"
COMMAND_NORMALIZED=$(echo "$COMMAND" | sed -E 's/\\[[:space:]]*[\r\n]+//g' | tr '\n' ' ' | tr -s ' ')
# Use normalized command for security checks
COMMAND_FOR_CHECK="$COMMAND_NORMALIZED"

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

# Helper to run a sub-hook (passes hook input via environment)
run_hook() {
  local name="$1"
  local script="$2"

  if [[ ! -f "$script" ]]; then
    return 0
  fi

  local output
  local exit_code
  output=$(_HOOK_INPUT="$_HOOK_INPUT" bash "$script" 2>&1) && exit_code=0 || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    WARNINGS+=("$name: failed")
  elif [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]] || [[ "$output" == *"REMINDER"* ]]; then
    local warn_msg=$(echo "$output" | grep -iE "(warning|reminder)" | head -1 | sed 's/.*[wW]arning[: ]*//')
    [[ -n "$warn_msg" ]] && WARNINGS+=("$name: $warn_msg")
  fi

  return 0
}

# 0. Error pattern warning (first - informational)
RULES_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/rules/error_rules.json"
if [[ -f "$RULES_FILE" ]]; then
  run_hook "ErrorPatterns" "$SCRIPT_DIR/bash/error-pattern-warner.sh"
fi

# 1. Dangerous command check (patterns loaded from external file or inline)
# Uses COMMAND_FOR_CHECK (normalized) to prevent bypass via line continuation
source "$SCRIPT_DIR/bash/dangerous-patterns.sh" 2>/dev/null || {
  # Fallback: define patterns inline if file doesn't exist
  DANGEROUS_PATTERNS=(
    "rm -rf /"
    "rm -rf ~"
    "> /dev/sda"
    "mkfs."
    "chmod -R 777 /"
  )
}

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if [[ "$COMMAND_FOR_CHECK" == *"$pattern"* ]]; then
    block "Dangerous" "Command matches dangerous pattern: $pattern"
  fi
done

# 2. Git branch protection
# Uses COMMAND_FOR_CHECK (normalized) to prevent bypass via line continuation
PROTECTED_BRANCHES=("main" "master" "production" "prod")
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [[ "$COMMAND_FOR_CHECK" =~ ^git\ push.*--force ]] || [[ "$COMMAND_FOR_CHECK" =~ ^git\ push.*-f ]]; then
  for branch in "${PROTECTED_BRANCHES[@]}"; do
    if [[ "$COMMAND_FOR_CHECK" == *"$branch"* ]] || [[ "$CURRENT_BRANCH" == "$branch" ]]; then
      block "Git" "Force push to protected branch '$branch' is not allowed"
    fi
  done
fi

# 3. CI simulation reminder (only for git commit)
# Uses COMMAND_FOR_CHECK to detect commit commands even with line continuation
if [[ "$COMMAND_FOR_CHECK" =~ git\ commit ]]; then
  run_hook "CIReminder" "$SCRIPT_DIR/bash/ci-simulation.sh"
fi

# 4. Issue docs requirement (for issue branches)
if [[ "$COMMAND_FOR_CHECK" =~ git\ checkout\ -b\ issue/ ]]; then
  run_hook "IssueDocs" "$SCRIPT_DIR/bash/issue-docs-requirement.sh"
fi

# 5. Multi-instance quality gate (last, only for commits + multi-instance)
if [[ "$COMMAND_FOR_CHECK" =~ git\ commit ]] && [[ -f "$COORDINATION_DB" ]]; then
  run_hook "QualityGate" "$SCRIPT_DIR/bash/multi-instance-quality-gate.sh"
fi

# 6. Add default timeout if not specified
if [[ "$TIMEOUT" == "null" ]]; then
  TIMEOUT=120000
fi

# Build updated params - use original COMMAND to preserve user intent
# The normalization is only for security checking, not execution
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