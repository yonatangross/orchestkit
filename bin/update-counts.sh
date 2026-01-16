#!/bin/bash
# Update component counts in all relevant files
# Usage: update-counts.sh [--dry-run]
#
# Architecture: Single source of truth = filesystem
# Updates declared counts in: .claude-plugin/plugin.json, CLAUDE.md, README.md
# Does NOT update marketplace.json (external schema, not our format)
#
# Updates:
# - .claude-plugin/plugin.json (description string)
# - CLAUDE.md (count references)
# - README.md (count references)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "DRY RUN - no files will be modified"
    echo ""
fi

# =============================================================================
# COUNT ACTUAL COMPONENTS (filesystem = source of truth)
# =============================================================================
if [[ -d "$PROJECT_ROOT/skills" ]]; then
    SKILLS=$(find "$PROJECT_ROOT/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
else
    SKILLS=0
fi

if [[ -d "$PROJECT_ROOT/agents" ]]; then
    AGENTS=$(find "$PROJECT_ROOT/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
else
    AGENTS=0
fi

if [[ -d "$PROJECT_ROOT/.claude/commands" ]]; then
    COMMANDS=$(find "$PROJECT_ROOT/.claude/commands" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
else
    COMMANDS=0
fi

if [[ -d "$PROJECT_ROOT/hooks" ]]; then
    HOOKS=$(find "$PROJECT_ROOT/hooks" -name "*.sh" -type f ! -path "*/_lib/*" 2>/dev/null | wc -l | tr -d ' ')
else
    HOOKS=0
fi

echo "Current counts (from filesystem):"
echo "  Skills:   $SKILLS"
echo "  Agents:   $AGENTS"
echo "  Commands: $COMMANDS"
echo "  Hooks:    $HOOKS"
echo ""

# =============================================================================
# UPDATE .claude-plugin/plugin.json (primary source of declared counts)
# =============================================================================
PLUGIN_JSON="$PROJECT_ROOT/.claude-plugin/plugin.json"
if [[ -f "$PLUGIN_JSON" ]]; then
    echo "Updating $PLUGIN_JSON..."

    if [[ "$DRY_RUN" == "false" ]]; then
        # Build new description string
        NEW_DESC="Comprehensive AI-assisted development toolkit with $SKILLS skills, $COMMANDS commands, $AGENTS agents, $HOOKS hooks, and production-ready patterns for modern full-stack development"

        # Update description in plugin.json
        jq --arg desc "$NEW_DESC" '.description = $desc' "$PLUGIN_JSON" > "${PLUGIN_JSON}.tmp" && mv "${PLUGIN_JSON}.tmp" "$PLUGIN_JSON"
        echo "  ✓ Updated plugin.json"
    else
        echo "  Would update description with: $SKILLS skills, $COMMANDS commands, $AGENTS agents, $HOOKS hooks"
    fi
fi

# =============================================================================
# UPDATE CLAUDE.md (documentation)
# =============================================================================
CLAUDE_MD="$PROJECT_ROOT/CLAUDE.md"
if [[ -f "$CLAUDE_MD" ]]; then
    echo "Updating $CLAUDE_MD..."

    if [[ "$DRY_RUN" == "false" ]]; then
        # Use sed to replace patterns like "78 skills" -> "$SKILLS skills"
        if [[ "$(uname)" == "Darwin" ]]; then
            sed -i '' -E "s/[0-9]+ [Ss]kills/$SKILLS skills/g" "$CLAUDE_MD"
            sed -i '' -E "s/[0-9]+ [Aa]gents/$AGENTS agents/g" "$CLAUDE_MD"
            sed -i '' -E "s/[0-9]+ [Cc]ommands/$COMMANDS commands/g" "$CLAUDE_MD"
            sed -i '' -E "s/[0-9]+ [Hh]ooks/$HOOKS hooks/g" "$CLAUDE_MD"
        else
            sed -i -E "s/[0-9]+ [Ss]kills/$SKILLS skills/g" "$CLAUDE_MD"
            sed -i -E "s/[0-9]+ [Aa]gents/$AGENTS agents/g" "$CLAUDE_MD"
            sed -i -E "s/[0-9]+ [Cc]ommands/$COMMANDS commands/g" "$CLAUDE_MD"
            sed -i -E "s/[0-9]+ [Hh]ooks/$HOOKS hooks/g" "$CLAUDE_MD"
        fi
        echo "  ✓ Updated CLAUDE.md"
    else
        echo "  Would replace: N skills → $SKILLS skills, N agents → $AGENTS agents, etc."
    fi
fi

# =============================================================================
# UPDATE README.md (documentation)
# =============================================================================
README="$PROJECT_ROOT/README.md"
if [[ -f "$README" ]]; then
    echo "Updating $README..."

    if [[ "$DRY_RUN" == "false" ]]; then
        if [[ "$(uname)" == "Darwin" ]]; then
            sed -i '' -E "s/[0-9]+ [Ss]kills/$SKILLS skills/g" "$README"
            sed -i '' -E "s/[0-9]+ [Aa]gents/$AGENTS agents/g" "$README"
            sed -i '' -E "s/[0-9]+ [Cc]ommands/$COMMANDS commands/g" "$README"
            sed -i '' -E "s/[0-9]+ [Hh]ooks/$HOOKS hooks/g" "$README"
        else
            sed -i -E "s/[0-9]+ [Ss]kills/$SKILLS skills/g" "$README"
            sed -i -E "s/[0-9]+ [Aa]gents/$AGENTS agents/g" "$README"
            sed -i -E "s/[0-9]+ [Cc]ommands/$COMMANDS commands/g" "$README"
            sed -i -E "s/[0-9]+ [Hh]ooks/$HOOKS hooks/g" "$README"
        fi
        echo "  ✓ Updated README.md"
    else
        echo "  Would replace: N skills → $SKILLS skills, N agents → $AGENTS agents, etc."
    fi
fi

# =============================================================================
# UPDATE marketplace.json description (but not .features - external schema)
# =============================================================================
MARKETPLACE="$PROJECT_ROOT/.claude-plugin/marketplace.json"
if [[ -f "$MARKETPLACE" ]]; then
    echo "Updating $MARKETPLACE descriptions..."

    if [[ "$DRY_RUN" == "false" ]]; then
        # Only update description strings, not schema structure
        jq --argjson skills "$SKILLS" \
           --argjson agents "$AGENTS" \
           --argjson commands "$COMMANDS" \
           --argjson hooks "$HOOKS" \
           '.description = "The Complete AI Development Toolkit - \($skills) skills, \($agents) agents, \($commands) commands, \($hooks) hooks for full-stack development" |
            .plugins[0].description = "Complete AI development toolkit with \($skills) skills covering AI/LLM, backend, frontend, security, and testing patterns. Includes \($agents) specialized agents, \($commands) commands, and \($hooks) lifecycle hooks."' \
           "$MARKETPLACE" > "${MARKETPLACE}.tmp" && mv "${MARKETPLACE}.tmp" "$MARKETPLACE"
        echo "  ✓ Updated marketplace.json descriptions"
    else
        echo "  Would update description strings with: $SKILLS skills, $AGENTS agents, $COMMANDS commands, $HOOKS hooks"
    fi
fi

echo ""
echo "Done! Component counts updated."
echo ""
echo "Verify with: bin/validate-counts.sh"
