#!/usr/bin/env bash
# ============================================================================
# Agent Lifecycle E2E Test
# ============================================================================
# Verifies that agents:
# 1. Are discovered from agents/ directory (Claude Code auto-discovery)
# 2. Have proper YAML frontmatter and markdown structure
# 3. Reference only existing skills
# 4. Can be validated for spawning readiness
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
AGENTS_DIR="$PROJECT_ROOT/agents"
SKILLS_DIR="$PROJECT_ROOT/skills"

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
# Test 1: Agent Directory Discovery (Claude Code auto-discovery)
# ============================================================================
echo "▶ Test 1: Agent Directory Discovery"
echo "────────────────────────────────────────"

if [ ! -d "$AGENTS_DIR" ]; then
    fail "agents/ directory not found at $AGENTS_DIR"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi

# Count .md files (excluding README)
agent_files=($(find "$AGENTS_DIR" -maxdepth 1 -name "*.md" ! -name "README.md" 2>/dev/null))
agent_count=${#agent_files[@]}

if [ "$agent_count" -gt 0 ]; then
    pass "Found $agent_count agents in agents/ directory"
else
    fail "No agent .md files found in agents/ directory"
fi

# Build list of agent IDs from filenames
declare -a AGENT_IDS
for agent_file in "${agent_files[@]}"; do
    agent_id=$(basename "$agent_file" .md)
    AGENT_IDS+=("$agent_id")
done

echo ""

# ============================================================================
# Test 2: YAML Frontmatter Validation
# ============================================================================
echo "▶ Test 2: YAML Frontmatter Validation"
echo "────────────────────────────────────────"

# Required frontmatter fields
required_frontmatter=("name" "description" "tools")

agents_with_missing_frontmatter=0

for agent_id in "${AGENT_IDS[@]}"; do
    md_file="$AGENTS_DIR/${agent_id}.md"
    missing_fields=()

    # Check file starts with frontmatter
    if ! head -1 "$md_file" | grep -q "^---$"; then
        fail "Agent '$agent_id' missing YAML frontmatter"
        ((agents_with_missing_frontmatter++)) || true
        continue
    fi

    for field in "${required_frontmatter[@]}"; do
        if ! grep -q "^${field}:" "$md_file" 2>/dev/null; then
            missing_fields+=("$field")
        fi
    done

    if [ ${#missing_fields[@]} -gt 0 ]; then
        fail "Agent '$agent_id' missing frontmatter: ${missing_fields[*]}"
        ((agents_with_missing_frontmatter++)) || true
    fi
done

if [ "$agents_with_missing_frontmatter" -eq 0 ]; then
    pass "All agents have valid YAML frontmatter"
fi

echo ""

# ============================================================================
# Test 3: Directive Section Validation
# ============================================================================
echo "▶ Test 3: Directive Section Validation"
echo "────────────────────────────────────────"

agents_without_directive=0

for agent_id in "${AGENT_IDS[@]}"; do
    md_file="$AGENTS_DIR/${agent_id}.md"

    # Check for Directive section (## Directive)
    if ! grep -qi "^## Directive\|^## Purpose\|^## Role" "$md_file" 2>/dev/null; then
        fail "Agent '$agent_id' missing Directive/Purpose section"
        ((agents_without_directive++)) || true
    fi
done

if [ "$agents_without_directive" -eq 0 ]; then
    pass "All agents have directive sections"
fi

echo ""

# ============================================================================
# Test 4: Skills Reference Validation
# ============================================================================
echo "▶ Test 4: Skills Reference Validation"
echo "────────────────────────────────────────"

# Get all valid skill IDs from skills directory
valid_skill_ids=$(find "$SKILLS_DIR" -maxdepth 1 -type d ! -name "skills" -exec basename {} \; 2>/dev/null | sort -u)

invalid_skill_refs=0

for agent_id in "${AGENT_IDS[@]}"; do
    md_file="$AGENTS_DIR/${agent_id}.md"

    # Extract skills from frontmatter (skills: skill1, skill2, skill3)
    skills_line=$(grep "^skills:" "$md_file" 2>/dev/null || echo "")

    if [ -n "$skills_line" ]; then
        # Parse comma-separated skills
        skills_value="${skills_line#skills:}"
        skills_value=$(echo "$skills_value" | tr ',' '\n' | tr -d ' ')

        for skill in $skills_value; do
            skill=$(echo "$skill" | tr -d '[:space:]')
            if [ -n "$skill" ] && ! echo "$valid_skill_ids" | grep -qx "$skill"; then
                fail "Agent '$agent_id' references non-existent skill: $skill"
                ((invalid_skill_refs++)) || true
            fi
        done
    fi
done

if [ "$invalid_skill_refs" -eq 0 ]; then
    pass "All agent skill references are valid"
fi

echo ""

# ============================================================================
# Test 5: Agent File Structure
# ============================================================================
echo "▶ Test 5: Agent File Structure"
echo "────────────────────────────────────────"

empty_files=0
small_files=0

for agent_id in "${AGENT_IDS[@]}"; do
    md_file="$AGENTS_DIR/${agent_id}.md"

    if [ ! -s "$md_file" ]; then
        fail "Agent '$agent_id' has empty .md file"
        ((empty_files++)) || true
        continue
    fi

    # Check minimum content (at least 200 bytes for meaningful agent definition)
    file_size=$(wc -c < "$md_file" | tr -d ' ')
    if [ "$file_size" -lt 200 ]; then
        fail "Agent '$agent_id' has insufficient content ($file_size bytes)"
        ((small_files++)) || true
    fi
done

if [ "$empty_files" -eq 0 ] && [ "$small_files" -eq 0 ]; then
    pass "All agents have proper file structure"
fi

echo ""

# ============================================================================
# Test 6: Tools Declaration Validation
# ============================================================================
echo "▶ Test 6: Tools Declaration Validation"
echo "────────────────────────────────────────"

valid_tools=("Read" "Write" "Edit" "MultiEdit" "Bash" "Glob" "Grep" "WebFetch" "WebSearch" "Task" "Skill" "NotebookEdit")
agents_with_invalid_tools=0

for agent_id in "${AGENT_IDS[@]}"; do
    md_file="$AGENTS_DIR/${agent_id}.md"

    # Extract tools from frontmatter
    tools_line=$(grep "^tools:" "$md_file" 2>/dev/null || echo "")

    if [ -z "$tools_line" ]; then
        fail "Agent '$agent_id' has no tools declared"
        ((agents_with_invalid_tools++)) || true
    fi
done

if [ "$agents_with_invalid_tools" -eq 0 ]; then
    pass "All agents have tools declared"
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

    # 1. Check agent .md file exists
    if [ ! -f "$AGENTS_DIR/${agent_id}.md" ]; then
        fail "Cannot spawn '$agent_id': .md file not found"
        return 1
    fi

    # 2. Check file has frontmatter
    if ! head -1 "$AGENTS_DIR/${agent_id}.md" | grep -q "^---$"; then
        fail "Cannot spawn '$agent_id': missing frontmatter"
        return 1
    fi

    # 3. Check it has name and description
    if ! grep -q "^name:" "$AGENTS_DIR/${agent_id}.md" 2>/dev/null; then
        fail "Cannot spawn '$agent_id': missing name in frontmatter"
        ((errors++)) || true
    fi

    if ! grep -q "^description:" "$AGENTS_DIR/${agent_id}.md" 2>/dev/null; then
        fail "Cannot spawn '$agent_id': missing description in frontmatter"
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
    if [ -f "$AGENTS_DIR/${agent}.md" ]; then
        simulate_spawn "$agent" || true
    else
        info "Key agent '$agent' not found (optional)"
    fi
done

echo ""

# ============================================================================
# Test 8: Agent Handoff Protocol
# ============================================================================
echo "▶ Test 8: Agent Handoff Protocol"
echo "────────────────────────────────────────"

# Check that agents with hooks have proper configuration
for agent_id in "${AGENT_IDS[@]}"; do
    md_file="$AGENTS_DIR/${agent_id}.md"

    # Check if agent has hooks defined
    if grep -q "^hooks:" "$md_file" 2>/dev/null; then
        # Verify hooks section has at least one hook
        if ! grep -q "command:" "$md_file" 2>/dev/null; then
            info "Agent '$agent_id' has hooks section but no commands defined"
        fi
    fi
done

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