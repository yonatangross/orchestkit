#!/usr/bin/env bash
# ============================================================================
# Hook Test Coverage Report
# ============================================================================
# Analyzes test coverage for all hook categories in OrchestKit.
#
# Primary: parses vitest coverage-summary.json (line coverage per file,
#          grouped by category).
# Fallback: grep-based heuristic when JSON is unavailable.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
HOOKS_DIR="$PROJECT_ROOT/src/hooks/src"  # TypeScript source directory
TESTS_DIR="$PROJECT_ROOT/src/hooks/src/__tests__"  # TypeScript test directory
COVERAGE_JSON="$PROJECT_ROOT/src/hooks/coverage/coverage-summary.json"

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

# ============================================================================
# Color helper: pick color based on percentage
# ============================================================================
pick_color() {
    local pct="$1"
    if [ "$pct" -ge 80 ]; then
        echo "$GREEN"
    elif [ "$pct" -ge 50 ]; then
        echo "$YELLOW"
    else
        echo "$RED"
    fi
}

# ============================================================================
# PRIMARY: vitest coverage-summary.json
# ============================================================================
if [ -f "$COVERAGE_JSON" ] && command -v jq &>/dev/null; then
    echo -e "  ${BLUE}Source: vitest coverage-summary.json${NC}"
    echo ""
    echo "▶ Line Coverage by Category"
    echo "────────────────────────────────────────"

    # Categories to report
    CATEGORIES=(pretool posttool lifecycle permission notification stop subagent-start subagent-stop agent skill prompt lib)

    TOTAL_LINES=0
    TOTAL_COVERED=0

    for category in "${CATEGORIES[@]}"; do
        # Extract files matching this category path (src/<category>/)
        # jq: filter keys containing /<category>/, sum lines total & covered
        cat_data=$(jq -r --arg cat "$category" '
            to_entries
            | map(select(.key != "total" and (.key | test("/src/" + $cat + "/"))))
            | {
                total: (map(.value.lines.total) | add // 0),
                covered: (map(.value.lines.covered) | add // 0),
                files: length
              }
        ' "$COVERAGE_JSON")

        cat_total=$(echo "$cat_data" | jq -r '.total')
        cat_covered=$(echo "$cat_data" | jq -r '.covered')
        cat_files=$(echo "$cat_data" | jq -r '.files')

        if [ "$cat_files" -gt 0 ] && [ "$cat_total" -gt 0 ]; then
            pct=$((cat_covered * 100 / cat_total))
            color=$(pick_color "$pct")
            printf "  %-25s %s%3d%%%s  (%d/%d lines, %d files)\n" \
                "$category:" "$color" "$pct" "$NC" "$cat_covered" "$cat_total" "$cat_files"

            TOTAL_LINES=$((TOTAL_LINES + cat_total))
            TOTAL_COVERED=$((TOTAL_COVERED + cat_covered))
        fi
    done

    # Overall from the "total" key
    echo ""
    echo "▶ Overall (from vitest)"
    echo "────────────────────────────────────────"

    overall_lines=$(jq -r '.total.lines.pct // 0' "$COVERAGE_JSON")
    overall_functions=$(jq -r '.total.functions.pct // 0' "$COVERAGE_JSON")
    overall_branches=$(jq -r '.total.branches.pct // 0' "$COVERAGE_JSON")
    overall_statements=$(jq -r '.total.statements.pct // 0' "$COVERAGE_JSON")

    echo -e "  Lines:        ${CYAN}${overall_lines}%${NC}"
    echo -e "  Functions:    ${CYAN}${overall_functions}%${NC}"
    echo -e "  Branches:     ${CYAN}${overall_branches}%${NC}"
    echo -e "  Statements:   ${CYAN}${overall_statements}%${NC}"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Summary"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Use the overall lines percentage for threshold check
    # Strip decimal for integer comparison
    overall_int=${overall_lines%.*}
    overall_int=${overall_int:-0}
    color=$(pick_color "$overall_int")

    echo -e "  ${CYAN}Line Coverage:${NC}   $color${overall_lines}%$NC"
    echo ""

    THRESHOLD="${COVERAGE_THRESHOLD:-70}"
    if [ "$overall_int" -lt "$THRESHOLD" ]; then
        echo -e "  ${RED}COVERAGE BELOW THRESHOLD ($THRESHOLD%)${NC}"
        exit 1
    else
        echo -e "  ${GREEN}COVERAGE MEETS THRESHOLD ($THRESHOLD%)${NC}"
        exit 0
    fi
fi

# ============================================================================
# FALLBACK: grep-based heuristic (no coverage JSON available)
# ============================================================================
echo -e "  ${YELLOW}Source: grep-based heuristic (coverage-summary.json not found)${NC}"
echo ""

# Function to check if a hook is tested
is_hook_tested() {
    local hook_name="$1"
    local hook_path="$2"
    local hook_base="${hook_name%.ts}"  # Strip .ts for matching .js imports

    # Check if hook base name appears in any test file (TypeScript tests)
    # Use base name (no extension) so "foo.ts" matches imports of "foo.js"
    if grep -rq "$hook_base" "$TESTS_DIR" --include="*.ts" 2>/dev/null; then
        return 0  # Tested
    fi

    # Check if hook path (without extension) appears in any test file
    local hook_path_base="${hook_path%.ts}"
    if grep -rq "$hook_path_base" "$TESTS_DIR" --include="*.ts" 2>/dev/null; then
        return 0  # Tested
    fi

    # Also check shell-based tests in project tests dir
    if grep -rq "$hook_base" "$PROJECT_ROOT/tests" --include="*.sh" 2>/dev/null; then
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

            ((category_total++)) || true
            TOTAL_HOOKS=$((TOTAL_HOOKS + 1))

            if is_hook_tested "$hook_name" "$relative_path"; then
                ((category_tested++)) || true
                TESTED_HOOKS=$((TESTED_HOOKS + 1))
            else
                UNTESTED_HOOKS=$((UNTESTED_HOOKS + 1))
                untested_list+=("$relative_path")
            fi
        fi
    done < <(find "$category_path" -name "*.ts" -type f 2>/dev/null)

    if [ "$category_total" -gt 0 ]; then
        local percentage=$((category_tested * 100 / category_total))

        # Color based on coverage
        local color
        color=$(pick_color "$percentage")

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
        count=$(find "$HOOKS_DIR/pretool/$subcategory" -name "*.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
        tested=0

        for hook_file in "$HOOKS_DIR/pretool/$subcategory"/*.ts; do
            if [ -f "$hook_file" ]; then
                hook_name=$(basename "$hook_file")
                if is_hook_tested "$hook_name" "pretool/$subcategory/$hook_name"; then
                    ((tested++)) || true
                fi
            fi
        done

        if [ "$count" -gt 0 ]; then
            percentage=$((tested * 100 / count))
            color=$(pick_color "$percentage")
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

color=$(pick_color "$TOTAL_PERCENTAGE")

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
