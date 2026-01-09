#!/bin/bash
# Validate that hardcoded counts match actual component counts
# Usage: validate-counts.sh
#
# Exit codes:
#   0 - All counts match
#   1 - One or more counts mismatch

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Get actual counts
ACTUAL_SKILLS=$(find "$PROJECT_ROOT/.claude/skills" -name "capabilities.json" -type f 2>/dev/null | wc -l | tr -d ' ')
ACTUAL_AGENTS=$(find "$PROJECT_ROOT/.claude/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
ACTUAL_COMMANDS=$(find "$PROJECT_ROOT/.claude/commands" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
ACTUAL_HOOKS=$(find "$PROJECT_ROOT/.claude/hooks" -name "*.sh" -type f ! -path "*/_lib/*" 2>/dev/null | wc -l | tr -d ' ')

# Get declared counts from marketplace.json
MARKETPLACE="$PROJECT_ROOT/.claude-plugin/marketplace.json"
if [[ ! -f "$MARKETPLACE" ]]; then
    echo "ERROR: marketplace.json not found at $MARKETPLACE"
    exit 1
fi

DECLARED_SKILLS=$(jq '.features.skills' "$MARKETPLACE")
DECLARED_AGENTS=$(jq '.features.agents' "$MARKETPLACE")
DECLARED_COMMANDS=$(jq '.features.commands' "$MARKETPLACE")
DECLARED_HOOKS=$(jq '.features.hooks' "$MARKETPLACE")

# Validate
ERRORS=0

echo "Validating component counts..."
echo ""

if [[ "$ACTUAL_SKILLS" != "$DECLARED_SKILLS" ]]; then
    echo "❌ Skills: declared $DECLARED_SKILLS, actual $ACTUAL_SKILLS"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ Skills: $ACTUAL_SKILLS"
fi

if [[ "$ACTUAL_AGENTS" != "$DECLARED_AGENTS" ]]; then
    echo "❌ Agents: declared $DECLARED_AGENTS, actual $ACTUAL_AGENTS"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ Agents: $ACTUAL_AGENTS"
fi

if [[ "$ACTUAL_COMMANDS" != "$DECLARED_COMMANDS" ]]; then
    echo "❌ Commands: declared $DECLARED_COMMANDS, actual $ACTUAL_COMMANDS"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ Commands: $ACTUAL_COMMANDS"
fi

if [[ "$ACTUAL_HOOKS" != "$DECLARED_HOOKS" ]]; then
    echo "❌ Hooks: declared $DECLARED_HOOKS, actual $ACTUAL_HOOKS"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ Hooks: $ACTUAL_HOOKS"
fi

echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo "Validation FAILED: $ERRORS mismatches found"
    echo ""
    echo "Run 'bin/update-counts.sh' to fix"
    exit 1
else
    echo "Validation PASSED: All counts match"
    exit 0
fi