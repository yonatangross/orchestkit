#!/bin/bash
# Skill-Agent Integration Tests
# Tests the integration between skills and agents using directory-based discovery
# (Updated for Claude Code plugin format which uses auto-discovery)
#
# Usage: ./test-skill-agent-integration.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
#
# Version: 2.0.0
# Part of Comprehensive Test Suite v4.6.4

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source test helpers
source "$PROJECT_ROOT/tests/fixtures/test-helpers.sh"

# Configuration - use directories directly
SKILLS_DIR="$PROJECT_ROOT/src/skills"
AGENTS_DIR="$PROJECT_ROOT/src/agents"
# Find skill directory (flat structure) by name across all category subdirectories
find_skill_dir() {
    local skill_id="$1"
    find "$SKILLS_DIR" -type d -name "$skill_id" -mindepth 1 -maxdepth 1 2>/dev/null | head -1
}


# Token budget: Based on skill files (SKILL.md ~100 tokens each)
# Updated to 350000 for AI/ML Roadmap 2026 expansion (159 skills)
MAX_SKILL_TOKEN_BUDGET=350000

# Verbose mode
VERBOSE="${1:-}"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

vlog() {
    if [[ "$VERBOSE" == "--verbose" || "$VERBOSE" == "-v" ]]; then
        echo "    [DEBUG] $1"
    fi
}

# Get all skill IDs from directory structure
get_all_skill_ids() {
    # Flat structure: skills/<category>/<skill-name>
    find "$SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | sort -u
}

# Get all agent IDs from directory structure
get_all_agent_ids() {
    find "$AGENTS_DIR" -name "*.md" -exec basename {} .md \; 2>/dev/null | sort -u
}

# Get skills from agent markdown file (from YAML frontmatter)
get_agent_skills_from_md() {
    local agent_file="$1"
    if [[ -f "$agent_file" ]]; then
        # Extract skills from YAML frontmatter
        awk '/^---$/,/^---$/' "$agent_file" 2>/dev/null | grep -E '^skills:' | sed 's/skills: *//' | tr ',' '\n' | tr -d ' []"' | grep -v '^$' | sort -u
    fi
}

# Get integrates_with from SKILL.md
get_skill_integrates_with() {
    local skill_id="$1"
    local skill_dir
    skill_dir=$(find_skill_dir "$skill_id")
    local caps_file="$skill_dir/SKILL.md"
    if [[ -f "$caps_file" ]]; then
        jq -r '.integrates_with[]?' "$caps_file" 2>/dev/null | sort -u
    fi
}

# Check if a skill exists
skill_exists() {
    local skill_id="$1"
    local skill_dir
    skill_dir=$(find_skill_dir "$skill_id")
    [[ -n "$skill_dir" && -d "$skill_dir" ]]
}

# Check if SKILL.md exists
skill_has_capabilities() {
    local skill_id="$1"
    local skill_dir
    skill_dir=$(find_skill_dir "$skill_id")
    [[ -n "$skill_dir" && -f "$skill_dir/SKILL.md" ]]
}

# Estimate tokens for skill files only
estimate_skill_tokens() {
    local skill_id="$1"
    local skill_dir
    skill_dir=$(find_skill_dir "$skill_id")
    if [[ -n "$skill_dir" && -f "$skill_dir/SKILL.md" ]]; then
        estimate_tokens "$skill_dir/SKILL.md"
    else
        echo 0
    fi
}

# ============================================================================
# TEST 1: SKILL DIRECTORIES EXIST
# ============================================================================

test_skill_directories_exist() {
    local missing_skills=""
    local count=0

    while IFS= read -r skill_id; do
        if [[ -n "$skill_id" ]]; then
            count=$((count + 1))
            if ! skill_has_capabilities "$skill_id"; then
                missing_skills="$missing_skills  - Skill '$skill_id' missing SKILL.md\n"
            fi
        fi
    done < <(get_all_skill_ids)

    vlog "Found $count skills"

    if [[ $count -eq 0 ]]; then
        echo "  No skills found in $SKILLS_DIR"
        return 1
    fi

    if [[ -n "$missing_skills" ]]; then
        echo -e "$missing_skills"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 2: AGENT FILES EXIST
# ============================================================================

test_agent_files_exist() {
    local missing_agents=""
    local count=0

    while IFS= read -r agent_id; do
        if [[ -n "$agent_id" ]]; then
            count=$((count + 1))
            local agent_file="$AGENTS_DIR/${agent_id}.md"
            if [[ ! -f "$agent_file" ]]; then
                missing_agents="$missing_agents  - Agent '$agent_id' file not found\n"
            fi
        fi
    done < <(get_all_agent_ids)

    vlog "Found $count agents"

    if [[ $count -eq 0 ]]; then
        echo "  No agents found in $AGENTS_DIR"
        return 1
    fi

    if [[ -n "$missing_agents" ]]; then
        echo -e "$missing_agents"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 3: AGENT SKILL REFERENCES ARE VALID
# ============================================================================

test_agent_skill_references() {
    local invalid_refs=""

    while IFS= read -r agent_id; do
        local agent_file="$AGENTS_DIR/${agent_id}.md"
        if [[ ! -f "$agent_file" ]]; then
            continue
        fi

        vlog "Checking skill references for agent: $agent_id"

        while IFS= read -r skill_id; do
            if [[ -n "$skill_id" ]]; then
                if ! skill_exists "$skill_id"; then
                    invalid_refs="$invalid_refs  - Agent '$agent_id' references non-existent skill: $skill_id\n"
                else
                    vlog "  Valid skill: $skill_id"
                fi
            fi
        done < <(get_agent_skills_from_md "$agent_file")
    done < <(get_all_agent_ids)

    if [[ -n "$invalid_refs" ]]; then
        echo -e "$invalid_refs"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 4: CROSS-REFERENCES (integrates_with)
# ============================================================================

test_cross_references() {
    local invalid_refs=""
    local all_skill_ids=$(get_all_skill_ids)

    while IFS= read -r skill_id; do
        if ! skill_has_capabilities "$skill_id"; then
            continue
        fi

        vlog "Checking cross-references for skill: $skill_id"

        while IFS= read -r ref_skill; do
            if [[ -n "$ref_skill" ]]; then
                if ! echo "$all_skill_ids" | grep -qx "$ref_skill"; then
                    invalid_refs="$invalid_refs  - Skill '$skill_id' references non-existent skill: $ref_skill\n"
                else
                    vlog "  Valid reference to: $ref_skill"
                fi
            fi
        done < <(get_skill_integrates_with "$skill_id")
    done < <(get_all_skill_ids)

    if [[ -n "$invalid_refs" ]]; then
        echo -e "$invalid_refs"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 5: TOKEN BUDGET
# ============================================================================

test_token_budget() {
    local total_skill_tokens=0
    local skill_count=0

    while IFS= read -r skill_id; do
        if skill_has_capabilities "$skill_id"; then
            local tokens=$(estimate_skill_tokens "$skill_id")
            total_skill_tokens=$((total_skill_tokens + tokens))
            skill_count=$((skill_count + 1))
            vlog "Skill $skill_id: ~$tokens tokens"
        fi
    done < <(get_all_skill_ids)

    vlog "Total skill files tokens for $skill_count skills: ~$total_skill_tokens"

    if [[ $total_skill_tokens -gt $MAX_SKILL_TOKEN_BUDGET ]]; then
        echo "  Total skill files budget exceeded: ~$total_skill_tokens tokens (max: $MAX_SKILL_TOKEN_BUDGET)"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 6: CAPABILITIES.JSON VALIDITY
# ============================================================================

test_capabilities_validity() {
    local invalid_caps=""

    while IFS= read -r skill_id; do
        local skill_md="$(find_skill_dir "$skill_id")/SKILL.md"
        if [[ -f "$skill_md" ]]; then
            vlog "Validating SKILL.md frontmatter for: $skill_id"
            # Check that file starts with YAML frontmatter (---)
            if ! head -1 "$skill_md" | grep -q "^---$"; then
                invalid_caps="$invalid_caps  - Skill '$skill_id' missing YAML frontmatter\n"
            fi
        fi
    done < <(get_all_skill_ids)

    if [[ -n "$invalid_caps" ]]; then
        echo -e "$invalid_caps"
        return 1
    fi
    return 0
}

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

echo "=========================================="
echo "  Skill-Agent Integration Tests"
echo "=========================================="
echo ""
echo "Project: $PROJECT_ROOT"
echo "Skills:  $SKILLS_DIR"
echo "Agents:  $AGENTS_DIR"
echo ""

# Verify prerequisites
if [[ ! -d "$SKILLS_DIR" ]]; then
    echo -e "${RED}ERROR${NC}: Skills directory not found at $SKILLS_DIR"
    exit 1
fi

if [[ ! -d "$AGENTS_DIR" ]]; then
    echo -e "${RED}ERROR${NC}: Agents directory not found at $AGENTS_DIR"
    exit 1
fi

# Count
SKILL_COUNT=$(get_all_skill_ids | wc -l | tr -d ' ')
AGENT_COUNT=$(get_all_agent_ids | wc -l | tr -d ' ')
echo "Found: $SKILL_COUNT skills, $AGENT_COUNT agents"
echo ""

# Run tests
describe "Skill-Agent Integration Tests"

it "All skill directories have SKILL.md" test_skill_directories_exist

it "All agent markdown files exist" test_agent_files_exist

it "Agent skill references point to valid skills" test_agent_skill_references

it "Cross-references (integrates_with) point to valid skills" test_cross_references

it "Total skill files tokens within budget ($MAX_SKILL_TOKEN_BUDGET)" test_token_budget

it "All SKILL.md files have valid YAML frontmatter" test_capabilities_validity

# Print summary
print_summary
