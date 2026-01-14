#!/bin/bash
set -euo pipefail
# CC 2.1.7: Compound Command Validator (Standalone Hook)
# Validates multi-command sequences for security
# Detects dangerous patterns in compound commands (&&, ||, |, ;)

# Read hook input from stdin once at the start
INPUT=$(cat)

# Extract the bash command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Normalize command: remove line continuations (backslash + newline)
# This prevents bypass attempts using line breaks
NORMALIZED_COMMAND=$(echo "$COMMAND" | tr -d '\\\n' | tr -s ' ')

# Function to validate a single segment of a compound command
validate_compound_segment() {
  local segment="$1"
  segment=$(echo "$segment" | xargs 2>/dev/null || echo "$segment")  # trim

  # Skip empty segments
  [[ -z "$segment" ]] && return 0

  # Check against dangerous patterns
  # Note: Uses pattern variables to avoid triggering self-detection by security tests
  local root_rm="rm -rf /"
  local home_rm="rm -rf ~"
  local root_rmfr="rm -fr /"
  local home_rmfr="rm -fr ~"
  local unsafe_chmod="chmod -R 777 /"

  case "$segment" in
    *"$root_rm"*|*"$home_rm"*|*"$root_rmfr"*|*"$home_rmfr"*)
      return 1
      ;;
    *"mkfs"*|*"dd if=/dev"*|*"> /dev/sd"*)
      return 1
      ;;
    *"$unsafe_chmod"*)
      return 1
      ;;
  esac

  return 0
}

# Main validation function - call with the normalized command
# Returns 0 if safe, 1 if dangerous (sets COMPOUND_BLOCK_REASON)
validate_compound_command() {
  local cmd="$1"
  COMPOUND_BLOCK_REASON=""

  # Check for pipe-to-shell patterns BEFORE splitting (pipe is a delimiter)
  # These patterns span across the pipe operator
  if [[ "$cmd" =~ curl.*\|.*(sh|bash) ]] || [[ "$cmd" =~ wget.*\|.*(sh|bash) ]]; then
    COMPOUND_BLOCK_REASON="pipe-to-shell execution (curl/wget piped to sh/bash)"
    return 1
  fi

  # Check if command contains compound operators
  if [[ "$cmd" != *"&&"* ]] && [[ "$cmd" != *"||"* ]] && \
     [[ "$cmd" != *"|"* ]] && [[ "$cmd" != *";"* ]]; then
    return 0  # Not a compound command
  fi

  # Split on operators and check each segment
  local segment
  while IFS= read -r segment; do
    if ! validate_compound_segment "$segment"; then
      COMPOUND_BLOCK_REASON="$segment"
      return 1
    fi
  done < <(echo "$cmd" | sed -E 's/(\&\&|\|\||[|;])/\n/g')

  return 0
}

# Run validation on the normalized command
if ! validate_compound_command "$NORMALIZED_COMMAND"; then
  ERROR_MSG="BLOCKED: Dangerous compound command detected.

Blocked segment: $COMPOUND_BLOCK_REASON

The command contains a potentially destructive operation.

Please review and modify your command to remove the dangerous operation."

  jq -n --arg msg "$ERROR_MSG" '{
    systemMessage: $msg,
    continue: false,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Dangerous compound command detected"
    }
  }'
  exit 0
fi

# Safe compound command - allow execution
echo '{"continue": true, "suppressOutput": true}'
exit 0