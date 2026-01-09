#!/bin/bash
# Runs after Write in testing skills
# Auto-runs the test file that was just created/modified

FILE="$CC_TOOL_FILE_PATH"

if [ -z "$FILE" ]; then
  exit 0
fi

# Python test files
if [[ "$FILE" == *test*.py ]] || [[ "$FILE" == *_test.py ]]; then
  echo "::group::Auto-running Python test: $(basename "$FILE")"
  cd "$(dirname "$FILE")" 2>/dev/null || true

  if command -v poetry &> /dev/null && [ -f "pyproject.toml" ]; then
    poetry run pytest "$FILE" -v --tb=short 2>&1 | tail -30
  elif command -v pytest &> /dev/null; then
    pytest "$FILE" -v --tb=short 2>&1 | tail -30
  else
    echo "pytest not found - skipping auto-run"
  fi
  echo "::endgroup::"
fi

# TypeScript/JavaScript test files
if [[ "$FILE" == *test*.ts ]] || [[ "$FILE" == *spec*.ts ]] || \
   [[ "$FILE" == *test*.tsx ]] || [[ "$FILE" == *spec*.tsx ]]; then
  echo "::group::Auto-running TypeScript test: $(basename "$FILE")"

  # Find project root (where package.json is)
  DIR="$FILE"
  while [ "$DIR" != "/" ]; do
    DIR="$(dirname "$DIR")"
    if [ -f "$DIR/package.json" ]; then
      cd "$DIR"
      npm test -- --testPathPattern="$(basename "$FILE" | sed 's/\.[^.]*$//')" 2>&1 | tail -30
      break
    fi
  done
  echo "::endgroup::"
fi

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0
