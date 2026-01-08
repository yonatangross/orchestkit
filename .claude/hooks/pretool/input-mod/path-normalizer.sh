#!/bin/bash
# path-normalizer.sh - Normalizes file paths to absolute paths for Read/Write/Edit/Glob/Grep tools
# Part of SkillForge Claude Plugin v4.4.2

set -euo pipefail

# Read input from stdin
INPUT=$(cat)

# Extract tool name and parameters (using correct Claude Code field names)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
PARAMS=$(echo "$INPUT" | jq -r '.tool_input // {}')

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
      # Silent operation - log to file if needed instead of stderr (causes "hook error" display)
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

# Output decision with systemMessage for user visibility
jq -n \
  --argjson params "$PARAMS" \
  '{
    systemMessage: "Path normalized",
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: $params
    }
  }'
