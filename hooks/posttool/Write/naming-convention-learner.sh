#!/bin/bash
# naming-convention-learner.sh - Learn project naming conventions from written code
# Hook: PostToolUse/Write
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/write/naming-convention-learner"
