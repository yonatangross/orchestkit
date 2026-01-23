#!/bin/bash
# Satisfaction Detector - Detects user satisfaction signals from conversation
# Hook: UserPromptSubmit
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "prompt/satisfaction-detector"
