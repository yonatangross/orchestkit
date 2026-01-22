#!/bin/bash
set -euo pipefail
# Dangerous Command Blocker Hook for Claude Code
# Blocks commands that match dangerous patterns known to cause system damage
# CC 2.1.7 Compliant: outputs JSON with continue field

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh" 2>/dev/null || true

# Initialize hook input from stdin
init_hook_input

# Extract the bash command
COMMAND=$(get_field '.tool_input.command')

# If no command, allow (shouldn't happen but be safe)
if [[ -z "$COMMAND" ]]; then
  echo '{"continue": true, "suppressOutput": true}'
  exit 0
fi

# Normalize command: remove line continuations and collapse whitespace
# This prevents bypassing detection with backslash-newline tricks
NORMALIZED_COMMAND=$(echo "$COMMAND" | sed -E 's/\\[[:space:]]*[\r\n]+//g' | tr '\n' ' ' | tr -s ' ')

# Load dangerous patterns from external file if it exists, otherwise use inline defaults
PATTERNS_FILE="${SCRIPT_DIR}/dangerous-patterns.sh"
DANGEROUS_PATTERNS=()

if [[ -f "$PATTERNS_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$PATTERNS_FILE"
else
  # Default dangerous patterns - commands that can cause catastrophic system damage
  DANGEROUS_PATTERNS=(
    "rm -rf /"
    "rm -rf ~"
    "> /dev/sda"
    "mkfs."
    "chmod -R 777 /"
    "dd if=/dev/zero of=/dev/"
    "dd if=/dev/random of=/dev/"
    ":(){:|:&};:"
    "mv /* /dev/null"
    "wget.*|.*sh"
    "curl.*|.*sh"
  )
fi

# Check command against each dangerous pattern
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  # Use grep -F for literal matching (no regex interpretation)
  # This is safer and matches exact substrings
  if echo "$NORMALIZED_COMMAND" | grep -qF "$pattern"; then
    log_hook "BLOCKED: Dangerous command detected matching pattern: $pattern"
    log_permission_feedback "deny" "Dangerous pattern: $pattern"

    # Output CC 2.1.7 compliant denial JSON
    jq -n \
      --arg pattern "$pattern" \
      --arg reason "Command matches dangerous pattern: $pattern" \
      '{
        systemMessage: ("Dangerous: Command matches dangerous pattern: " + $pattern),
        continue: false,
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: $reason
        }
      }'
    output_silent_success
    exit 0
  fi
done

# Command is safe, allow it silently
echo '{"continue": true, "suppressOutput": true}'
exit 0