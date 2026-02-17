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
TOTAL_COMMANDS_GENERATED=0

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}        OrchestKit Plugin Build System v2.4.0${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# ============================================================================
# Function: Generate command file from user-invocable skill
# ============================================================================
# Workaround for CC bug: https://github.com/anthropics/claude-code/issues/20802
# CC doesn't discover skills with user-invocable: true, only commands/*.md
generate_command_from_skill() {
    local skill_md="$1"
    local command_file="$2"
    local skill_name="$3"

    # Extract frontmatter (lines between first --- and second ---)
    local frontmatter=$(sed -n '2,/^---$/p' "$skill_md" | sed '$d')

    # Extract description from frontmatter
    local description=$(echo "$frontmatter" | grep -E "^description:" | sed 's/^description: *//')

    # Extract allowed tools from frontmatter
    local allowed_tools=$(echo "$frontmatter" | grep -E "^allowed-tools:" | sed 's/^allowed-tools: *//')

    # Default allowed tools if not specified
    if [[ -z "$allowed_tools" ]]; then
        allowed_tools="[Bash, Read, Write, Edit, Glob, Grep]"
    fi

    # Generate command file with frontmatter + skill content
    {
        echo "---"
        echo "description: $description"
        echo "allowed-tools: $allowed_tools"
        echo "---"
        echo ""
        echo "# Auto-generated from skills/$skill_name/SKILL.md"
        echo "# Source: https://github.com/yonatangross/orchestkit"
        echo ""
        # Skip the frontmatter from skill and include the rest (after second ---)
        awk 'BEGIN{c=0} /^---$/{c++; next} c>=2{print}' "$skill_md"
    } > "$command_file"
}

# ============================================================================
# Phase 1: Validate Environment
# ============================================================================
echo -e "${BLUE}[1/10] Validating environment...${NC}"

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
echo -e "${BLUE}[2/10] Cleaning previous build...${NC}"

# Clean contents but keep the directory — rm -rf on the dir itself fails
# on macOS when com.apple.provenance extended attribute is set (sandbox).
if [[ -d "$PLUGINS_DIR" ]]; then
  find "$PLUGINS_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
fi
mkdir -p "$PLUGINS_DIR"
echo -e "${GREEN}  Cleaned plugins/ directory${NC}"
echo ""

# ============================================================================
# Phase 3: Build Plugins from Manifests
# ============================================================================
echo -e "${BLUE}[3/10] Building plugins from manifests...${NC}"
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
    command_count=0

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

    # Generate commands from user-invocable skills
    # Workaround for CC bug #20802 - CC doesn't discover skills, only commands/
    if [[ -d "$PLUGIN_DIR/skills" ]]; then
        for skill_md in "$PLUGIN_DIR/skills"/*/SKILL.md; do
            [[ ! -f "$skill_md" ]] && continue
            if grep -q "^user-invocable: *true" "$skill_md"; then
                skill_name=$(dirname "$skill_md" | xargs basename)
                mkdir -p "$PLUGIN_DIR/commands"
                generate_command_from_skill "$skill_md" "$PLUGIN_DIR/commands/$skill_name.md" "$skill_name"
                command_count=$((command_count + 1))
            fi
        done
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
        rsync -a \
            --exclude='node_modules' \
            --exclude='.claude' \
            --exclude='coverage' \
            --exclude='src' \
            --exclude='logs' \
            --exclude='.instance' \
            --exclude='__tests__' \
            --exclude='TEST_REPORT.md' \
            --exclude='IMPROVEMENT-PLAN.md' \
            --exclude='.gitignore' \
            --exclude='package-lock.json' \
            "$SRC_DIR/hooks/" "$PLUGIN_DIR/hooks/"
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
        [[ -d "$PLUGIN_DIR/commands" ]] && echo '  ,"commands": "./commands/"'
        # Note: "hooks" field not needed - CC auto-discovers hooks/hooks.json
        # Note: "agents" field removed - Claude Code doesn't support this field
        # Agents are auto-discovered from the agents/ directory
        echo '}'
    } > "$PLUGIN_DIR/.claude-plugin/plugin.json"

    TOTAL_SKILLS_COPIED=$((TOTAL_SKILLS_COPIED + skill_count))
    TOTAL_AGENTS_COPIED=$((TOTAL_AGENTS_COPIED + agent_count))
    TOTAL_COMMANDS_GENERATED=$((TOTAL_COMMANDS_GENERATED + command_count))
    PLUGINS_BUILT=$((PLUGINS_BUILT + 1))

    echo -e "${GREEN}  Built $PLUGIN_NAME ($CURRENT/$MANIFEST_COUNT) - $skill_count skills, $agent_count agents, $command_count commands${NC}"
done

echo ""

# ============================================================================
# Phase 4: Validate Built Plugins
# ============================================================================
echo -e "${BLUE}[4/10] Validating built plugins...${NC}"

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
# Phase 5: Validate Plugin Dependencies
# ============================================================================
echo -e "${BLUE}[5/10] Validating plugin dependencies...${NC}"

DEP_WARNINGS=0
DEP_CHECKED=0

for manifest in "$MANIFESTS_DIR"/*.json; do
    [[ ! -f "$manifest" ]] && continue

    PLUGIN_NAME=$(jq -r '.name' "$manifest")
    DEPS=$(jq -r '.dependencies[]? // empty' "$manifest" 2>/dev/null)

    if [[ -z "$DEPS" ]]; then
        continue
    fi

    while IFS= read -r dep; do
        [[ -z "$dep" ]] && continue
        DEP_CHECKED=$((DEP_CHECKED + 1))

        # Check if dependency manifest exists
        DEP_MANIFEST="$MANIFESTS_DIR/${dep}.json"
        if [[ ! -f "$DEP_MANIFEST" ]]; then
            echo -e "${YELLOW}  WARNING: $PLUGIN_NAME depends on '$dep' but no manifest found${NC}"
            DEP_WARNINGS=$((DEP_WARNINGS + 1))
        fi
    done <<< "$DEPS"
done

if [[ $DEP_WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}  $DEP_WARNINGS dependency warnings (of $DEP_CHECKED checked)${NC}"
else
    echo -e "${GREEN}  All $DEP_CHECKED dependencies resolved${NC}"
fi

echo ""

# ============================================================================
# Phase 6: Generate Passive Indexes (Tier 1 + Tier 2)
# ============================================================================
echo -e "${BLUE}[6/10] Generating passive indexes...${NC}"

if [[ -f "$SCRIPT_DIR/generate-indexes.js" ]]; then
    node "$SCRIPT_DIR/generate-indexes.js"
else
    echo -e "${YELLOW}  generate-indexes.js not found, skipping${NC}"
fi

echo ""

# ============================================================================
# Phase 7: Generate Docs Site Data
# ============================================================================
echo -e "${BLUE}[7/10] Generating docs site data...${NC}"

if [[ -f "$SCRIPT_DIR/generate-docs-data.js" ]]; then
    node "$SCRIPT_DIR/generate-docs-data.js" 2>/dev/null || echo -e "${YELLOW}  generate-docs-data.js failed, skipping${NC}"
else
    echo -e "${YELLOW}  generate-docs-data.js not found, skipping${NC}"
fi

echo ""

# ============================================================================
# Phase 8: Regenerate Fumadocs reference pages
# ============================================================================
echo -e "${BLUE}[8/10] Regenerating docs reference pages...${NC}"

if [[ -x "$SCRIPT_DIR/build-docs.sh" ]]; then
    bash "$SCRIPT_DIR/build-docs.sh" 2>/dev/null || echo -e "${YELLOW}  build-docs.sh failed, skipping${NC}"
else
    echo -e "${YELLOW}  build-docs.sh not found or not executable, skipping${NC}"
fi

# Generate changelog timeline data
if [[ -f "$SCRIPT_DIR/generate-changelog-data.js" ]]; then
    node "$SCRIPT_DIR/generate-changelog-data.js" 2>/dev/null || echo -e "${YELLOW}  generate-changelog-data.js failed, skipping${NC}"
else
    echo -e "${YELLOW}  generate-changelog-data.js not found, skipping${NC}"
fi

echo ""

# ============================================================================
# Phase 9: Sync marketplace.json versions from manifests
# ============================================================================
echo -e "${BLUE}[9/10] Syncing marketplace.json...${NC}"

MARKETPLACE_FILE="$PROJECT_ROOT/.claude-plugin/marketplace.json"
if [[ -f "$MARKETPLACE_FILE" ]]; then
  # Use the top-level project version for ALL plugin entries
  PROJECT_VERSION=$(jq -r '.version' "$MARKETPLACE_FILE")
  VER_SYNC_COUNT=0

  for manifest in "$MANIFESTS_DIR"/*.json; do
    PLUGIN_NAME=$(jq -r '.name' "$manifest")

    # Set version to project version
    CURRENT_VERSION=$(jq -r --arg name "$PLUGIN_NAME" '.plugins[] | select(.name == $name) | .version' "$MARKETPLACE_FILE" 2>/dev/null || echo "")
    if [[ -n "$CURRENT_VERSION" && "$CURRENT_VERSION" != "$PROJECT_VERSION" ]]; then
      jq --arg name "$PLUGIN_NAME" --arg ver "$PROJECT_VERSION" \
        '(.plugins[] | select(.name == $name)).version = $ver' \
        "$MARKETPLACE_FILE" > "${MARKETPLACE_FILE}.tmp" && mv "${MARKETPLACE_FILE}.tmp" "$MARKETPLACE_FILE"
      VER_SYNC_COUNT=$((VER_SYNC_COUNT + 1))
    fi
  done

  # NOTE: Dependencies are tracked in manifests/*.json for internal use only.
  # They must NOT be written to marketplace.json — Claude Code's schema validator
  # rejects unrecognized keys like "deps".

  echo -e "${GREEN}  Versions: synced $VER_SYNC_COUNT to $PROJECT_VERSION${NC}"
else
  echo -e "${YELLOW}  No marketplace.json found, skipping${NC}"
fi

echo ""

# ============================================================================
# Phase 10: Summary
# ============================================================================
echo -e "${BLUE}[10/10] Build Summary${NC}"
echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}                    BUILD COMPLETE${NC}"
echo -e "${CYAN}============================================================${NC}"
echo -e "  Plugins built:          ${GREEN}$PLUGINS_BUILT${NC}"
echo -e "  Total skills copied:    ${GREEN}$TOTAL_SKILLS_COPIED${NC}"
echo -e "  Total agents copied:    ${GREEN}$TOTAL_AGENTS_COPIED${NC}"
echo -e "  Total commands generated: ${GREEN}$TOTAL_COMMANDS_GENERATED${NC}"
echo -e "  Output directory:       ${GREEN}$PLUGINS_DIR${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""
