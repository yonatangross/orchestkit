#!/bin/bash
# Validate that declared counts match actual component counts
# Usage: validate-counts.sh
#
# Architecture: Single source of truth = filesystem
# Declared counts come from plugin.json description string
# Actual counts come from counting actual files
#
# Note: Commands were migrated to skills in v4.7.0, so command validation
# is skipped. The "17 user-invocable skills" have `user-invocable: true` in frontmatter
# (commit, configure, explore, review-pr, etc.) which are part of the 97 skills count.
# The remaining 80 skills have `user-invocable: false` (internal knowledge modules).
#
# Exit codes:
#   0 - All counts match
#   1 - One or more counts mismatch

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# =============================================================================
# ACTUAL COUNTS (filesystem = source of truth)
# =============================================================================
ACTUAL_SKILLS=$(find "$PROJECT_ROOT/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
ACTUAL_AGENTS=$(find "$PROJECT_ROOT/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
ACTUAL_HOOKS=$(find "$PROJECT_ROOT/hooks" -name "*.sh" -type f ! -path "*/_lib/*" 2>/dev/null | wc -l | tr -d ' ')

# =============================================================================
# DECLARED COUNTS (from plugin.json description string)
# =============================================================================
PLUGIN_JSON="$PROJECT_ROOT/plugin.json"
if [[ ! -f "$PLUGIN_JSON" ]]; then
    echo "ERROR: plugin.json not found at $PLUGIN_JSON"
    exit 1
fi

# Extract description and parse counts from it
# Format: "... with 90 skills (78 knowledge + 12 commands), 20 agents, 96 hooks..."
DESCRIPTION=$(jq -r '.description' "$PLUGIN_JSON")

# Parse counts from description using regex
# Skills: "N skills" (total including command-type skills)
DECLARED_SKILLS=$(echo "$DESCRIPTION" | grep -oE '[0-9]+ skills' | grep -oE '[0-9]+' || echo "0")
# Agents: "N agents"
DECLARED_AGENTS=$(echo "$DESCRIPTION" | grep -oE '[0-9]+ agents' | grep -oE '[0-9]+' || echo "0")
# Hooks: "N hooks"
DECLARED_HOOKS=$(echo "$DESCRIPTION" | grep -oE '[0-9]+[^0-9]*hooks' | grep -oE '[0-9]+' || echo "0")

# =============================================================================
# VALIDATION
# =============================================================================
ERRORS=0

echo "Validating component counts..."
echo "Source: plugin.json description"
echo ""

if [[ "$ACTUAL_SKILLS" != "$DECLARED_SKILLS" ]]; then
    echo "❌ Skills: declared $DECLARED_SKILLS, actual $ACTUAL_SKILLS"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ Skills: $ACTUAL_SKILLS (includes command-type skills)"
fi

if [[ "$ACTUAL_AGENTS" != "$DECLARED_AGENTS" ]]; then
    echo "❌ Agents: declared $DECLARED_AGENTS, actual $ACTUAL_AGENTS"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ Agents: $ACTUAL_AGENTS"
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
    echo "To fix: Update plugin.json description to match actual counts"
    exit 1
else
    echo "Validation PASSED: All counts match"
    exit 0
fi
