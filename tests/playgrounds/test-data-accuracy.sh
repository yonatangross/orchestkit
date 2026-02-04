#!/usr/bin/env bash
# ============================================================================
# Playground Data Accuracy Test
# ============================================================================
# Verifies that docs/playgrounds/data.js has accurate counts matching
# the actual manifests. Catches issues like plugins showing 0 skills
# when they should have more.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Playground Data Accuracy Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DATA_JS="$PROJECT_ROOT/docs/playgrounds/data.js"
MANIFESTS_DIR="$PROJECT_ROOT/manifests"

ERRORS=0

echo "▶ Checking plugin skill counts..."

# For each manifest, verify data.js has matching skill count
# Skip meta-plugins (ork.json is "all" that has skills: "all")
for manifest in "$MANIFESTS_DIR"/ork*.json; do
    plugin_name=$(basename "$manifest" .json)

    # Skip meta-plugins that use "all" instead of explicit skill list
    skills_value=$(jq -r '.skills' "$manifest" 2>/dev/null)
    if [[ "$skills_value" == "all" ]]; then
        echo -e "  ${YELLOW}⊘${NC} $plugin_name: skipped (meta-plugin with skills='all')"
        continue
    fi

    # Get skill count from manifest
    manifest_skills=$(jq -r '.skills // [] | length' "$manifest" 2>/dev/null || echo "0")

    # Get skill count from data.js (parse the JS object)
    # Look for: { name: "plugin-name", ... skills: [...], ...
    datajs_skills=$(grep -A3 "name: \"$plugin_name\"" "$DATA_JS" 2>/dev/null | grep "skills:" | head -1 | grep -o '\[.*\]' | tr ',' '\n' | grep -c '"' || echo "0")

    if [[ "$manifest_skills" != "$datajs_skills" ]]; then
        echo -e "  ${RED}✗${NC} $plugin_name: manifest=$manifest_skills, data.js=$datajs_skills"
        ((ERRORS++)) || true
    else
        echo -e "  ${GREEN}✓${NC} $plugin_name: $manifest_skills skills"
    fi
done

echo ""

if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}FAIL:${NC} $ERRORS plugin(s) have mismatched skill counts"
    echo ""
    echo -e "${YELLOW}Fix:${NC} Run 'node scripts/generate-playground-data.js' and commit"
    exit 1
else
    echo -e "${GREEN}PASS:${NC} All plugin skill counts match"
    exit 0
fi
