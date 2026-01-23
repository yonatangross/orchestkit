#!/bin/bash
# Test Runner - Auto-runs test files after creation/modification
# Hook: PostToolUse (Write)
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/test-runner"
