#!/usr/bin/env bash
# ============================================================================
# Playground Data Accuracy Test (Two-Tier System)
# ============================================================================
# Verifies that docs/playgrounds/data.js has valid structure and
# accurate counts for the two-tier plugin system (orkl, ork).
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
echo "  Playground Data Accuracy Test (Two-Tier)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DATA_JS="$PROJECT_ROOT/docs/playgrounds/data.js"
ERRORS=0

if [[ ! -f "$DATA_JS" ]]; then
    echo -e "${RED}FAIL:${NC} data.js not found at $DATA_JS"
    exit 1
fi

echo "▶ Checking two-tier plugin structure..."

# Check for orkl (JS object syntax: name: "orkl")
if grep -q 'name: "orkl"' "$DATA_JS"; then
    echo -e "  ${GREEN}✓${NC} orkl plugin present"
else
    echo -e "  ${RED}✗${NC} orkl plugin missing"
    ((ERRORS++)) || true
fi

# Check for ork (note: must match exactly "ork", not "orkl" etc.)
if grep -E 'name: "ork"[,}]' "$DATA_JS" | grep -v "orkl" > /dev/null; then
    echo -e "  ${GREEN}✓${NC} ork plugin present"
else
    echo -e "  ${RED}✗${NC} ork plugin missing"
    ((ERRORS++)) || true
fi

# Check that old plugins are NOT present
for old_plugin in "ork-memory-graph" "ork-memory-mem0" "ork-memory-fabric" "ork-frontend" "ork-backend"; do
    if grep -q "name: \"$old_plugin\"" "$DATA_JS"; then
        echo -e "  ${RED}✗${NC} Old plugin $old_plugin should be removed"
        ((ERRORS++)) || true
    fi
done

echo ""
echo "▶ Checking totals structure..."

# Check totals exist (JS object syntax: totals:)
if grep -q 'totals:' "$DATA_JS"; then
    echo -e "  ${GREEN}✓${NC} totals object present"
else
    echo -e "  ${RED}✗${NC} totals object missing"
    ((ERRORS++)) || true
fi

# Check version is 6.x
if grep -q 'version: "6\.' "$DATA_JS"; then
    echo -e "  ${GREEN}✓${NC} version 6.x present"
else
    echo -e "  ${YELLOW}⊘${NC} version not 6.x (may need update)"
fi

echo ""

if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}FAIL:${NC} $ERRORS accuracy issue(s) found"
    echo ""
    echo -e "${YELLOW}Fix:${NC} Update docs/playgrounds/data.js for two-tier system"
    exit 1
else
    echo -e "${GREEN}PASS:${NC} Data accuracy verified for two-tier system"
    exit 0
fi
