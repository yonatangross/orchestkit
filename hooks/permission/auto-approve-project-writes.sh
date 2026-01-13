#!/bin/bash
set -euo pipefail
# Auto-Approve Project Writes - Auto-approves writes within project directory
# Hook: PermissionRequest (Write|Edit)
# CC 2.1.6 Compliant: includes continue field in all outputs

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

FILE_PATH=$(get_field '.tool_input.file_path')

log_hook "Evaluating write to: $FILE_PATH"

# Resolve to absolute path
if [[ "$FILE_PATH" != /* ]]; then
  FILE_PATH="$CLAUDE_PROJECT_DIR/$FILE_PATH"
fi

# Check if file is within project directory
if [[ "$FILE_PATH" == "$CLAUDE_PROJECT_DIR"* ]]; then
  # Additional check: not in node_modules, .git, etc.
  EXCLUDED_DIRS=(
    'node_modules'
    '.git'
    'dist'
    'build'
    '__pycache__'
    '.venv'
    'venv'
  )

  for dir in "${EXCLUDED_DIRS[@]}"; do
    if [[ "$FILE_PATH" == *"/$dir/"* ]]; then
      log_hook "Write to excluded directory: $dir"
      output_silent_success  # Let user decide, but silently
      exit 0
    fi
  done

  log_hook "Auto-approved: within project directory"
  # Silent approval - no user-visible output
  output_silent_allow
  exit 0
fi

# Outside project directory - let user decide (silent passthrough)
log_hook "Write outside project directory - manual approval required"
output_silent_success
exit 0