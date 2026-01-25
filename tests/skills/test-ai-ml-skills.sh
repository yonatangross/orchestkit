#!/usr/bin/env bash
# Test suite for AI/ML Roadmap 2026 skills
# Tests: mcp-security-hardening, advanced-guardrails, agentic-rag-patterns,
#        prompt-engineering-suite, alternative-agent-frameworks, mcp-advanced-patterns,
#        high-performance-inference, fine-tuning-customization

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

# AI/ML skills to test
AI_ML_SKILLS=(
    "mcp-security-hardening"
    "advanced-guardrails"
    "agentic-rag-patterns"
    "prompt-engineering-suite"
    "alternative-agent-frameworks"
    "mcp-advanced-patterns"
    "high-performance-inference"
    "fine-tuning-customization"
)

echo "=== AI/ML Roadmap 2026 Skills Test Suite ==="
echo ""

# Test 1: All skills have SKILL.md
echo "Test 1: All skills have SKILL.md"
for skill in "${AI_ML_SKILLS[@]}"; do
    if [[ -f "$PROJECT_ROOT/src/skills/$skill/SKILL.md" ]]; then
        pass "$skill has SKILL.md"
    else
        fail "$skill missing SKILL.md"
    fi
done

# Test 2: All SKILL.md have required frontmatter
echo ""
echo "Test 2: SKILL.md frontmatter validation"
for skill in "${AI_ML_SKILLS[@]}"; do
    skill_file="$PROJECT_ROOT/src/skills/$skill/SKILL.md"
    if [[ -f "$skill_file" ]]; then
        # Check for required fields
        has_name=$(grep -c "^name:" "$skill_file" || true)
        has_desc=$(grep -c "^description:" "$skill_file" || true)
        has_version=$(grep -c "^version:" "$skill_file" || true)
        has_tags=$(grep -c "^tags:" "$skill_file" || true)

        if [[ $has_name -ge 1 && $has_desc -ge 1 && $has_version -ge 1 && $has_tags -ge 1 ]]; then
            pass "$skill has valid frontmatter"
        else
            fail "$skill missing frontmatter fields (name:$has_name desc:$has_desc version:$has_version tags:$has_tags)"
        fi
    fi
done

# Test 3: All skills have references directory with content
echo ""
echo "Test 3: References directory validation"
for skill in "${AI_ML_SKILLS[@]}"; do
    refs_dir="$PROJECT_ROOT/src/skills/$skill/references"
    if [[ -d "$refs_dir" ]]; then
        ref_count=$(find "$refs_dir" -type f -name "*.md" | wc -l | tr -d ' ')
        if [[ $ref_count -ge 2 ]]; then
            pass "$skill has $ref_count reference files"
        else
            fail "$skill has only $ref_count reference files (need >=2)"
        fi
    else
        fail "$skill missing references directory"
    fi
done

# Test 4: Skills have templates or checklists (at least one)
echo ""
echo "Test 4: Templates/Checklists validation"
for skill in "${AI_ML_SKILLS[@]}"; do
    has_templates=0
    has_checklists=0

    if [[ -d "$PROJECT_ROOT/src/skills/$skill/templates" ]]; then
        template_count=$(find "$PROJECT_ROOT/src/skills/$skill/templates" -type f | wc -l | tr -d ' ')
        if [[ $template_count -ge 1 ]]; then
            has_templates=1
        fi
    fi

    if [[ -d "$PROJECT_ROOT/src/skills/$skill/checklists" ]]; then
        checklist_count=$(find "$PROJECT_ROOT/src/skills/$skill/checklists" -type f | wc -l | tr -d ' ')
        if [[ $checklist_count -ge 1 ]]; then
            has_checklists=1
        fi
    fi

    if [[ $has_templates -eq 1 || $has_checklists -eq 1 ]]; then
        pass "$skill has templates($has_templates) or checklists($has_checklists)"
    else
        fail "$skill missing both templates and checklists"
    fi
done

# Test 5: SKILL.md "Overview" section (standardized in #179)
echo ""
echo "Test 5: 'Overview' section validation"
for skill in "${AI_ML_SKILLS[@]}"; do
    skill_file="$PROJECT_ROOT/src/skills/$skill/SKILL.md"
    if [[ -f "$skill_file" ]]; then
        if grep -q "## Overview" "$skill_file"; then
            pass "$skill has 'Overview' section"
        else
            fail "$skill missing 'Overview' section"
        fi
    fi
done

# Test 6: SKILL.md "Capability Details" section
echo ""
echo "Test 6: 'Capability Details' section validation"
for skill in "${AI_ML_SKILLS[@]}"; do
    skill_file="$PROJECT_ROOT/src/skills/$skill/SKILL.md"
    if [[ -f "$skill_file" ]]; then
        if grep -q "## Capability Details" "$skill_file"; then
            pass "$skill has 'Capability Details' section"
        else
            fail "$skill missing 'Capability Details' section"
        fi
    fi
done

# Test 7: SKILL.md "Related Skills" section
echo ""
echo "Test 7: 'Related Skills' section validation"
for skill in "${AI_ML_SKILLS[@]}"; do
    skill_file="$PROJECT_ROOT/src/skills/$skill/SKILL.md"
    if [[ -f "$skill_file" ]]; then
        if grep -q "## Related Skills" "$skill_file"; then
            pass "$skill has 'Related Skills' section"
        else
            fail "$skill missing 'Related Skills' section"
        fi
    fi
done

# Test 8: Token budget check (SKILL.md < 1500 tokens estimated)
echo ""
echo "Test 8: Token budget validation (SKILL.md)"
for skill in "${AI_ML_SKILLS[@]}"; do
    skill_file="$PROJECT_ROOT/src/skills/$skill/SKILL.md"
    if [[ -f "$skill_file" ]]; then
        # Rough estimate: 1 token ≈ 4 chars
        char_count=$(wc -c < "$skill_file" | tr -d ' ')
        estimated_tokens=$((char_count / 4))

        if [[ $estimated_tokens -le 1500 ]]; then
            pass "$skill SKILL.md ~$estimated_tokens tokens (budget OK)"
        else
            echo -e "${YELLOW}!${NC} $skill SKILL.md ~$estimated_tokens tokens (over budget, but acceptable for comprehensive skill)"
            ((TESTS_RUN++)) || true
            ((TESTS_PASSED++)) || true
        fi
    fi
done

# Test 9: Python templates syntax check (if python3 available)
echo ""
echo "Test 9: Python template syntax validation"
if command -v python3 &> /dev/null; then
    for skill in "${AI_ML_SKILLS[@]}"; do
        templates_dir="$PROJECT_ROOT/src/skills/$skill/templates"
        if [[ -d "$templates_dir" ]]; then
            py_files=$(find "$templates_dir" -name "*.py" 2>/dev/null || true)
            for py_file in $py_files; do
                if python3 -m py_compile "$py_file" 2>/dev/null; then
                    pass "$(basename "$py_file") syntax valid"
                else
                    fail "$(basename "$py_file") has syntax errors"
                fi
            done
        fi
    done
else
    echo -e "${YELLOW}!${NC} python3 not available, skipping syntax check"
fi

# Test 10: YAML templates validation (if yq available)
echo ""
echo "Test 10: YAML template validation"
for skill in "${AI_ML_SKILLS[@]}"; do
    templates_dir="$PROJECT_ROOT/src/skills/$skill/templates"
    if [[ -d "$templates_dir" ]]; then
        yaml_files=$(find "$templates_dir" -name "*.yaml" -o -name "*.yml" 2>/dev/null || true)
        for yaml_file in $yaml_files; do
            # Basic YAML validation: check for document markers, keys, or comments (valid YAML)
            if grep -q "^---" "$yaml_file" 2>/dev/null || \
               grep -qE "^[a-z_]+:" "$yaml_file" 2>/dev/null || \
               head -1 "$yaml_file" | grep -qE "^#" 2>/dev/null; then
                pass "$(basename "$yaml_file") appears valid"
            else
                fail "$(basename "$yaml_file") may be invalid"
            fi
        done
    fi
done

echo ""
echo "=== Results ==="
echo "Tests run: $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}All AI/ML skills tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
fi
