#!/bin/bash
# Default Timeout Setter Hook for Claude Code
# Sets default timeout of 120000ms (2 minutes) if not specified
# CC 2.1.7 Compliant: outputs JSON with updatedInput to modify tool params
set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Extract relevant fields from tool_input
TIMEOUT=$(echo "$INPUT" | jq -r '.tool_input.timeout // "null"')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
DESCRIPTION=$(echo "$INPUT" | jq -r '.tool_input.description // ""')

# Default timeout: 2 minutes (120000ms)
DEFAULT_TIMEOUT=120000

# If timeout is null or empty, set the default
if [[ "$TIMEOUT" == "null" || -z "$TIMEOUT" ]]; then
  TIMEOUT=$DEFAULT_TIMEOUT
fi

# Build updatedInput object
# Include description only if it was provided
if [[ -n "$DESCRIPTION" ]]; then
  UPDATED_INPUT=$(jq -n \
    --arg command "$COMMAND" \
    --argjson timeout "$TIMEOUT" \
    --arg description "$DESCRIPTION" \
    '{command: $command, timeout: $timeout, description: $description}')
else
  UPDATED_INPUT=$(jq -n \
    --arg command "$COMMAND" \
    --argjson timeout "$TIMEOUT" \
    '{command: $command, timeout: $timeout}')
fi

# Output CC 2.1.7 compliant response with updatedInput
jq -n \
  --argjson updatedInput "$UPDATED_INPUT" \
  '{
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: $updatedInput
    }
  }'

output_silent_success
exit 0