#!/bin/bash
# Runs after Write for database-schema-designer skill
# Validates alembic migration files

FILE="$CC_TOOL_FILE_PATH"

if [ -z "$FILE" ]; then
  exit 0
fi

# Only check migration files
if [[ "$FILE" != *alembic/versions*.py ]]; then
  exit 0
fi

echo "::group::Migration Validation: $(basename "$FILE")"

# Check for required functions
if ! grep -q "def upgrade" "$FILE"; then
  echo "::error::Missing upgrade() function in migration"
  exit 1
fi

if ! grep -q "def downgrade" "$FILE"; then
  echo "::error::Missing downgrade() function in migration"
  exit 1
fi

# Check for revision ID
if ! grep -q "^revision = " "$FILE"; then
  echo "::error::Missing revision ID in migration"
  exit 1
fi

# Validate syntax
python3 -m py_compile "$FILE" 2>&1
if [ $? -ne 0 ]; then
  echo "::error::Python syntax error in migration"
  exit 1
fi

echo "Migration file is valid"
echo "::endgroup::"

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
# echo '{"systemMessage":"Migration validated","continue":true}'
exit 0
