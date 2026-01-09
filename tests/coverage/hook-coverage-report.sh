#!/usr/bin/env bash
# ============================================================================
# Hook Test Coverage Report
# ============================================================================
# Analyzes test coverage for all hook categories in SkillForge.
# Reports which hooks have dedicated tests vs which are untested.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
HOOKS_DIR="$PROJECT_ROOT/.claude/hooks"
TESTS_DIR="$PROJECT_ROOT/tests"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
TOTAL_HOOKS=0
TESTED_HOOKS=0
UNTESTED_HOOKS=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Hook Test Coverage Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to check if a hook is tested
is_hook_tested() {
    local hook_name="$1"
    local hook_path="$2"

    # Check if hook name appears in any test file
    if grep -rq "$hook_name" "$TESTS_DIR" --include="*.sh" 2>/dev/null; then
        return 0  # Tested
    fi

    # Check if hook path appears in any test file
    if grep -rq "$hook_path" "$TESTS_DIR" --include="*.sh" 2>/dev/null; then
        return 0  # Tested
    fi

    return 1  # Not tested
}

# Function to report coverage for a category
report_category() {
    local category="$1"
    local category_path="$HOOKS_DIR/$category"
    local category_total=0
    local category_tested=0
    local untested_list=()

    if [ ! -d "$category_path" ]; then
        return
    fi

    # Find all hook scripts in this category (recursive)
    while IFS= read -r hook_file; do
        if [ -f "$hook_file" ]; then
            hook_name=$(basename "$hook_file")
            relative_path="${hook_file#$HOOKS_DIR/}"

            # Skip dispatchers
            if [[ "$hook_name" == *"dispatcher"* ]]; then
                continue
            fi

            ((category_total++)) || true
            ((TOTAL_HOOKS++)) || true

            if is_hook_tested "$hook_name" "$relative_path"; then
                ((category_tested++)) || true
                ((TESTED_HOOKS++)) || true
            else
                ((UNTESTED_HOOKS++)) || true
                untested_list+=("$relative_path")
            fi
        fi
    done < <(find "$category_path" -name "*.sh" -type f 2>/dev/null)

    if [ "$category_total" -gt 0 ]; then
        local percentage=$((category_tested * 100 / category_total))

        # Color based on coverage
        local color="$RED"
        if [ "$percentage" -ge 80 ]; then
            color="$GREEN"
        elif [ "$percentage" -ge 50 ]; then
            color="$YELLOW"
        fi

        printf "  %-25s %s%3d%%%s (%d/%d)\n" "$category:" "$color" "$percentage" "$NC" "$category_tested" "$category_total"

        # List untested hooks if any
        if [ ${#untested_list[@]} -gt 0 ] && [ "${VERBOSE:-0}" = "1" ]; then
            for untested in "${untested_list[@]}"; do
                echo -e "    ${RED}○${NC} $untested"
            done
        fi
    fi
}

echo "▶ Coverage by Category"
echo "────────────────────────────────────────"

# Report each major category
for category in pretool posttool lifecycle permission notification stop subagent-start subagent-stop agent skill prompt; do
    report_category "$category"
done

# Also check nested categories
echo ""
echo "▶ Pretool Subcategories"
echo "────────────────────────────────────────"
for subcategory in bash write-edit input-mod mcp task skill; do
    if [ -d "$HOOKS_DIR/pretool/$subcategory" ]; then
        # Count hooks
        count=$(find "$HOOKS_DIR/pretool/$subcategory" -name "*.sh" -type f ! -name "*dispatcher*" 2>/dev/null | wc -l | tr -d ' ')
        tested=0

        for hook_file in "$HOOKS_DIR/pretool/$subcategory"/*.sh; do
            if [ -f "$hook_file" ]; then
                hook_name=$(basename "$hook_file")
                if [[ "$hook_name" != *"dispatcher"* ]]; then
                    if is_hook_tested "$hook_name" "pretool/$subcategory/$hook_name"; then
                        ((tested++)) || true
                    fi
                fi
            fi
        done

        if [ "$count" -gt 0 ]; then
            percentage=$((tested * 100 / count))
            color="$RED"
            if [ "$percentage" -ge 80 ]; then
                color="$GREEN"
            elif [ "$percentage" -ge 50 ]; then
                color="$YELLOW"
            fi
            printf "  pretool/%-15s %s%3d%%%s (%d/%d)\n" "$subcategory:" "$color" "$percentage" "$NC" "$tested" "$count"
        fi
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL_PERCENTAGE=0
if [ "$TOTAL_HOOKS" -gt 0 ]; then
    TOTAL_PERCENTAGE=$((TESTED_HOOKS * 100 / TOTAL_HOOKS))
fi

color="$RED"
if [ "$TOTAL_PERCENTAGE" -ge 80 ]; then
    color="$GREEN"
elif [ "$TOTAL_PERCENTAGE" -ge 50 ]; then
    color="$YELLOW"
fi

echo -e "  Total Hooks:     $TOTAL_HOOKS"
echo -e "  ${GREEN}Tested:${NC}          $TESTED_HOOKS"
echo -e "  ${RED}Untested:${NC}        $UNTESTED_HOOKS"
echo -e "  ${CYAN}Coverage:${NC}        $color$TOTAL_PERCENTAGE%$NC"
echo ""

# Exit with error if coverage is below threshold
THRESHOLD="${COVERAGE_THRESHOLD:-70}"
if [ "$TOTAL_PERCENTAGE" -lt "$THRESHOLD" ]; then
    echo -e "  ${RED}COVERAGE BELOW THRESHOLD ($THRESHOLD%)${NC}"
    exit 1
else
    echo -e "  ${GREEN}COVERAGE MEETS THRESHOLD ($THRESHOLD%)${NC}"
    exit 0
fi