#!/bin/bash
# Agent Definition Validation Tests
# Validates agent definitions using directory-based discovery
# (Updated for Claude Code plugin format which uses auto-discovery)
#
# Tests:
# 1. All agent .md files in agents/ directory are valid
# 2. Agent .md files have required YAML frontmatter fields
# 3. Agent names (filenames) are kebab-case
# 4. Agent files have required sections
# 5. Skills referenced in frontmatter exist in skills/ directory
#
# Usage: ./test-agent-definitions.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENTS_DIR="$PROJECT_ROOT/src/agents"
SKILLS_DIR="$PROJECT_ROOT/src/skills"

VERBOSE="${1:-}"
FAILED=0
PASSED=0
SKIPPED=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

log_pass() {
    echo -e "  ${GREEN}PASS${NC} $1"
    PASSED=$((PASSED + 1))
}

log_fail() {
    echo -e "  ${RED}FAIL${NC} $1"
    if [[ -n "${2:-}" ]]; then
        echo -e "       ${RED}Reason:${NC} $2"
    fi
    FAILED=$((FAILED + 1))
}

log_warn() {
    echo -e "  ${YELLOW}WARN${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

log_skip() {
    echo -e "  ${CYAN}SKIP${NC} $1"
    SKIPPED=$((SKIPPED + 1))
}

log_info() {
    if [[ "$VERBOSE" == "--verbose" ]]; then
        echo -e "  ${BLUE}INFO${NC} $1"
    fi
}

# Extract frontmatter from markdown file
get_frontmatter() {
    local file="$1"
    awk '/^---$/{if(++n==1){next}else{exit}}n' "$file"
}

# Check if a skill exists in the CC 2.1.6 nested structure
skill_exists() {
    local skill_name="$1"
    # Search in all category directories
    for category_dir in "$SKILLS_DIR"/*/; do
        if [[ -d "${category_dir}${skill_name}" ]]; then
            return 0
        fi
    done
    return 1
}

# Extract skills from YAML frontmatter (handles both inline and list formats)
extract_skills() {
    local frontmatter="$1"
    local skills=""
    local in_skills_block=false

    while IFS= read -r line; do
        # Check for skills: key
        if [[ "$line" == "skills:"* ]]; then
            in_skills_block=true
            # Handle inline format: skills: [skill1, skill2]
            inline=$(echo "$line" | sed 's/skills:[[:space:]]*//')
            if [[ "$inline" =~ ^\[.*\]$ ]]; then
                # Inline array format
                echo "$inline" | tr ',' '\n' | tr -d ' []"'
            fi
            continue
        fi

        if [[ "$in_skills_block" == true ]]; then
            # Check for list item format: "  - skill-name"
            if [[ "$line" =~ ^[[:space:]]*-[[:space:]]+ ]]; then
                echo "$line" | sed 's/^[[:space:]]*-[[:space:]]*//' | tr -d ' '
            elif [[ "$line" =~ ^[a-z] ]]; then
                # Hit another key, stop
                break
            fi
        fi
    done <<< "$frontmatter"
}

echo ""
echo "=========================================="
echo "  Agent Definition Validation Tests"
echo "=========================================="
echo ""
echo -e "${CYAN}Project Root:${NC} $PROJECT_ROOT"
echo -e "${CYAN}Agents Dir:${NC}  $AGENTS_DIR"
echo -e "${CYAN}Skills Dir:${NC}  $SKILLS_DIR"
echo ""

# Verify prerequisites
if [[ ! -d "$AGENTS_DIR" ]]; then
    echo -e "${RED}ERROR: Agents directory not found at $AGENTS_DIR${NC}"
    exit 1
fi

if [[ ! -d "$SKILLS_DIR" ]]; then
    echo -e "${RED}ERROR: Skills directory not found at $SKILLS_DIR${NC}"
    exit 1
fi

# Find all agent files
AGENT_FILES=$(find "$AGENTS_DIR" -name "*.md" -type f 2>/dev/null | sort)
AGENT_COUNT=$(echo "$AGENT_FILES" | grep -c '.' || echo "0")

if [[ "$AGENT_COUNT" -eq 0 ]]; then
    echo -e "${RED}ERROR: No agent files found in $AGENTS_DIR${NC}"
    exit 1
fi

echo -e "${MAGENTA}Found $AGENT_COUNT agent files${NC}"
echo ""

# =============================================================================
# Test 1: Agent files are valid markdown with frontmatter
# =============================================================================
echo -e "${CYAN}Test 1: Agent files have valid frontmatter${NC}"
echo "----------------------------------------"

REQUIRED_FRONTMATTER=("name" "description" "tools")

for agent_file in $AGENT_FILES; do
    agent_id=$(basename "$agent_file" .md)

    # Check frontmatter exists
    first_line=$(head -1 "$agent_file")
    if [[ "$first_line" != "---" ]]; then
        log_fail "$agent_id has no frontmatter"
        continue
    fi

    frontmatter=$(get_frontmatter "$agent_file")
    missing=""
    all_found=true

    for field in "${REQUIRED_FRONTMATTER[@]}"; do
        if ! echo "$frontmatter" | grep -q "^${field}:"; then
            all_found=false
            missing="$missing $field"
        fi
    done

    if [[ "$all_found" == true ]]; then
        log_pass "$agent_id has required frontmatter"
    else
        log_fail "$agent_id missing frontmatter fields" "Missing:$missing"
    fi
done

echo ""

# =============================================================================
# Test 2: Agent IDs are kebab-case
# =============================================================================
echo -e "${CYAN}Test 2: Agent IDs (filenames) are kebab-case${NC}"
echo "----------------------------------------"

KEBAB_REGEX='^[a-z][a-z0-9]*(-[a-z0-9]+)*$'

for agent_file in $AGENT_FILES; do
    agent_id=$(basename "$agent_file" .md)

    if [[ "$agent_id" =~ $KEBAB_REGEX ]]; then
        log_pass "$agent_id is valid kebab-case"
    else
        log_fail "$agent_id is not kebab-case"
    fi
done

echo ""

# =============================================================================
# Test 3: Agent files have required sections
# =============================================================================
echo -e "${CYAN}Test 3: Required sections in agent files${NC}"
echo "----------------------------------------"

# Required sections (at least one must be present)
REQUIRED_SECTIONS=("Directive" "Purpose" "Objective" "Description" "Role")

for agent_file in $AGENT_FILES; do
    agent_id=$(basename "$agent_file" .md)
    content=$(cat "$agent_file")

    found_section=false
    for section in "${REQUIRED_SECTIONS[@]}"; do
        if echo "$content" | grep -q "^## $section\|^# $section"; then
            found_section=true
            break
        fi
    done

    if [[ "$found_section" == true ]]; then
        log_pass "$agent_id has required sections"
    else
        log_warn "$agent_id missing standard sections (Directive/Purpose/Objective)"
    fi
done

echo ""

# =============================================================================
# Test 4: Skills referenced in frontmatter exist
# =============================================================================
echo -e "${CYAN}Test 4: Skills referenced in frontmatter exist${NC}"
echo "----------------------------------------"

for agent_file in $AGENT_FILES; do
    agent_id=$(basename "$agent_file" .md)
    frontmatter=$(get_frontmatter "$agent_file")

    # Check if skills key exists
    if ! echo "$frontmatter" | grep -q "^skills:"; then
        log_info "$agent_id has no skills in frontmatter"
        continue
    fi

    # Extract and validate skills
    skills=$(extract_skills "$frontmatter")

    if [[ -z "$skills" ]]; then
        log_info "$agent_id has empty skills list"
        continue
    fi

    invalid_skills=""
    while IFS= read -r skill; do
        [[ -z "$skill" ]] && continue
        if ! skill_exists "$skill"; then
            invalid_skills="$invalid_skills $skill"
        fi
    done <<< "$skills"

    if [[ -z "$invalid_skills" ]]; then
        log_pass "$agent_id skill references are valid"
    else
        log_warn "$agent_id references non-existent skills:$invalid_skills"
    fi
done

echo ""

# =============================================================================
# =============================================================================
# Test 5: Tools declaration is valid
# =============================================================================
echo -e "${CYAN}Test 5: Tools declaration is valid${NC}"
echo "----------------------------------------"

for agent_file in $AGENT_FILES; do
    agent_id=$(basename "$agent_file" .md)
    frontmatter=$(get_frontmatter "$agent_file")

    if ! echo "$frontmatter" | grep -q "^tools:"; then
        log_fail "$agent_id has no tools declaration"
        continue
    fi

    tools_count=0
    in_tools_block=false
    while IFS= read -r line; do
        if [[ "$line" == "tools:"* ]]; then
            in_tools_block=true
            inline=$(echo "$line" | sed 's/tools:[[:space:]]*//')
            if [[ -n "$inline" && "$inline" != "[]" ]]; then
                tools_count=1; break
            fi
            continue
        fi
        if [[ "$in_tools_block" == true ]]; then
            if [[ "$line" =~ ^[[:space:]]*-[[:space:]]+ ]]; then
                tools_count=$((tools_count + 1))
            elif [[ "$line" =~ ^[a-z] ]]; then
                break
            fi
        fi
    done <<< "$frontmatter"

    if [[ $tools_count -gt 0 ]]; then
        log_pass "$agent_id has tools declared"
    else
        log_fail "$agent_id has empty tools declaration"
    fi
done

echo ""

# =============================================================================
# Summary
# =============================================================================
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo -e "  ${GREEN}Passed:${NC}   $PASSED"
echo -e "  ${RED}Failed:${NC}   $FAILED"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "  ${CYAN}Skipped:${NC}  $SKIPPED"
echo ""

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}TESTS FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}ALL TESTS PASSED${NC}"
    exit 0
fi