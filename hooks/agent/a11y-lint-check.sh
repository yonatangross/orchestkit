#!/usr/bin/env bash
# a11y-lint-check.sh - Runs accessibility linting on written files
#
# Used by: accessibility-specialist
#
# Purpose: Auto-lint written files for accessibility issues
#
# CC 2.1.7 compliant output format

set -euo pipefail

# Get file path from hook context
FILE_PATH="${CLAUDE_TOOL_INPUT_FILE_PATH:-}"
TOOL_NAME="${CLAUDE_TOOL_NAME:-}"

# Only run on Write operations to frontend files
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
    cat <<EOF
{
  "continue": true,
  "suppressOutput": true
}
EOF
    exit 0
fi

# Check if file is a frontend file that should be linted
case "$FILE_PATH" in
    *.tsx|*.jsx|*.html)
        # Could integrate with axe-linter or eslint-plugin-jsx-a11y here
        # For now, just provide guidance
        cat <<EOF
{
  "continue": true,
  "suppressOutput": false,
  "hookSpecificOutput": {
    "additionalContext": "A11y reminder: Verify WCAG 2.2 compliance - check color contrast, ARIA labels, keyboard navigation, and focus management."
  }
}
EOF
        exit 0
        ;;
    *)
        # Non-frontend files pass through
        cat <<EOF
{
  "continue": true,
  "suppressOutput": true
}
EOF
        exit 0
        ;;
esac
