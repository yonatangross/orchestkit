#!/bin/bash
# Agent Memory Store - Extracts and stores successful patterns after agent completion
# Hook: SubagentStop
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "subagent-stop/agent-memory-store"
