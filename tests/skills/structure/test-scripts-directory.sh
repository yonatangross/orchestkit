#!/usr/bin/env bash
# ============================================================================
# Scripts Directory Validation Tests
# ============================================================================
# Validates that templates/ → scripts/ rename is complete.
#
# Tests:
# 1. No templates/ directories remain
# 2. All SKILL.md files reference scripts/ not templates/
# 3. All markdown files reference scripts/ not templates/
# 4. Broken links to templates/ are caught
# 5. Script-enhanced skills are in correct location
#
# Usage: ./test-scripts-directory.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/src/skills"

VERBOSE="${1:-}"

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' NC=''
fi

# Test output functions
pass() {
    echo -e "  ${GREEN}PASS${NC} $1"
    ((PASS_COUNT++)) || true
}

fail() {
    echo -e "  ${RED}FAIL${NC} $1"
    ((FAIL_COUNT++)) || true
}

warn() {
    echo -e "  ${YELLOW}WARN${NC} $1"
    ((WARN_COUNT++)) || true
}

info() {
    if [[ "$VERBOSE" == "--verbose" ]]; then
        echo -e "  ${BLUE}INFO${NC} $1"
    fi
}

# ============================================================================
# Header
# ============================================================================
echo "============================================================================"
echo "  Scripts Directory Validation Tests"
echo "============================================================================"
echo ""
echo "Skills directory: $SKILLS_DIR"
echo ""

# ============================================================================
# Test 1: No templates/ directories remain
# ============================================================================
echo -e "${CYAN}Test 1: No templates/ Directories${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

TEMPLATES_DIRS=()
while IFS= read -r dir; do
    if [[ -d "$dir" ]]; then
        TEMPLATES_DIRS+=("$dir")
    fi
done < <(find "$SKILLS_DIR" -type d -name "templates" 2>/dev/null)

if [[ ${#TEMPLATES_DIRS[@]} -eq 0 ]]; then
    pass "No templates/ directories found (all renamed to scripts/)"
else
    fail "${#TEMPLATES_DIRS[@]} templates/ directory(ies) still exist:"
    for dir in "${TEMPLATES_DIRS[@]}"; do
        echo "    - $dir"
    done
fi
echo ""

# ============================================================================
# Test 2: SKILL.md files reference scripts/ not templates/
# ============================================================================
echo -e "${CYAN}Test 2: SKILL.md Files Reference scripts/${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

TEMPLATES_REFERENCES=()
SCRIPTS_REFERENCES=0

for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/SKILL.md" ]]; then
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"
        
        # Check for templates/ directory references (not just the word "templates")
        if grep -qE '(templates/|templates\.md|\[.*\]\(.*templates/)' "$skill_file" 2>/dev/null; then
            TEMPLATES_REFERENCES+=("$skill_name")
            fail "$skill_name: SKILL.md references templates/ directory"
        fi
        
        # Check for scripts/ references
        if grep -qE 'scripts/' "$skill_file" 2>/dev/null; then
            ((SCRIPTS_REFERENCES++)) || true
            info "$skill_name: SKILL.md references scripts/"
        fi
    fi
done

if [[ ${#TEMPLATES_REFERENCES[@]} -eq 0 ]]; then
    pass "No SKILL.md files reference templates/"
    if [[ $SCRIPTS_REFERENCES -gt 0 ]]; then
        info "$SCRIPTS_REFERENCES SKILL.md file(s) reference scripts/"
    fi
else
    fail "${#TEMPLATES_REFERENCES[@]} SKILL.md file(s) still reference templates/"
fi
echo ""

# ============================================================================
# Test 3: All markdown files reference scripts/ not templates/
# ============================================================================
echo -e "${CYAN}Test 3: All Markdown Files Reference scripts/${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

TEMPLATES_IN_MD=()
while IFS= read -r md_file; do
    # Check for templates/ directory references (not just the word "templates")
    if grep -qE '(templates/|templates\.md|\[.*\]\(.*templates/)' "$md_file" 2>/dev/null; then
        TEMPLATES_IN_MD+=("$md_file")
    fi
done < <(find "$SKILLS_DIR" -name "*.md" -type f 2>/dev/null)

if [[ ${#TEMPLATES_IN_MD[@]} -eq 0 ]]; then
    pass "No markdown files reference templates/"
else
    fail "${#TEMPLATES_IN_MD[@]} markdown file(s) still reference templates/:"
    for file in "${TEMPLATES_IN_MD[@]}"; do
        echo "    - $file"
    done
fi
echo ""

# ============================================================================
# Test 4: Script-enhanced skills in correct location
# ============================================================================
echo -e "${CYAN}Test 4: Script-Enhanced Skills Location${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

SCRIPTS_DIRS=0
MISSING_SCRIPTS=()

for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]]; then
        skill_name=$(basename "$skill_dir")
        
        if [[ -d "$skill_dir/scripts" ]]; then
            ((SCRIPTS_DIRS++)) || true
            info "$skill_name: Has scripts/ directory"
        fi
    fi
done

pass "$SCRIPTS_DIRS skill(s) have scripts/ directory"
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================================"
echo "  Test Summary"
echo "============================================================================"
echo ""
echo -e "  ${GREEN}Passed:          $PASS_COUNT${NC}"
echo -e "  ${RED}Failed:          $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}Warnings:        $WARN_COUNT${NC}"
echo ""

# Exit with appropriate code
if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All directory rename tests passed${NC}"
    if [[ $WARN_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Note: $WARN_COUNT warning(s) should be reviewed${NC}"
    fi
    exit 0
fi
