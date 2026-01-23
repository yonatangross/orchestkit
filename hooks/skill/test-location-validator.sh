#!/bin/bash
# Test Location Validator - Validates test file locations
# Hook: PreToolUse (Write/Edit)
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/test-location-validator"
