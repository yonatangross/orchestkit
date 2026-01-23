#!/bin/bash
# issue-subtask-updater.sh - Auto-update issue checkboxes based on commit messages
# Hook: PostToolUse/Bash (git commit)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/bash/issue-subtask-updater"
