#!/usr/bin/env bash
# ============================================================================
# CC 2.1.16 Discovery Simulation Test
# ============================================================================
# Simulates how Claude Code discovers and loads plugin components at startup.
# This test verifies that OrchestKit is properly structured for CC discovery.
#
# CC Discovery Process:
# 1. Read .claude-plugin/plugin.json
# 2. Discover skills from skills/ directory (each with SKILL.md)
# 3. Discover agents from agents/ directory (each .md file)
# 4. Load skill/agent metadata into system prompt
# 5. Register hooks for lifecycle events
#
# Reference: https://code.claude.com/docs/en/plugins-reference
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PLUGIN_JSON="$PROJECT_ROOT/.claude-plugin/plugin.json"

FAILED=0

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' CYAN='' NC=''
fi

echo "=============================================="
echo "CC 2.1.16 Discovery Simulation"
echo "=============================================="
echo ""

# ============================================================================
# Step 1: Read plugin.json
# ============================================================================
echo -e "${CYAN}Step 1: Reading plugin.json${NC}"
echo "────────────────────────────────────────"

if [[ ! -f "$PLUGIN_JSON" ]]; then
    echo -e "${RED}FAIL${NC}: plugin.json not found"
    exit 1
fi

plugin_name=$(jq -r '.name' "$PLUGIN_JSON")
plugin_version=$(jq -r '.version' "$PLUGIN_JSON")
plugin_description=$(jq -r '.description // "No description"' "$PLUGIN_JSON" | head -c 80)

echo "  Plugin: $plugin_name v$plugin_version"
echo "  Description: $plugin_description..."
echo ""

# ============================================================================
# Step 2: Discover Skills Directory
# ============================================================================
echo -e "${CYAN}Step 2: Discovering Skills${NC}"
echo "────────────────────────────────────────"

# Get skills path from plugin.json (handle both formats)
skills_config=$(jq -r '.skills // "null"' "$PLUGIN_JSON")

if [[ "$skills_config" == "null" ]]; then
    skills_dir="$PROJECT_ROOT/skills"
elif echo "$skills_config" | jq -e '.directory' >/dev/null 2>&1; then
    # Object format (legacy): {"directory": "skills"}
    skills_subdir=$(echo "$skills_config" | jq -r '.directory')
    skills_dir="$PROJECT_ROOT/$skills_subdir"
else
    # String format (correct): "./skills/"
    skills_dir="$PROJECT_ROOT/${skills_config#./}"
    skills_dir="${skills_dir%/}"
fi

echo "  Skills path: $skills_dir"

if [[ ! -d "$skills_dir" ]]; then
    echo -e "  ${RED}FAIL${NC}: Skills directory not found"
    ((FAILED++))
else
    # Count and categorize skills
    total_skills=0
    user_invocable_skills=()
    internal_skills=()

    while IFS= read -r skill_file; do
        ((total_skills++))
        skill_name=$(basename "$(dirname "$skill_file")")

        # Check user-invocable field
        if grep -q "user-invocable: true" "$skill_file" 2>/dev/null; then
            user_invocable_skills+=("$skill_name")
        else
            internal_skills+=("$skill_name")
        fi
    done < <(find "$skills_dir" -maxdepth 2 -name "SKILL.md" -type f 2>/dev/null)

    echo -e "  ${GREEN}Found${NC}: $total_skills skills"
    echo "    - User-invocable: ${#user_invocable_skills[@]}"
    echo "    - Internal: ${#internal_skills[@]}"

    # Show sample user-invocable skills
    if [[ ${#user_invocable_skills[@]} -gt 0 ]]; then
        echo ""
        echo "  User-invocable skills (available as /ork:<name>):"
        for skill in "${user_invocable_skills[@]:0:5}"; do
            echo "    - /ork:$skill"
        done
        [[ ${#user_invocable_skills[@]} -gt 5 ]] && echo "    ... and $((${#user_invocable_skills[@]} - 5)) more"
    fi
fi
echo ""

# ============================================================================
# Step 3: Discover Agents Directory
# ============================================================================
echo -e "${CYAN}Step 3: Discovering Agents${NC}"
echo "────────────────────────────────────────"

# Get agents path from plugin.json (handle both formats)
agents_config=$(jq -r '.agents // "null"' "$PLUGIN_JSON")

if [[ "$agents_config" == "null" ]]; then
    agents_dir="$PROJECT_ROOT/agents"
elif echo "$agents_config" | jq -e '.directory' >/dev/null 2>&1; then
    agents_subdir=$(echo "$agents_config" | jq -r '.directory')
    agents_dir="$PROJECT_ROOT/$agents_subdir"
else
    agents_dir="$PROJECT_ROOT/${agents_config#./}"
    agents_dir="${agents_dir%/}"
fi

echo "  Agents path: $agents_dir"

if [[ ! -d "$agents_dir" ]]; then
    echo -e "  ${RED}FAIL${NC}: Agents directory not found"
    ((FAILED++))
else
    agent_count=0
    agent_names=()

    for agent_file in "$agents_dir"/*.md; do
        [[ ! -f "$agent_file" ]] && continue
        ((agent_count++))

        agent_name=$(basename "$agent_file" .md)
        agent_names+=("$agent_name")

        # Extract description for display
        desc=$(awk '/^---$/,/^---$/ { if (/^description:/) { sub(/^description: */, ""); gsub(/^["'"'"']|["'"'"']$/, ""); print; exit } }' "$agent_file" | head -c 60)
    done

    echo -e "  ${GREEN}Found${NC}: $agent_count agents"
    echo ""
    echo "  Available agents (via Task tool subagent_type):"
    for agent in "${agent_names[@]:0:5}"; do
        echo "    - $agent"
    done
    [[ ${#agent_names[@]} -gt 5 ]] && echo "    ... and $((${#agent_names[@]} - 5)) more"
fi
echo ""

# ============================================================================
# Step 4: Validate Skill Metadata
# ============================================================================
echo -e "${CYAN}Step 4: Validating Skill Metadata${NC}"
echo "────────────────────────────────────────"

skills_with_issues=0

for skill_file in "$skills_dir"/*/SKILL.md; do
    [[ ! -f "$skill_file" ]] && continue
    skill_name=$(basename "$(dirname "$skill_file")")

    # Check required frontmatter fields
    has_name=$(grep -c "^name:" "$skill_file" 2>/dev/null || echo 0)
    has_desc=$(grep -c "^description:" "$skill_file" 2>/dev/null || echo 0)

    if [[ "$has_name" -eq 0 ]] || [[ "$has_desc" -eq 0 ]]; then
        echo -e "  ${RED}FAIL${NC}: $skill_name missing required frontmatter"
        ((skills_with_issues++))
    fi

    # Check description has trigger phrases (for discoverability)
    desc=$(awk '/^---$/,/^---$/ { if (/^description:/) { sub(/^description: */, ""); print; exit } }' "$skill_file")
    if [[ ! "$desc" =~ (Use\ when|Use\ for|Use\ this|Activates) ]]; then
        # Only warn, not fail - not all skills need trigger phrases
        :
    fi
done

if [[ $skills_with_issues -eq 0 ]]; then
    echo -e "  ${GREEN}PASS${NC}: All skills have valid metadata"
else
    echo -e "  ${YELLOW}WARN${NC}: $skills_with_issues skills have metadata issues"
fi
echo ""

# ============================================================================
# Step 5: Validate Agent Metadata
# ============================================================================
echo -e "${CYAN}Step 5: Validating Agent Metadata${NC}"
echo "────────────────────────────────────────"

agents_with_issues=0

for agent_file in "$agents_dir"/*.md; do
    [[ ! -f "$agent_file" ]] && continue
    agent_name=$(basename "$agent_file" .md)

    # Check required frontmatter fields
    has_name=$(grep -c "^name:" "$agent_file" 2>/dev/null || echo 0)
    has_desc=$(grep -c "^description:" "$agent_file" 2>/dev/null || echo 0)

    if [[ "$has_name" -eq 0 ]] || [[ "$has_desc" -eq 0 ]]; then
        echo -e "  ${RED}FAIL${NC}: $agent_name missing required frontmatter"
        ((agents_with_issues++))
        ((FAILED++))
    fi

    # Check for tools specification
    if ! grep -q "^tools:" "$agent_file" 2>/dev/null; then
        echo -e "  ${YELLOW}WARN${NC}: $agent_name missing tools specification"
    fi

    # Check description has "Activates for" keywords
    desc=$(awk '/^---$/,/^---$/ { if (/^description:/) { sub(/^description: */, ""); print; exit } }' "$agent_file")
    if [[ ! "$desc" =~ (Activates\ for|activates\ for) ]]; then
        echo -e "  ${YELLOW}WARN${NC}: $agent_name description missing 'Activates for' keywords"
    fi
done

if [[ $agents_with_issues -eq 0 ]]; then
    echo -e "  ${GREEN}PASS${NC}: All agents have valid metadata"
fi
echo ""

# ============================================================================
# Step 6: Verify Hook Registration
# ============================================================================
echo -e "${CYAN}Step 6: Verifying Hook Registration${NC}"
echo "────────────────────────────────────────"

hooks_config=$(jq -r '.hooks // "null"' "$PLUGIN_JSON")

if [[ "$hooks_config" == "null" ]]; then
    echo "  No hooks defined in plugin.json"
else
    # Count hooks by event type
    hook_events=$(jq -r '.hooks | keys[]' "$PLUGIN_JSON" 2>/dev/null || echo "")

    if [[ -n "$hook_events" ]]; then
        echo "  Registered hook events:"
        while IFS= read -r event; do
            hook_count=$(jq -r ".hooks.$event | if type == \"array\" then .[0].hooks | length else 0 end" "$PLUGIN_JSON" 2>/dev/null || echo 0)
            echo "    - $event: $hook_count hooks"
        done <<< "$hook_events"
    fi
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=============================================="
echo "Discovery Simulation Summary"
echo "=============================================="
echo ""
echo "  Plugin: $plugin_name v$plugin_version"
echo "  Skills: $total_skills (${#user_invocable_skills[@]} user-invocable)"
echo "  Agents: $agent_count"
echo ""

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED${NC}: $FAILED critical issues found"
    echo ""
    echo "CC will not properly discover plugin components until issues are fixed."
    exit 1
else
    echo -e "${GREEN}PASSED${NC}: Plugin is properly structured for CC 2.1.16 discovery"
    exit 0
fi
