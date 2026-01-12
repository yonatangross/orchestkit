#!/bin/bash
# bash-defaults.sh - Adds defaults and safety checks to Bash commands
# Part of SkillForge Claude Plugin v4.4.2

set -euo pipefail

# Read input from stdin
INPUT=$(cat)

# Extract parameters (using correct Claude Code field names)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
TIMEOUT=$(echo "$INPUT" | jq -r '.tool_input.timeout // "null"')
DESCRIPTION=$(echo "$INPUT" | jq -r '.tool_input.description // ""')

# Dangerous command patterns
DANGEROUS_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \$HOME"
  "rm -rf \*"
  "> /dev/sda"
  "dd if=/dev/zero of=/dev/sda"
  "mkfs\."
  ":(){ :\|:& };:"  # Fork bomb
  "chmod -R 777 /"
  "chown -R"
)

# Function to check for dangerous commands
check_dangerous() {
  local cmd="$1"

  for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if [[ "$cmd" == *"$pattern"* ]]; then
      return 0  # Dangerous
    fi
  done

  return 1  # Safe
}

# Check if command is dangerous
if check_dangerous "$COMMAND"; then
  echo "[bash-defaults] BLOCKED dangerous command: $COMMAND" >&2
  jq -n --arg cmd "$COMMAND" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("Dangerous command blocked: " + $cmd)
    }
  ,"continue":true,"suppressOutput":true}'
  exit 0
fi

# Add default timeout if not specified (120 seconds = 2 minutes)
if [[ "$TIMEOUT" == "null" ]]; then
  TIMEOUT=120000
  # Log to file instead of stderr to avoid "hook error" display
  # echo "[bash-defaults] Added default timeout: 120000ms" >> "${CLAUDE_PROJECT_DIR:-.}/.claude/logs/hooks.log" 2>/dev/null || true
fi

# Build updated params
UPDATED_PARAMS=$(jq -n \
  --arg command "$COMMAND" \
  --argjson timeout "$TIMEOUT" \
  --arg description "$DESCRIPTION" \
  '{
    command: $command,
    timeout: $timeout
  } + (if $description != "" then {description: $description} else {} end)')

# Output decision with systemMessage for user visibility
jq -n \
  --argjson params "$UPDATED_PARAMS" \
  '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: $params
    }
  ,"continue":true,"suppressOutput":true}'
