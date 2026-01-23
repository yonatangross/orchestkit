#!/bin/bash
# Full Test Suite Runner - Stop Hook
# CC 2.1.3 Compliant - Uses 10-minute hook timeout
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "stop/full-test-suite"
