#!/bin/bash
# Memory Bridge Hook - Graph-First Memory Sync
# Hook: PostToolUse (mcp__mem0__add_memory)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/memory-bridge"
