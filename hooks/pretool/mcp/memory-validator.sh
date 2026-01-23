#!/bin/bash
# Memory Knowledge Graph Validator - Validates memory operations
# Hook: PreToolUse (MCP)
# CC 2.1.7: Warns about bulk operations
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "pretool/mcp/memory-validator"
