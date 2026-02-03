#!/bin/bash
# AGENTS.md Cross-Tool Compatibility Test
# Validates that AGENTS.md files are generated correctly for all plugins
#
# AGENTS.md is the open standard for AI coding agents (https://agents.md/)
# Claude Code uses CLAUDE.md, but other tools (Cursor, Codex, Amp, Zed) use AGENTS.md.
# We generate both to ensure cross-tool compatibility.
#
# Usage: ./test-agents-md-generation.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGINS_DIR="$PROJECT_ROOT/plugins"

VERBOSE="${1:-}"
FAILED=0
PASSED=0
WARNINGS=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  AGENTS.md Cross-Tool Compatibility Test"
echo "=========================================="
echo ""

# Check if plugins directory exists
if [[ ! -d "$PLUGINS_DIR" ]]; then
    echo -e "${YELLOW}WARNING: plugins/ directory not found${NC}"
    echo "Run 'npm run build' to generate plugins"
    exit 0
fi

# Count plugins with CLAUDE.md
plugins_with_claude=0
plugins_with_agents=0

for plugin_dir in "$PLUGINS_DIR"/*/; do
    [[ ! -d "$plugin_dir" ]] && continue

    plugin_name=$(basename "$plugin_dir")
    TOTAL=$((TOTAL + 1))

    # Check for CLAUDE.md
    if [[ -f "$plugin_dir/CLAUDE.md" ]]; then
        plugins_with_claude=$((plugins_with_claude + 1))

        # Check for AGENTS.md
        if [[ -f "$plugin_dir/AGENTS.md" ]]; then
            plugins_with_agents=$((plugins_with_agents + 1))

            # Verify content matches
            if diff -q "$plugin_dir/CLAUDE.md" "$plugin_dir/AGENTS.md" > /dev/null 2>&1; then
                PASSED=$((PASSED + 1))
                if [[ "$VERBOSE" == "--verbose" ]]; then
                    echo -e "${GREEN}✓${NC} $plugin_name: CLAUDE.md and AGENTS.md match"
                fi
            else
                FAILED=$((FAILED + 1))
                echo -e "${RED}✗${NC} $plugin_name: AGENTS.md differs from CLAUDE.md"
                echo "  AGENTS.md should be an exact copy of CLAUDE.md"
            fi
        else
            FAILED=$((FAILED + 1))
            echo -e "${RED}✗${NC} $plugin_name: Missing AGENTS.md (has CLAUDE.md)"
            echo "  Run 'npm run build' to regenerate"
        fi
    else
        # No CLAUDE.md, check if AGENTS.md exists (should not)
        if [[ -f "$plugin_dir/AGENTS.md" ]]; then
            WARNINGS=$((WARNINGS + 1))
            echo -e "${YELLOW}⚠${NC} $plugin_name: Has AGENTS.md but no CLAUDE.md"
        else
            # Neither file - might be expected for some plugins
            PASSED=$((PASSED + 1))
            if [[ "$VERBOSE" == "--verbose" ]]; then
                echo -e "${GREEN}✓${NC} $plugin_name: No index files (expected)"
            fi
        fi
    fi
done

echo ""
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo "  Plugins checked:       $TOTAL"
echo "  Plugins with CLAUDE.md: $plugins_with_claude"
echo "  Plugins with AGENTS.md: $plugins_with_agents"
echo "  Passed:                $PASSED"
echo "  Failed:                $FAILED"
echo "  Warnings:              $WARNINGS"
echo "=========================================="

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAILED plugins have AGENTS.md issues${NC}"
    echo ""
    echo "To fix:"
    echo "  1. Run 'npm run build' to regenerate plugins"
    echo "  2. Ensure generate-indexes.sh includes AGENTS.md generation"
    exit 1
elif [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}WARNING: $WARNINGS plugins have inconsistent index files${NC}"
    exit 0
else
    echo -e "${GREEN}SUCCESS: All plugins have proper cross-tool compatibility${NC}"
    exit 0
fi
