#!/bin/bash
# Skill Auto-Suggest - Proactive skill suggestion based on prompt analysis
# Hook: UserPromptSubmit
# CC 2.1.9 Compliant: Uses additionalContext for suggestions
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "prompt/skill-auto-suggest"
