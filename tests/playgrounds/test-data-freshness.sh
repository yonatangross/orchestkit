#!/usr/bin/env bash
# ============================================================================
# Playground Data Freshness Test
# ============================================================================
# Verifies that docs/playgrounds/data.js matches the generated output from
# manifests. Fails if data.js is stale.
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
echo "  Playground Data Freshness Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DATA_JS="$PROJECT_ROOT/docs/playgrounds/data.js"
GENERATOR="$PROJECT_ROOT/scripts/generate-playground-data.js"
TEMP_DATA="/tmp/data.js.generated"

# Check files exist
if [[ ! -f "$DATA_JS" ]]; then
    echo -e "${RED}FAIL:${NC} data.js not found at $DATA_JS"
    exit 1
fi

if [[ ! -f "$GENERATOR" ]]; then
    echo -e "${RED}FAIL:${NC} Generator script not found at $GENERATOR"
    exit 1
fi

echo "▶ Generating fresh data.js..."
# Capture current data.js
cp "$DATA_JS" "$TEMP_DATA.current"

# Generate new data.js
node "$GENERATOR" > /dev/null 2>&1

# Compare
if diff -q "$DATA_JS" "$TEMP_DATA.current" > /dev/null 2>&1; then
    echo -e "${GREEN}PASS:${NC} data.js is up to date with manifests"
    rm -f "$TEMP_DATA.current"
    exit 0
else
    echo -e "${RED}FAIL:${NC} data.js is stale!"
    echo ""
    echo "Differences found:"
    diff "$TEMP_DATA.current" "$DATA_JS" | head -50 || true
    echo ""
    echo -e "${YELLOW}Fix:${NC} Run 'node scripts/generate-playground-data.js' and commit"

    # Restore original (don't leave modified file)
    mv "$TEMP_DATA.current" "$DATA_JS"
    exit 1
fi
