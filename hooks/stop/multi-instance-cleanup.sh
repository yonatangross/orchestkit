#!/bin/bash
# Multi-Instance Cleanup Hook - Stop Hook
# Releases locks and updates instance status on session stop
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "stop/multi-instance-cleanup"
