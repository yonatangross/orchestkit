#!/usr/bin/env bash
# ============================================================================
# Skill Uniqueness Validation
# ============================================================================
# Validates that each skill appears in exactly ONE plugin manifest.
# No skill should be claimed by multiple plugins — that creates undefined
# ownership, conflict on install, and makes maintenance a guessing game.
#
# Tests:
# 1. Collect all skill arrays from all manifests
# 2. Detect any skill appearing in 2+ manifests
# 3. Report every duplication with plugin names
#
# Related: GitHub Issue #252 (Plugin Consolidation)
# Usage: ./test-skill-uniqueness.sh [--verbose]
# Exit codes: 0 = all unique, 1 = duplicates found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
MANIFESTS_DIR="$PROJECT_ROOT/manifests"

VERBOSE="${1:-}"

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

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

log_pass() { echo -e "  ${GREEN}[PASS]${NC} $1"; PASSED_CHECKS=$((PASSED_CHECKS + 1)); TOTAL_CHECKS=$((TOTAL_CHECKS + 1)); }
log_fail() { echo -e "  ${RED}[FAIL]${NC} $1"; FAILED_CHECKS=$((FAILED_CHECKS + 1)); TOTAL_CHECKS=$((TOTAL_CHECKS + 1)); }
log_info() { [[ "$VERBOSE" == "--verbose" ]] && echo -e "  ${BLUE}[INFO]${NC} $1" || true; }

# ============================================================================
# MAIN: Skill Uniqueness Check
# ============================================================================

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  Manifest Integrity: Skill Uniqueness"
echo "  Each skill must appear in exactly ONE plugin manifest."
echo "══════════════════════════════════════════════════════════════════════"
echo ""

if [[ ! -d "$MANIFESTS_DIR" ]]; then
    echo -e "${RED}ERROR:${NC} Manifests directory not found: $MANIFESTS_DIR"
    exit 1
fi

# Temp file for skill->plugin mappings
SKILL_MAP=$(mktemp)
trap "rm -f $SKILL_MAP" EXIT

# Collect all skill->plugin mappings from manifests
# Skip the meta "ork" plugin (skills: "all" means it bundles everything)
MANIFEST_COUNT=0
for manifest in "$MANIFESTS_DIR"/*.json; do
    [[ -f "$manifest" ]] || continue

    plugin_name=$(jq -r '.name' "$manifest")

    # Skip the meta plugin — it declares "all" which is intentional bundling
    if [[ "$plugin_name" == "ork" ]]; then
        log_info "Skipping meta plugin: $plugin_name (skills: \"all\")"
        continue
    fi

    # Check skills field type
    skills_type=$(jq -r '.skills | type' "$manifest")

    if [[ "$skills_type" == "array" ]]; then
        MANIFEST_COUNT=$((MANIFEST_COUNT + 1))
        # Extract each skill and record plugin ownership
        jq -r '.skills[]' "$manifest" | while read -r skill; do
            echo "$skill|$plugin_name" >> "$SKILL_MAP"
        done
    elif [[ "$skills_type" == "string" ]]; then
        skills_value=$(jq -r '.skills' "$manifest")
        if [[ "$skills_value" == "all" ]]; then
            log_info "Skipping plugin with skills: \"all\": $plugin_name"
        else
            log_info "Skipping plugin with skills: \"$skills_value\": $plugin_name"
        fi
    fi
done

echo "  Scanned $MANIFEST_COUNT manifests with explicit skill arrays."
echo ""

# Find duplicates: skills that appear in 2+ plugins
DUPLICATE_COUNT=0
UNIQUE_SKILLS=0

# Get sorted unique skill names
cut -d'|' -f1 "$SKILL_MAP" | sort -u | while read -r skill; do
    # Find all plugins claiming this skill
    plugins=$(grep "^${skill}|" "$SKILL_MAP" | cut -d'|' -f2 | sort -u)
    plugin_count=$(echo "$plugins" | wc -l | tr -d ' ')

    if [[ "$plugin_count" -gt 1 ]]; then
        plugin_list=$(echo "$plugins" | tr '\n' ', ' | sed 's/,$//' | sed 's/,/, /g')
        log_fail "DUPLICATE: '$skill' claimed by $plugin_count plugins: [$plugin_list]"
        DUPLICATE_COUNT=$((DUPLICATE_COUNT + 1))
    else
        log_info "Unique: '$skill' -> $plugins"
    fi
done

# Recount from file since the while loop runs in a subshell
DUPLICATE_COUNT=$(cut -d'|' -f1 "$SKILL_MAP" | sort | uniq -c | sort -rn | awk '$1 > 1 { count++ } END { print count+0 }')
UNIQUE_COUNT=$(cut -d'|' -f1 "$SKILL_MAP" | sort -u | wc -l | tr -d ' ')
TOTAL_SLOTS=$(wc -l < "$SKILL_MAP" | tr -d ' ')

# Re-report failures for exit code (subshell above doesn't propagate counters)
FAILED_CHECKS=0
PASSED_CHECKS=0
TOTAL_CHECKS=0

if [[ "$DUPLICATE_COUNT" -gt 0 ]]; then
    # List each duplicate with its plugins
    echo ""
    echo "───────────────────────────────────────────────────────────────"
    echo "  Duplicated Skills Detail:"
    echo "───────────────────────────────────────────────────────────────"

    cut -d'|' -f1 "$SKILL_MAP" | sort | uniq -c | sort -rn | while read -r count skill; do
        if [[ "$count" -gt 1 ]]; then
            plugins=$(grep "^${skill}|" "$SKILL_MAP" | cut -d'|' -f2 | sort -u | tr '\n' ', ' | sed 's/,$//' | sed 's/,/, /g')
            log_fail "'$skill' appears in $count plugins: [$plugins]"
        fi
    done

    # Recount for exit
    FAILED_CHECKS=$DUPLICATE_COUNT
else
    log_pass "All skills are unique across manifests"
fi

# Summary
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  SKILL UNIQUENESS SUMMARY"
echo "══════════════════════════════════════════════════════════════════════"
echo -e "  Total skill slots:     ${BLUE}$TOTAL_SLOTS${NC}"
echo -e "  Unique skills:         ${BLUE}$UNIQUE_COUNT${NC}"
echo -e "  Duplicated skills:     ${RED}$DUPLICATE_COUNT${NC}"
echo -e "  Wasted slots:          ${YELLOW}$((TOTAL_SLOTS - UNIQUE_COUNT))${NC}"
echo ""

if [[ "$DUPLICATE_COUNT" -gt 0 ]]; then
    echo -e "${RED}FAILED${NC} — $DUPLICATE_COUNT skill(s) appear in multiple plugins."
    echo "  Each skill must have exactly ONE canonical plugin owner."
    echo "  See: https://github.com/yonatangross/orchestkit/issues/252"
    exit 1
else
    echo -e "${GREEN}PASSED${NC} — All skills are uniquely owned."
    exit 0
fi
