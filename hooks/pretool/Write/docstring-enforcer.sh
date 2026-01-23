#!/bin/bash
# Docstring Enforcer - Checks if public functions have docstrings
# Hook: PreToolUse (Write)
# CC 2.1.9: Uses additionalContext for documentation warnings
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "pretool/Write/docstring-enforcer"
