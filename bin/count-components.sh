#!/bin/bash
# Count all plugin components dynamically
# Usage: count-components.sh [--json]
#
# Counts:
# - Skills: directories with capabilities.json
# - Agents: .md files in agents/
# - Commands: .md files in commands/
# - Hooks: .sh files in hooks/ (excluding _lib/)
# - Bundles: entries in marketplace.json plugins array

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Count skills (directories with capabilities.json)
count_skills() {
    find "$PROJECT_ROOT/.claude/skills" -name "capabilities.json" -type f 2>/dev/null | wc -l | tr -d ' '
}

# Count agents (markdown files in agents dir)
count_agents() {
    find "$PROJECT_ROOT/.claude/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' '
}

# Count commands (markdown files in commands dir)
count_commands() {
    find "$PROJECT_ROOT/.claude/commands" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' '
}

# Count hooks (shell scripts in hooks dir, excluding _lib)
count_hooks() {
    find "$PROJECT_ROOT/.claude/hooks" -name "*.sh" -type f ! -path "*/_lib/*" 2>/dev/null | wc -l | tr -d ' '
}

# Count hook entries in settings.json (alternative method)
count_hook_entries() {
    if [[ -f "$PROJECT_ROOT/.claude/settings.json" ]]; then
        jq '.hooks | to_entries | map(.value | map(.hooks | length) | add) | add // 0' \
            "$PROJECT_ROOT/.claude/settings.json" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Count plugin bundles
count_bundles() {
    if [[ -f "$PROJECT_ROOT/.claude-plugin/marketplace.json" ]]; then
        jq '.plugins | length' "$PROJECT_ROOT/.claude-plugin/marketplace.json" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Get counts
SKILLS=$(count_skills)
AGENTS=$(count_agents)
COMMANDS=$(count_commands)
HOOKS=$(count_hooks)
HOOK_ENTRIES=$(count_hook_entries)
BUNDLES=$(count_bundles)

# Output
if [[ "${1:-}" == "--json" ]]; then
    jq -n \
        --argjson skills "$SKILLS" \
        --argjson agents "$AGENTS" \
        --argjson commands "$COMMANDS" \
        --argjson hooks "$HOOKS" \
        --argjson hook_entries "$HOOK_ENTRIES" \
        --argjson bundles "$BUNDLES" \
        '{
            skills: $skills,
            agents: $agents,
            commands: $commands,
            hooks: $hooks,
            hook_entries: $hook_entries,
            bundles: $bundles
        }'
else
    echo "Component Counts:"
    echo "================="
    echo "Skills:       $SKILLS"
    echo "Agents:       $AGENTS"
    echo "Commands:     $COMMANDS"
    echo "Hooks:        $HOOKS files ($HOOK_ENTRIES entries in settings.json)"
    echo "Bundles:      $BUNDLES"
fi