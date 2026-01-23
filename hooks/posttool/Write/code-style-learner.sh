#!/bin/bash
# code-style-learner.sh - Learn user's code style preferences from written code
# Hook: PostToolUse/Write
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/write/code-style-learner"
