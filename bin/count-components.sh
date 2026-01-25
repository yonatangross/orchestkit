#!/bin/bash
# Count all plugin components dynamically
# Usage: count-components.sh [--json]
#
# Counts:
# - Skills: directories with SKILL.md in src/skills/
# - Agents: .md files in src/agents/
# - Commands: .md files in src/commands/
# - Hooks: TypeScript files in src/hooks/src/ (excluding _lib/)
# - Bundles: entries in marketplace.json plugins array

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Count skills (directories with SKILL.md in src/skills/)
count_skills() {
    if [[ -d "$PROJECT_ROOT/src/skills" ]]; then
        find "$PROJECT_ROOT/src/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

# Count agents (markdown files in src/agents dir)
count_agents() {
    if [[ -d "$PROJECT_ROOT/src/agents" ]]; then
        find "$PROJECT_ROOT/src/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

# Count commands (markdown files in src/commands dir)
count_commands() {
    if [[ -d "$PROJECT_ROOT/src/commands" ]]; then
        find "$PROJECT_ROOT/src/commands" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

# Count hooks (TypeScript files in src/hooks/src, excluding __tests__ and lib)
# Migrated from shell scripts to TypeScript in v5.1.0
count_hooks() {
    if [[ -d "$PROJECT_ROOT/src/hooks/src" ]]; then
        find "$PROJECT_ROOT/src/hooks/src" -name "*.ts" -type f ! -path "*/__tests__/*" ! -path "*/lib/*" ! -name "index.ts" ! -name "types.ts" 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

# Count hook entries in settings.json (alternative method)
count_hook_entries() {
    local settings_file="$PROJECT_ROOT/.claude/settings.json"
    if [[ -f "$settings_file" ]]; then
        # Check if .hooks exists and is not null before counting
        local result
        result=$(jq -r 'if .hooks then (.hooks | to_entries | map(.value | if type == "array" then map(if .hooks then (.hooks | length) else 0 end) | add else 0 end) | add) // 0 else 0 end' "$settings_file" 2>/dev/null) || result="0"
        echo "${result:-0}"
    else
        echo "0"
    fi
}

# Count plugin bundles
count_bundles() {
    local marketplace_file="$PROJECT_ROOT/.claude-plugin/marketplace.json"
    if [[ -f "$marketplace_file" ]]; then
        local result
        result=$(jq '.plugins | length // 0' "$marketplace_file" 2>/dev/null) || result="0"
        echo "${result:-0}"
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