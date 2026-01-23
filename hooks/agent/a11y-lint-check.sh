#!/bin/bash
# A11y Lint Check - Agent Hook
# Runs accessibility linting on written files
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "agent/a11y-lint-check"
