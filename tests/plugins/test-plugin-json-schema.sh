#!/usr/bin/env bash
# ============================================================================
# plugin.json CC 2.1.16 Schema Compliance Test
# ============================================================================
# Validates that plugin.json follows the official Claude Code plugin schema.
#
# CC 2.1.16 Schema Requirements:
# - skills: string path or array (NOT object with "directory" key)
# - agents: string path or array (NOT object with "directory" key)
# - commands: DEPRECATED (use skills with user-invocable: true)
# - Paths must be relative, starting with ./
#
# Reference: https://code.claude.com/docs/en/plugins-reference
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PLUGIN_JSON="$PROJECT_ROOT/.claude-plugin/plugin.json"

FAILED=0
WARNINGS=0

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' NC=''
fi

echo "=============================================="
echo "plugin.json CC 2.1.16 Schema Compliance"
echo "=============================================="
echo ""

# Check plugin.json exists
if [[ ! -f "$PLUGIN_JSON" ]]; then
    echo -e "${RED}FAIL${NC}: plugin.json not found at $PLUGIN_JSON"
    exit 1
fi

echo "Testing: $PLUGIN_JSON"
echo ""

# Helper to get JSON field type
get_field_type() {
    local field="$1"
    jq -r "if .$field == null then \"null\" elif .$field | type == \"object\" then \"object\" elif .$field | type == \"array\" then \"array\" elif .$field | type == \"string\" then \"string\" else \"other\" end" "$PLUGIN_JSON" 2>/dev/null || echo "error"
}

# ============================================================================
# Test 1: Required fields present
# ============================================================================
echo "Test 1: Required Fields"
echo "────────────────────────────────────────"

for field in name version; do
    value=$(jq -r ".$field // empty" "$PLUGIN_JSON" 2>/dev/null)
    if [[ -z "$value" ]]; then
        echo -e "  ${RED}FAIL${NC}: Missing required field '$field'"
        ((FAILED++))
    else
        echo -e "  ${GREEN}PASS${NC}: $field = $value"
    fi
done
echo ""

# ============================================================================
# Test 2: Skills field format (must be string or array, NOT object)
# ============================================================================
echo "Test 2: Skills Field Format"
echo "────────────────────────────────────────"

skills_type=$(get_field_type "skills")

case "$skills_type" in
    "null")
        echo -e "  ${GREEN}PASS${NC}: skills field absent (CC uses default ./skills/)"
        ;;
    "string")
        skills_val=$(jq -r '.skills' "$PLUGIN_JSON")
        if [[ "$skills_val" =~ ^\.\/ ]]; then
            echo -e "  ${GREEN}PASS${NC}: skills = \"$skills_val\" (valid string path)"
        else
            echo -e "  ${YELLOW}WARN${NC}: skills path should start with ./ (got: $skills_val)"
            ((WARNINGS++))
        fi
        ;;
    "array")
        echo -e "  ${GREEN}PASS${NC}: skills is array (valid)"
        ;;
    "object")
        echo -e "  ${RED}FAIL${NC}: skills is object - CC expects string or array"
        echo "        Current: $(jq -c '.skills' "$PLUGIN_JSON")"
        echo "        Expected: \"./skills/\" or [\"./skills/\"]"
        ((FAILED++))
        ;;
    *)
        echo -e "  ${RED}FAIL${NC}: skills has unexpected type: $skills_type"
        ((FAILED++))
        ;;
esac
echo ""

# ============================================================================
# Test 3: Agents field format (must be string or array, NOT object)
# ============================================================================
echo "Test 3: Agents Field Format"
echo "────────────────────────────────────────"

agents_type=$(get_field_type "agents")

case "$agents_type" in
    "null")
        echo -e "  ${GREEN}PASS${NC}: agents field absent (CC uses default ./agents/)"
        ;;
    "string")
        agents_val=$(jq -r '.agents' "$PLUGIN_JSON")
        if [[ "$agents_val" =~ ^\.\/ ]]; then
            echo -e "  ${GREEN}PASS${NC}: agents = \"$agents_val\" (valid string path)"
        else
            echo -e "  ${YELLOW}WARN${NC}: agents path should start with ./ (got: $agents_val)"
            ((WARNINGS++))
        fi
        ;;
    "array")
        echo -e "  ${GREEN}PASS${NC}: agents is array (valid)"
        ;;
    "object")
        echo -e "  ${RED}FAIL${NC}: agents is object - CC expects string or array"
        echo "        Current: $(jq -c '.agents' "$PLUGIN_JSON")"
        echo "        Expected: \"./agents/\" or [\"./agents/\"]"
        ((FAILED++))
        ;;
    *)
        echo -e "  ${RED}FAIL${NC}: agents has unexpected type: $agents_type"
        ((FAILED++))
        ;;
esac
echo ""

# ============================================================================
# Test 4: Commands field (DEPRECATED - should not exist)
# ============================================================================
echo "Test 4: Commands Field (Deprecated)"
echo "────────────────────────────────────────"

commands_type=$(get_field_type "commands")

if [[ "$commands_type" == "null" ]]; then
    echo -e "  ${GREEN}PASS${NC}: commands field absent (correct - use skills with user-invocable)"
else
    echo -e "  ${YELLOW}WARN${NC}: commands field present - this is deprecated in CC 2.1.16"
    echo "        Use skills with 'user-invocable: true' in frontmatter instead"
    echo "        Current: $(jq -c '.commands' "$PLUGIN_JSON")"
    ((WARNINGS++))
fi
echo ""

# ============================================================================
# Test 5: Hooks field format (must be object or string path)
# ============================================================================
echo "Test 5: Hooks Field Format"
echo "────────────────────────────────────────"

hooks_type=$(get_field_type "hooks")

case "$hooks_type" in
    "null")
        echo -e "  ${GREEN}PASS${NC}: hooks field absent (no hooks defined)"
        ;;
    "string")
        echo -e "  ${GREEN}PASS${NC}: hooks = path to hooks config file"
        ;;
    "object")
        hook_events=$(jq -r '.hooks | keys[]' "$PLUGIN_JSON" 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
        echo -e "  ${GREEN}PASS${NC}: hooks is inline object with events: $hook_events"
        ;;
    *)
        echo -e "  ${RED}FAIL${NC}: hooks has unexpected type: $hooks_type"
        ((FAILED++))
        ;;
esac
echo ""

# ============================================================================
# Test 6: Verify directories exist
# ============================================================================
echo "Test 6: Directory Existence"
echo "────────────────────────────────────────"

# Skills directory
skills_dir="$PROJECT_ROOT/skills"
if [[ -d "$skills_dir" ]]; then
    skill_count=$(find "$skills_dir" -maxdepth 2 -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  ${GREEN}PASS${NC}: skills/ directory exists ($skill_count skills)"
else
    echo -e "  ${RED}FAIL${NC}: skills/ directory not found"
    ((FAILED++))
fi

# Agents directory
agents_dir="$PROJECT_ROOT/agents"
if [[ -d "$agents_dir" ]]; then
    agent_count=$(find "$agents_dir" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  ${GREEN}PASS${NC}: agents/ directory exists ($agent_count agents)"
else
    echo -e "  ${RED}FAIL${NC}: agents/ directory not found"
    ((FAILED++))
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=============================================="
echo "Summary"
echo "=============================================="
echo ""

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED${NC}: $FAILED test(s) failed"
    [[ $WARNINGS -gt 0 ]] && echo -e "${YELLOW}WARNINGS${NC}: $WARNINGS"
    echo ""
    echo "To fix plugin.json schema issues:"
    echo "  1. Change skills: {\"directory\":\"skills\"} to skills: \"./skills/\""
    echo "  2. Change agents: {\"directory\":\"agents\"} to agents: \"./agents/\""
    echo "  3. Remove commands field (use skills with user-invocable: true)"
    exit 1
else
    echo -e "${GREEN}PASSED${NC}: All schema tests passed"
    [[ $WARNINGS -gt 0 ]] && echo -e "${YELLOW}WARNINGS${NC}: $WARNINGS (review recommended)"
    exit 0
fi
