#!/usr/bin/env bash
# ============================================================================
# OrchestKit Plugin Build Script
# ============================================================================
# Assembles plugin directories from source files and manifest definitions.
# Each plugin gets real directories (no symlinks) for Claude Code compatibility.
#
# Usage:
#   ./scripts/build-plugins.sh
#   npm run build
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$PROJECT_ROOT/src"
MANIFESTS_DIR="$PROJECT_ROOT/manifests"
PLUGINS_DIR="$PROJECT_ROOT/plugins"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Stats
PLUGINS_BUILT=0
TOTAL_SKILLS_COPIED=0
TOTAL_AGENTS_COPIED=0

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}        OrchestKit Plugin Build System v2.0.0${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# ============================================================================
# Phase 1: Validate Environment
# ============================================================================
echo -e "${BLUE}[1/5] Validating environment...${NC}"

if [[ ! -d "$SRC_DIR" ]]; then
    echo -e "${RED}Error: src/ directory not found${NC}"
    exit 1
fi

if [[ ! -d "$MANIFESTS_DIR" ]]; then
    echo -e "${RED}Error: manifests/ directory not found${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    exit 1
fi

# Count manifests
MANIFEST_COUNT=$(find "$MANIFESTS_DIR" -name "*.json" -type f | wc -l | tr -d ' ')
echo -e "${GREEN}  Found $MANIFEST_COUNT manifests${NC}"
echo ""

# ============================================================================
# Phase 2: Clean Previous Build
# ============================================================================
echo -e "${BLUE}[2/5] Cleaning previous build...${NC}"

rm -rf "$PLUGINS_DIR"
mkdir -p "$PLUGINS_DIR"
echo -e "${GREEN}  Cleaned plugins/ directory${NC}"
echo ""

# ============================================================================
# Phase 3: Build Plugins from Manifests
# ============================================================================
echo -e "${BLUE}[3/5] Building plugins from manifests...${NC}"
echo ""

CURRENT=0
for manifest in "$MANIFESTS_DIR"/*.json; do
    [[ ! -f "$manifest" ]] && continue

    CURRENT=$((CURRENT + 1))

    # Parse manifest
    PLUGIN_NAME=$(jq -r '.name' "$manifest")
    PLUGIN_VERSION=$(jq -r '.version' "$manifest")
    PLUGIN_DESC=$(jq -r '.description' "$manifest")

    # Detect skills mode (array vs string)
    SKILLS_TYPE=$(jq -r '.skills | type' "$manifest")
    if [[ "$SKILLS_TYPE" == "array" ]]; then
        SKILLS_MODE="array"
    else
        SKILLS_MODE=$(jq -r '.skills // "none"' "$manifest")
    fi

    # Detect agents mode (array vs string)
    AGENTS_TYPE=$(jq -r '.agents | type' "$manifest")
    if [[ "$AGENTS_TYPE" == "array" ]]; then
        AGENTS_MODE="array"
    else
        AGENTS_MODE=$(jq -r '.agents // "none"' "$manifest")
    fi

    HOOKS_MODE=$(jq -r '.hooks // "none"' "$manifest")

    # Skip invalid manifests
    if [[ -z "$PLUGIN_NAME" ]] || [[ "$PLUGIN_NAME" == "null" ]]; then
        echo -e "${YELLOW}  Skipping invalid manifest: $(basename "$manifest")${NC}"
        continue
    fi

    PLUGIN_DIR="$PLUGINS_DIR/$PLUGIN_NAME"
    mkdir -p "$PLUGIN_DIR/.claude-plugin"

    skill_count=0
    agent_count=0

    # Copy skills
    if [[ "$SKILLS_MODE" == "all" ]]; then
        cp -R "$SRC_DIR/skills" "$PLUGIN_DIR/"
        skill_count=$(find "$PLUGIN_DIR/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
    elif [[ "$SKILLS_MODE" == "array" ]]; then
        mkdir -p "$PLUGIN_DIR/skills"
        while IFS= read -r skill; do
            if [[ -n "$skill" ]] && [[ -d "$SRC_DIR/skills/$skill" ]]; then
                cp -R "$SRC_DIR/skills/$skill" "$PLUGIN_DIR/skills/"
                skill_count=$((skill_count + 1))
            fi
        done < <(jq -r '.skills[]?' "$manifest")
    fi

    # Copy agents
    if [[ "$AGENTS_MODE" == "all" ]]; then
        cp -R "$SRC_DIR/agents" "$PLUGIN_DIR/"
        agent_count=$(find "$PLUGIN_DIR/agents" -mindepth 1 -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')
    elif [[ "$AGENTS_MODE" == "array" ]]; then
        mkdir -p "$PLUGIN_DIR/agents"
        while IFS= read -r agent; do
            if [[ -n "$agent" ]] && [[ -f "$SRC_DIR/agents/${agent}.md" ]]; then
                cp "$SRC_DIR/agents/${agent}.md" "$PLUGIN_DIR/agents/"
                agent_count=$((agent_count + 1))
            fi
        done < <(jq -r '.agents[]?' "$manifest")
    fi

    # Copy hooks (excluding node_modules)
    if [[ "$HOOKS_MODE" == "all" ]]; then
        rsync -a --exclude='node_modules' "$SRC_DIR/hooks/" "$PLUGIN_DIR/hooks/"
    fi

    # Copy shared resources if they exist
    if [[ -d "$SRC_DIR/shared" ]]; then
        cp -R "$SRC_DIR/shared" "$PLUGIN_DIR/"
    fi

    # Generate plugin.json
    {
        echo '{'
        echo "  \"name\": \"$PLUGIN_NAME\","
        echo "  \"version\": \"$PLUGIN_VERSION\","
        echo "  \"description\": \"$PLUGIN_DESC\","
        echo '  "author": {'
        echo '    "name": "Yonatan Gross",'
        echo '    "email": "yonatan2gross@gmail.com",'
        echo '    "url": "https://github.com/yonatangross/orchestkit"'
        echo '  },'
        echo '  "homepage": "https://github.com/yonatangross/orchestkit",'
        echo '  "repository": "https://github.com/yonatangross/orchestkit",'
        echo '  "license": "MIT",'
        echo '  "keywords": ["ai-development", "langgraph", "fastapi", "react", "typescript", "python", "multi-agent"]'
        [[ -d "$PLUGIN_DIR/skills" ]] && echo '  ,"skills": "./skills/"'
        # Note: "hooks" field not needed - CC auto-discovers hooks/hooks.json
        # Note: "agents" field removed - Claude Code doesn't support this field
        # Agents are auto-discovered from the agents/ directory
        echo '}'
    } > "$PLUGIN_DIR/.claude-plugin/plugin.json"

    TOTAL_SKILLS_COPIED=$((TOTAL_SKILLS_COPIED + skill_count))
    TOTAL_AGENTS_COPIED=$((TOTAL_AGENTS_COPIED + agent_count))
    PLUGINS_BUILT=$((PLUGINS_BUILT + 1))

    echo -e "${GREEN}  Built $PLUGIN_NAME ($CURRENT/$MANIFEST_COUNT) - $skill_count skills, $agent_count agents${NC}"
done

echo ""

# ============================================================================
# Phase 4: Validate Built Plugins
# ============================================================================
echo -e "${BLUE}[4/5] Validating built plugins...${NC}"

VALIDATION_ERRORS=0

for plugin_dir in "$PLUGINS_DIR"/*; do
    [[ ! -d "$plugin_dir" ]] && continue

    plugin_name=$(basename "$plugin_dir")

    # Check plugin.json exists
    if [[ ! -f "$plugin_dir/.claude-plugin/plugin.json" ]]; then
        echo -e "${RED}  $plugin_name: Missing plugin.json${NC}"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        continue
    fi

    # Validate JSON syntax
    if ! jq empty "$plugin_dir/.claude-plugin/plugin.json" 2>/dev/null; then
        echo -e "${RED}  $plugin_name: Invalid JSON${NC}"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        continue
    fi

    # Check for symlinks (should be none)
    if find "$plugin_dir" -type l | grep -q .; then
        echo -e "${RED}  $plugin_name: Contains symlinks${NC}"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        continue
    fi
done

if [[ $VALIDATION_ERRORS -gt 0 ]]; then
    echo -e "${RED}Build failed with $VALIDATION_ERRORS validation errors${NC}"
    exit 1
fi

echo -e "${GREEN}  All $PLUGINS_BUILT plugins validated${NC}"
echo ""

# ============================================================================
# Phase 5: Summary
# ============================================================================
echo -e "${BLUE}[5/5] Build Summary${NC}"
echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}                    BUILD COMPLETE${NC}"
echo -e "${CYAN}============================================================${NC}"
echo -e "  Plugins built:       ${GREEN}$PLUGINS_BUILT${NC}"
echo -e "  Total skills copied: ${GREEN}$TOTAL_SKILLS_COPIED${NC}"
echo -e "  Total agents copied: ${GREEN}$TOTAL_AGENTS_COPIED${NC}"
echo -e "  Output directory:    ${GREEN}$PLUGINS_DIR${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""
