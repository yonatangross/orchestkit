#!/bin/bash
# Setup Check - Entry point for CC 2.1.11 Setup hooks
# Triggered by --init, --init-only, --maintenance
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "setup/setup-check"
