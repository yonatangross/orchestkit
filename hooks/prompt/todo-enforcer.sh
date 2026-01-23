#!/bin/bash
# Todo Enforcer - Reminds about todo tracking for complex tasks
# Hook: UserPromptSubmit
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "prompt/todo-enforcer"
