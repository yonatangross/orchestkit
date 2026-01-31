#!/bin/bash
# Validate that declared counts match actual component counts
# Usage: validate-counts.sh
#
# Architecture: Single source of truth = filesystem
# Declared counts come from .claude-plugin/plugin.json description string
# Actual counts come from counting actual files
#
# Note: Commands were migrated to skills in v4.7.0, so command validation
# is skipped. The "17 user-invocable skills" have `user-invocable: true` in frontmatter
# (commit, configure, explore, review-pr, etc.) which are part of the 116 skills count.
# The remaining 99 skills have `user-invocable: false` (internal knowledge modules).
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
ACTUAL_SKILLS=$(find "$PROJECT_ROOT/src/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
ACTUAL_AGENTS=$(find "$PROJECT_ROOT/src/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
# Count hooks from hooks.json entries (global) + agent/skill-scoped hooks in frontmatter
# Global hooks: count "type": "command" entries in hooks.json
GLOBAL_HOOKS=$(grep -c '"type": "command"' "$PROJECT_ROOT/src/hooks/hooks.json" 2>/dev/null || echo "0")
# Scoped hooks: count 'command:' entries in agent/skill YAML frontmatter (hooks with run-hook handlers)
AGENT_HOOKS=0
for f in "$PROJECT_ROOT"/src/agents/*.md; do
  n=$(awk '/^---$/{if(++c==2) exit} /command:.*run-hook/{n++} END{print n+0}' "$f")
  AGENT_HOOKS=$((AGENT_HOOKS + n))
done
SKILL_HOOKS=0
while IFS= read -r f; do
  n=$(awk '/^---$/{if(++c==2) exit} /command:.*run-hook/{n++} END{print n+0}' "$f")
  SKILL_HOOKS=$((SKILL_HOOKS + n))
done < <(find "$PROJECT_ROOT/src/skills" -name "SKILL.md" -type f 2>/dev/null)
ACTUAL_HOOKS=$((GLOBAL_HOOKS + AGENT_HOOKS + SKILL_HOOKS))

# =============================================================================
# DECLARED COUNTS (from .claude-plugin/plugin.json description string)
# =============================================================================
# Try plugins/ork/plugin.json first (new structure), then fall back to root (old structure)
PLUGIN_JSON="$PROJECT_ROOT/plugins/ork/.claude-plugin/plugin.json"
if [[ ! -f "$PLUGIN_JSON" ]]; then
    PLUGIN_JSON="$PROJECT_ROOT/.claude-plugin/plugin.json"
fi
if [[ ! -f "$PLUGIN_JSON" ]]; then
    echo "ERROR: plugin.json not found at plugins/ork/.claude-plugin/ or .claude-plugin/"
    exit 1
fi

# Extract description and parse counts from it
# Format: "... with 90 skills (78 knowledge + 12 commands), 20 agents, 96 hooks..."
DESCRIPTION=$(jq -r '.description' "$PLUGIN_JSON")

# Parse counts from description using regex
# Skills: "N skills" (total including command-type skills)
DECLARED_SKILLS=$(echo "$DESCRIPTION" | grep -oE '[0-9]+ skills' | head -1 | grep -oE '[0-9]+' || echo "0")
# Agents: "N agents"
DECLARED_AGENTS=$(echo "$DESCRIPTION" | grep -oE '[0-9]+ agents' | head -1 | grep -oE '[0-9]+' || echo "0")
# Hooks: "N hooks" or "N TypeScript hooks" pattern
DECLARED_HOOKS=$(echo "$DESCRIPTION" | grep -oE '[0-9]+ (TypeScript )?hooks' | head -1 | grep -oE '[0-9]+' || echo "0")

# =============================================================================
# VALIDATION
# =============================================================================
ERRORS=0

echo "Validating component counts..."
echo "Source: .claude-plugin/plugin.json description"
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
    echo "To fix: Update .claude-plugin/plugin.json description to match actual counts"
    exit 1
else
    echo "Validation PASSED: All counts match"
    exit 0
fi
