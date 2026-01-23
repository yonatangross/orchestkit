#!/bin/bash
# Context Pruning Advisor - Recommends context pruning when usage exceeds 70%
# Hook: UserPromptSubmit
# CC 2.1.9 Compliant: Uses additionalContext for recommendations
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "prompt/context-pruning-advisor"
