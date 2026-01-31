#!/usr/bin/env bash
# ============================================================================
# Manifest Dependency Declaration Validation
# ============================================================================
# Validates that all plugin dependencies are explicitly declared in manifest
# JSON via the "dependencies" field — not just documented as English prose
# in the "description" string.
#
# Tests:
# 1. Any manifest whose description contains "Depends on X" must have
#    dependencies: ["X"] in the JSON
# 2. Any "-advanced" plugin must declare a dependency on its "-core" sibling
#    (if one exists)
# 3. All declared dependencies must reference plugins that exist in manifests/
#
# Related: GitHub Issue #252 (Plugin Consolidation)
# Usage: ./test-manifest-dependencies.sh [--verbose]
# Exit codes: 0 = all deps declared, 1 = undeclared deps found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
MANIFESTS_DIR="$PROJECT_ROOT/manifests"

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
WARNINGS=0

log_pass() { echo -e "  ${GREEN}[PASS]${NC} $1"; PASSED_CHECKS=$((PASSED_CHECKS + 1)); TOTAL_CHECKS=$((TOTAL_CHECKS + 1)); }
log_fail() { echo -e "  ${RED}[FAIL]${NC} $1"; FAILED_CHECKS=$((FAILED_CHECKS + 1)); TOTAL_CHECKS=$((TOTAL_CHECKS + 1)); }
log_warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
log_info() { [[ "$VERBOSE" == "--verbose" ]] && echo -e "  ${BLUE}[INFO]${NC} $1" || true; }

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  Manifest Integrity: Dependency Declarations"
echo "  All dependencies must be declared in JSON, not just prose."
echo "══════════════════════════════════════════════════════════════════════"
echo ""

if [[ ! -d "$MANIFESTS_DIR" ]]; then
    echo -e "${RED}ERROR:${NC} Manifests directory not found: $MANIFESTS_DIR"
    exit 1
fi

# Collect all known plugin names
KNOWN_PLUGINS=$(mktemp)
trap "rm -f $KNOWN_PLUGINS" EXIT
for manifest in "$MANIFESTS_DIR"/*.json; do
    jq -r '.name' "$manifest" >> "$KNOWN_PLUGINS"
done

# ============================================================================
# CHECK 1: Description-based dependency detection
# ============================================================================
echo "───────────────────────────────────────────────────────────────"
echo "  Check 1: Prose dependencies must have matching JSON field"
echo "───────────────────────────────────────────────────────────────"

for manifest in "$MANIFESTS_DIR"/*.json; do
    [[ -f "$manifest" ]] || continue
    plugin_name=$(jq -r '.name' "$manifest")
    description=$(jq -r '.description // ""' "$manifest")

    # Check for "Depends on <plugin-name>" pattern in description
    # Match patterns like "Depends on ork-memory-graph" or "depends on ork-core"
    while IFS= read -r dep_name; do
        [[ -z "$dep_name" ]] && continue

        # Check if this dependency is declared in the dependencies array
        has_dep=$(jq -r --arg dep "$dep_name" \
            'if .dependencies then (.dependencies | index($dep) // empty) else empty end' \
            "$manifest")

        if [[ -n "$has_dep" ]]; then
            log_pass "$plugin_name: dependency on '$dep_name' is declared in JSON"
        else
            log_fail "$plugin_name: description says 'Depends on $dep_name' but NO dependencies field declares it"
        fi
    done < <(echo "$description" | grep -oiE '[Dd]epends on (ork-[a-z0-9-]+)' | sed -E 's/[Dd]epends on //')
done

# ============================================================================
# CHECK 2: Advanced plugins must depend on their core sibling
# ============================================================================
echo ""
echo "───────────────────────────────────────────────────────────────"
echo "  Check 2: Advanced plugins must depend on their core sibling"
echo "───────────────────────────────────────────────────────────────"

for manifest in "$MANIFESTS_DIR"/*.json; do
    [[ -f "$manifest" ]] || continue
    plugin_name=$(jq -r '.name' "$manifest")

    # Check if this is an "-advanced" plugin
    if [[ "$plugin_name" == *"-advanced" ]]; then
        # Derive the core sibling name
        # ork-langgraph-advanced -> ork-langgraph-core
        # ork-backend-advanced -> ork-architecture (special case)
        # ork-rag-advanced -> ork-rag
        base_name="${plugin_name%-advanced}"
        core_name="${base_name}-core"
        plain_name="$base_name"

        # Check if -core variant exists
        core_exists=false
        plain_exists=false
        if grep -q "^${core_name}$" "$KNOWN_PLUGINS"; then
            core_exists=true
        fi
        if grep -q "^${plain_name}$" "$KNOWN_PLUGINS"; then
            plain_exists=true
        fi

        if $core_exists; then
            # Check if dependency is declared
            has_dep=$(jq -r --arg dep "$core_name" \
                'if .dependencies then (.dependencies | index($dep) // empty) else empty end' \
                "$manifest")

            if [[ -n "$has_dep" ]]; then
                log_pass "$plugin_name: depends on $core_name (declared)"
            else
                log_fail "$plugin_name: should depend on '$core_name' but has no dependencies field"
            fi
        elif $plain_exists; then
            # Check if dependency on plain name is declared
            has_dep=$(jq -r --arg dep "$plain_name" \
                'if .dependencies then (.dependencies | index($dep) // empty) else empty end' \
                "$manifest")

            if [[ -n "$has_dep" ]]; then
                log_pass "$plugin_name: depends on $plain_name (declared)"
            else
                log_fail "$plugin_name: should depend on '$plain_name' but has no dependencies field"
            fi
        else
            log_info "$plugin_name: no core sibling found (standalone advanced plugin)"
        fi
    fi
done

# ============================================================================
# CHECK 3: All declared dependencies reference existing plugins
# ============================================================================
echo ""
echo "───────────────────────────────────────────────────────────────"
echo "  Check 3: Declared dependencies must reference existing plugins"
echo "───────────────────────────────────────────────────────────────"

for manifest in "$MANIFESTS_DIR"/*.json; do
    [[ -f "$manifest" ]] || continue
    plugin_name=$(jq -r '.name' "$manifest")

    # Get dependencies array (if any)
    deps_count=$(jq -r 'if .dependencies then (.dependencies | length) else 0 end' "$manifest")

    if [[ "$deps_count" -gt 0 ]]; then
        jq -r '.dependencies[]' "$manifest" | while read -r dep; do
            if grep -q "^${dep}$" "$KNOWN_PLUGINS"; then
                log_pass "$plugin_name: dependency '$dep' exists in manifests"
            else
                log_fail "$plugin_name: dependency '$dep' does NOT exist in manifests"
            fi
        done
    else
        log_info "$plugin_name: no dependencies declared"
    fi
done

# Summary
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  DEPENDENCY DECLARATION SUMMARY"
echo "══════════════════════════════════════════════════════════════════════"
echo -e "  Total checks:    ${BLUE}$TOTAL_CHECKS${NC}"
echo -e "  Passed:          ${GREEN}$PASSED_CHECKS${NC}"
echo -e "  Failed:          ${RED}$FAILED_CHECKS${NC}"
echo -e "  Warnings:        ${YELLOW}$WARNINGS${NC}"
echo ""

if [[ "$FAILED_CHECKS" -gt 0 ]]; then
    echo -e "${RED}FAILED${NC} — $FAILED_CHECKS dependency declaration(s) missing."
    echo "  Dependencies must be in the JSON 'dependencies' field, not just description prose."
    echo "  See: https://github.com/yonatangross/orchestkit/issues/252"
    exit 1
else
    echo -e "${GREEN}PASSED${NC} — All dependencies properly declared."
    exit 0
fi
