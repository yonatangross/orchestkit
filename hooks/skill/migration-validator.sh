#!/bin/bash
# Runs after Write for database-schema-designer skill
# Validates alembic migration files
set -euo pipefail

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

FILE="${CC_TOOL_FILE_PATH:-}"

if [ -z "$FILE" ]; then
  output_silent_success
  exit 0
fi

# Only check migration files
if [[ "$FILE" != *alembic/versions*.py ]]; then
  output_silent_success
  exit 0
fi

echo "::group::Migration Validation: $(basename "$FILE")" >&2

ERRORS=()

# Check for required functions
if ! grep -q "def upgrade" "$FILE"; then
  ERRORS+=("Missing upgrade() function in migration")
fi

if ! grep -q "def downgrade" "$FILE"; then
  ERRORS+=("Missing downgrade() function in migration")
fi

# Check for revision ID
if ! grep -q "^revision = " "$FILE"; then
  ERRORS+=("Missing revision ID in migration")
fi

# Validate syntax
if ! python3 -m py_compile "$FILE" 2>&1; then
  ERRORS+=("Python syntax error in migration")
fi

# Report errors
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo "::error::Migration validation failed" >&2
  for error in "${ERRORS[@]}"; do
    echo "  - $error" >&2
  done
  echo "::endgroup::" >&2

  # Output proper CC 2.1.7 JSON with context
  CTX="Migration validation failed for $FILE. See stderr for details."
  output_with_context "$CTX"
  exit 1
fi

echo "Migration file is valid" >&2
echo "::endgroup::" >&2

# Success - output proper CC 2.1.7 JSON
output_silent_success
exit 0
