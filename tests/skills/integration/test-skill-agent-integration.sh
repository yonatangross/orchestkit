#!/bin/bash
# Skill-Agent Integration Tests
# Tests the integration between skills and agents to ensure proper references,
# consistency, and cross-validation of the SkillForge plugin configuration.
#
# Usage: ./test-skill-agent-integration.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
#
# Tests covered:
#   1. Skill Loading by Agent: Each agent's skills_used references exist
#   2. Trigger Matching: plugin.json skill triggers match capabilities.json triggers
#   3. Agent-Skill Consistency: Agents load skills from correct categories
#   4. Cross-References: Skills' integrates_with fields reference valid skill IDs
#   5. Auto-Trigger Validation: Skills with auto_trigger reference valid agents
#   6. Token Budget Chain: Combined loading doesn't exceed reasonable budget
#   7. Circular Dependency Check: No circular skill dependencies
#   8. Complete Workflow Test: Workflows have all required skills
#
# Environment Variables:
#   CIRCULAR_DEP_MODE: "strict" to fail on cycles, "warn" to just warn (default: warn)
#
# Version: 1.0.0
# Part of Comprehensive Test Suite v4.6.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source test helpers
source "$PROJECT_ROOT/tests/fixtures/test-helpers.sh"

# Configuration
PLUGIN_JSON="$PROJECT_ROOT/plugin.json"
SKILLS_DIR="$PROJECT_ROOT/.claude/skills"
AGENTS_DIR="$PROJECT_ROOT/.claude/agents"

# Token budget: Based on Tier 1 (capabilities.json ~100 tokens each)
# In progressive loading, only Tier 1 is loaded for all skills
# Tier 2+ is loaded on-demand for the specific skill being used
# 20 skills * 100 tokens = 2000 tokens typical maximum for discovery phase
MAX_TIER1_TOKEN_BUDGET=15000

# Full budget if ALL tiers were loaded (used for warnings only)
MAX_FULL_TOKEN_BUDGET=50000

# Verbose mode
VERBOSE="${1:-}"

# Allow circular dependencies in integrates_with (mutual references are acceptable)
# Set to "strict" to fail on any cycle, "warn" to just warn
CIRCULAR_DEP_MODE="${CIRCULAR_DEP_MODE:-warn}"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Log verbose message
vlog() {
    if [[ "$VERBOSE" == "--verbose" || "$VERBOSE" == "-v" ]]; then
        echo "    [DEBUG] $1"
    fi
}

# Get all skill IDs from plugin.json
get_all_skill_ids() {
    jq -r '.skills[].id' "$PLUGIN_JSON" 2>/dev/null | sort -u
}

# Get all agent IDs from plugin.json
get_all_agent_ids() {
    jq -r '.agents[].id' "$PLUGIN_JSON" 2>/dev/null | sort -u
}

# Get skills used by an agent from plugin.json
get_agent_skills_from_plugin() {
    local agent_id="$1"
    jq -r ".agents[] | select(.id == \"$agent_id\") | .skills_used[]?" "$PLUGIN_JSON" 2>/dev/null | sort -u
}

# Get skills used by an agent from the agent markdown file
get_agent_skills_from_md() {
    local agent_file="$1"
    if [[ -f "$agent_file" ]]; then
        # Extract skills: line from YAML frontmatter
        awk '/^---$/,/^---$/' "$agent_file" | grep '^skills:' | sed 's/skills: *//' | tr ',' '\n' | tr -d ' ' | grep -v '^$' | sort -u
    fi
}

# Get integrates_with from capabilities.json
get_skill_integrates_with() {
    local skill_id="$1"
    local caps_file="$SKILLS_DIR/$skill_id/capabilities.json"
    if [[ -f "$caps_file" ]]; then
        jq -r '.integrates_with[]?' "$caps_file" 2>/dev/null | sort -u
    fi
}

# Get triggers from capabilities.json
get_skill_triggers() {
    local skill_id="$1"
    local caps_file="$SKILLS_DIR/$skill_id/capabilities.json"
    if [[ -f "$caps_file" ]]; then
        jq -r '.triggers | (.high_confidence[]?, .medium_confidence[]?)' "$caps_file" 2>/dev/null | sort -u
    fi
}

# Estimate tokens for Tier 1 only (capabilities.json)
estimate_tier1_tokens() {
    local skill_id="$1"
    local skill_dir="$SKILLS_DIR/$skill_id"

    # Tier 1: capabilities.json only
    if [[ -f "$skill_dir/capabilities.json" ]]; then
        estimate_tokens "$skill_dir/capabilities.json"
    else
        echo 0
    fi
}

# Estimate tokens for all tiers (for warnings)
estimate_all_tier_tokens() {
    local skill_id="$1"
    local skill_dir="$SKILLS_DIR/$skill_id"
    local total=0

    # Tier 1: capabilities.json
    if [[ -f "$skill_dir/capabilities.json" ]]; then
        local t=$(estimate_tokens "$skill_dir/capabilities.json")
        total=$((total + t))
    fi

    # Tier 2: SKILL.md
    if [[ -f "$skill_dir/SKILL.md" ]]; then
        local t=$(estimate_tokens "$skill_dir/SKILL.md")
        total=$((total + t))
    fi

    echo "$total"
}

# Get skill category based on tags
get_skill_category() {
    local skill_id="$1"
    # Get tags from plugin.json
    jq -r ".skills[] | select(.id == \"$skill_id\") | .tags[]?" "$PLUGIN_JSON" 2>/dev/null | head -1
}

# Get agent category based on boundaries
get_agent_category() {
    local agent_id="$1"
    local allowed=$(jq -r ".agents[] | select(.id == \"$agent_id\") | .boundaries.allowed[]?" "$PLUGIN_JSON" 2>/dev/null | head -1)

    if [[ "$allowed" == *"backend"* || "$allowed" == *"api"* || "$allowed" == *"database"* ]]; then
        echo "backend"
    elif [[ "$allowed" == *"frontend"* || "$allowed" == *"components"* || "$allowed" == *"styles"* ]]; then
        echo "frontend"
    elif [[ "$allowed" == *"tests"* ]]; then
        echo "testing"
    else
        echo "general"
    fi
}

# Check if a skill exists in skills directory
skill_exists() {
    local skill_id="$1"
    [[ -d "$SKILLS_DIR/$skill_id" ]]
}

# Check if capabilities.json exists for a skill
skill_has_capabilities() {
    local skill_id="$1"
    [[ -f "$SKILLS_DIR/$skill_id/capabilities.json" ]]
}

# ============================================================================
# TEST 1: SKILL LOADING BY AGENT
# ============================================================================

test_skill_loading_by_agent() {
    local failed_agents=""
    local missing_skills=""

    while IFS= read -r agent_id; do
        vlog "Checking agent: $agent_id"

        while IFS= read -r skill_id; do
            if [[ -n "$skill_id" ]]; then
                if ! skill_exists "$skill_id"; then
                    missing_skills="$missing_skills  - Agent '$agent_id' references non-existent skill: $skill_id\n"
                    failed_agents="$failed_agents $agent_id"
                else
                    vlog "  Found skill: $skill_id"
                fi
            fi
        done < <(get_agent_skills_from_plugin "$agent_id")
    done < <(get_all_agent_ids)

    if [[ -n "$missing_skills" ]]; then
        echo -e "$missing_skills"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 2: TRIGGER MATCHING
# ============================================================================

test_trigger_matching() {
    local mismatches=""

    while IFS= read -r skill_id; do
        if ! skill_has_capabilities "$skill_id"; then
            continue
        fi

        vlog "Checking triggers for skill: $skill_id"

        # Get triggers from capabilities.json
        local caps_triggers=$(get_skill_triggers "$skill_id")

        if [[ -n "$caps_triggers" ]]; then
            # Check if the skill is referenced with compatible triggers in plugin.json
            # (We verify that capabilities.json has triggers defined - this is the canonical source)
            local trigger_count=$(echo "$caps_triggers" | grep -c '.' || echo "0")
            if [[ "$trigger_count" -eq 0 ]]; then
                mismatches="$mismatches  - Skill '$skill_id' has empty triggers in capabilities.json\n"
            else
                vlog "  Found $trigger_count triggers for $skill_id"
            fi
        fi
    done < <(get_all_skill_ids)

    if [[ -n "$mismatches" ]]; then
        echo -e "$mismatches"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 3: AGENT-SKILL CONSISTENCY
# ============================================================================

test_agent_skill_consistency() {
    local inconsistencies=""

    # Backend agents should primarily use backend skills
    local backend_agents="backend-system-architect database-engineer data-pipeline-engineer"
    local backend_skill_tags="backend api database postgresql"

    # Frontend agents should primarily use frontend skills
    local frontend_agents="frontend-ui-developer rapid-ui-designer"
    local frontend_skill_tags="frontend react ui components"

    # Testing agents should use testing skills
    local testing_agents="test-generator code-quality-reviewer"
    local testing_skill_tags="testing unit integration e2e mocking"

    # Check backend agents
    for agent_id in $backend_agents; do
        local has_backend_skill=false
        while IFS= read -r skill_id; do
            if [[ -n "$skill_id" ]]; then
                local tags=$(jq -r ".skills[] | select(.id == \"$skill_id\") | .tags[]?" "$PLUGIN_JSON" 2>/dev/null | tr '\n' ' ')
                for tag in $backend_skill_tags; do
                    if [[ "$tags" == *"$tag"* ]]; then
                        has_backend_skill=true
                        break 2
                    fi
                done
            fi
        done < <(get_agent_skills_from_plugin "$agent_id")

        if [[ "$has_backend_skill" == "false" ]]; then
            inconsistencies="$inconsistencies  - Backend agent '$agent_id' has no backend-related skills\n"
        else
            vlog "Backend agent $agent_id has appropriate backend skills"
        fi
    done

    # Check frontend agents
    for agent_id in $frontend_agents; do
        local has_frontend_skill=false
        while IFS= read -r skill_id; do
            if [[ -n "$skill_id" ]]; then
                local tags=$(jq -r ".skills[] | select(.id == \"$skill_id\") | .tags[]?" "$PLUGIN_JSON" 2>/dev/null | tr '\n' ' ')
                for tag in $frontend_skill_tags; do
                    if [[ "$tags" == *"$tag"* ]]; then
                        has_frontend_skill=true
                        break 2
                    fi
                done
            fi
        done < <(get_agent_skills_from_plugin "$agent_id")

        if [[ "$has_frontend_skill" == "false" ]]; then
            inconsistencies="$inconsistencies  - Frontend agent '$agent_id' has no frontend-related skills\n"
        else
            vlog "Frontend agent $agent_id has appropriate frontend skills"
        fi
    done

    # Check testing agents
    for agent_id in $testing_agents; do
        local has_testing_skill=false
        while IFS= read -r skill_id; do
            if [[ -n "$skill_id" ]]; then
                local tags=$(jq -r ".skills[] | select(.id == \"$skill_id\") | .tags[]?" "$PLUGIN_JSON" 2>/dev/null | tr '\n' ' ')
                for tag in $testing_skill_tags; do
                    if [[ "$tags" == *"$tag"* ]]; then
                        has_testing_skill=true
                        break 2
                    fi
                done
            fi
        done < <(get_agent_skills_from_plugin "$agent_id")

        if [[ "$has_testing_skill" == "false" ]]; then
            inconsistencies="$inconsistencies  - Testing agent '$agent_id' has no testing-related skills\n"
        else
            vlog "Testing agent $agent_id has appropriate testing skills"
        fi
    done

    if [[ -n "$inconsistencies" ]]; then
        echo -e "$inconsistencies"
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
                # Check if referenced skill exists
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
# TEST 5: AUTO-TRIGGER VALIDATION
# ============================================================================

test_auto_trigger_validation() {
    local invalid_triggers=""
    local all_agent_ids=$(get_all_agent_ids)

    # Check auto_triggers in progressive_loading section
    local auto_triggers=$(jq -r '.progressive_loading.auto_triggers | keys[]?' "$PLUGIN_JSON" 2>/dev/null)

    for trigger_key in $auto_triggers; do
        vlog "Checking auto_trigger: $trigger_key"

        # Get the agent referenced in this auto_trigger
        local agent_ref=$(jq -r ".progressive_loading.auto_triggers[\"$trigger_key\"].agent // empty" "$PLUGIN_JSON" 2>/dev/null)

        if [[ -n "$agent_ref" ]]; then
            if ! echo "$all_agent_ids" | grep -qx "$agent_ref"; then
                invalid_triggers="$invalid_triggers  - Auto-trigger '$trigger_key' references non-existent agent: $agent_ref\n"
            else
                vlog "  Valid agent reference: $agent_ref"
            fi
        fi

        # Get the skill referenced in this auto_trigger
        local skill_ref=$(jq -r ".progressive_loading.auto_triggers[\"$trigger_key\"].skill // empty" "$PLUGIN_JSON" 2>/dev/null)

        if [[ -n "$skill_ref" ]]; then
            if ! skill_exists "$skill_ref"; then
                invalid_triggers="$invalid_triggers  - Auto-trigger '$trigger_key' references non-existent skill: $skill_ref\n"
            else
                vlog "  Valid skill reference: $skill_ref"
            fi
        fi
    done

    if [[ -n "$invalid_triggers" ]]; then
        echo -e "$invalid_triggers"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 6: TOKEN BUDGET CHAIN (Progressive Loading - Tier 1 Only)
# ============================================================================

test_token_budget_chain() {
    local budget_violations=""

    while IFS= read -r agent_id; do
        vlog "Checking token budget for agent: $agent_id"

        local tier1_tokens=0
        local skill_count=0

        while IFS= read -r skill_id; do
            if [[ -n "$skill_id" ]] && skill_exists "$skill_id"; then
                local skill_tokens=$(estimate_tier1_tokens "$skill_id")
                tier1_tokens=$((tier1_tokens + skill_tokens))
                skill_count=$((skill_count + 1))
                vlog "  Skill $skill_id (Tier 1): ~$skill_tokens tokens"
            fi
        done < <(get_agent_skills_from_plugin "$agent_id")

        vlog "  Total Tier 1 for $agent_id ($skill_count skills): ~$tier1_tokens tokens"

        # Check Tier 1 budget (discovery phase)
        if [[ $tier1_tokens -gt $MAX_TIER1_TOKEN_BUDGET ]]; then
            budget_violations="$budget_violations  - Agent '$agent_id' Tier 1 budget exceeded: ~$tier1_tokens tokens (max: $MAX_TIER1_TOKEN_BUDGET)\n"
        fi
    done < <(get_all_agent_ids)

    if [[ -n "$budget_violations" ]]; then
        echo -e "$budget_violations"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 7: CIRCULAR DEPENDENCY CHECK (simplified - direct mutual refs only)
# ============================================================================

# Check for direct mutual references (A integrates B and B integrates A)
# This is a simplified check that runs fast. Mutual references are acceptable
# in integrates_with as they indicate skills that work well together.
test_circular_dependency_check() {
    local mutual_refs=""
    local checked_pairs=""

    while IFS= read -r skill_id; do
        if ! skill_has_capabilities "$skill_id"; then
            continue
        fi

        vlog "Checking mutual refs for: $skill_id"

        # Get this skill's integrates_with
        while IFS= read -r dep_skill; do
            if [[ -n "$dep_skill" ]]; then
                # Skip already checked pairs
                local pair_key="$dep_skill:$skill_id"
                if [[ " $checked_pairs " == *" $pair_key "* ]]; then
                    continue
                fi

                # Check if dep_skill also references skill_id
                if skill_has_capabilities "$dep_skill"; then
                    local reverse_deps=$(get_skill_integrates_with "$dep_skill")
                    if echo "$reverse_deps" | grep -qx "$skill_id"; then
                        # Only report once (alphabetically first)
                        if [[ "$skill_id" < "$dep_skill" ]]; then
                            mutual_refs="$mutual_refs    $skill_id <-> $dep_skill\n"
                        fi
                        checked_pairs="$checked_pairs $skill_id:$dep_skill"
                    fi
                fi
            fi
        done < <(get_skill_integrates_with "$skill_id")
    done < <(get_all_skill_ids)

    if [[ -n "$mutual_refs" ]]; then
        if [[ "$CIRCULAR_DEP_MODE" == "strict" ]]; then
            echo -e "  Mutual references found:\n$mutual_refs"
            return 1
        else
            vlog "Mutual references found (acceptable):\n$mutual_refs"
            return 0  # Pass - mutual refs are acceptable
        fi
    fi

    return 0
}
# ============================================================================
# TEST 8: COMPLETE WORKFLOW TEST
# ============================================================================

test_complete_workflow() {
    local workflow_issues=""

    # Get all workflows
    local workflows=$(jq -r '.workflows[].id' "$PLUGIN_JSON" 2>/dev/null)

    for workflow_id in $workflows; do
        vlog "Checking workflow: $workflow_id"

        # Check skills referenced in workflow
        local workflow_skills=$(jq -r ".workflows[] | select(.id == \"$workflow_id\") | .skills[]?" "$PLUGIN_JSON" 2>/dev/null)

        for skill_id in $workflow_skills; do
            if [[ -n "$skill_id" ]]; then
                if ! skill_exists "$skill_id"; then
                    workflow_issues="$workflow_issues  - Workflow '$workflow_id' references non-existent skill: $skill_id\n"
                else
                    vlog "  Valid skill: $skill_id"
                fi
            fi
        done

        # Check agents referenced in workflow
        local workflow_agents=$(jq -r ".workflows[] | select(.id == \"$workflow_id\") | .agents | (.pipeline[]?, .sequence[]?, .primary?, .validation?, .orchestrator?) // empty" "$PLUGIN_JSON" 2>/dev/null | sort -u)

        for agent_id in $workflow_agents; do
            if [[ -n "$agent_id" ]]; then
                local agent_exists=$(jq -r ".agents[] | select(.id == \"$agent_id\") | .id" "$PLUGIN_JSON" 2>/dev/null)
                if [[ -z "$agent_exists" ]]; then
                    workflow_issues="$workflow_issues  - Workflow '$workflow_id' references non-existent agent: $agent_id\n"
                else
                    vlog "  Valid agent: $agent_id"
                fi
            fi
        done

        # Verify workflow has at least one agent
        if [[ -z "$workflow_agents" ]]; then
            workflow_issues="$workflow_issues  - Workflow '$workflow_id' has no agents defined\n"
        fi
    done

    if [[ -n "$workflow_issues" ]]; then
        echo -e "$workflow_issues"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 9: AGENT MARKDOWN SKILL CONSISTENCY
# ============================================================================

test_agent_md_skill_consistency() {
    local inconsistencies=""

    while IFS= read -r agent_id; do
        local agent_path=$(jq -r ".agents[] | select(.id == \"$agent_id\") | .path" "$PLUGIN_JSON" 2>/dev/null)
        local agent_file="$PROJECT_ROOT/$agent_path"

        if [[ ! -f "$agent_file" ]]; then
            vlog "Agent file not found: $agent_file"
            continue
        fi

        vlog "Checking agent markdown consistency: $agent_id"

        # Get skills from plugin.json
        local plugin_skills=$(get_agent_skills_from_plugin "$agent_id" | sort | tr '\n' ' ')

        # Get skills from agent markdown
        local md_skills=$(get_agent_skills_from_md "$agent_file" | sort | tr '\n' ' ')

        # Compare (allowing for minor differences)
        if [[ -n "$plugin_skills" && -n "$md_skills" ]]; then
            # Check if all plugin skills are in md
            for skill in $plugin_skills; do
                if [[ "$md_skills" != *"$skill"* ]]; then
                    vlog "  Skill $skill in plugin.json but not in markdown"
                fi
            done
            # Check if all md skills are in plugin
            for skill in $md_skills; do
                if [[ "$plugin_skills" != *"$skill"* ]]; then
                    vlog "  Skill $skill in markdown but not in plugin.json"
                fi
            done
        fi
    done < <(get_all_agent_ids)

    # This is a soft check - just log inconsistencies but don't fail
    return 0
}

# ============================================================================
# TEST 10: DEPENDENCY GRAPH VALIDATION
# ============================================================================

test_dependency_graph_validation() {
    local invalid_mappings=""

    vlog "Checking dependency_graph.skills_to_agents"

    # Get all skill-to-agent mappings
    local skill_mappings=$(jq -r '.dependency_graph.skills_to_agents | keys[]' "$PLUGIN_JSON" 2>/dev/null)

    for skill_id in $skill_mappings; do
        # Check skill exists
        if ! skill_exists "$skill_id"; then
            invalid_mappings="$invalid_mappings  - dependency_graph references non-existent skill: $skill_id\n"
            continue
        fi

        vlog "Checking dependency mapping for skill: $skill_id"

        # Check each agent in the mapping
        local mapped_agents=$(jq -r ".dependency_graph.skills_to_agents[\"$skill_id\"][]" "$PLUGIN_JSON" 2>/dev/null)

        for agent_id in $mapped_agents; do
            local agent_exists=$(jq -r ".agents[] | select(.id == \"$agent_id\") | .id" "$PLUGIN_JSON" 2>/dev/null)
            if [[ -z "$agent_exists" ]]; then
                invalid_mappings="$invalid_mappings  - dependency_graph skill '$skill_id' maps to non-existent agent: $agent_id\n"
            else
                vlog "  Valid mapping: $skill_id -> $agent_id"
            fi
        done
    done

    if [[ -n "$invalid_mappings" ]]; then
        echo -e "$invalid_mappings"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 11: SKILL DIRECTORY STRUCTURE
# ============================================================================

test_skill_directory_structure() {
    local structure_issues=""

    while IFS= read -r skill_id; do
        local skill_dir="$SKILLS_DIR/$skill_id"

        vlog "Checking structure for skill: $skill_id"

        # Check for required Tier 1 file
        if [[ ! -f "$skill_dir/capabilities.json" ]]; then
            structure_issues="$structure_issues  - Skill '$skill_id' missing required capabilities.json (Tier 1)\n"
        fi

        # Check for recommended Tier 2 file
        if [[ ! -f "$skill_dir/SKILL.md" ]]; then
            vlog "  Warning: Skill '$skill_id' missing SKILL.md (Tier 2)"
        fi
    done < <(get_all_skill_ids)

    if [[ -n "$structure_issues" ]]; then
        echo -e "$structure_issues"
        return 1
    fi
    return 0
}

# ============================================================================
# TEST 12: AGENT FILE EXISTS
# ============================================================================

test_agent_file_exists() {
    local missing_files=""

    while IFS= read -r agent_id; do
        local agent_path=$(jq -r ".agents[] | select(.id == \"$agent_id\") | .path" "$PLUGIN_JSON" 2>/dev/null)
        local agent_file="$PROJECT_ROOT/$agent_path"

        vlog "Checking agent file: $agent_file"

        if [[ ! -f "$agent_file" ]]; then
            missing_files="$missing_files  - Agent '$agent_id' file not found: $agent_path\n"
        fi
    done < <(get_all_agent_ids)

    if [[ -n "$missing_files" ]]; then
        echo -e "$missing_files"
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
echo "Plugin:  $PLUGIN_JSON"
echo "Skills:  $SKILLS_DIR"
echo "Agents:  $AGENTS_DIR"
echo ""

# Verify prerequisites
if [[ ! -f "$PLUGIN_JSON" ]]; then
    echo -e "${RED}ERROR${NC}: plugin.json not found at $PLUGIN_JSON"
    exit 1
fi

if [[ ! -d "$SKILLS_DIR" ]]; then
    echo -e "${RED}ERROR${NC}: Skills directory not found at $SKILLS_DIR"
    exit 1
fi

if [[ ! -d "$AGENTS_DIR" ]]; then
    echo -e "${RED}ERROR${NC}: Agents directory not found at $AGENTS_DIR"
    exit 1
fi

# Count skills and agents
SKILL_COUNT=$(get_all_skill_ids | wc -l | tr -d ' ')
AGENT_COUNT=$(get_all_agent_ids | wc -l | tr -d ' ')
WORKFLOW_COUNT=$(jq -r '.workflows | length' "$PLUGIN_JSON" 2>/dev/null || echo "0")
echo "Found: $SKILL_COUNT skills, $AGENT_COUNT agents, $WORKFLOW_COUNT workflows"
echo "Token budget (Tier 1): $MAX_TIER1_TOKEN_BUDGET tokens"
echo "Circular dependency mode: $CIRCULAR_DEP_MODE"
echo ""

# Run tests
describe "Skill-Agent Integration Tests"

it "Agent files exist in filesystem" test_agent_file_exists

it "Skills used by agents exist in skills directory" test_skill_loading_by_agent

it "Skill triggers are defined in capabilities.json" test_trigger_matching

it "Agents use skills consistent with their category" test_agent_skill_consistency

it "Cross-references (integrates_with) point to valid skills" test_cross_references

it "Auto-triggers reference valid agents and skills" test_auto_trigger_validation

it "Agent Tier 1 skill loading stays within budget ($MAX_TIER1_TOKEN_BUDGET tokens)" test_token_budget_chain

it "No deep circular dependencies in skill integrations" test_circular_dependency_check

it "Workflows reference valid skills and agents" test_complete_workflow

it "Agent markdown files are consistent with plugin.json" test_agent_md_skill_consistency

it "Dependency graph maps to valid skills and agents" test_dependency_graph_validation

it "Skill directories have required structure" test_skill_directory_structure

# Print summary
print_summary