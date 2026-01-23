#!/bin/bash
# Security Scan Aggregator - Stop Hook
# CC 2.1.3 Compliant - Uses 10-minute hook timeout
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "stop/security-scan-aggregator"
