#!/usr/bin/env bash
# ============================================================================
# Commands Directory Validation Tests
# ============================================================================
# Validates the commands/ directory structure for Claude Code autocomplete.
#
# Tests:
# 1. commands/ directory exists
# 2. Each user-invocable skill has a corresponding command file
# 3. Command files have valid YAML frontmatter (description, allowed-tools)
# 4. Command count matches user-invocable skill count (17)
# 5. No orphan commands (commands without matching skills)
#
# Usage: ./test-commands-structure.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
COMMANDS_DIR="$PROJECT_ROOT/commands"
SKILLS_DIR="$PROJECT_ROOT/skills"

VERBOSE="${1:-}"

# Counters
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_TESTS=0

# Colors (only if stdout is a terminal)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

# Test output functions
pass() {
    echo -e "  ${GREEN}PASS${NC} $1"
    ((PASS_COUNT++)) || true
    ((TOTAL_TESTS++)) || true
}

fail() {
    echo -e "  ${RED}FAIL${NC} $1"
    ((FAIL_COUNT++)) || true
    ((TOTAL_TESTS++)) || true
}

info() {
    if [[ -n "$VERBOSE" ]]; then
        echo -e "  ${BLUE}INFO${NC} $1"
    fi
}

# ============================================================================
# TEST 1: Commands directory exists
# ============================================================================
echo ""
echo -e "${BLUE}Test 1: Commands directory exists${NC}"

if [[ -d "$COMMANDS_DIR" ]]; then
    pass "commands/ directory exists at $COMMANDS_DIR"
else
    fail "commands/ directory not found at $COMMANDS_DIR"
    echo "Commands directory is required for Claude Code autocomplete."
    exit 1
fi

# ============================================================================
# TEST 2: Command files have valid frontmatter
# ============================================================================
echo ""
echo -e "${BLUE}Test 2: Command files have valid YAML frontmatter${NC}"

INVALID_FRONTMATTER=0
for cmd_file in "$COMMANDS_DIR"/*.md; do
    if [[ ! -f "$cmd_file" ]]; then
        continue
    fi

    cmd_name=$(basename "$cmd_file" .md)

    # Check for YAML frontmatter delimiters
    if ! head -1 "$cmd_file" | grep -q "^---$"; then
        fail "$cmd_name: Missing opening YAML frontmatter (---)"
        ((INVALID_FRONTMATTER++))
        continue
    fi

    # Extract frontmatter (between first two --- lines)
    # Use awk for macOS compatibility
    frontmatter=$(awk '/^---$/{p=!p;next} p{print}' "$cmd_file" | head -20)

    # Check for description field
    if ! echo "$frontmatter" | grep -q "^description:"; then
        fail "$cmd_name: Missing 'description' field in frontmatter"
        ((INVALID_FRONTMATTER++))
        continue
    fi

    # Check for allowed-tools field
    if ! echo "$frontmatter" | grep -q "^allowed-tools:"; then
        fail "$cmd_name: Missing 'allowed-tools' field in frontmatter"
        ((INVALID_FRONTMATTER++))
        continue
    fi

    info "$cmd_name: Valid frontmatter"
done

if [[ $INVALID_FRONTMATTER -eq 0 ]]; then
    pass "All command files have valid YAML frontmatter"
fi

# ============================================================================
# TEST 3: Each user-invocable skill has a command file
# ============================================================================
echo ""
echo -e "${BLUE}Test 3: User-invocable skills have corresponding commands${NC}"

# Get list of user-invocable skills
USER_INVOCABLE_SKILLS=()
while IFS= read -r skill_md; do
    if grep -q "^user-invocable: true" "$skill_md"; then
        skill_name=$(basename "$(dirname "$skill_md")")
        USER_INVOCABLE_SKILLS+=("$skill_name")
    fi
done < <(find "$SKILLS_DIR" -name "SKILL.md" -type f)

MISSING_COMMANDS=0
for skill in "${USER_INVOCABLE_SKILLS[@]}"; do
    cmd_file="$COMMANDS_DIR/$skill.md"
    if [[ ! -f "$cmd_file" ]]; then
        fail "Missing command file for user-invocable skill: $skill"
        ((MISSING_COMMANDS++))
    else
        info "Found command for skill: $skill"
    fi
done

if [[ $MISSING_COMMANDS -eq 0 ]]; then
    pass "All user-invocable skills have corresponding command files"
fi

# ============================================================================
# TEST 4: Command count matches expected (17)
# ============================================================================
echo ""
echo -e "${BLUE}Test 4: Command count validation${NC}"

EXPECTED_COMMANDS=17
ACTUAL_COMMANDS=$(find "$COMMANDS_DIR" -name "*.md" -type f | wc -l | tr -d ' ')
ACTUAL_SKILLS=${#USER_INVOCABLE_SKILLS[@]}

info "Expected commands: $EXPECTED_COMMANDS"
info "Actual commands: $ACTUAL_COMMANDS"
info "User-invocable skills: $ACTUAL_SKILLS"

if [[ $ACTUAL_COMMANDS -eq $EXPECTED_COMMANDS ]]; then
    pass "Command count is correct: $ACTUAL_COMMANDS commands"
else
    fail "Command count mismatch: expected $EXPECTED_COMMANDS, got $ACTUAL_COMMANDS"
fi

if [[ $ACTUAL_COMMANDS -eq $ACTUAL_SKILLS ]]; then
    pass "Commands match user-invocable skills: $ACTUAL_COMMANDS = $ACTUAL_SKILLS"
else
    fail "Commands don't match skills: $ACTUAL_COMMANDS commands vs $ACTUAL_SKILLS skills"
fi

# ============================================================================
# TEST 5: No orphan commands (commands without matching skills)
# ============================================================================
echo ""
echo -e "${BLUE}Test 5: No orphan commands${NC}"

ORPHAN_COMMANDS=0
for cmd_file in "$COMMANDS_DIR"/*.md; do
    if [[ ! -f "$cmd_file" ]]; then
        continue
    fi

    cmd_name=$(basename "$cmd_file" .md)
    skill_dir="$SKILLS_DIR/$cmd_name"

    if [[ ! -d "$skill_dir" ]] || [[ ! -f "$skill_dir/SKILL.md" ]]; then
        fail "Orphan command: $cmd_name (no matching skill directory)"
        ((ORPHAN_COMMANDS++))
    else
        info "Command $cmd_name has matching skill"
    fi
done

if [[ $ORPHAN_COMMANDS -eq 0 ]]; then
    pass "No orphan commands found"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}Commands Structure Test Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Commands found: $ACTUAL_COMMANDS"
echo "  User-invocable skills: $ACTUAL_SKILLS"
echo ""
echo -e "  ${GREEN}Passed${NC}: $PASS_COUNT"
echo -e "  ${RED}Failed${NC}: $FAIL_COUNT"
echo ""

if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}COMMANDS STRUCTURE VALIDATION FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}ALL COMMANDS STRUCTURE TESTS PASSED${NC}"
    exit 0
fi
