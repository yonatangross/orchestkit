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

TOTAL_FAILED=0
TOTAL_WARNINGS=0
PLUGINS_TESTED=0

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

# Helper to get JSON field type
get_field_type() {
    local plugin_file="$1"
    local field="$2"
    jq -r "if .$field == null then \"null\" elif .$field | type == \"object\" then \"object\" elif .$field | type == \"array\" then \"array\" elif .$field | type == \"string\" then \"string\" else \"other\" end" "$plugin_file" 2>/dev/null || echo "error"
}

# Validate a single plugin.json file
validate_plugin_schema() {
    local PLUGIN_JSON="$1"
    local PLUGIN_NAME="$2"
    local FAILED=0
    local WARNINGS=0

    echo ""
    echo -e "${BLUE}=== $PLUGIN_NAME ===${NC}"
    echo "File: $PLUGIN_JSON"
    echo ""

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
    echo "Test 2: Skills Field Format (CC 2.1.19)"
    echo "────────────────────────────────────────"

    skills_type=$(get_field_type "$PLUGIN_JSON" "skills")

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
            echo -e "  ${RED}FAIL${NC}: skills is OBJECT - CC 2.1.19 expects string or array"
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
    echo "Test 3: Agents Field Format (CC 2.1.19)"
    echo "────────────────────────────────────────"

    agents_type=$(get_field_type "$PLUGIN_JSON" "agents")

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
            echo -e "  ${RED}FAIL${NC}: agents is OBJECT - CC 2.1.19 expects string or array"
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

    commands_type=$(get_field_type "$PLUGIN_JSON" "commands")

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

    hooks_type=$(get_field_type "$PLUGIN_JSON" "hooks")

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

    # Return failures count
    TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
    TOTAL_WARNINGS=$((TOTAL_WARNINGS + WARNINGS))
    PLUGINS_TESTED=$((PLUGINS_TESTED + 1))

    return $FAILED
}

# ============================================================================
# MAIN - Test all plugins
# ============================================================================
echo "=============================================="
echo "plugin.json CC 2.1.19 Schema Compliance"
echo "=============================================="

# 1. Test root plugin
ROOT_PLUGIN="$PROJECT_ROOT/.claude-plugin/plugin.json"
if [[ -f "$ROOT_PLUGIN" ]]; then
    validate_plugin_schema "$ROOT_PLUGIN" "Root Plugin (ork)"
else
    echo -e "${YELLOW}WARN${NC}: Root plugin.json not found at $ROOT_PLUGIN"
    ((TOTAL_WARNINGS++))
fi

# 2. Test all modular plugins
echo ""
echo "=============================================="
echo "Testing Modular Plugins"
echo "=============================================="

for plugin_dir in "$PROJECT_ROOT"/plugins/ork-*/; do
    [[ -d "$plugin_dir" ]] || continue
    plugin_name=$(basename "$plugin_dir")

    if [[ -f "$plugin_dir/.claude-plugin/plugin.json" ]]; then
        validate_plugin_schema "$plugin_dir/.claude-plugin/plugin.json" "$plugin_name"
    elif [[ -f "$plugin_dir/plugin.json" ]]; then
        validate_plugin_schema "$plugin_dir/plugin.json" "$plugin_name"
    fi
done

# ============================================================================
# Final Summary
# ============================================================================
echo ""
echo "=============================================="
echo "Final Summary"
echo "=============================================="
echo ""
echo "Plugins tested: $PLUGINS_TESTED"
echo "Total failures: $TOTAL_FAILED"
echo "Total warnings: $TOTAL_WARNINGS"
echo ""

if [[ $TOTAL_FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED${NC}: $TOTAL_FAILED test(s) failed across $PLUGINS_TESTED plugins"
    echo ""
    echo "To fix plugin.json schema issues:"
    echo "  1. Change skills: {\"directory\":\"skills\"} to skills: \"./skills/\""
    echo "  2. Change agents: {\"directory\":\"agents\"} to agents: \"./agents/\""
    echo "  3. Remove commands field (use skills with user-invocable: true)"
    exit 1
else
    echo -e "${GREEN}PASSED${NC}: All $PLUGINS_TESTED plugins validated successfully"
    [[ $TOTAL_WARNINGS -gt 0 ]] && echo -e "${YELLOW}WARNINGS${NC}: $TOTAL_WARNINGS (review recommended)"
    exit 0
fi
