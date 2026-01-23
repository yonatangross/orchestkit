#!/bin/bash
# issue-progress-commenter.sh - Queue commit progress for GitHub issue updates
# Hook: PostToolUse/Bash (git commit)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/bash/issue-progress-commenter"
