#!/usr/bin/env bash
# Test suite for AI/ML Roadmap 2026 agents
# Tests: ai-safety-auditor, prompt-engineer

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++)) || true
    ((TESTS_RUN++)) || true
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++)) || true
    ((TESTS_RUN++)) || true
}

# New AI/ML agents to test
AI_ML_AGENTS=(
    "ai-safety-auditor"
    "prompt-engineer"
)

echo "=== AI/ML Roadmap 2026 Agents Test Suite ==="
echo ""

# Test 1: Agent files exist
echo "Test 1: Agent files exist"
for agent in "${AI_ML_AGENTS[@]}"; do
    if [[ -f "$PROJECT_ROOT/agents/$agent.md" ]]; then
        pass "$agent.md exists"
    else
        fail "$agent.md missing"
    fi
done

# Test 2: Required frontmatter fields
echo ""
echo "Test 2: Frontmatter validation"
for agent in "${AI_ML_AGENTS[@]}"; do
    agent_file="$PROJECT_ROOT/agents/$agent.md"
    if [[ -f "$agent_file" ]]; then
        has_name=$(grep -c "^name:" "$agent_file" || true)
        has_desc=$(grep -c "^description:" "$agent_file" || true)
        has_model=$(grep -c "^model:" "$agent_file" || true)
        has_tools=$(grep -c "^tools:" "$agent_file" || true)
        has_skills=$(grep -c "^skills:" "$agent_file" || true)

        if [[ $has_name -ge 1 && $has_desc -ge 1 && $has_model -ge 1 && $has_tools -ge 1 && $has_skills -ge 1 ]]; then
            pass "$agent has all required frontmatter"
        else
            fail "$agent missing frontmatter (name:$has_name desc:$has_desc model:$has_model tools:$has_tools skills:$has_skills)"
        fi
    fi
done

# Test 3: Model selection appropriate
echo ""
echo "Test 3: Model selection validation"
for agent in "${AI_ML_AGENTS[@]}"; do
    agent_file="$PROJECT_ROOT/agents/$agent.md"
    if [[ -f "$agent_file" ]]; then
        model=$(grep "^model:" "$agent_file" | awk '{print $2}')

        # ai-safety-auditor should use opus (security-critical)
        # prompt-engineer can use sonnet (balanced)
        if [[ "$agent" == "ai-safety-auditor" && "$model" == "opus" ]]; then
            pass "$agent uses opus (appropriate for security-critical)"
        elif [[ "$agent" == "prompt-engineer" && "$model" == "sonnet" ]]; then
            pass "$agent uses sonnet (appropriate for prompt design)"
        else
            echo -e "${YELLOW}!${NC} $agent uses $model (review if appropriate)"
            ((TESTS_RUN++)) || true
            ((TESTS_PASSED++)) || true
        fi
    fi
done

# Test 4: Skills array validation
echo ""
echo "Test 4: Skills array validation"
for agent in "${AI_ML_AGENTS[@]}"; do
    agent_file="$PROJECT_ROOT/agents/$agent.md"
    if [[ -f "$agent_file" ]]; then
        # Count skills in the skills array (between skills: and ---)
        skill_count=$(awk '/^skills:/,/^---/' "$agent_file" | grep -c "^  - " || true)

        if [[ $skill_count -ge 3 ]]; then
            pass "$agent has $skill_count skills"
        else
            fail "$agent has only $skill_count skills (need >=3)"
        fi
    fi
done

# Test 5: Description contains activation keywords
echo ""
echo "Test 5: Activation keywords in description"
for agent in "${AI_ML_AGENTS[@]}"; do
    agent_file="$PROJECT_ROOT/agents/$agent.md"
    if [[ -f "$agent_file" ]]; then
        desc=$(grep "^description:" "$agent_file" | cut -d':' -f2-)

        if [[ "$agent" == "ai-safety-auditor" ]]; then
            if echo "$desc" | grep -qi "safety\|security\|audit\|red.team\|guardrail"; then
                pass "$agent has security-related activation keywords"
            else
                fail "$agent missing activation keywords"
            fi
        elif [[ "$agent" == "prompt-engineer" ]]; then
            if echo "$desc" | grep -qi "prompt\|cot\|few.shot\|chain.of.thought"; then
                pass "$agent has prompt-related activation keywords"
            else
                fail "$agent missing activation keywords"
            fi
        fi
    fi
done

# Test 6: Directive section exists
echo ""
echo "Test 6: Directive section validation"
for agent in "${AI_ML_AGENTS[@]}"; do
    agent_file="$PROJECT_ROOT/agents/$agent.md"
    if [[ -f "$agent_file" ]]; then
        if grep -q "## Directive" "$agent_file"; then
            pass "$agent has Directive section"
        else
            fail "$agent missing Directive section"
        fi
    fi
done

# Test 7: Concrete Objectives section
echo ""
echo "Test 7: Concrete Objectives section"
for agent in "${AI_ML_AGENTS[@]}"; do
    agent_file="$PROJECT_ROOT/agents/$agent.md"
    if [[ -f "$agent_file" ]]; then
        if grep -q "## Concrete Objectives" "$agent_file"; then
            pass "$agent has Concrete Objectives section"
        else
            fail "$agent missing Concrete Objectives section"
        fi
    fi
done

# Test 8: Task Boundaries section
echo ""
echo "Test 8: Task Boundaries section"
for agent in "${AI_ML_AGENTS[@]}"; do
    agent_file="$PROJECT_ROOT/agents/$agent.md"
    if [[ -f "$agent_file" ]]; then
        if grep -q "## Task Boundaries" "$agent_file"; then
            pass "$agent has Task Boundaries section"
        else
            fail "$agent missing Task Boundaries section"
        fi
    fi
done

# Test 9: Output Format section
echo ""
echo "Test 9: Output Format section"
for agent in "${AI_ML_AGENTS[@]}"; do
    agent_file="$PROJECT_ROOT/agents/$agent.md"
    if [[ -f "$agent_file" ]]; then
        if grep -q "## Output Format" "$agent_file"; then
            pass "$agent has Output Format section"
        else
            fail "$agent missing Output Format section"
        fi
    fi
done

# Test 10: MCP Tools section (for memory integration)
echo ""
echo "Test 10: MCP Tools section"
for agent in "${AI_ML_AGENTS[@]}"; do
    agent_file="$PROJECT_ROOT/agents/$agent.md"
    if [[ -f "$agent_file" ]]; then
        if grep -q "## MCP Tools" "$agent_file" || grep -q "mcp__" "$agent_file"; then
            pass "$agent has MCP integration"
        else
            echo -e "${YELLOW}!${NC} $agent may be missing MCP integration"
            ((TESTS_RUN++)) || true
            ((TESTS_PASSED++)) || true
        fi
    fi
done

# Test 11: Referenced skills exist
echo ""
echo "Test 11: Referenced skills exist"
for agent in "${AI_ML_AGENTS[@]}"; do
    agent_file="$PROJECT_ROOT/agents/$agent.md"
    if [[ -f "$agent_file" ]]; then
        # Extract skills from frontmatter (between skills: and ---)
        skills=$(awk '/^skills:/,/^---/' "$agent_file" | grep "^  - " | awk '{print $2}')

        all_exist=1
        for skill in $skills; do
            if [[ ! -d "$PROJECT_ROOT/skills/$skill" ]]; then
                echo -e "${RED}✗${NC} $agent references non-existent skill: $skill"
                all_exist=0
            fi
        done

        if [[ $all_exist -eq 1 ]]; then
            pass "$agent: all referenced skills exist"
        else
            ((TESTS_FAILED++)) || true
            ((TESTS_RUN++)) || true
        fi
    fi
done

echo ""
echo "=== Results ==="
echo "Tests run: $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}All AI/ML agent tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
fi
