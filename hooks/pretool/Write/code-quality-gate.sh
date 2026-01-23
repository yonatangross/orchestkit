#!/bin/bash
# Code Quality Gate - Unified code quality checks before write
# Hook: PreToolUse (Write)
# CC 2.1.9: Uses additionalContext for quality warnings
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "pretool/Write/code-quality-gate"
