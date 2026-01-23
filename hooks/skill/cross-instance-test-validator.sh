#!/bin/bash
# Cross-Instance Test Validator - Ensures test coverage across worktrees
# Hook: PostToolUse (Write/Edit)
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/cross-instance-test-validator"
