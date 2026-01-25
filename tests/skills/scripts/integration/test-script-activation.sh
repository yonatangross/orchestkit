#!/usr/bin/env bash
# ============================================================================
# Script Activation Validation Tests
# ============================================================================
# Validates that script-enhanced skills are properly configured for activation
# by Claude Code. This verifies the structure and configuration needed for
# skills to appear in the `/` menu and be invocable.
#
# Tests:
# 1. Script files are in correct location for Claude Code discovery
# 2. Script files have user-invocable: true (required for menu appearance)
# 3. Script files have valid frontmatter (name, description)
# 4. Script files have argument-hint when arguments are expected
# 5. Script names match expected command names
# 6. Script files are readable and non-empty
#
# Note: Full E2E testing requires Claude Code to be running. This test validates
# the configuration and structure needed for activation.
#
# Usage: ./test-script-activation.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/src/skills"

# Source helpers
source "$SCRIPT_DIR/../fixtures/script-test-helpers.sh"
source "$SCRIPT_DIR/../../../fixtures/test-helpers.sh" 2>/dev/null || true

VERBOSE="${1:-}"

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
TOTAL_SCRIPTS=0
ACTIVATABLE_SCRIPTS=0

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
echo "  Script Activation Validation Tests"
echo "============================================================================"
echo ""
echo "Skills directory: $SKILLS_DIR"
echo ""
echo "Note: This validates configuration for activation. Full E2E testing"
echo "      requires Claude Code to be running and able to discover skills."
echo ""

# ============================================================================
# Test 1: Script Location for Discovery
# ============================================================================
echo -e "${CYAN}Test 1: Script Location for Claude Code Discovery${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

WRONG_LOCATION=()
SCRIPT_FILES=()

while IFS= read -r script_file; do
    if [[ -f "$script_file" ]]; then
        SCRIPT_FILES+=("$script_file")
        ((TOTAL_SCRIPTS++)) || true
        
        # Claude Code discovers skills in skills/<skill-name>/scripts/*.md
        skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
        script_name=$(basename "$script_file")
        
        # Verify structure: skills/<skill-name>/scripts/<script-name>.md
        if [[ "$script_file" =~ ^$SKILLS_DIR/[^/]+/scripts/[^/]+\.md$ ]]; then
            info "$skill_name/scripts/$script_name: Correct location for discovery"
        else
            WRONG_LOCATION+=("$script_file")
            fail "$skill_name/scripts/$script_name: Incorrect location structure"
        fi
    fi
done < <(find_all_script_files "$SKILLS_DIR")

if [[ ${#WRONG_LOCATION[@]} -eq 0 ]]; then
    pass "All $TOTAL_SCRIPTS script(s) in correct location for Claude Code discovery"
else
    fail "${#WRONG_LOCATION[@]} script(s) in incorrect location"
fi
echo ""

# ============================================================================
# Test 2: user-invocable Field (Required for Menu Appearance)
# ============================================================================
echo -e "${CYAN}Test 2: user-invocable Field (Required for / Menu)${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

NOT_INVOCABLE=()
INVALID_INVOCABLE=()

for script_file in "${SCRIPT_FILES[@]}"; do
    [[ ! -f "$script_file" ]] && continue
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    script_name=$(basename "$script_file")
    
    frontmatter=$(extract_script_frontmatter "$script_file" 2>/dev/null || echo "")
    
    # If no frontmatter (file doesn't start with ---), it's likely a template file
    if ! head -1 "$script_file" 2>/dev/null | grep -q "^---$"; then
        NOT_INVOCABLE+=("$skill_name/scripts/$script_name")
        info "$skill_name/scripts/$script_name: Template file (no frontmatter, not a script-enhanced skill)"
        continue
    fi
    
    # If frontmatter is empty or very short, also treat as template
    if [[ -z "$frontmatter" ]] || [[ ${#frontmatter} -lt 10 ]]; then
        NOT_INVOCABLE+=("$skill_name/scripts/$script_name")
        info "$skill_name/scripts/$script_name: Template file (empty frontmatter)"
        continue
    fi
    
    user_invocable=$(get_frontmatter_field "$frontmatter" "user-invocable" 2>/dev/null || echo "")
    
    if [[ "$user_invocable" == "true" ]]; then
        ((ACTIVATABLE_SCRIPTS++)) || true
        info "$skill_name/scripts/$script_name: user-invocable: true (will appear in / menu)"
    elif [[ "$user_invocable" == "false" ]]; then
        NOT_INVOCABLE+=("$skill_name/scripts/$script_name")
        warn "$skill_name/scripts/$script_name: user-invocable: false (won't appear in / menu)"
    elif [[ -z "$user_invocable" ]]; then
        # Template files may not have user-invocable (they're not commands)
        if [[ "$script_name" =~ (template|checklist|evidence) ]]; then
            NOT_INVOCABLE+=("$skill_name/scripts/$script_name")
            info "$skill_name/scripts/$script_name: Template file (user-invocable not required)"
        else
            INVALID_INVOCABLE+=("$skill_name/scripts/$script_name")
            fail "$skill_name/scripts/$script_name: Missing user-invocable field (required for activation)"
        fi
    else
        INVALID_INVOCABLE+=("$skill_name/scripts/$script_name")
        fail "$skill_name/scripts/$script_name: Invalid user-invocable value: $user_invocable"
    fi
done

if [[ ${#INVALID_INVOCABLE[@]} -eq 0 ]]; then
    pass "All scripts have valid user-invocable field"
    info "$ACTIVATABLE_SCRIPTS script(s) are user-invocable (will appear in / menu)"
    if [[ ${#NOT_INVOCABLE[@]} -gt 0 ]]; then
        warn "${#NOT_INVOCABLE[@]} script(s) are not user-invocable (may be intentional for templates)"
    fi
else
    fail "${#INVALID_INVOCABLE[@]} script(s) have invalid or missing user-invocable field"
fi
echo ""

# ============================================================================
# Test 3: Required Frontmatter for Discovery
# ============================================================================
echo -e "${CYAN}Test 3: Required Frontmatter for Skill Discovery${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

MISSING_NAME=()
MISSING_DESCRIPTION=()
VALID_FRONTMATTER=0

for script_file in "${SCRIPT_FILES[@]}"; do
    [[ ! -f "$script_file" ]] && continue
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    script_name=$(basename "$script_file")
    
    # Skip template files (no frontmatter)
    if ! head -1 "$script_file" 2>/dev/null | grep -q "^---$"; then
        continue
    fi
    
    frontmatter=$(extract_script_frontmatter "$script_file" 2>/dev/null || echo "")
    name=$(get_frontmatter_field "$frontmatter" "name" 2>/dev/null || echo "")
    description=$(get_frontmatter_field "$frontmatter" "description" 2>/dev/null || echo "")
    
    has_error=false
    if [[ -z "$name" ]]; then
        MISSING_NAME+=("$skill_name/scripts/$script_name")
        fail "$skill_name/scripts/$script_name: Missing 'name' field (required for discovery)"
        has_error=true
    fi
    
    if [[ -z "$description" ]]; then
        MISSING_DESCRIPTION+=("$skill_name/scripts/$script_name")
        fail "$skill_name/scripts/$script_name: Missing 'description' field (required for discovery)"
        has_error=true
    fi
    
    if [[ "$has_error" == "false" ]]; then
        ((VALID_FRONTMATTER++)) || true
        info "$skill_name/scripts/$script_name: Has required frontmatter (name, description)"
    fi
done

if [[ ${#MISSING_NAME[@]} -eq 0 ]] && [[ ${#MISSING_DESCRIPTION[@]} -eq 0 ]]; then
    pass "All $TOTAL_SCRIPTS script(s) have required frontmatter for discovery"
else
    if [[ ${#MISSING_NAME[@]} -gt 0 ]]; then
        fail "${#MISSING_NAME[@]} script(s) missing 'name' field"
    fi
    if [[ ${#MISSING_DESCRIPTION[@]} -gt 0 ]]; then
        fail "${#MISSING_DESCRIPTION[@]} script(s) missing 'description' field"
    fi
fi
echo ""

# ============================================================================
# Test 4: argument-hint for Skills with Arguments
# ============================================================================
echo -e "${CYAN}Test 4: argument-hint for Skills with Arguments${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

WITH_HINT=0
WITHOUT_HINT=0
HINT_MISMATCH=0

for script_file in "${SCRIPT_FILES[@]}"; do
    [[ ! -f "$script_file" ]] && continue
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    script_name=$(basename "$script_file")
    
    # Skip template files (no frontmatter)
    if ! head -1 "$script_file" 2>/dev/null | grep -q "^---$"; then
        continue
    fi
    
    frontmatter=$(extract_script_frontmatter "$script_file" 2>/dev/null || echo "")
    argument_hint=$(get_frontmatter_field "$frontmatter" "argument-hint" 2>/dev/null || echo "")
    
    # Check if script uses $ARGUMENTS
    uses_args=false
    if check_arguments_in_markdown "$script_file" 2>/dev/null || check_arguments_in_code_blocks "$script_file" 2>/dev/null; then
        uses_args=true
    fi
    
    if [[ -n "$argument_hint" ]]; then
        ((WITH_HINT++)) || true
        if [[ "$uses_args" == "true" ]]; then
            info "$skill_name/scripts/$script_name: Has argument-hint and uses \$ARGUMENTS (correct)"
        else
            ((HINT_MISMATCH++)) || true
            warn "$skill_name/scripts/$script_name: Has argument-hint but doesn't use \$ARGUMENTS"
        fi
    else
        ((WITHOUT_HINT++)) || true
        if [[ "$uses_args" == "true" ]]; then
            warn "$skill_name/scripts/$script_name: Uses \$ARGUMENTS but no argument-hint (recommended)"
        fi
    fi
done

pass "$WITH_HINT script(s) have argument-hint, $WITHOUT_HINT script(s) don't"
if [[ $HINT_MISMATCH -gt 0 ]]; then
    warn "$HINT_MISMATCH script(s) have argument-hint but don't use \$ARGUMENTS"
fi
echo ""

# ============================================================================
# Test 5: Script Name Convention
# ============================================================================
echo -e "${CYAN}Test 5: Script Name Convention${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

# Script names should be descriptive and follow conventions
# Common patterns: create-*, review-*, assess-*, generate-*, etc.
UNCONVENTIONAL=0
CONVENTIONAL=0

for script_file in "${SCRIPT_FILES[@]}"; do
    [[ ! -f "$script_file" ]] && continue
    script_name=$(basename "$script_file" .md)
    
    # Check for common prefixes
    if [[ "$script_name" =~ ^(create|review|assess|generate|backup|automate|capture|multi|test)- ]]; then
        ((CONVENTIONAL++)) || true
    else
        ((UNCONVENTIONAL++)) || true
        # Not a failure, just informational
    fi
done

info "$CONVENTIONAL script(s) follow naming convention, $UNCONVENTIONAL script(s) don't"
pass "Script name validation complete (naming convention is recommended, not required)"
echo ""

# ============================================================================
# Test 6: Script Readability and Content
# ============================================================================
echo -e "${CYAN}Test 6: Script Readability and Content${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

UNREADABLE=()
EMPTY_SCRIPTS=()
READABLE=0

for script_file in "${SCRIPT_FILES[@]}"; do
    [[ ! -f "$script_file" ]] && continue
    skill_name=$(echo "$script_file" | sed "s|$SKILLS_DIR/||" | sed 's|/scripts/.*||')
    script_name=$(basename "$script_file")
    
    # Check if file is readable
    if [[ ! -r "$script_file" ]]; then
        UNREADABLE+=("$skill_name/scripts/$script_name")
        fail "$skill_name/scripts/$script_name: File is not readable"
        continue
    fi
    
    # Check if file has content after frontmatter
    content_after_frontmatter=$(sed '/^---$/,/^---$/d' "$script_file" 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' ')
    
    if [[ "$content_after_frontmatter" -gt 0 ]]; then
        ((READABLE++)) || true
        info "$skill_name/scripts/$script_name: Readable with content ($content_after_frontmatter lines)"
    else
        EMPTY_SCRIPTS+=("$skill_name/scripts/$script_name")
        fail "$skill_name/scripts/$script_name: Empty or missing content"
    fi
done

if [[ ${#UNREADABLE[@]} -eq 0 ]] && [[ ${#EMPTY_SCRIPTS[@]} -eq 0 ]]; then
    pass "All $TOTAL_SCRIPTS script(s) are readable with content"
else
    if [[ ${#UNREADABLE[@]} -gt 0 ]]; then
        fail "${#UNREADABLE[@]} script(s) are not readable"
    fi
    if [[ ${#EMPTY_SCRIPTS[@]} -gt 0 ]]; then
        fail "${#EMPTY_SCRIPTS[@]} script(s) are empty"
    fi
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================================"
echo "  Test Summary"
echo "============================================================================"
echo ""
echo -e "  Total scripts:        $TOTAL_SCRIPTS"
echo -e "  Activatable scripts:   $ACTIVATABLE_SCRIPTS (user-invocable: true)"
echo -e "  ${GREEN}Passed:          $PASS_COUNT${NC}"
echo -e "  ${RED}Failed:          $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}Warnings:        $WARN_COUNT${NC}"
echo ""
echo "============================================================================"
echo "  Activation Readiness"
echo "============================================================================"
echo ""
if [[ $ACTIVATABLE_SCRIPTS -gt 0 ]]; then
    echo -e "  ${GREEN}✅ $ACTIVATABLE_SCRIPTS script(s) are configured for activation${NC}"
    echo "     These will appear in Claude Code's / menu when the plugin is loaded."
else
    echo -e "  ${YELLOW}⚠️  No scripts are user-invocable${NC}"
    echo "     Scripts need user-invocable: true to appear in the / menu."
fi
echo ""
echo "Note: Full activation testing requires Claude Code to be running."
echo "      This test validates the configuration needed for activation."
echo ""

# Exit with appropriate code
if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All activation validation tests passed${NC}"
    if [[ $WARN_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Note: $WARN_COUNT warning(s) should be reviewed${NC}"
    fi
    exit 0
fi
