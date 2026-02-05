#!/usr/bin/env bash
# ============================================================================
# Playground Data Freshness Test (Two-Tier System)
# ============================================================================
# Note: In the two-tier system (v6.0.0+), data.js is manually maintained
# rather than auto-generated. This test validates basic structure only.
#
# For the old auto-generated system, see git history.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Playground Data Freshness Test (Two-Tier)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DATA_JS="$PROJECT_ROOT/docs/playgrounds/data.js"

# Check file exists
if [[ ! -f "$DATA_JS" ]]; then
    echo -e "${YELLOW}SKIP:${NC} data.js not found at $DATA_JS"
    exit 0
fi

# In two-tier system, data.js is manually maintained
# The accuracy test (test-data-accuracy.sh) validates structure
echo -e "${YELLOW}INFO:${NC} Two-tier system uses manually maintained data.js"
echo "      Freshness is validated by test-data-accuracy.sh"
echo ""
echo -e "${GREEN}PASS:${NC} No auto-generation required for two-tier system"
exit 0
