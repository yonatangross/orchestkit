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
ACTUAL_AGENTS=$(find "$PROJECT_ROOT/src/agents" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
# Hook counting — delegate to single source of truth
eval "$("$PROJECT_ROOT/bin/count-hooks.sh")"
ACTUAL_HOOKS=$TOTAL

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

# =============================================================================
# VERSION DRIFT CHECK (package.json = source of truth)
# =============================================================================
# Ensures all sibling files stay synchronized with package.json version.
# The version is propagated by scripts/stamp-counts.sh during `npm run build`.
check_version() {
    local label="$1"
    local file="$2"
    local actual="$3"
    if [[ "$actual" != "$EXPECTED_VERSION" ]]; then
        echo "Version drift detected: package.json says $EXPECTED_VERSION but $file has $actual"
        ERRORS=$((ERRORS + 1))
    else
        echo "✓ Version $label: $actual"
    fi
}

echo "Validating version sync..."
EXPECTED_VERSION=$(jq -r '.version' "$PROJECT_ROOT/package.json")

if [[ -f "$PROJECT_ROOT/pyproject.toml" ]]; then
    PY_VERSION=$(grep -E '^version = ' "$PROJECT_ROOT/pyproject.toml" | head -1 | sed -E 's/^version = "([^"]+)".*/\1/')
    check_version "pyproject.toml" "pyproject.toml" "$PY_VERSION"
fi

if [[ -f "$PROJECT_ROOT/manifests/ork.json" ]]; then
    ORK_VERSION=$(jq -r '.version' "$PROJECT_ROOT/manifests/ork.json")
    check_version "manifests/ork.json" "manifests/ork.json" "$ORK_VERSION"
fi

if [[ -f "$PROJECT_ROOT/.claude-plugin/marketplace.json" ]]; then
    MKT_TOP=$(jq -r '.version' "$PROJECT_ROOT/.claude-plugin/marketplace.json")
    check_version "marketplace.json (top)" ".claude-plugin/marketplace.json" "$MKT_TOP"
    MKT_PLUGIN=$(jq -r '.plugins[0].version' "$PROJECT_ROOT/.claude-plugin/marketplace.json")
    check_version "marketplace.json (plugins[0])" ".claude-plugin/marketplace.json (plugins[0])" "$MKT_PLUGIN"
fi

if [[ -f "$PROJECT_ROOT/.release-please-manifest.json" ]]; then
    RP_VERSION=$(jq -r '."."' "$PROJECT_ROOT/.release-please-manifest.json")
    check_version ".release-please-manifest.json" ".release-please-manifest.json" "$RP_VERSION"
fi

if [[ -f "$PROJECT_ROOT/CLAUDE.md" ]]; then
    CM_VERSION=$(grep -E '\*\*Current\*\*: [0-9]+\.[0-9]+\.[0-9]+' "$PROJECT_ROOT/CLAUDE.md" | head -1 | sed -E 's/.*\*\*Current\*\*: ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')
    check_version "CLAUDE.md" "CLAUDE.md" "$CM_VERSION"
fi

echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo "Validation FAILED: $ERRORS mismatches found"
    echo ""
    echo "To fix: Update .claude-plugin/plugin.json description to match actual counts,"
    echo "        or run 'npm run build' to re-propagate the version from package.json."
    exit 1
else
    echo "Validation PASSED: All counts and versions match"
    exit 0
fi
