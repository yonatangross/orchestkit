#!/bin/bash
# Security Pattern Validator - Detects security anti-patterns before write
# Hook: PreToolUse (Write)
# CC 2.1.9: Uses additionalContext for security warnings
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "pretool/Write/security-pattern-validator"
