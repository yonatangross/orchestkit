#!/bin/bash
set -euo pipefail
# Docstring Enforcer Hook for Claude Code
# Checks if public functions have docstrings
# For Python: checks for """ docstrings
# For TypeScript: checks for JSDoc /** */ comments
# CC 2.1.9 Enhanced: Uses additionalContext for warnings (does not block)
# Hook: PreToolUse (Write)
# Issue: #139

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

# Self-guard: Only run for code files
guard_code_files || exit 0

# Self-guard: Skip internal/generated files
guard_skip_internal || exit 0

# Get file path and content
FILE_PATH=$(get_field '.tool_input.file_path')
NEW_CONTENT=$(get_field '.tool_input.content // ""')

# Skip if no file path
if [[ -z "$FILE_PATH" ]]; then
  output_silent_success
  exit 0
fi

# Skip if no content (probably an Edit, not Write)
if [[ -z "$NEW_CONTENT" ]]; then
  output_silent_success
  exit 0
fi

# Skip test files - docstrings are less critical
case "$FILE_PATH" in
  *test*|*spec*|*__tests__*|*_test.py|*.test.ts|*.spec.ts)
    output_silent_success
    exit 0
    ;;
esac

# Determine file type
FILE_EXT="${FILE_PATH##*.}"
FILE_EXT_LOWER=$(printf '%s' "$FILE_EXT" | tr '[:upper:]' '[:lower:]')

MISSING_DOCSTRINGS=""
MISSING_COUNT=0

# Python docstring check
if [[ "$FILE_EXT_LOWER" == "py" ]]; then
  # Find public functions without docstrings
  # Public functions: def func_name( where func_name doesn't start with _
  # Should be followed by """ or ''' on the next non-empty line

  # Use awk to detect functions missing docstrings
  MISSING_DOCSTRINGS=$(echo "$NEW_CONTENT" | awk '
    /^def [^_][a-zA-Z0-9_]*\(/ || /^    def [^_][a-zA-Z0-9_]*\(/ || /^async def [^_][a-zA-Z0-9_]*\(/ {
      func_line = $0
      # Extract function name
      gsub(/^(async )?def /, "", func_line)
      gsub(/\(.*/, "", func_line)
      func_name = func_line

      # Read next non-empty line
      while ((getline line) > 0) {
        if (line ~ /^[[:space:]]*$/) continue
        if (line ~ /^[[:space:]]*"""/ || line ~ /^[[:space:]]*'"'"''"'"''"'"'/) {
          break  # Has docstring
        } else {
          print func_name  # Missing docstring
          break
        }
      }
    }
  ' 2>/dev/null | head -5)

  MISSING_COUNT=$(echo "$MISSING_DOCSTRINGS" | grep -c . 2>/dev/null || echo "0")
fi

# TypeScript/JavaScript JSDoc check
if [[ "$FILE_EXT_LOWER" == "ts" || "$FILE_EXT_LOWER" == "tsx" || "$FILE_EXT_LOWER" == "js" || "$FILE_EXT_LOWER" == "jsx" ]]; then
  # Find exported functions without JSDoc
  # Exported functions: export function/const/async function
  # Should be preceded by /** ... */ comment

  MISSING_DOCSTRINGS=$(echo "$NEW_CONTENT" | awk '
    BEGIN { prev_line = ""; has_jsdoc = 0 }
    {
      # Check if previous non-empty line was end of JSDoc
      if (prev_line ~ /\*\/[[:space:]]*$/) {
        has_jsdoc = 1
      }

      # Check for exported function
      if (/^export (async )?function [a-zA-Z]/ || /^export const [a-zA-Z][a-zA-Z0-9_]* = (async )?\(/ || /^export const [a-zA-Z][a-zA-Z0-9_]* = (async )?function/) {
        if (!has_jsdoc) {
          # Extract function/const name
          name = $0
          gsub(/^export (async )?function /, "", name)
          gsub(/^export const /, "", name)
          gsub(/[[:space:]=\(].*/, "", name)
          print name
        }
        has_jsdoc = 0
      }

      # Track non-empty lines
      if ($0 !~ /^[[:space:]]*$/) {
        prev_line = $0
        if ($0 !~ /\*\//) {
          has_jsdoc = 0
        }
      }
    }
  ' 2>/dev/null | head -5)

  MISSING_COUNT=$(echo "$MISSING_DOCSTRINGS" | grep -c . 2>/dev/null || echo "0")
fi

# If missing docstrings found, inject warning context
if [[ "$MISSING_COUNT" -gt 0 && -n "$MISSING_DOCSTRINGS" ]]; then
  # Format function names for message
  FUNC_LIST=$(echo "$MISSING_DOCSTRINGS" | tr '\n' ', ' | sed 's/,$//' | sed 's/,/, /g')

  if [[ "$FILE_EXT_LOWER" == "py" ]]; then
    CONTEXT_MSG="Documentation: $MISSING_COUNT public function(s) missing docstrings: $FUNC_LIST. Consider adding \"\"\"docstrings\"\"\" for better code documentation."
  else
    CONTEXT_MSG="Documentation: $MISSING_COUNT exported function(s) missing JSDoc: $FUNC_LIST. Consider adding /** JSDoc */ comments for better IDE support."
  fi

  # Truncate if too long
  if [[ ${#CONTEXT_MSG} -gt 200 ]]; then
    if [[ "$FILE_EXT_LOWER" == "py" ]]; then
      CONTEXT_MSG="Documentation: $MISSING_COUNT public function(s) missing docstrings. Add \"\"\"docstrings\"\"\" for better documentation."
    else
      CONTEXT_MSG="Documentation: $MISSING_COUNT exported function(s) missing JSDoc. Add /** JSDoc */ for better IDE support."
    fi
  fi

  log_hook "DOCSTRING_WARN: $MISSING_COUNT functions missing docs in $FILE_PATH"
  output_with_context "$CONTEXT_MSG"
  exit 0
fi

# All public functions documented - allow silently
log_hook "DOCSTRING_OK: All public functions documented in $FILE_PATH"
output_silent_success
exit 0
