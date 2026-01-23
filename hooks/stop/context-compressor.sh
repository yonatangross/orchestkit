#!/bin/bash
# Context Compressor - Session End Hook
# Compresses and archives context at end of session
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "stop/context-compressor"
