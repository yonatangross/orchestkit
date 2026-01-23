#!/bin/bash
# Release Lock on Commit - Releases file locks after successful git commit
# Hook: PostToolUse/Write
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/write/release-lock-on-commit"
