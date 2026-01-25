#!/usr/bin/env bash
# =============================================================================
# Test: Hooks Location (Quick Check)
# =============================================================================
# Quick test to ensure hooks are in the correct location per Claude Code
# This is a simpler version for CI pipelines
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "Testing Claude Code hooks location..."

# Test 1: hooks/hooks.json must exist
if [[ ! -f "$PROJECT_ROOT/src/hooks/hooks.json" ]]; then
    echo "FAIL: hooks/hooks.json not found"
    echo "  Claude Code requires hooks to be defined in hooks/hooks.json"
    exit 1
fi

# Test 2: hooks/hooks.json must be valid JSON with hooks wrapper
if ! jq -e '.hooks' "$PROJECT_ROOT/src/hooks/hooks.json" >/dev/null 2>&1; then
    echo "FAIL: hooks/hooks.json missing 'hooks' wrapper object"
    echo "  Format must be: {\"hooks\": {\"PreToolUse\": [...], ...}}"
    exit 1
fi

# Test 3: plugin.json must NOT have inline hooks
if jq -e '.hooks | keys | length > 0' "$PROJECT_ROOT/.claude-plugin/plugin.json" 2>/dev/null; then
    echo "FAIL: .claude-plugin/plugin.json has inline hooks"
    echo "  Claude Code requires hooks in hooks/hooks.json, not inline in plugin.json"
    exit 1
fi

echo "PASS: Hooks correctly located in hooks/hooks.json"
exit 0
