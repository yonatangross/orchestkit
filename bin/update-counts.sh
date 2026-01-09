#!/bin/bash
# Update component counts in all relevant files
# Usage: update-counts.sh [--dry-run]
#
# Updates:
# - .claude-plugin/marketplace.json (features section, description, plugins[0].description)
# - CLAUDE.md (count references)
# - README.md (count references)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "DRY RUN - no files will be modified"
    echo ""
fi

# Get counts
SKILLS=$(find "$PROJECT_ROOT/.claude/skills" -name "capabilities.json" -type f 2>/dev/null | wc -l | tr -d ' ')
AGENTS=$(find "$PROJECT_ROOT/.claude/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
COMMANDS=$(find "$PROJECT_ROOT/.claude/commands" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
HOOKS=$(find "$PROJECT_ROOT/.claude/hooks" -name "*.sh" -type f ! -path "*/_lib/*" 2>/dev/null | wc -l | tr -d ' ')
BUNDLES=$(jq '.plugins | length' "$PROJECT_ROOT/.claude-plugin/marketplace.json" 2>/dev/null || echo "0")

echo "Current counts:"
echo "  Skills:   $SKILLS"
echo "  Agents:   $AGENTS"
echo "  Commands: $COMMANDS"
echo "  Hooks:    $HOOKS"
echo "  Bundles:  $BUNDLES"
echo ""

# Update marketplace.json
MARKETPLACE="$PROJECT_ROOT/.claude-plugin/marketplace.json"
if [[ -f "$MARKETPLACE" ]]; then
    echo "Updating $MARKETPLACE..."

    if [[ "$DRY_RUN" == "false" ]]; then
        # Update features section and descriptions
        jq --argjson skills "$SKILLS" \
           --argjson agents "$AGENTS" \
           --argjson commands "$COMMANDS" \
           --argjson hooks "$HOOKS" \
           '.features.skills = $skills |
            .features.agents = $agents |
            .features.commands = $commands |
            .features.hooks = $hooks |
            .description = "The Complete AI Development Toolkit - \($skills) skills, \($agents) agents, \($commands) commands, \($hooks) hooks" |
            .plugins[0].description = "Full toolkit - all \($skills) skills, \($agents) agents, \($commands) commands, \($hooks) hooks"' \
           "$MARKETPLACE" > "${MARKETPLACE}.tmp" && mv "${MARKETPLACE}.tmp" "$MARKETPLACE"
        echo "  ✓ Updated marketplace.json"
    else
        echo "  Would update: features.skills=$SKILLS, features.agents=$AGENTS, features.commands=$COMMANDS, features.hooks=$HOOKS"
    fi
fi

# Update CLAUDE.md (replace count patterns)
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

# Update README.md if exists
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

echo ""
echo "Done! Component counts updated."