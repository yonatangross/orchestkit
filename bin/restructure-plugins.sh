#!/usr/bin/env bash
# restructure-plugins.sh - Migrate plugins to Claude Code compliant structure
#
# TARGET (per code.claude.com/docs/en/plugins-reference):
#   plugins/ork-*/
#   ├── .claude-plugin/
#   │   └── plugin.json
#   ├── commands/
#   ├── agents/
#   ├── skills/
#   └── scripts/         # Hook shell scripts (flattened)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PLUGINS_DIR="$REPO_ROOT/plugins"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

PLUGINS_PROCESSED=0
PLUGINS_SUCCESS=0
PLUGINS_FAILED=0

restructure_plugin() {
    local plugin_dir="$1"
    local plugin_name=$(basename "$plugin_dir")

    log_info "Processing: $plugin_name"

    # Check if already restructured
    if [[ -d "$plugin_dir/.claude-plugin" ]] && [[ ! -d "$plugin_dir/.claude" ]]; then
        log_warn "  Already restructured, skipping"
        return 0
    fi

    # Step 1: Create .claude-plugin directory
    mkdir -p "$plugin_dir/.claude-plugin"
    log_success "  Created .claude-plugin/"

    # Step 2: Move plugin.json to .claude-plugin/
    if [[ -f "$plugin_dir/plugin.json" ]]; then
        mv "$plugin_dir/plugin.json" "$plugin_dir/.claude-plugin/plugin.json"
        log_success "  Moved plugin.json → .claude-plugin/"
    fi

    # Step 3: Move components from .claude/ to root
    if [[ -d "$plugin_dir/.claude" ]]; then
        # Move agents
        if [[ -d "$plugin_dir/.claude/agents" ]] && [[ -n "$(ls -A "$plugin_dir/.claude/agents" 2>/dev/null)" ]]; then
            mkdir -p "$plugin_dir/agents"
            cp -r "$plugin_dir/.claude/agents/"* "$plugin_dir/agents/" 2>/dev/null || true
            rm -rf "$plugin_dir/.claude/agents"
            log_success "  Moved .claude/agents → agents/"
        fi

        # Move skills
        if [[ -d "$plugin_dir/.claude/skills" ]] && [[ -n "$(ls -A "$plugin_dir/.claude/skills" 2>/dev/null)" ]]; then
            mkdir -p "$plugin_dir/skills"
            cp -r "$plugin_dir/.claude/skills/"* "$plugin_dir/skills/" 2>/dev/null || true
            rm -rf "$plugin_dir/.claude/skills"
            log_success "  Moved .claude/skills → skills/"
        fi

        # Move hooks scripts to scripts/ (flattened)
        if [[ -d "$plugin_dir/.claude/hooks" ]]; then
            mkdir -p "$plugin_dir/scripts"

            # Find all .sh files and copy to scripts/ with flattened names
            while IFS= read -r -d '' script; do
                # Get relative path from hooks dir
                rel_path="${script#$plugin_dir/.claude/hooks/}"
                # Flatten: lifecycle/session-start.sh → lifecycle-session-start.sh
                flat_name=$(echo "$rel_path" | tr '/' '-')
                cp "$script" "$plugin_dir/scripts/$flat_name"
            done < <(find "$plugin_dir/.claude/hooks" -name "*.sh" -type f -print0 2>/dev/null)

            rm -rf "$plugin_dir/.claude/hooks"
            log_success "  Moved hook scripts → scripts/"
        fi

        # Move commands if present
        if [[ -d "$plugin_dir/.claude/commands" ]] && [[ -n "$(ls -A "$plugin_dir/.claude/commands" 2>/dev/null)" ]]; then
            mkdir -p "$plugin_dir/commands"
            cp -r "$plugin_dir/.claude/commands/"* "$plugin_dir/commands/" 2>/dev/null || true
            rm -rf "$plugin_dir/.claude/commands"
            log_success "  Moved .claude/commands → commands/"
        fi

        # Remove .claude directory
        rm -rf "$plugin_dir/.claude"
        log_success "  Removed .claude/"
    fi

    # Step 4: Ensure required directories exist
    mkdir -p "$plugin_dir/commands"
    mkdir -p "$plugin_dir/agents"
    mkdir -p "$plugin_dir/skills"
    mkdir -p "$plugin_dir/scripts"

    log_success "  $plugin_name restructured"
    return 0
}

update_all_plugin_json() {
    log_info "Updating plugin.json hook paths..."

    for plugin_json in "$PLUGINS_DIR"/ork-*/.claude-plugin/plugin.json; do
        if [[ -f "$plugin_json" ]]; then
            local plugin_name=$(basename "$(dirname "$(dirname "$plugin_json")")")

            # Update paths using sed
            # /hooks/xxx/yyy.sh → /scripts/xxx-yyy.sh
            if grep -q '/hooks/' "$plugin_json" 2>/dev/null; then
                # macOS sed requires different syntax
                if [[ "$(uname)" == "Darwin" ]]; then
                    sed -i '' 's|/hooks/\([^/]*\)/\([^"/]*\)\.sh|/scripts/\1-\2.sh|g' "$plugin_json"
                    # Also handle nested paths like /hooks/lifecycle/session-start/xxx.sh
                    sed -i '' 's|/hooks/\([^/]*\)/\([^/]*\)/\([^"/]*\)\.sh|/scripts/\1-\2-\3.sh|g' "$plugin_json"
                else
                    sed -i 's|/hooks/\([^/]*\)/\([^"/]*\)\.sh|/scripts/\1-\2.sh|g' "$plugin_json"
                    sed -i 's|/hooks/\([^/]*\)/\([^/]*\)/\([^"/]*\)\.sh|/scripts/\1-\2-\3.sh|g' "$plugin_json"
                fi
                log_success "  Updated paths in $plugin_name"
            fi
        fi
    done
}

main() {
    echo "=================================================="
    echo "  OrchestKit Plugin Restructure Migration"
    echo "  Target: Claude Code compliant structure"
    echo "=================================================="
    echo ""

    if [[ ! -d "$PLUGINS_DIR" ]]; then
        log_error "Plugins directory not found: $PLUGINS_DIR"
        exit 1
    fi

    # Process each plugin
    for plugin_dir in "$PLUGINS_DIR"/ork-*; do
        if [[ -d "$plugin_dir" ]]; then
            PLUGINS_PROCESSED=$((PLUGINS_PROCESSED + 1))
            if restructure_plugin "$plugin_dir"; then
                PLUGINS_SUCCESS=$((PLUGINS_SUCCESS + 1))
            else
                PLUGINS_FAILED=$((PLUGINS_FAILED + 1))
                log_error "Failed: $(basename "$plugin_dir")"
            fi
            echo ""
        fi
    done

    # Update plugin.json files
    update_all_plugin_json

    # Summary
    echo ""
    echo "=================================================="
    echo "  Migration Complete"
    echo "=================================================="
    echo "  Processed: $PLUGINS_PROCESSED"
    echo "  Success:   $PLUGINS_SUCCESS"
    echo "  Failed:    $PLUGINS_FAILED"
    echo ""

    if [[ $PLUGINS_FAILED -gt 0 ]]; then
        exit 1
    fi
}

main "$@"
