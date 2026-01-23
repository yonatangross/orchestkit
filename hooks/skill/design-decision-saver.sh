#!/bin/bash
# Design Decision Saver - Reminds to save design decisions
# Hook: Stop
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/design-decision-saver"
