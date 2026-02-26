#!/usr/bin/env bash
# ============================================================================
# Marketplace Plugin Ordering Validation
# ============================================================================
# Validates that plugins are ordered correctly in marketplace.json:
# if plugin A depends on plugin B, B must appear BEFORE A in the list.
#
# v7 unified architecture: ork is the primary plugin listed first,
# orkl and ork-creative are aliases listed after.
#
# Tests:
# 1. ork (primary) must be the first plugin listed
# 2. Aliases (orkl, ork-creative) must appear after ork
# 3. Dependencies must appear before their dependents
#
# Related: GitHub Issue #252 (Plugin Consolidation)
# Usage: ./test-marketplace-ordering.sh [--verbose]
# Exit codes: 0 = order correct, 1 = ordering violations
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
MANIFESTS_DIR="$PROJECT_ROOT/manifests"
MARKETPLACE_JSON="$PROJECT_ROOT/.claude-plugin/marketplace.json"

VERBOSE="${1:-}"

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

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

log_pass() { echo -e "  ${GREEN}[PASS]${NC} $1"; PASSED_CHECKS=$((PASSED_CHECKS + 1)); TOTAL_CHECKS=$((TOTAL_CHECKS + 1)); }
log_fail() { echo -e "  ${RED}[FAIL]${NC} $1"; FAILED_CHECKS=$((FAILED_CHECKS + 1)); TOTAL_CHECKS=$((TOTAL_CHECKS + 1)); }
log_info() { [[ "$VERBOSE" == "--verbose" ]] && echo -e "  ${BLUE}[INFO]${NC} $1" || true; }

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  Manifest Integrity: Marketplace Plugin Ordering"
echo "  Dependencies must appear before dependents."
echo "══════════════════════════════════════════════════════════════════════"
echo ""

if [[ ! -f "$MARKETPLACE_JSON" ]]; then
    echo -e "${RED}ERROR:${NC} marketplace.json not found: $MARKETPLACE_JSON"
    exit 1
fi

# Build position map: plugin_name -> index (0-based)
POSITION_MAP=$(mktemp)
trap "rm -f $POSITION_MAP" EXIT

jq -r '.plugins[].name' "$MARKETPLACE_JSON" | nl -ba -v0 | while read -r idx name; do
    echo "$name|$idx" >> "$POSITION_MAP"
done

get_position() {
    local name="$1"
    grep "^${name}|" "$POSITION_MAP" | cut -d'|' -f2 | tr -d ' '
}

PLUGIN_COUNT=$(jq '.plugins | length' "$MARKETPLACE_JSON")
log_info "Marketplace has $PLUGIN_COUNT plugins"

# ============================================================================
# CHECK 1: ork (primary) must be listed first
# ============================================================================
echo "───────────────────────────────────────────────────────────────"
echo "  Check 1: ork should be first (primary plugin)"
echo "───────────────────────────────────────────────────────────────"

first_plugin=$(jq -r '.plugins[0].name' "$MARKETPLACE_JSON")
if [[ "$first_plugin" == "ork" ]]; then
    log_pass "ork is the first plugin listed"
else
    log_fail "ork should be first but position 0 is '$first_plugin'"
fi

# ============================================================================
# CHECK 2: aliases (orkl, ork-creative) must appear after ork
# ============================================================================
echo ""
echo "───────────────────────────────────────────────────────────────"
echo "  Check 2: aliases should appear after primary plugin"
echo "───────────────────────────────────────────────────────────────"

ork_pos=$(get_position "ork")
for alias_name in orkl ork-creative; do
    alias_pos=$(get_position "$alias_name")
    if [[ -n "$alias_pos" && -n "$ork_pos" && "$alias_pos" -gt "$ork_pos" ]]; then
        log_pass "$alias_name (pos $alias_pos) listed after ork (pos $ork_pos)"
    elif [[ -z "$alias_pos" ]]; then
        log_info "$alias_name not in marketplace (OK if removed)"
    else
        log_fail "$alias_name (pos $alias_pos) should be after ork (pos $ork_pos)"
    fi
done

# ============================================================================
# CHECK 3: Dependencies must appear before dependents
# ============================================================================
echo ""
echo "───────────────────────────────────────────────────────────────"
echo "  Check 3: Dependency ordering (deps before dependents)"
echo "───────────────────────────────────────────────────────────────"

for manifest in "$MANIFESTS_DIR"/*.json; do
    [[ -f "$manifest" ]] || continue
    plugin_name=$(jq -r '.name' "$manifest")

    # Get dependencies array
    deps_count=$(jq -r 'if .dependencies then (.dependencies | length) else 0 end' "$manifest")

    if [[ "$deps_count" -gt 0 ]]; then
        plugin_pos=$(get_position "$plugin_name")

        if [[ -z "$plugin_pos" ]]; then
            log_fail "$plugin_name: not found in marketplace.json"
            continue
        fi

        jq -r '.dependencies[]' "$manifest" | while read -r dep; do
            dep_pos=$(get_position "$dep")

            if [[ -z "$dep_pos" ]]; then
                log_fail "$plugin_name: dependency '$dep' not found in marketplace.json"
            elif [[ "$dep_pos" -lt "$plugin_pos" ]]; then
                log_pass "$plugin_name: dependency '$dep' (pos $dep_pos) listed before dependent (pos $plugin_pos)"
            else
                log_fail "$plugin_name (pos $plugin_pos) is listed BEFORE its dependency '$dep' (pos $dep_pos)"
            fi
        done
    fi
done

# ============================================================================
# CHECK 4: All plugins have consistent versions
# ============================================================================
echo ""
echo "───────────────────────────────────────────────────────────────"
echo "  Check 4: Version consistency across marketplace entries"
echo "───────────────────────────────────────────────────────────────"

unique_versions=$(jq -r '.plugins[].version' "$MARKETPLACE_JSON" | sort -u | wc -l | tr -d ' ')
if [[ "$unique_versions" -eq 1 ]]; then
    version=$(jq -r '.plugins[0].version' "$MARKETPLACE_JSON")
    log_pass "All plugins at version $version"
else
    log_fail "Plugins have inconsistent versions: $(jq -r '.plugins[] | "\(.name)=\(.version)"' "$MARKETPLACE_JSON" | tr '\n' ' ')"
fi

# Summary
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  MARKETPLACE ORDERING SUMMARY"
echo "══════════════════════════════════════════════════════════════════════"
echo -e "  Total checks:    ${BLUE}$TOTAL_CHECKS${NC}"
echo -e "  Passed:          ${GREEN}$PASSED_CHECKS${NC}"
echo -e "  Failed:          ${RED}$FAILED_CHECKS${NC}"
echo ""

if [[ "$FAILED_CHECKS" -gt 0 ]]; then
    echo -e "${RED}FAILED${NC} — $FAILED_CHECKS ordering violation(s) found."
    echo "  Dependencies must appear before dependents in marketplace.json."
    echo "  See: https://github.com/yonatangross/orchestkit/issues/252"
    exit 1
else
    echo -e "${GREEN}PASSED${NC} — Marketplace plugin ordering is correct."
    exit 0
fi
