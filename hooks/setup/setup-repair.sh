#!/bin/bash
# Setup Repair - Self-healing for broken installations
# CC 2.1.11 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "setup/setup-repair"
