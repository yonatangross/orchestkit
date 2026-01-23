#!/bin/bash
# Memory Context - Auto-searches knowledge graph for relevant context
# Hook: UserPromptSubmit
# CC 2.1.7 Compliant - Graph-First Architecture (v2.1)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "prompt/memory-context"
