#!/bin/bash
# Review Summary Generator - Generates review summary on stop
# Hook: Stop
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/review-summary-generator"
