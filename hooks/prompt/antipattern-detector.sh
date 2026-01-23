#!/bin/bash
# Antipattern Detector - Suggests checking mem0 for known failed patterns
# Hook: UserPromptSubmit
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "prompt/antipattern-detector"
