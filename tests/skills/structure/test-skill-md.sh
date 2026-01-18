#!/usr/bin/env bash
# ============================================================================
# SKILL.md Validation Tests
# ============================================================================
# Validates all skill SKILL.md files for structure and content compliance.
#
# Tests:
# 1. All skills have SKILL.md (file existence)
# 2. SKILL.md starts with YAML frontmatter (--- delimiter)
# 3. Frontmatter has required fields: name, description, version
# 4. H1 title exists (# heading)
# 5. "When to Use" or "Overview" section exists
# 6. At least one code example (``` block)
# 7. Token budget between 300-1500 tokens (chars/4)
# 8. Has "Related Skills" or "Key Decisions" section
# 9. No broken internal links to references/ or templates/
# 10. user-invocable field validation (18 commands, 97 internal)
#
# Usage: ./test-skill-md.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/skills"

VERBOSE="${1:-}"

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
TOTAL_SKILLS=0

# Colors (only if stderr is a terminal)
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
# Token Counting
# ============================================================================
count_tokens() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        echo 0
        return
    fi

    # Try tiktoken first (accurate for Claude)
    if command -v python3 &>/dev/null; then
        local result
        result=$(python3 -c "
import sys
try:
    import tiktoken
    enc = tiktoken.get_encoding('cl100k_base')
    with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
        print(len(enc.encode(f.read())))
except:
    sys.exit(1)
" "$file" 2>/dev/null) || true

        if [[ -n "$result" && "$result" =~ ^[0-9]+$ ]]; then
            echo "$result"
            return
        fi
    fi

    # Fallback: chars/4 approximation
    local chars
    chars=$(wc -c < "$file" | tr -d ' ')
    echo $((chars / 4))
}

# ============================================================================
# YAML Frontmatter Parsing
# ============================================================================
extract_frontmatter() {
    local file="$1"
    # Extract content between first and second ---
    sed -n '/^---$/,/^---$/p' "$file" 2>/dev/null | sed '1d;$d'
}

get_frontmatter_field() {
    local frontmatter="$1"
    local field="$2"
    # Extract field value from YAML (handles simple cases)
    echo "$frontmatter" | grep -E "^${field}:" | sed "s/^${field}:[[:space:]]*//" | sed 's/^["'"'"']//' | sed 's/["'"'"']$//'
}

# ============================================================================
# Content Validation Helpers
# ============================================================================
has_h1_title() {
    local file="$1"
    # Check for H1 heading after frontmatter
    grep -q "^# " "$file" 2>/dev/null
}

has_when_to_use_or_overview() {
    local file="$1"
    # Check for "When to Use" or "Overview" section (case-insensitive)
    grep -iE "^#+\s*(when\s+to\s+use|overview)" "$file" >/dev/null 2>&1
}

has_code_block() {
    local file="$1"
    # Check for at least one code block
    grep -q '```' "$file" 2>/dev/null
}

has_related_skills_or_key_decisions() {
    local file="$1"
    # Check for "Related Skills" or "Key Decisions" section
    grep -iE "^#+\s*(related\s+skills|key\s+decisions)" "$file" >/dev/null 2>&1
}

count_code_blocks() {
    local file="$1"
    # Count code block pairs
    local open_count close_count
    open_count=$(grep -c '```' "$file" 2>/dev/null || echo 0)
    echo $((open_count / 2))
}

# ============================================================================
# Broken Link Detection
# ============================================================================
check_internal_links() {
    local file="$1"
    local skill_dir="$2"
    local broken_links=()

    # Extract markdown links that reference local files
    while IFS= read -r link; do
        # Skip empty lines and external links
        [[ -z "$link" ]] && continue
        [[ "$link" =~ ^https?:// ]] && continue
        [[ "$link" =~ ^mailto: ]] && continue

        # Handle relative paths
        local target_path
        if [[ "$link" == /* ]]; then
            target_path="$PROJECT_ROOT$link"
        else
            target_path="$skill_dir/$link"
        fi

        # Normalize path (remove ./ and handle ../)
        target_path=$(cd "$(dirname "$target_path")" 2>/dev/null && pwd)/$(basename "$target_path") 2>/dev/null || target_path=""

        # Check if file exists (for references/ and templates/ specifically)
        if [[ "$link" =~ (references/|templates/) ]] && [[ ! -f "$target_path" ]] && [[ ! -d "$target_path" ]]; then
            broken_links+=("$link")
        fi
    done < <(grep -oE '\[([^\]]+)\]\(([^)]+)\)' "$file" 2>/dev/null | grep -oE '\(([^)]+)\)' | tr -d '()')

    if [[ ${#broken_links[@]} -gt 0 ]]; then
        echo "${broken_links[*]}"
        return 1
    fi
    return 0
}

# ============================================================================
# Header
# ============================================================================
echo "============================================================================"
echo "  SKILL.md Validation Tests"
echo "============================================================================"
echo ""
echo "Skills directory: $SKILLS_DIR"
echo ""

# ============================================================================
# Test 1: All skills have SKILL.md (file existence)
# ============================================================================
echo -e "${CYAN}Test 1: File Existence (SKILL.md)${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

missing_files=()
for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]]; then
        ((TOTAL_SKILLS++)) || true
        skill_name=$(basename "$skill_dir")

        if [[ ! -f "$skill_dir/SKILL.md" ]]; then
            missing_files+=("$skill_name")
            fail "$skill_name: SKILL.md not found"
        else
            info "$skill_name: SKILL.md exists"
        fi
    fi
done

if [[ ${#missing_files[@]} -eq 0 ]]; then
    pass "All $TOTAL_SKILLS skills have SKILL.md"
fi
echo ""

# ============================================================================
# Test 2: SKILL.md starts with YAML frontmatter (--- delimiter)
# ============================================================================
echo -e "${CYAN}Test 2: YAML Frontmatter Presence${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

missing_frontmatter=()
for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/SKILL.md" ]]; then
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"

        # Use awk for more reliable frontmatter detection
        # Count how many lines match ^---$ and get first line
        dash_count=$(awk '/^---$/ {count++} END {print count+0}' "$skill_file" 2>/dev/null)
        first_line=$(awk 'NR==1 {print; exit}' "$skill_file" 2>/dev/null)

        if [[ "$first_line" != "---" ]]; then
            missing_frontmatter+=("$skill_name")
            fail "$skill_name: Missing YAML frontmatter delimiter (---)"
        elif [[ "$dash_count" -lt 2 ]]; then
            missing_frontmatter+=("$skill_name")
            fail "$skill_name: Missing closing frontmatter delimiter (---)"
        else
            info "$skill_name: Valid frontmatter delimiters"
        fi
    fi
done

if [[ ${#missing_frontmatter[@]} -eq 0 ]]; then
    pass "All SKILL.md files have valid YAML frontmatter delimiters"
fi
echo ""

# ============================================================================
# Test 3: Frontmatter has required fields: name, description, version
# ============================================================================
echo -e "${CYAN}Test 3: Required Frontmatter Fields (name, description)${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

missing_fields=()
for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/SKILL.md" ]]; then
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"

        frontmatter=$(extract_frontmatter "$skill_file")

        # Check for required fields
        name_field=$(get_frontmatter_field "$frontmatter" "name")
        description_field=$(get_frontmatter_field "$frontmatter" "description")

        has_error=false
        if [[ -z "$name_field" ]]; then
            fail "$skill_name: Missing 'name' field in frontmatter"
            has_error=true
        fi

        if [[ -z "$description_field" ]]; then
            fail "$skill_name: Missing 'description' field in frontmatter"
            has_error=true
        fi

        if [[ "$has_error" == "true" ]]; then
            missing_fields+=("$skill_name")
        else
            info "$skill_name: Has all required frontmatter fields"
        fi
    fi
done

if [[ ${#missing_fields[@]} -eq 0 ]]; then
    pass "All SKILL.md files have required frontmatter fields"
fi
echo ""

# ============================================================================
# Test 4: H1 title exists (# heading)
# ============================================================================
echo -e "${CYAN}Test 4: H1 Title Presence${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

missing_h1=()
for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/SKILL.md" ]]; then
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"

        if ! has_h1_title "$skill_file"; then
            missing_h1+=("$skill_name")
            fail "$skill_name: Missing H1 title (# heading)"
        else
            info "$skill_name: Has H1 title"
        fi
    fi
done

if [[ ${#missing_h1[@]} -eq 0 ]]; then
    pass "All SKILL.md files have H1 title"
fi
echo ""

# ============================================================================
# Test 5: "When to Use" or "Overview" section exists
# ============================================================================
echo -e "${CYAN}Test 5: 'When to Use' or 'Overview' Section${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

missing_section=()
for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/SKILL.md" ]]; then
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"

        if ! has_when_to_use_or_overview "$skill_file"; then
            missing_section+=("$skill_name")
            fail "$skill_name: Missing 'When to Use' or 'Overview' section"
        else
            info "$skill_name: Has usage/overview section"
        fi
    fi
done

if [[ ${#missing_section[@]} -eq 0 ]]; then
    pass "All SKILL.md files have 'When to Use' or 'Overview' section"
fi
echo ""

# ============================================================================
# Test 6: At least one code example (``` block)
# ============================================================================
echo -e "${CYAN}Test 6: Code Examples Present${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

missing_code=()
for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/SKILL.md" ]]; then
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"

        if ! has_code_block "$skill_file"; then
            missing_code+=("$skill_name")
            fail "$skill_name: No code examples found (missing \`\`\` blocks)"
        else
            code_count=$(count_code_blocks "$skill_file")
            info "$skill_name: Has $code_count code example(s)"
        fi
    fi
done

if [[ ${#missing_code[@]} -eq 0 ]]; then
    pass "All SKILL.md files have at least one code example"
fi
echo ""

# ============================================================================
# Test 7: Token budget between 300-1500 tokens (chars/4)
# ============================================================================
echo -e "${CYAN}Test 7: Token Budget (300-1500 tokens)${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

MIN_TOKENS=200
MAX_TOKENS=5000

under_budget=()
over_budget=()

for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/SKILL.md" ]]; then
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"

        tokens=$(count_tokens "$skill_file")

        if [[ "$tokens" -lt "$MIN_TOKENS" ]]; then
            under_budget+=("$skill_name ($tokens tokens)")
            warn "$skill_name: Under minimum token budget ($tokens < $MIN_TOKENS tokens)"
        elif [[ "$tokens" -gt "$MAX_TOKENS" ]]; then
            over_budget+=("$skill_name ($tokens tokens)")
            warn "$skill_name: Over maximum token budget ($tokens > $MAX_TOKENS tokens)"
        else
            info "$skill_name: Token budget OK ($tokens tokens)"
        fi
    fi
done

if [[ ${#under_budget[@]} -eq 0 ]] && [[ ${#over_budget[@]} -eq 0 ]]; then
    pass "All SKILL.md files within token budget ($MIN_TOKENS-$MAX_TOKENS tokens)"
else
    if [[ ${#under_budget[@]} -gt 0 ]]; then
        warn "${#under_budget[@]} files under minimum token budget"
    fi
    if [[ ${#over_budget[@]} -gt 0 ]]; then
        warn "${#over_budget[@]} files over maximum token budget"
    fi
fi
echo ""

# ============================================================================
# Test 8: Has "Related Skills" or "Key Decisions" section
# ============================================================================
echo -e "${CYAN}Test 8: 'Related Skills' or 'Key Decisions' Section${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

missing_related=()
for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/SKILL.md" ]]; then
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"

        if ! has_related_skills_or_key_decisions "$skill_file"; then
            missing_related+=("$skill_name")
            warn "$skill_name: Missing 'Related Skills' or 'Key Decisions' section (recommended)"
        else
            info "$skill_name: Has related skills/key decisions section"
        fi
    fi
done

if [[ ${#missing_related[@]} -eq 0 ]]; then
    pass "All SKILL.md files have 'Related Skills' or 'Key Decisions' section"
fi
echo ""

# ============================================================================
# Test 9: No broken internal links to references/ or templates/
# ============================================================================
echo -e "${CYAN}Test 9: Internal Link Validation${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

broken_link_skills=()
for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/SKILL.md" ]]; then
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"

        broken=$(check_internal_links "$skill_file" "$skill_dir" 2>&1) || true
        if [[ -n "$broken" ]]; then
            broken_link_skills+=("$skill_name")
            fail "$skill_name: Broken internal links: $broken"
        else
            info "$skill_name: All internal links valid"
        fi
    fi
done

if [[ ${#broken_link_skills[@]} -eq 0 ]]; then
    pass "All internal links to references/ and templates/ are valid"
fi
echo ""

# ============================================================================
# Test 10: user-invocable field validation (CC 2.1.3+)
# ============================================================================
echo -e "${CYAN}Test 10: user-invocable Field Validation${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

# Expected counts
EXPECTED_USER_INVOCABLE=20
EXPECTED_INTERNAL=139

missing_user_invocable=()
user_invocable_true=()
user_invocable_false=()

for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/SKILL.md" ]]; then
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"

        frontmatter=$(extract_frontmatter "$skill_file")
        user_invocable_field=$(get_frontmatter_field "$frontmatter" "user-invocable")

        if [[ -z "$user_invocable_field" ]]; then
            missing_user_invocable+=("$skill_name")
            fail "$skill_name: Missing 'user-invocable' field in frontmatter"
        elif [[ "$user_invocable_field" == "true" ]]; then
            user_invocable_true+=("$skill_name")
            info "$skill_name: user-invocable: true (command)"
        elif [[ "$user_invocable_field" == "false" ]]; then
            user_invocable_false+=("$skill_name")
            info "$skill_name: user-invocable: false (internal)"
        else
            fail "$skill_name: Invalid 'user-invocable' value: $user_invocable_field (expected true/false)"
        fi
    fi
done

# Check counts
actual_commands=${#user_invocable_true[@]}
actual_internal=${#user_invocable_false[@]}

if [[ ${#missing_user_invocable[@]} -eq 0 ]]; then
    pass "All SKILL.md files have 'user-invocable' field"
fi

if [[ "$actual_commands" -eq "$EXPECTED_USER_INVOCABLE" ]]; then
    pass "User-invocable commands: $actual_commands (expected $EXPECTED_USER_INVOCABLE)"
else
    fail "User-invocable commands: $actual_commands (expected $EXPECTED_USER_INVOCABLE)"
    echo "    Commands found: ${user_invocable_true[*]}"
fi

if [[ "$actual_internal" -eq "$EXPECTED_INTERNAL" ]]; then
    pass "Internal skills: $actual_internal (expected $EXPECTED_INTERNAL)"
else
    fail "Internal skills: $actual_internal (expected $EXPECTED_INTERNAL)"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================================"
echo "  Test Summary"
echo "============================================================================"
echo ""
echo -e "  Total skills:    $TOTAL_SKILLS"
echo -e "  ${GREEN}Passed:          $PASS_COUNT${NC}"
echo -e "  ${RED}Failed:          $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}Warnings:        $WARN_COUNT${NC}"
echo ""
echo "============================================================================"

# Exit with appropriate code
if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All critical tests passed${NC}"
    if [[ $WARN_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Note: $WARN_COUNT warning(s) should be reviewed${NC}"
    fi
    exit 0
fi