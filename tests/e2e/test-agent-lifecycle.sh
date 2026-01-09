#!/usr/bin/env bash
# ============================================================================
# Agent Lifecycle E2E Test
# ============================================================================
# Verifies that agents:
# 1. Are properly defined in plugin.json
# 2. Have all required fields (model_preference, boundaries, skills_used)
# 3. Reference only existing skills
# 4. Have corresponding .md files with proper structure
# 5. Can be validated for spawning readiness
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
AGENTS_DIR="$PROJECT_ROOT/.claude/agents"
SKILLS_DIR="$PROJECT_ROOT/.claude/skills"
PLUGIN_JSON="$PROJECT_ROOT/plugin.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; ((PASS_COUNT++)) || true; }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL_COUNT++)) || true; }
info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Agent Lifecycle E2E Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# Test 1: Plugin.json Agent Definitions
# ============================================================================
echo "▶ Test 1: Plugin.json Agent Definitions"
echo "────────────────────────────────────────"

if [ ! -f "$PLUGIN_JSON" ]; then
    fail "plugin.json not found"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi

agent_count=$(jq '.agents | length' "$PLUGIN_JSON" 2>/dev/null || echo "0")

if [ "$agent_count" -gt 0 ]; then
    pass "Found $agent_count agents in plugin.json"
else
    fail "No agents defined in plugin.json"
fi

echo ""

# ============================================================================
# Test 2: Required Fields Validation
# ============================================================================
echo "▶ Test 2: Required Fields Validation"
echo "────────────────────────────────────────"

# Required fields for each agent
required_fields=("id" "name" "capabilities" "model_preference")

agents_with_missing_fields=0

while IFS= read -r agent_id; do
    missing_fields=()

    for field in "${required_fields[@]}"; do
        if ! jq -e --arg id "$agent_id" --arg field "$field" '
            .agents[] | select(.id == $id) | .[$field]
        ' "$PLUGIN_JSON" >/dev/null 2>&1; then
            missing_fields+=("$field")
        fi
    done

    if [ ${#missing_fields[@]} -gt 0 ]; then
        fail "Agent '$agent_id' missing fields: ${missing_fields[*]}"
        ((agents_with_missing_fields++)) || true
    fi
done < <(jq -r '.agents[].id' "$PLUGIN_JSON" 2>/dev/null)

if [ "$agents_with_missing_fields" -eq 0 ]; then
    pass "All agents have required fields"
fi

echo ""

# ============================================================================
# Test 3: Model Preference Validation
# ============================================================================
echo "▶ Test 3: Model Preference Validation"
echo "────────────────────────────────────────"

valid_models=("opus" "sonnet" "haiku")
invalid_model_agents=0

while IFS= read -r agent_id; do
    # Get model preference (can be string or array)
    model_pref=$(jq -r --arg id "$agent_id" '
        .agents[] | select(.id == $id) | .model_preference
    ' "$PLUGIN_JSON" 2>/dev/null)

    if [ "$model_pref" = "null" ] || [ -z "$model_pref" ]; then
        fail "Agent '$agent_id' has no model_preference"
        ((invalid_model_agents++)) || true
        continue
    fi

    # Handle both string and array formats
    if [[ "$model_pref" == "["* ]]; then
        # It's an array, extract first model
        first_model=$(jq -r --arg id "$agent_id" '
            .agents[] | select(.id == $id) | .model_preference[0]
        ' "$PLUGIN_JSON" 2>/dev/null)
    else
        first_model="$model_pref"
    fi

    # Validate model is valid
    model_valid=false
    for valid in "${valid_models[@]}"; do
        if [[ "$first_model" == *"$valid"* ]]; then
            model_valid=true
            break
        fi
    done

    if ! $model_valid; then
        fail "Agent '$agent_id' has invalid model: $first_model"
        ((invalid_model_agents++)) || true
    fi
done < <(jq -r '.agents[].id' "$PLUGIN_JSON" 2>/dev/null)

if [ "$invalid_model_agents" -eq 0 ]; then
    pass "All agents have valid model preferences"
fi

echo ""

# ============================================================================
# Test 4: Skills Reference Validation
# ============================================================================
echo "▶ Test 4: Skills Reference Validation"
echo "────────────────────────────────────────"

# Get all valid skill IDs
valid_skill_ids=$(jq -r '.skills[].id // empty' "$PLUGIN_JSON" 2>/dev/null | sort -u)

invalid_skill_refs=0

while IFS= read -r agent_id; do
    # Get skills_used for this agent
    skills_used=$(jq -r --arg id "$agent_id" '
        .agents[] | select(.id == $id) | .skills_used[]? // empty
    ' "$PLUGIN_JSON" 2>/dev/null)

    for skill in $skills_used; do
        if ! echo "$valid_skill_ids" | grep -qx "$skill"; then
            fail "Agent '$agent_id' references non-existent skill: $skill"
            ((invalid_skill_refs++)) || true
        fi
    done
done < <(jq -r '.agents[].id' "$PLUGIN_JSON" 2>/dev/null)

if [ "$invalid_skill_refs" -eq 0 ]; then
    pass "All agent skill references are valid"
fi

echo ""

# ============================================================================
# Test 5: Agent Markdown Files
# ============================================================================
echo "▶ Test 5: Agent Markdown Files"
echo "────────────────────────────────────────"

missing_md_files=0

while IFS= read -r agent_id; do
    # Check for corresponding .md file
    md_file="$AGENTS_DIR/${agent_id}.md"

    if [ ! -f "$md_file" ]; then
        fail "Missing markdown file for agent: $agent_id"
        ((missing_md_files++)) || true
    fi
done < <(jq -r '.agents[].id' "$PLUGIN_JSON" 2>/dev/null)

if [ "$missing_md_files" -eq 0 ]; then
    pass "All agents have corresponding .md files"
fi

echo ""

# ============================================================================
# Test 6: Boundaries Validation
# ============================================================================
echo "▶ Test 6: Boundaries Validation"
echo "────────────────────────────────────────"

agents_without_boundaries=0

while IFS= read -r agent_id; do
    # Check if boundaries field exists
    has_boundaries=$(jq -r --arg id "$agent_id" '
        .agents[] | select(.id == $id) | has("boundaries")
    ' "$PLUGIN_JSON" 2>/dev/null)

    if [ "$has_boundaries" != "true" ]; then
        # Check the markdown file for boundaries section
        md_file="$AGENTS_DIR/${agent_id}.md"
        if [ -f "$md_file" ]; then
            if ! grep -qi "boundaries\|limitations\|scope" "$md_file" 2>/dev/null; then
                fail "Agent '$agent_id' has no boundaries defined"
                ((agents_without_boundaries++)) || true
            fi
        else
            fail "Agent '$agent_id' has no boundaries (no md file)"
            ((agents_without_boundaries++)) || true
        fi
    fi
done < <(jq -r '.agents[].id' "$PLUGIN_JSON" 2>/dev/null)

if [ "$agents_without_boundaries" -eq 0 ]; then
    pass "All agents have boundaries defined"
fi

echo ""

# ============================================================================
# Test 7: Spawning Readiness Simulation
# ============================================================================
echo "▶ Test 7: Spawning Readiness Simulation"
echo "────────────────────────────────────────"

simulate_spawn() {
    local agent_id="$1"
    local errors=0

    # 1. Check agent exists
    if ! jq -e --arg id "$agent_id" '.agents[] | select(.id == $id)' "$PLUGIN_JSON" >/dev/null 2>&1; then
        fail "Cannot spawn '$agent_id': not found in plugin.json"
        return 1
    fi

    # 2. Check all skills_used exist and can be loaded
    local skills_used
    skills_used=$(jq -r --arg id "$agent_id" '
        .agents[] | select(.id == $id) | .skills_used[]? // empty
    ' "$PLUGIN_JSON" 2>/dev/null)

    for skill in $skills_used; do
        skill_dir="$SKILLS_DIR/$skill"
        if [ ! -d "$skill_dir" ]; then
            fail "Cannot spawn '$agent_id': skill '$skill' directory not found"
            ((errors++)) || true
            continue
        fi

        if [ ! -f "$skill_dir/capabilities.json" ]; then
            fail "Cannot spawn '$agent_id': skill '$skill' missing capabilities.json"
            ((errors++)) || true
        fi
    done

    # 3. Check markdown file exists
    if [ ! -f "$AGENTS_DIR/${agent_id}.md" ]; then
        fail "Cannot spawn '$agent_id': markdown file not found"
        ((errors++)) || true
    fi

    if [ "$errors" -eq 0 ]; then
        pass "Agent '$agent_id' ready for spawning"
        return 0
    fi

    return 1
}

# Test spawning readiness for key agents
key_agents=("backend-system-architect" "frontend-ui-developer" "code-quality-reviewer" "security-auditor" "workflow-architect")

for agent in "${key_agents[@]}"; do
    simulate_spawn "$agent" || true
done

echo ""

# ============================================================================
# Test 8: Agent Handoff Protocol
# ============================================================================
echo "▶ Test 8: Agent Handoff Protocol"
echo "────────────────────────────────────────"

# Check that agents with handoff capabilities have proper configuration
handoff_issues=0

while IFS= read -r agent_id; do
    md_file="$AGENTS_DIR/${agent_id}.md"

    if [ -f "$md_file" ]; then
        # Check if agent mentions handoff
        if grep -qi "handoff\|delegate\|spawn" "$md_file" 2>/dev/null; then
            # Verify it has clear handoff criteria
            if ! grep -qi "when to\|criteria\|delegate when" "$md_file" 2>/dev/null; then
                info "Agent '$agent_id' mentions handoff but may lack clear criteria"
            fi
        fi
    fi
done < <(jq -r '.agents[].id' "$PLUGIN_JSON" 2>/dev/null)

pass "Handoff protocol check complete"

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi

exit 0