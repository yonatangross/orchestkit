#!/bin/bash
# File Guard - Protects sensitive files from modification
# Hook: PreToolUse (Write|Edit)
#
# SECURITY: Resolves symlinks before checking patterns (ME-001 fix)
# to prevent symlink-based bypasses of file protection.

set -euo pipefail

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../../_lib/common.sh"

FILE_PATH=$(get_field '.tool_input.file_path')

log_hook "File write/edit: $FILE_PATH"

# Resolve symlinks to prevent bypass attacks (ME-001 fix)
# Use readlink -f on Linux, or fallback for macOS
if command -v greadlink &>/dev/null; then
  REAL_PATH=$(greadlink -f "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
elif command -v readlink &>/dev/null; then
  # macOS readlink doesn't support -f, use perl fallback
  if [[ "$OSTYPE" == "darwin"* ]]; then
    REAL_PATH=$(perl -MCwd -e 'print Cwd::abs_path($ARGV[0])' "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
  else
    REAL_PATH=$(readlink -f "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
  fi
else
  REAL_PATH="$FILE_PATH"
fi

log_hook "Resolved path: $REAL_PATH"

# Protected file patterns
PROTECTED_PATTERNS=(
  '\.env$'
  '\.env\.local$'
  '\.env\.production$'
  'credentials\.json$'
  'secrets\.json$'
  'private\.key$'
  '\.pem$'
  'id_rsa$'
  'id_ed25519$'
)

# Check if file matches protected patterns (using resolved path)
for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$REAL_PATH" =~ $pattern ]]; then
    block_with_error "Protected File" "Cannot modify protected file: $FILE_PATH (resolved: $REAL_PATH)

This file matches protected pattern: $pattern

Protected files include:
- Environment files (.env, .env.local, .env.production)
- Credential files (credentials.json, secrets.json)
- Private keys (.pem, id_rsa, id_ed25519)

If you need to modify this file, do it manually outside Claude Code."
  fi
done

# Warn on configuration files (but allow)
CONFIG_PATTERNS=(
  'package\.json$'
  'pyproject\.toml$'
  'tsconfig\.json$'
)

for pattern in "${CONFIG_PATTERNS[@]}"; do
  if [[ "$REAL_PATH" =~ $pattern ]]; then
    warn "Modifying configuration file: $FILE_PATH"
    log_hook "WARNING: Config file modification: $REAL_PATH"
  fi
done

# Output systemMessage for user visibility
echo '{"continue": true, "suppressOutput": true}'
exit 0
