#!/bin/bash
# Memory Fabric Lazy Initialization - One-time setup on first memory call
# Hook: PreToolUse (MCP)
# CC 2.1.9: Uses additionalContext for initialization status
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "pretool/mcp/memory-fabric-init"
