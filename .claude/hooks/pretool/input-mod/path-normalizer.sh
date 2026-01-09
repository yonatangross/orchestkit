#!/bin/bash
# path-normalizer.sh - Normalizes file paths to absolute paths for Read/Write/Edit/Glob/Grep tools
# CC 2.1.2 Compliant: includes continue field in all outputs
# Part of SkillForge Claude Plugin v4.6.0

set -euo pipefail

# Read input from stdin
INPUT=$(cat)

# Extract tool name and parameters (using correct Claude Code field names)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
PARAMS=$(echo "$INPUT" | jq -r '.tool_input // {}')

# Track if any path was actually changed
PATH_CHANGED=false

# Function to normalize a single path
normalize_path() {
  local path="$1"

  # Return empty if path is empty
  if [[ -z "$path" ]]; then
    echo ""
    return
  fi

  # Expand ~ to home directory
  if [[ "$path" == "~"* ]]; then
    path="${HOME}${path:1}"
  fi

  # Convert to absolute path if relative
  if [[ "$path" != /* ]]; then
    # Use realpath if available, otherwise use pwd-based resolution
    if command -v realpath &> /dev/null; then
      path=$(realpath -m "$path" 2>/dev/null || echo "$PWD/$path")
    else
      path="$PWD/$path"
    fi
  fi

  # Normalize by removing redundant slashes and . components
  path=$(echo "$path" | sed 's|//\+|/|g' | sed 's|/\./|/|g')

  echo "$path"
}

# Function to update path parameter in JSON
update_path_param() {
  local param_name="$1"
  local original_path
  local normalized_path

  original_path=$(echo "$PARAMS" | jq -r ".$param_name // empty")

  if [[ -n "$original_path" && "$original_path" != "null" ]]; then
    normalized_path=$(normalize_path "$original_path")

    # Only update if path changed
    if [[ "$normalized_path" != "$original_path" ]]; then
      PARAMS=$(echo "$PARAMS" | jq --arg path "$normalized_path" ".$param_name = \$path")
      PATH_CHANGED=true
    fi
  fi
}

# Normalize paths based on tool
case "$TOOL_NAME" in
  Read|Write|Edit)
    update_path_param "file_path"
    ;;
  Glob|Grep)
    update_path_param "path"
    ;;
esac

# ANSI colors
GREEN=$'\033[32m'
CYAN=$'\033[36m'
RESET=$'\033[0m'

# Output decision with colored systemMessage
# Show different message based on whether path was actually normalized
if [[ "$PATH_CHANGED" == "true" ]]; then
  MSG="${GREEN}✓${RESET} Path normalized"
else
  MSG="${GREEN}✓${RESET} Path OK"
fi

jq -n \
  --arg msg "$MSG" \
  --argjson params "$PARAMS" \
  '{
    systemMessage: $msg,
    continue: true,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: $params
    }
  }'