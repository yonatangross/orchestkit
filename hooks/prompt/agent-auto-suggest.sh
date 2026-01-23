#!/usr/bin/env bash
# Agent Auto-Suggest - UserPromptSubmit Hook
# Delegates to TypeScript implementation via hooks bundle
# Issue #197: Agent Orchestration Layer

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_ROOT="$(dirname "$SCRIPT_DIR")"

# Delegate to TypeScript bundle
exec node "$HOOKS_ROOT/bin/run-hook.mjs" "prompt/agent-auto-suggest"
