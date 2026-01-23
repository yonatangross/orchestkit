#!/bin/bash
# Context Injector - Injects relevant context into user prompts
# Hook: UserPromptSubmit
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "prompt/context-injector"
