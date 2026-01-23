#!/bin/bash
# Antipattern Warning - Proactive anti-pattern detection and warning injection
# Hook: UserPromptSubmit
# CC 2.1.9 Compliant: Uses additionalContext for warnings
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "prompt/antipattern-warning"
