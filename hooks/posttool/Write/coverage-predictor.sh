#!/bin/bash
# Test Coverage Predictor - Predicts if new code has adequate test coverage
# Hook: PostToolUse/Write
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/write/coverage-predictor"
