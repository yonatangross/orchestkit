#!/usr/bin/env bash
# test-plugin-schema.sh - Validate plugin.json schema compliance for ALL plugins
# Ensures all plugin.json files conform to Claude Code's expected schema
#
# Based on official CC plugin format:
# - Required fields: name, version, description
# - Optional fields: author, homepage, repository, license, hooks, lspServers, keywords
# - Invalid fields: engine (only allowed in marketplace.json root)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

total_errors=0
total_warnings=0
plugins_validated=0

log_error() {
    echo -e "${RED}ERROR:${NC} $*"
    ((total_errors++)) || true
}

log_warning() {
    echo -e "${YELLOW}WARNING:${NC} $*"
    ((total_warnings++)) || true
}

log_success() {
    echo -e "${GREEN}OK:${NC} $*"
}

log_info() {
    echo "INFO: $*"
}

log_plugin() {
    echo -e "${BLUE}=== $* ===${NC}"
}

# Validate a single plugin.json file
validate_plugin() {
    local plugin_file="$1"
    local plugin_name="$2"
    local errors=0

    # 1. Validate JSON syntax
    if ! jq empty "$plugin_file" 2>/dev/null; then
        log_error "[$plugin_name] Invalid JSON syntax"
        return 1
    fi

    # 2. Check required fields
    for field in name version description; do
        value=$(jq -r ".$field // empty" "$plugin_file")
        if [[ -z "$value" ]]; then
            log_error "[$plugin_name] Missing required field: $field"
            ((errors++)) || true
        fi
    done

    # 3. Validate version format (semver)
    version=$(jq -r '.version // ""' "$plugin_file")
    if [[ -n "$version" && ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$ ]]; then
        log_error "[$plugin_name] Invalid version format: '$version'"
        ((errors++)) || true
    fi

    # 4. Check for INVALID fields
    # engine is NOT allowed in plugin.json (only in marketplace.json root)
    if jq -e '.engine' "$plugin_file" >/dev/null 2>&1; then
        log_error "[$plugin_name] 'engine' field is not allowed in plugin.json"
        ((errors++)) || true
    fi

    # 5. Validate hooks structure (if present)
    if jq -e '.hooks' "$plugin_file" >/dev/null 2>&1; then
        hooks_type=$(jq -r '.hooks | type' "$plugin_file")
        if [[ "$hooks_type" != "object" ]]; then
            log_error "[$plugin_name] 'hooks' should be an object, got $hooks_type"
            ((errors++)) || true
        else
            # Check that hook events are valid
            valid_events='["PreToolUse", "PostToolUse", "PermissionRequest", "UserPromptSubmit", "SessionStart", "SessionEnd", "PreCompact", "PostCompact", "Stop", "StopFailure", "SubagentStart", "SubagentStop", "Notification", "Setup", "TeammateIdle", "TaskCompleted", "TaskCreated", "WorktreeCreate", "WorktreeRemove", "ConfigChange", "InstructionsLoaded", "Elicitation", "ElicitationResult"]'
            invalid_events=$(jq -r --argjson valid "$valid_events" '.hooks | keys | map(select(. as $k | $valid | index($k) | not)) | .[]' "$plugin_file" 2>/dev/null || true)
            if [[ -n "$invalid_events" ]]; then
                while IFS= read -r event; do
                    [[ -n "$event" ]] && log_warning "[$plugin_name] Unknown hook event: '$event'"
                done <<< "$invalid_events"
            fi
        fi
    fi

    if [[ $errors -eq 0 ]]; then
        log_success "[$plugin_name] Valid"
    fi

    return $errors
}

echo "========================================"
echo "  Plugin.json Schema Validation"
echo "  (All Plugins in Marketplace)"
echo "========================================"
echo ""

# 1. Validate root plugin.json
echo "1. Validating root plugin..."
ROOT_PLUGIN="${ROOT_DIR}/.claude-plugin/plugin.json"
if [[ -f "$ROOT_PLUGIN" ]]; then
    log_plugin "Root Plugin (ork)"
    if validate_plugin "$ROOT_PLUGIN" "root"; then
        ((plugins_validated++)) || true
    fi
else
    log_warning "No root plugin.json found"
fi

# 2. Validate all modular plugins
echo ""
echo "2. Validating modular plugins..."
for plugin_dir in "${ROOT_DIR}"/plugins/ork-*/; do
    [[ -d "$plugin_dir" ]] || continue
    plugin_name=$(basename "$plugin_dir")

    # Check both possible locations for plugin.json
    if [[ -f "$plugin_dir/.claude-plugin/plugin.json" ]]; then
        plugin_file="$plugin_dir/.claude-plugin/plugin.json"
    elif [[ -f "$plugin_dir/plugin.json" ]]; then
        plugin_file="$plugin_dir/plugin.json"
    else
        log_warning "[$plugin_name] No plugin.json found"
        continue
    fi

    log_plugin "$plugin_name"
    if validate_plugin "$plugin_file" "$plugin_name"; then
        ((plugins_validated++)) || true
    fi
done

# 3. Summary
echo ""
echo "========================================"
echo "  Validation Summary"
echo "========================================"
echo ""
echo "Plugins validated: $plugins_validated"
echo "Total errors: $total_errors"
echo "Total warnings: $total_warnings"
echo ""

if [[ $total_errors -gt 0 ]]; then
    echo -e "${RED}FAILED: $total_errors errors found across plugins${NC}"
    exit 1
fi

if [[ $total_warnings -gt 0 ]]; then
    echo -e "${YELLOW}PASSED with $total_warnings warnings${NC}"
else
    echo -e "${GREEN}PASSED: All $plugins_validated plugins validated successfully${NC}"
fi

exit 0
