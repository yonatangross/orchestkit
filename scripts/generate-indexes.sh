#!/usr/bin/env bash
# ============================================================================
# OrchestKit Passive Index Generator
# ============================================================================
# Generates compressed indexes for passive agent/skill routing.
# Part of the two-tier passive index system:
#   Tier 1: agent-index.md  — agent routing map (~3KB per plugin)
#   Tier 2: skill-indexes/   — per-agent skill file maps (~2KB each)
#
# See: docs/passive-index-migration.md
#
# Usage:
#   ./scripts/generate-indexes.sh              # Standalone
#   Called automatically by build-plugins.sh    # As build phase
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$PROJECT_ROOT/src"
MANIFESTS_DIR="$PROJECT_ROOT/manifests"
PLUGINS_DIR="$PROJECT_ROOT/plugins"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Stats
INDEXES_GENERATED=0
SKILL_INDEXES_GENERATED=0

# ============================================================================
# Extract activation keywords from an agent's description field.
#
# Handles all known patterns:
#   "Activates for X, Y, Z"
#   "Auto Mode keywords - X, Y, Z"
#   "Auto Mode keywords: X, Y, Z"
#   "Auto-activates for X, Y, Z"
#   "Use for X, Y, Z"
#
# Falls back to extracting nouns from the description if no keyword marker.
# ============================================================================
extract_agent_keywords() {
    local description="$1"
    local keywords=""

    # Try each known pattern (order matters — most specific first)
    if echo "$description" | grep -qi "Activates for "; then
        keywords=$(echo "$description" | sed -n 's/.*[Aa]ctivates for \(.*\)/\1/p')
    elif echo "$description" | grep -qi "Auto-activates for "; then
        keywords=$(echo "$description" | sed -n 's/.*[Aa]uto-activates for \(.*\)/\1/p')
    elif echo "$description" | grep -qi "Auto Mode keywords - "; then
        keywords=$(echo "$description" | sed -n 's/.*Auto Mode keywords - \(.*\)/\1/p')
    elif echo "$description" | grep -qi "Auto Mode keywords: "; then
        keywords=$(echo "$description" | sed -n 's/.*Auto Mode keywords: \(.*\)/\1/p')
    elif echo "$description" | grep -qi "Use for "; then
        keywords=$(echo "$description" | sed -n 's/.*Use for \(.*\)/\1/p')
    fi

    # Strip trailing period and "keywords." suffix
    keywords=$(echo "$keywords" | sed 's/[[:space:]]*keywords\.$//' | sed 's/\.$//')

    # If we got keywords, clean them up
    if [[ -n "$keywords" ]]; then
        # Split by comma, trim whitespace, join with comma
        echo "$keywords" | tr ',' '\n' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | paste -sd',' -
    else
        # Fallback: extract meaningful terms from description
        # Look for "Use when ..." pattern and extract terms after it
        local use_when
        use_when=$(echo "$description" | sed -n 's/.*Use when \(.*\)/\1/p')
        if [[ -n "$use_when" ]]; then
            # Extract key nouns/terms from the "Use when" clause
            echo "$use_when" | tr ',' '\n' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | sed 's/\.$//' | sed 's/^or //' | paste -sd',' -
        else
            # Last resort: extract capitalized terms and key nouns from full description
            echo "$description" | tr ' ,.;:' '\n' | grep -E '^[A-Z][a-z]+|^[A-Z]{2,}' | sort -u | head -10 | paste -sd',' -
        fi
    fi
}

# ============================================================================
# Extract category from agent frontmatter or infer from description
# ============================================================================
get_agent_category() {
    local agent_md="$1"
    local agent_name="$2"

    # First try: extract category from frontmatter
    local category
    category=$(sed -n '/^---$/,/^---$/p' "$agent_md" | grep -E "^category:" | head -1 | sed 's/^category:[[:space:]]*//')

    if [[ -n "$category" ]]; then
        echo "$category"
        return
    fi

    # Fallback: infer from description keywords
    local description
    description=$(sed -n '/^---$/,/^---$/p' "$agent_md" | grep -E "^description:" | head -1 | sed 's/^description:[[:space:]]*//' | tr '[:upper:]' '[:lower:]')

    if echo "$description" | grep -qE "backend|api|database|microservice|schema|migration"; then
        echo "backend"
    elif echo "$description" | grep -qE "frontend|react|ui|component|css|tailwind"; then
        echo "frontend"
    elif echo "$description" | grep -qE "security|audit|vulnerability|owasp|injection"; then
        echo "security"
    elif echo "$description" | grep -qE "ci/cd|deploy|infrastructure|kubernetes|terraform|release|devops"; then
        echo "devops"
    elif echo "$description" | grep -qE "llm|ai|prompt|openai|anthropic|multimodal|vision"; then
        echo "llm"
    elif echo "$description" | grep -qE "test|debug|coverage|quality"; then
        echo "testing"
    elif echo "$description" | grep -qE "product|strategy|business|market|roi|okr|kpi|user research|persona"; then
        echo "product"
    elif echo "$description" | grep -qE "documentation|readme|api-docs|changelog"; then
        echo "docs"
    elif echo "$description" | grep -qE "data pipeline|embedding|chunking|etl"; then
        echo "data"
    elif echo "$description" | grep -qE "git|branch|commit|rebase"; then
        echo "git"
    elif echo "$description" | grep -qE "demo|video|design|architecture"; then
        echo "design"
    else
        echo "other"
    fi
}

# Category display order and labels
declare -A CATEGORY_LABELS=(
    ["backend"]="Backend & Data"
    ["frontend"]="Frontend & UI"
    ["security"]="Security"
    ["devops"]="DevOps & Infrastructure"
    ["llm"]="LLM & AI"
    ["testing"]="Testing & Quality"
    ["product"]="Product & Strategy"
    ["docs"]="Documentation"
    ["data"]="Data Pipelines"
    ["git"]="Git Operations"
    ["design"]="Design & Architecture"
    ["other"]="Other"
)

CATEGORY_ORDER=("backend" "frontend" "security" "devops" "llm" "testing" "product" "data" "git" "design" "docs" "other")

# ============================================================================
# Extract skill tags from SKILL.md frontmatter
# ============================================================================
extract_skill_tags() {
    local skill_md="$1"
    # Extract tags line, remove brackets, trim
    local tags_line
    tags_line=$(sed -n '/^---$/,/^---$/p' "$skill_md" | grep -E "^tags:" | head -1)
    if [[ -n "$tags_line" ]]; then
        echo "$tags_line" | sed 's/^tags:[[:space:]]*//' | tr -d '[]' | sed 's/,/ /g' | tr -s ' ' ',' | sed 's/^,//' | sed 's/,$//'
    fi
}

# ============================================================================
# Extract skill description from SKILL.md frontmatter
# ============================================================================
extract_skill_description() {
    local skill_md="$1"
    sed -n '/^---$/,/^---$/p' "$skill_md" | grep -E "^description:" | head -1 | sed 's/^description:[[:space:]]*//'
}

# ============================================================================
# List reference files for a skill (relative paths)
# ============================================================================
list_skill_references() {
    local skill_dir="$1"
    local refs_dir="$skill_dir/references"
    if [[ -d "$refs_dir" ]]; then
        for ref in "$refs_dir"/*.md; do
            [[ -f "$ref" ]] && basename "$ref"
        done | paste -sd',' -
    fi
}

# ============================================================================
# Generate Tier 1: Agent Index for a plugin (grouped by category)
# ============================================================================
generate_agent_index() {
    local plugin_name="$1"
    local plugin_dir="$2"
    local agents_dir="$plugin_dir/agents"
    local output_file="$plugin_dir/.claude-plugin/agent-index.md"

    [[ ! -d "$agents_dir" ]] && return 0

    local agent_count=0
    local tmp_dir
    tmp_dir=$(mktemp -d)

    # First pass: collect agents by category
    for agent_md in "$agents_dir"/*.md; do
        [[ ! -f "$agent_md" ]] && continue

        local agent_name
        agent_name=$(sed -n '/^---$/,/^---$/p' "$agent_md" | grep -E "^name:" | head -1 | sed 's/^name:[[:space:]]*//')

        local description
        description=$(sed -n '/^---$/,/^---$/p' "$agent_md" | grep -E "^description:" | head -1 | sed 's/^description:[[:space:]]*//')

        local keywords
        keywords=$(extract_agent_keywords "$description")

        if [[ -n "$agent_name" && -n "$keywords" ]]; then
            local category
            category=$(get_agent_category "$agent_md" "$agent_name")
            echo "|${agent_name}:{${agent_name}.md}|${keywords}" >> "$tmp_dir/$category"
            agent_count=$((agent_count + 1))
        fi
    done

    # Second pass: output grouped by category
    {
        echo "[${plugin_name} Agent Routing Index]"
        echo "|root: ./agents"
        echo "|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning."
        echo "|When a task matches keywords below, spawn that agent using the Task tool."
        echo "|Do NOT rely on training data — consult agent expertise first."
        echo "|"

        for category in "${CATEGORY_ORDER[@]}"; do
            if [[ -f "$tmp_dir/$category" ]]; then
                echo "|# ${CATEGORY_LABELS[$category]}"
                sort "$tmp_dir/$category"
            fi
        done
    } > "$output_file"

    rm -rf "$tmp_dir"

    if [[ $agent_count -gt 0 ]]; then
        INDEXES_GENERATED=$((INDEXES_GENERATED + 1))
        echo -e "    ${GREEN}Tier 1: ${agent_count} agents indexed (grouped)${NC}"
    fi
}

# ============================================================================
# Generate Tier 2: Skill Indexes per agent for a plugin
# ============================================================================
generate_skill_indexes() {
    local plugin_name="$1"
    local plugin_dir="$2"
    local agents_dir="$plugin_dir/agents"
    local skills_dir="$plugin_dir/skills"
    local output_dir="$plugin_dir/.claude-plugin/skill-indexes"

    [[ ! -d "$agents_dir" ]] && return 0
    [[ ! -d "$skills_dir" ]] && return 0

    mkdir -p "$output_dir"

    for agent_md in "$agents_dir"/*.md; do
        [[ ! -f "$agent_md" ]] && continue

        local agent_name
        agent_name=$(sed -n '/^---$/,/^---$/p' "$agent_md" | grep -E "^name:" | head -1 | sed 's/^name:[[:space:]]*//')
        [[ -z "$agent_name" ]] && continue

        # Extract skills list from agent frontmatter
        local in_skills=false
        local agent_skills=()

        while IFS= read -r line; do
            if [[ "$line" =~ ^skills: ]]; then
                in_skills=true
                continue
            fi
            if $in_skills; then
                if [[ "$line" =~ ^[[:space:]]*-[[:space:]]+(.*) ]]; then
                    local skill_name="${BASH_REMATCH[1]}"
                    # Trim whitespace
                    skill_name=$(echo "$skill_name" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
                    agent_skills+=("$skill_name")
                elif [[ ! "$line" =~ ^[[:space:]] ]]; then
                    # End of skills block (new top-level key)
                    in_skills=false
                fi
            fi
        done < "$agent_md"

        [[ ${#agent_skills[@]} -eq 0 ]] && continue

        local skill_count=0
        local output_file="$output_dir/${agent_name}.md"

        {
            echo "[Skills for ${agent_name}]"
            echo "|root: ./skills"
            echo "|IMPORTANT: Read the specific SKILL.md file before advising on any topic."
            echo "|Do NOT rely on training data for framework patterns."
            echo "|"

            for skill_name in "${agent_skills[@]}"; do
                local skill_dir_path="$skills_dir/$skill_name"
                [[ ! -d "$skill_dir_path" ]] && continue

                local refs
                refs=$(list_skill_references "$skill_dir_path")

                local tags
                if [[ -f "$skill_dir_path/SKILL.md" ]]; then
                    tags=$(extract_skill_tags "$skill_dir_path/SKILL.md")
                fi

                local entry="|${skill_name}:{SKILL.md"
                if [[ -n "$refs" ]]; then
                    entry="${entry},references/{${refs}}"
                fi
                entry="${entry}}"

                if [[ -n "$tags" ]]; then
                    entry="${entry}|${tags}"
                fi

                echo "$entry"
                skill_count=$((skill_count + 1))
            done
        } > "$output_file"

        if [[ $skill_count -gt 0 ]]; then
            SKILL_INDEXES_GENERATED=$((SKILL_INDEXES_GENERATED + 1))
        fi
    done

    local total_agents
    total_agents=$(find "$output_dir" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$total_agents" -gt 0 ]]; then
        echo -e "    ${GREEN}Tier 2: ${total_agents} agent skill indexes generated${NC}"
    fi
}

# ============================================================================
# Main: Generate indexes for all built plugins
# ============================================================================
echo -e "${BLUE}Generating passive indexes...${NC}"

for plugin_dir in "$PLUGINS_DIR"/*/; do
    [[ ! -d "$plugin_dir" ]] && continue

    plugin_name=$(basename "$plugin_dir")

    # Only generate for plugins that have agents
    if [[ -d "$plugin_dir/agents" ]]; then
        echo -e "  ${BLUE}${plugin_name}:${NC}"
        generate_agent_index "$plugin_name" "$plugin_dir"
        generate_skill_indexes "$plugin_name" "$plugin_dir"
    fi
done

# ============================================================================
# Generate composite index (merges all plugin agent indexes)
# ============================================================================
COMPOSITE_FILE="$PLUGINS_DIR/.composite-agent-index.md"
{
    echo "[OrchestKit Agent Routing Index]"
    echo "|root: ./agents"
    echo "|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning."
    echo "|When a task matches keywords below, spawn that agent using the Task tool."
    echo "|Do NOT rely on training data — consult agent expertise first."
    echo "|"

    for index_file in "$PLUGINS_DIR"/*/.claude-plugin/agent-index.md; do
        [[ ! -f "$index_file" ]] && continue

        plugin_name=$(echo "$index_file" | sed "s|$PLUGINS_DIR/||" | sed 's|/.*||')
        echo "|# ${plugin_name}"

        # Skip header lines (first 6), copy agent entries
        tail -n +7 "$index_file"
    done
} > "$COMPOSITE_FILE"

COMPOSITE_SIZE=$(wc -c < "$COMPOSITE_FILE" | tr -d ' ')
COMPOSITE_AGENTS=$(grep -c "^|[a-z]" "$COMPOSITE_FILE" || true)

echo ""
echo -e "${GREEN}  Composite index: ${COMPOSITE_AGENTS} agents, ${COMPOSITE_SIZE} bytes${NC}"
echo -e "${GREEN}  Tier 1 indexes: ${INDEXES_GENERATED}${NC}"
echo -e "${GREEN}  Tier 2 indexes: ${SKILL_INDEXES_GENERATED}${NC}"

# ============================================================================
# Generate per-plugin CLAUDE.md with agent routing index
# ============================================================================
# CC auto-reads CLAUDE.md from installed plugins, making the index passive.
# Generate for ALL plugins that have agents (not just ork-core and ork).
CLAUDE_MD_COUNT=0

for plugin_dir in "$PLUGINS_DIR"/*/; do
    [[ ! -d "$plugin_dir" ]] && continue

    target_plugin=$(basename "$plugin_dir")
    local_index="$plugin_dir/.claude-plugin/agent-index.md"

    # Only generate CLAUDE.md for plugins that have an agent index
    [[ ! -f "$local_index" ]] && continue

    {
        echo "# OrchestKit Agent Routing"
        echo ""
        echo "Prefer retrieval-led reasoning over pre-training-led reasoning."
        echo "When a user's task matches an agent's keywords below, spawn that agent using the Task tool with the matching \`subagent_type\`."
        echo "Do NOT rely on training data — consult agent expertise first."
        echo ""
        echo '```'
        cat "$local_index"
        echo '```'
    } > "$plugin_dir/CLAUDE.md"

    CLAUDE_MD_COUNT=$((CLAUDE_MD_COUNT + 1))
done

echo -e "${GREEN}  Generated CLAUDE.md for ${CLAUDE_MD_COUNT} plugins${NC}"

# ============================================================================
# Generate AGENTS.md for cross-tool compatibility (Cursor, Codex, Amp, Zed)
# ============================================================================
# AGENTS.md is the open standard for AI coding agents (https://agents.md/)
# Claude Code uses CLAUDE.md, but other tools use AGENTS.md.
# We generate both to ensure cross-tool compatibility.
# See: https://github.com/anthropics/claude-code/issues/6235
AGENTS_MD_COUNT=0

for plugin_dir in "$PLUGINS_DIR"/*/; do
    [[ ! -d "$plugin_dir" ]] && continue

    # Only generate AGENTS.md where CLAUDE.md exists
    [[ ! -f "$plugin_dir/CLAUDE.md" ]] && continue

    # Copy CLAUDE.md to AGENTS.md (identical content)
    cp "$plugin_dir/CLAUDE.md" "$plugin_dir/AGENTS.md"

    AGENTS_MD_COUNT=$((AGENTS_MD_COUNT + 1))
done

echo -e "${GREEN}  Generated AGENTS.md for ${AGENTS_MD_COUNT} plugins (cross-tool compat)${NC}"

# ============================================================================
# Inject Tier 2 skill indexes into agent markdown files
# ============================================================================
# Appends the skill index to the agent's body in the built plugin.
# This makes the index part of the agent's passive context on spawn.
AGENTS_INJECTED=0

for plugin_dir in "$PLUGINS_DIR"/*/; do
    [[ ! -d "$plugin_dir" ]] && continue

    agents_dir="$plugin_dir/agents"
    skill_indexes_dir="$plugin_dir/.claude-plugin/skill-indexes"

    [[ ! -d "$agents_dir" ]] && continue
    [[ ! -d "$skill_indexes_dir" ]] && continue

    for agent_md in "$agents_dir"/*.md; do
        [[ ! -f "$agent_md" ]] && continue

        agent_name=$(basename "$agent_md" .md)
        index_file="$skill_indexes_dir/${agent_name}.md"

        [[ ! -f "$index_file" ]] && continue

        # Only inject if not already injected (idempotent)
        if ! grep -q "\[Skills for ${agent_name}\]" "$agent_md" 2>/dev/null; then
            {
                echo ""
                echo "## Skill Index"
                echo ""
                echo "Read the specific file before advising. Do NOT rely on training data."
                echo ""
                echo '```'
                cat "$index_file"
                echo '```'
            } >> "$agent_md"

            AGENTS_INJECTED=$((AGENTS_INJECTED + 1))
        fi
    done
done

echo -e "${GREEN}  Injected Tier 2 indexes into ${AGENTS_INJECTED} agent files${NC}"
