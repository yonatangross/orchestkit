#!/bin/bash
# Agent Definition Validation Tests
# Validates all 20 agent definitions against plugin.json and .md files
#
# Tests:
# 1. All agents listed in plugin.json have corresponding .md file
# 2. Agent .md files have required sections (Description, Capabilities, Tools)
# 3. Agent names are kebab-case
# 4. skills_used in plugin.json reference valid skill IDs
# 5. Agent tools match allowed subagent_type tools from Task tool documentation
# 6. No duplicate agent IDs
# 7. Agent descriptions are non-empty
# 8. Each agent has success_criteria section (can_solve_examples)
#
# Usage: ./test-agent-definitions.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENTS_DIR="$PROJECT_ROOT/.claude/agents"
SKILLS_DIR="$PROJECT_ROOT/.claude/skills"
PLUGIN_FILE="$PROJECT_ROOT/plugin.json"

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

# Test results array for summary
declare -a FAILED_TESTS=()
declare -a PASSED_TESTS=()
declare -a WARNING_TESTS=()

log_pass() {
    echo -e "  ${GREEN}PASS${NC} $1"
    PASSED=$((PASSED + 1))
    PASSED_TESTS+=("$1")
}

log_fail() {
    echo -e "  ${RED}FAIL${NC} $1"
    if [[ -n "${2:-}" ]]; then
        echo -e "       ${RED}Reason:${NC} $2"
    fi
    FAILED=$((FAILED + 1))
    FAILED_TESTS+=("$1: ${2:-}")
}

log_warn() {
    echo -e "  ${YELLOW}WARN${NC} $1"
    if [[ -n "${2:-}" ]]; then
        echo -e "       ${YELLOW}Note:${NC} $2"
    fi
    WARNINGS=$((WARNINGS + 1))
    WARNING_TESTS+=("$1: ${2:-}")
}

log_skip() {
    echo -e "  ${CYAN}SKIP${NC} $1"
    if [[ -n "${2:-}" ]]; then
        echo -e "       ${CYAN}Reason:${NC} $2"
    fi
    SKIPPED=$((SKIPPED + 1))
}

log_info() {
    if [[ "$VERBOSE" == "--verbose" ]]; then
        echo -e "  ${BLUE}INFO${NC} $1"
    fi
}

# Extract frontmatter from markdown file (macOS compatible)
# Usage: get_frontmatter "file.md"
get_frontmatter() {
    local file="$1"
    awk '/^---$/{if(++n==1){next}else{exit}}n' "$file"
}

echo ""
echo "=========================================="
echo "  Agent Definition Validation Tests"
echo "=========================================="
echo ""
echo -e "${CYAN}Project Root:${NC} $PROJECT_ROOT"
echo -e "${CYAN}Agents Dir:${NC}  $AGENTS_DIR"
echo -e "${CYAN}Plugin File:${NC} $PLUGIN_FILE"
echo ""

# Verify prerequisites
if [[ ! -f "$PLUGIN_FILE" ]]; then
    echo -e "${RED}ERROR: plugin.json not found at $PLUGIN_FILE${NC}"
    exit 1
fi

if [[ ! -d "$AGENTS_DIR" ]]; then
    echo -e "${RED}ERROR: Agents directory not found at $AGENTS_DIR${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}ERROR: jq is required but not installed${NC}"
    exit 1
fi

# Extract agents from plugin.json
AGENTS_JSON=$(jq -c '.agents[]' "$PLUGIN_FILE" 2>/dev/null || echo "")
if [[ -z "$AGENTS_JSON" ]]; then
    echo -e "${RED}ERROR: No agents found in plugin.json${NC}"
    exit 1
fi

# Count agents
AGENT_COUNT=$(jq '.agents | length' "$PLUGIN_FILE")
echo -e "${MAGENTA}Found $AGENT_COUNT agents in plugin.json${NC}"
echo ""

# =============================================================================
# Test 1: All agents listed in plugin.json have corresponding .md file
# =============================================================================
echo -e "${CYAN}Test 1: Agent .md files exist${NC}"
echo "----------------------------------------"

while IFS= read -r agent; do
    agent_id=$(echo "$agent" | jq -r '.id')
    agent_path=$(echo "$agent" | jq -r '.path')
    expected_file="$PROJECT_ROOT/$agent_path"

    if [[ -f "$expected_file" ]]; then
        log_pass "$agent_id has .md file"
        log_info "File: $agent_path"
    else
        log_fail "$agent_id missing .md file" "Expected: $agent_path"
    fi
done <<< "$(echo "$AGENTS_JSON" | jq -c '.')"

echo ""

# =============================================================================
# Test 2: Agent .md files have required sections
# =============================================================================
echo -e "${CYAN}Test 2: Required sections in .md files${NC}"
echo "----------------------------------------"

# Required sections based on agent file analysis
# Note: Using frontmatter (YAML) format based on actual agent files
REQUIRED_FRONTMATTER=("name" "description" "tools")
REQUIRED_SECTIONS=("## Directive" "## Task Boundaries" "## Boundaries")
OPTIONAL_SECTIONS=("## Example" "## Context Protocol" "## Integration")

while IFS= read -r agent; do
    agent_id=$(echo "$agent" | jq -r '.id')
    agent_path=$(echo "$agent" | jq -r '.path')
    md_file="$PROJECT_ROOT/$agent_path"

    if [[ ! -f "$md_file" ]]; then
        log_skip "$agent_id section check" "File does not exist"
        continue
    fi

    file_content=$(cat "$md_file")
    all_found=true
    missing=""

    # Check frontmatter (between --- markers)
    first_line=$(echo "$file_content" | head -1)
    if [[ "$first_line" == "---" ]]; then
        frontmatter=$(get_frontmatter "$md_file")

        for field in "${REQUIRED_FRONTMATTER[@]}"; do
            if ! echo "$frontmatter" | grep -q "^${field}:"; then
                all_found=false
                missing="$missing frontmatter:$field"
            fi
        done
    else
        all_found=false
        missing="$missing frontmatter-block"
    fi

    # Check markdown sections
    for section in "${REQUIRED_SECTIONS[@]}"; do
        if ! echo "$file_content" | grep -q "^${section}"; then
            all_found=false
            missing="$missing '$section'"
        fi
    done

    if [[ "$all_found" == true ]]; then
        log_pass "$agent_id has all required sections"
    else
        log_fail "$agent_id missing sections" "Missing:$missing"
    fi
done <<< "$(echo "$AGENTS_JSON" | jq -c '.')"

echo ""

# =============================================================================
# Test 3: Agent IDs are kebab-case
# =============================================================================
echo -e "${CYAN}Test 3: Agent IDs are kebab-case${NC}"
echo "----------------------------------------"

# Kebab-case regex: lowercase letters, numbers, and hyphens only
# Must start with letter, no consecutive hyphens, no trailing hyphen
KEBAB_REGEX='^[a-z][a-z0-9]*(-[a-z0-9]+)*$'

while IFS= read -r agent; do
    agent_id=$(echo "$agent" | jq -r '.id')

    if [[ "$agent_id" =~ $KEBAB_REGEX ]]; then
        log_pass "$agent_id is valid kebab-case"
    else
        log_fail "$agent_id is not kebab-case" "ID must be lowercase with hyphens"
    fi
done <<< "$(echo "$AGENTS_JSON" | jq -c '.')"

echo ""

# =============================================================================
# Test 4: skills_used in plugin.json reference valid skill IDs
# =============================================================================
echo -e "${CYAN}Test 4: skills_used reference valid skills${NC}"
echo "----------------------------------------"

# Get all valid skill IDs from plugin.json
VALID_SKILLS=$(jq -r '.skills[].id' "$PLUGIN_FILE" | sort -u)
VALID_SKILLS_COUNT=$(echo "$VALID_SKILLS" | wc -l | tr -d ' ')
log_info "Found $VALID_SKILLS_COUNT skills in plugin.json"

while IFS= read -r agent; do
    agent_id=$(echo "$agent" | jq -r '.id')
    skills_used=$(echo "$agent" | jq -r '.skills_used[]? // empty')

    if [[ -z "$skills_used" ]]; then
        log_warn "$agent_id has no skills_used" "Consider adding relevant skills"
        continue
    fi

    invalid_skills=""
    skill_count=0

    while IFS= read -r skill; do
        skill_count=$((skill_count + 1))
        if ! echo "$VALID_SKILLS" | grep -qx "$skill"; then
            invalid_skills="$invalid_skills $skill"
        fi
    done <<< "$skills_used"

    if [[ -z "$invalid_skills" ]]; then
        log_pass "$agent_id: all $skill_count skills valid"
    else
        log_fail "$agent_id has invalid skills" "Invalid:$invalid_skills"
    fi
done <<< "$(echo "$AGENTS_JSON" | jq -c '.')"

echo ""

# =============================================================================
# Test 5: Agent tools match allowed subagent_type tools
# =============================================================================
echo -e "${CYAN}Test 5: Agent tools are valid${NC}"
echo "----------------------------------------"

# Allowed tools for subagents based on Task tool documentation
# These are the tools allowed for subagent_type in the Task tool
ALLOWED_TOOLS=(
    "Read"
    "Edit"
    "MultiEdit"
    "Write"
    "Bash"
    "Grep"
    "Glob"
    "WebSearch"
    "WebFetch"
    "TodoRead"
    "TodoWrite"
    "Task"
)

while IFS= read -r agent; do
    agent_id=$(echo "$agent" | jq -r '.id')
    tools=$(echo "$agent" | jq -r '.tools[]? // empty')

    if [[ -z "$tools" ]]; then
        log_warn "$agent_id has no tools defined" "Consider adding tools"
        continue
    fi

    invalid_tools=""
    tool_count=0

    while IFS= read -r tool; do
        tool_count=$((tool_count + 1))
        tool_found=false
        for allowed in "${ALLOWED_TOOLS[@]}"; do
            if [[ "$tool" == "$allowed" ]]; then
                tool_found=true
                break
            fi
        done
        if [[ "$tool_found" == false ]]; then
            invalid_tools="$invalid_tools $tool"
        fi
    done <<< "$tools"

    if [[ -z "$invalid_tools" ]]; then
        log_pass "$agent_id: all $tool_count tools valid"
    else
        log_fail "$agent_id has invalid tools" "Invalid:$invalid_tools"
    fi
done <<< "$(echo "$AGENTS_JSON" | jq -c '.')"

echo ""

# =============================================================================
# Test 6: No duplicate agent IDs
# =============================================================================
echo -e "${CYAN}Test 6: No duplicate agent IDs${NC}"
echo "----------------------------------------"

# Get all agent IDs and check for duplicates
ALL_IDS=$(jq -r '.agents[].id' "$PLUGIN_FILE")
UNIQUE_IDS=$(echo "$ALL_IDS" | sort -u)
DUPLICATE_IDS=$(echo "$ALL_IDS" | sort | uniq -d)

if [[ -z "$DUPLICATE_IDS" ]]; then
    log_pass "No duplicate agent IDs found"
else
    while IFS= read -r dup; do
        log_fail "Duplicate agent ID" "$dup appears multiple times"
    done <<< "$DUPLICATE_IDS"
fi

# Also check for duplicate .md files
ALL_PATHS=$(jq -r '.agents[].path' "$PLUGIN_FILE")
DUPLICATE_PATHS=$(echo "$ALL_PATHS" | sort | uniq -d)

if [[ -z "$DUPLICATE_PATHS" ]]; then
    log_pass "No duplicate agent paths found"
else
    while IFS= read -r dup; do
        log_fail "Duplicate agent path" "$dup used by multiple agents"
    done <<< "$DUPLICATE_PATHS"
fi

echo ""

# =============================================================================
# Test 7: Agent descriptions are non-empty
# =============================================================================
echo -e "${CYAN}Test 7: Agent descriptions are non-empty${NC}"
echo "----------------------------------------"

while IFS= read -r agent; do
    agent_id=$(echo "$agent" | jq -r '.id')

    # Check plugin.json for display_name (agents use display_name, not description)
    json_display_name=$(echo "$agent" | jq -r '.display_name // .name // empty')

    # Check .md file frontmatter description
    agent_path=$(echo "$agent" | jq -r '.path')
    md_file="$PROJECT_ROOT/$agent_path"

    if [[ -f "$md_file" ]]; then
        md_desc=$(get_frontmatter "$md_file" | grep "^description:" | sed 's/^description: *//' || echo "")
    else
        md_desc=""
    fi

    # Validate display_name in plugin.json
    if [[ -n "$json_display_name" && ${#json_display_name} -gt 3 ]]; then
        log_pass "$agent_id has valid display_name in plugin.json"
    else
        log_fail "$agent_id has empty/short display_name in plugin.json" "Length: ${#json_display_name}"
    fi

    # Validate description in .md frontmatter (this is the detailed description)
    if [[ -n "$md_desc" && ${#md_desc} -gt 10 ]]; then
        log_pass "$agent_id has valid description in .md frontmatter"
    else
        log_warn "$agent_id has empty/short description in .md" "Consider adding detailed description"
    fi

done <<< "$(echo "$AGENTS_JSON" | jq -c '.')"
echo ""

# =============================================================================
# Test 8: Each agent has success_criteria (can_solve_examples)
# =============================================================================
echo -e "${CYAN}Test 8: Agents have success criteria (can_solve_examples)${NC}"
echo "----------------------------------------"

while IFS= read -r agent; do
    agent_id=$(echo "$agent" | jq -r '.id')
    examples=$(echo "$agent" | jq -r '.can_solve_examples[]? // empty')
    example_count=$(echo "$agent" | jq '.can_solve_examples | length // 0')

    if [[ "$example_count" -ge 3 ]]; then
        log_pass "$agent_id has $example_count examples"
    elif [[ "$example_count" -ge 1 ]]; then
        log_warn "$agent_id has only $example_count examples" "Recommend at least 3"
    else
        log_fail "$agent_id has no can_solve_examples" "Add examples to show agent capabilities"
    fi
done <<< "$(echo "$AGENTS_JSON" | jq -c '.')"

echo ""

# =============================================================================
# Test 9: Agent handoff_to references valid agents
# =============================================================================
echo -e "${CYAN}Test 9: handoff_to references valid agents${NC}"
echo "----------------------------------------"

# Get all valid agent IDs
ALL_AGENT_IDS=$(jq -r '.agents[].id' "$PLUGIN_FILE")

while IFS= read -r agent; do
    agent_id=$(echo "$agent" | jq -r '.id')
    handoffs=$(echo "$agent" | jq -r '.handoff_to[]? // empty')

    if [[ -z "$handoffs" ]]; then
        log_info "$agent_id has no handoff_to (terminal agent)"
        continue
    fi

    invalid_handoffs=""
    handoff_count=0

    while IFS= read -r handoff; do
        handoff_count=$((handoff_count + 1))
        if ! echo "$ALL_AGENT_IDS" | grep -qx "$handoff"; then
            invalid_handoffs="$invalid_handoffs $handoff"
        fi
    done <<< "$handoffs"

    if [[ -z "$invalid_handoffs" ]]; then
        log_pass "$agent_id: all $handoff_count handoffs valid"
    else
        log_fail "$agent_id has invalid handoff targets" "Invalid:$invalid_handoffs"
    fi
done <<< "$(echo "$AGENTS_JSON" | jq -c '.')"

echo ""

# =============================================================================
# Test 10: Agent files in directory match plugin.json
# =============================================================================
echo -e "${CYAN}Test 10: All .md files in agents/ are registered${NC}"
echo "----------------------------------------"

# Get list of .md files in agents directory
MD_FILES=$(ls "$AGENTS_DIR"/*.md 2>/dev/null | xargs -n1 basename | sort)

# Get list of registered agent files
REGISTERED_FILES=$(jq -r '.agents[].path' "$PLUGIN_FILE" | xargs -n1 basename | sort)

# Find orphan files (in directory but not in plugin.json)
ORPHAN_FILES=""
while IFS= read -r file; do
    if ! echo "$REGISTERED_FILES" | grep -qx "$file"; then
        ORPHAN_FILES="$ORPHAN_FILES $file"
    fi
done <<< "$MD_FILES"

if [[ -z "$(echo "$ORPHAN_FILES" | tr -d ' ')" ]]; then
    log_pass "All agent .md files are registered in plugin.json"
else
    for orphan in $ORPHAN_FILES; do
        log_warn "Orphan file: $orphan" "Not registered in plugin.json agents array"
    done
fi

# Find missing files (in plugin.json but not in directory)
while IFS= read -r registered; do
    if ! echo "$MD_FILES" | grep -qx "$registered"; then
        log_fail "Registered file missing" "$registered in plugin.json but not in $AGENTS_DIR"
    fi
done <<< "$REGISTERED_FILES"

echo ""

# =============================================================================
# Test 11: Agent colors are valid
# =============================================================================
echo -e "${CYAN}Test 11: Agent colors are valid${NC}"
echo "----------------------------------------"

# Valid color names (based on common terminal/UI color names)
VALID_COLORS=(
    "red" "green" "blue" "yellow" "orange" "purple" "pink" "cyan"
    "magenta" "violet" "indigo" "plum" "orchid" "emerald" "teal"
    "gray" "grey" "black" "white"
)

while IFS= read -r agent; do
    agent_id=$(echo "$agent" | jq -r '.id')
    color=$(echo "$agent" | jq -r '.color // empty')

    if [[ -z "$color" ]]; then
        log_warn "$agent_id has no color defined" "Consider adding a color"
        continue
    fi

    # Convert to lowercase for comparison
    color_lower=$(echo "$color" | tr '[:upper:]' '[:lower:]')
    color_valid=false

    for valid in "${VALID_COLORS[@]}"; do
        if [[ "$color_lower" == "$valid" ]]; then
            color_valid=true
            break
        fi
    done

    if [[ "$color_valid" == true ]]; then
        log_pass "$agent_id has valid color: $color"
    else
        log_warn "$agent_id has non-standard color: $color" "Consider using a standard color name"
    fi
done <<< "$(echo "$AGENTS_JSON" | jq -c '.')"

echo ""

# =============================================================================
# Test 12: Frontmatter consistency between .md and plugin.json
# =============================================================================
echo -e "${CYAN}Test 12: Frontmatter consistency check${NC}"
echo "----------------------------------------"

while IFS= read -r agent; do
    agent_id=$(echo "$agent" | jq -r '.id')
    json_name=$(echo "$agent" | jq -r '.name // empty')
    json_color=$(echo "$agent" | jq -r '.color // empty')
    agent_path=$(echo "$agent" | jq -r '.path')
    md_file="$PROJECT_ROOT/$agent_path"

    if [[ ! -f "$md_file" ]]; then
        log_skip "$agent_id consistency check" "File does not exist"
        continue
    fi

    # Extract frontmatter values
    frontmatter=$(get_frontmatter "$md_file")
    md_name=$(echo "$frontmatter" | grep "^name:" | sed 's/^name: *//' | tr -d '\r' || echo "")
    md_color=$(echo "$frontmatter" | grep "^color:" | sed 's/^color: *//' | tr -d '\r' || echo "")

    issues=""

    # Compare name (kebab-case in frontmatter vs display name in JSON)
    if [[ -n "$md_name" && -n "$json_name" ]]; then
        # Convert json_name to kebab-case for comparison
        json_name_kebab=$(echo "$json_name" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')
        if [[ "$md_name" != "$json_name_kebab" && "$md_name" != "$agent_id" ]]; then
            # Name mismatch might be intentional (display_name vs id)
            log_info "$agent_id: name differs (md: $md_name, json: $json_name)"
        fi
    fi

    # Compare color
    if [[ -n "$md_color" && -n "$json_color" ]]; then
        if [[ "$md_color" != "$json_color" ]]; then
            issues="$issues color mismatch (md: $md_color, json: $json_color)"
        fi
    fi

    if [[ -z "$issues" ]]; then
        log_pass "$agent_id has consistent frontmatter"
    else
        log_warn "$agent_id has inconsistencies" "$issues"
    fi
done <<< "$(echo "$AGENTS_JSON" | jq -c '.')"

echo ""

# =============================================================================
# Summary
# =============================================================================
echo "=========================================="
echo "  Test Summary"
echo "=========================================="
echo ""
TOTAL=$((PASSED + FAILED + SKIPPED))
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${RED}Failed:${NC}   $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${CYAN}Skipped:${NC}  $SKIPPED"
echo -e "Total:    $TOTAL"
echo ""

if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
    echo -e "${RED}Failed Tests:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  - $test"
    done
    echo ""
fi

if [[ ${#WARNING_TESTS[@]} -gt 0 && "$VERBOSE" == "--verbose" ]]; then
    echo -e "${YELLOW}Warnings:${NC}"
    for warn in "${WARNING_TESTS[@]}"; do
        echo -e "  - $warn"
    done
    echo ""
fi

echo "=========================================="
if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}RESULT: FAILED${NC}"
    echo "=========================================="
    exit 1
else
    echo -e "${GREEN}RESULT: PASSED${NC}"
    if [[ $WARNINGS -gt 0 ]]; then
        echo -e "${YELLOW}(with $WARNINGS warnings)${NC}"
    fi
    echo "=========================================="
    exit 0
fi