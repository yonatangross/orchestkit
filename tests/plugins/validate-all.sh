#!/usr/bin/env bash
# validate-all.sh - Comprehensive plugin validation suite
# Validates all 33 OrchestKit plugins against Claude Code marketplace standards

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
PLUGINS_DIR="$REPO_ROOT/plugins"
MARKETPLACE_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

log_check() { echo -e "${BLUE}[CHECK]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; PASSED_CHECKS=$((PASSED_CHECKS + 1)); TOTAL_CHECKS=$((TOTAL_CHECKS + 1)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; FAILED_CHECKS=$((FAILED_CHECKS + 1)); TOTAL_CHECKS=$((TOTAL_CHECKS + 1)); }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; WARNINGS=$((WARNINGS + 1)); }

# ============================================================================
# LAYER 1: Marketplace Validation
# ============================================================================
validate_marketplace() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  LAYER 1: Marketplace Validation"
    echo "═══════════════════════════════════════════════════════════════"

    # Check marketplace.json exists
    if [[ -f "$MARKETPLACE_JSON" ]]; then
        log_pass "marketplace.json exists at .claude-plugin/"
    else
        log_fail "marketplace.json not found at .claude-plugin/"
        return 1
    fi

    # Check valid JSON
    if jq empty "$MARKETPLACE_JSON" 2>/dev/null; then
        log_pass "marketplace.json is valid JSON"
    else
        log_fail "marketplace.json has invalid JSON syntax"
        return 1
    fi

    # Check required fields
    local name=$(jq -r '.name // empty' "$MARKETPLACE_JSON")
    if [[ -n "$name" ]]; then
        log_pass "marketplace has 'name' field: $name"
    else
        log_fail "marketplace missing 'name' field"
    fi

    local owner_name=$(jq -r '.owner.name // empty' "$MARKETPLACE_JSON")
    if [[ -n "$owner_name" ]]; then
        log_pass "marketplace has 'owner.name' field: $owner_name"
    else
        log_fail "marketplace missing 'owner.name' field"
    fi

    # Check plugins array
    local plugins_count=$(jq '.plugins | length' "$MARKETPLACE_JSON")
    if [[ "$plugins_count" -gt 0 ]]; then
        log_pass "marketplace has $plugins_count plugins defined"
    else
        log_fail "marketplace has no plugins defined"
    fi

    # Check for reserved names
    local reserved_names=("claude-code-marketplace" "claude-code-plugins" "claude-plugins-official" "anthropic-marketplace" "anthropic-plugins" "agent-skills")
    for reserved in "${reserved_names[@]}"; do
        if [[ "$name" == "$reserved" ]]; then
            log_fail "marketplace uses reserved name: $reserved"
        fi
    done
}

# ============================================================================
# LAYER 2: Plugin Structure Validation
# ============================================================================
validate_plugin_structure() {
    local plugin_dir="$1"
    local plugin_name=$(basename "$plugin_dir")

    echo ""
    echo "───────────────────────────────────────────────────────────────"
    echo "  Plugin: $plugin_name"
    echo "───────────────────────────────────────────────────────────────"

    # Check .claude-plugin/plugin.json exists
    if [[ -f "$plugin_dir/.claude-plugin/plugin.json" ]]; then
        log_pass "$plugin_name: .claude-plugin/plugin.json exists"
    else
        log_fail "$plugin_name: .claude-plugin/plugin.json MISSING"
        return 1
    fi

    # Check NO .claude directory (old structure)
    if [[ -d "$plugin_dir/.claude" ]]; then
        log_fail "$plugin_name: old .claude/ directory still exists"
    else
        log_pass "$plugin_name: no legacy .claude/ directory"
    fi

    # Check standard directories exist at root
    local dirs=("commands" "agents" "skills" "scripts")
    for dir in "${dirs[@]}"; do
        if [[ -d "$plugin_dir/$dir" ]]; then
            local count=$(find "$plugin_dir/$dir" -maxdepth 1 -type f -o -type d 2>/dev/null | wc -l)
            log_pass "$plugin_name: $dir/ exists ($count items)"
        else
            log_warn "$plugin_name: $dir/ directory missing (may be intentional)"
        fi
    done
}

# ============================================================================
# LAYER 3: Plugin.json Schema Validation
# ============================================================================
validate_plugin_json() {
    local plugin_json="$1"
    local plugin_name=$(basename "$(dirname "$(dirname "$plugin_json")")")

    # Check valid JSON
    if ! jq empty "$plugin_json" 2>/dev/null; then
        log_fail "$plugin_name: plugin.json has invalid JSON syntax"
        return 1
    fi

    # Check required 'name' field
    local name=$(jq -r '.name // empty' "$plugin_json")
    if [[ -n "$name" ]]; then
        log_pass "$plugin_name: has 'name' field"
    else
        log_fail "$plugin_name: missing required 'name' field"
    fi

    # Check version is semver-like
    local version=$(jq -r '.version // empty' "$plugin_json")
    if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+.*$ ]]; then
        log_pass "$plugin_name: version is semver ($version)"
    elif [[ -n "$version" ]]; then
        log_warn "$plugin_name: version '$version' may not be valid semver"
    fi

    # Check hook paths if hooks exist
    local has_hooks=$(jq 'has("hooks")' "$plugin_json")
    if [[ "$has_hooks" == "true" ]]; then
        # Check that hook paths use ${CLAUDE_PLUGIN_ROOT}
        local bad_paths=$(jq -r '.. | .command? // empty' "$plugin_json" | grep -v 'CLAUDE_PLUGIN_ROOT' || true)
        if [[ -z "$bad_paths" ]]; then
            log_pass "$plugin_name: all hook paths use \${CLAUDE_PLUGIN_ROOT}"
        else
            log_fail "$plugin_name: some hook paths don't use \${CLAUDE_PLUGIN_ROOT}"
        fi

        # Check that hook paths point to scripts/ not hooks/
        local hooks_paths=$(jq -r '.. | .command? // empty' "$plugin_json" | grep '/hooks/' || true)
        if [[ -z "$hooks_paths" ]]; then
            log_pass "$plugin_name: hook paths use scripts/ directory"
        else
            log_fail "$plugin_name: hook paths still reference hooks/ instead of scripts/"
            echo "  Found: $hooks_paths"
        fi
    fi
}

# ============================================================================
# LAYER 4: Skills Validation
# ============================================================================
validate_skills() {
    local plugin_dir="$1"
    local plugin_name=$(basename "$plugin_dir")

    if [[ ! -d "$plugin_dir/skills" ]]; then
        return 0
    fi

    local skill_count=0
    local valid_count=0

    for skill_dir in "$plugin_dir/skills"/*/; do
        if [[ -d "$skill_dir" ]]; then
            skill_count=$((skill_count + 1))
            local skill_name=$(basename "$skill_dir")

            # Check SKILL.md exists
            if [[ -f "$skill_dir/SKILL.md" ]]; then
                valid_count=$((valid_count + 1))

                # Check SKILL.md has frontmatter
                if head -1 "$skill_dir/SKILL.md" | grep -q '^---'; then
                    : # Has frontmatter
                else
                    log_warn "$plugin_name: $skill_name/SKILL.md missing frontmatter"
                fi
            else
                log_fail "$plugin_name: $skill_name/ missing SKILL.md"
            fi
        fi
    done

    if [[ $skill_count -gt 0 ]]; then
        log_pass "$plugin_name: $valid_count/$skill_count skills have SKILL.md"
    fi
}

# ============================================================================
# LAYER 5: Agents Validation
# ============================================================================
validate_agents() {
    local plugin_dir="$1"
    local plugin_name=$(basename "$plugin_dir")

    if [[ ! -d "$plugin_dir/agents" ]]; then
        return 0
    fi

    local agent_count=0
    local valid_count=0

    for agent_file in "$plugin_dir/agents"/*.md; do
        if [[ -f "$agent_file" ]]; then
            agent_count=$((agent_count + 1))
            local agent_name=$(basename "$agent_file" .md)

            # Check agent has frontmatter
            if head -1 "$agent_file" | grep -q '^---'; then
                valid_count=$((valid_count + 1))

                # Check required frontmatter fields
                local has_name=$(sed -n '/^---$/,/^---$/p' "$agent_file" | grep -c '^name:' || true)
                local has_desc=$(sed -n '/^---$/,/^---$/p' "$agent_file" | grep -c '^description:' || true)

                if [[ "$has_name" -eq 0 ]]; then
                    log_warn "$plugin_name: agent $agent_name missing 'name' in frontmatter"
                fi
                if [[ "$has_desc" -eq 0 ]]; then
                    log_warn "$plugin_name: agent $agent_name missing 'description' in frontmatter"
                fi
            else
                log_fail "$plugin_name: agent $agent_name missing frontmatter"
            fi
        fi
    done

    if [[ $agent_count -gt 0 ]]; then
        log_pass "$plugin_name: $valid_count/$agent_count agents have valid frontmatter"
    fi
}

# ============================================================================
# LAYER 6: Commands Validation
# ============================================================================
validate_commands() {
    local plugin_dir="$1"
    local plugin_name=$(basename "$plugin_dir")

    if [[ ! -d "$plugin_dir/commands" ]]; then
        return 0
    fi

    local cmd_count=$(find "$plugin_dir/commands" -name "*.md" -type f 2>/dev/null | wc -l)
    if [[ $cmd_count -gt 0 ]]; then
        log_pass "$plugin_name: $cmd_count command(s) found"
    fi
}

# ============================================================================
# LAYER 7: Scripts Validation
# ============================================================================
validate_scripts() {
    local plugin_dir="$1"
    local plugin_name=$(basename "$plugin_dir")

    if [[ ! -d "$plugin_dir/scripts" ]]; then
        return 0
    fi

    local script_count=0
    local executable_count=0
    local shebang_count=0

    for script in "$plugin_dir/scripts"/*.sh; do
        if [[ -f "$script" ]]; then
            script_count=$((script_count + 1))

            # Check executable
            if [[ -x "$script" ]]; then
                executable_count=$((executable_count + 1))
            else
                log_warn "$plugin_name: $(basename "$script") not executable"
            fi

            # Check shebang
            if head -1 "$script" | grep -q '^#!'; then
                shebang_count=$((shebang_count + 1))
            else
                log_warn "$plugin_name: $(basename "$script") missing shebang"
            fi
        fi
    done

    if [[ $script_count -gt 0 ]]; then
        log_pass "$plugin_name: $script_count scripts ($executable_count executable, $shebang_count with shebang)"
    fi
}

# ============================================================================
# LAYER 8: Cross-Reference Validation
# ============================================================================
validate_cross_references() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  LAYER 8: Cross-Reference Validation"
    echo "═══════════════════════════════════════════════════════════════"

    # Check each marketplace plugin entry has corresponding directory
    local plugins=$(jq -r '.plugins[].name' "$MARKETPLACE_JSON")
    for plugin_name in $plugins; do
        local source=$(jq -r ".plugins[] | select(.name == \"$plugin_name\") | .source" "$MARKETPLACE_JSON")
        local full_path="$REPO_ROOT/${source#./}"

        if [[ -d "$full_path" ]]; then
            log_pass "Marketplace entry '$plugin_name' → directory exists"
        else
            log_fail "Marketplace entry '$plugin_name' → directory MISSING ($full_path)"
        fi
    done

    # Check each plugin directory is in marketplace
    for plugin_dir in "$PLUGINS_DIR"/ork-*; do
        if [[ -d "$plugin_dir" ]]; then
            local dir_name=$(basename "$plugin_dir")
            local in_marketplace=$(jq -r ".plugins[] | select(.name == \"$dir_name\") | .name // empty" "$MARKETPLACE_JSON")

            if [[ -n "$in_marketplace" ]]; then
                log_pass "Plugin directory '$dir_name' → in marketplace"
            else
                log_warn "Plugin directory '$dir_name' → NOT in marketplace"
            fi
        fi
    done
}

# ============================================================================
# Main Execution
# ============================================================================
main() {
    echo "══════════════════════════════════════════════════════════════════════"
    echo "  OrchestKit Plugin Validation Suite"
    echo "  Standards: code.claude.com/docs/en/plugins-reference"
    echo "══════════════════════════════════════════════════════════════════════"

    # Layer 1: Marketplace
    validate_marketplace

    # Layer 2-7: Each Plugin
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  LAYERS 2-7: Per-Plugin Validation"
    echo "═══════════════════════════════════════════════════════════════"

    for plugin_dir in "$PLUGINS_DIR"/ork-*; do
        if [[ -d "$plugin_dir" ]]; then
            plugin_name=$(basename "$plugin_dir")
            if [[ -f "$plugin_dir/.codex-plugin/plugin.json" || -f "$plugin_dir/.cursor-plugin/plugin.json" ]]; then
                host_json="$plugin_dir/.codex-plugin/plugin.json"
                if [[ ! -f "$host_json" ]]; then
                    host_json="$plugin_dir/.cursor-plugin/plugin.json"
                fi
                log_pass "$plugin_name: host-native adapter (skip Claude marketplace structure)"
                validate_plugin_json "$host_json"
                validate_skills "$plugin_dir"
                continue
            fi
            validate_plugin_structure "$plugin_dir"
            validate_plugin_json "$plugin_dir/.claude-plugin/plugin.json"
            validate_skills "$plugin_dir"
            validate_agents "$plugin_dir"
            validate_commands "$plugin_dir"
            validate_scripts "$plugin_dir"
        fi
    done

    # Layer 8: Cross-references
    validate_cross_references

    # Summary
    echo ""
    echo "══════════════════════════════════════════════════════════════════════"
    echo "  VALIDATION SUMMARY"
    echo "══════════════════════════════════════════════════════════════════════"
    echo -e "  Total Checks: ${BLUE}$TOTAL_CHECKS${NC}"
    echo -e "  Passed:       ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "  Failed:       ${RED}$FAILED_CHECKS${NC}"
    echo -e "  Warnings:     ${YELLOW}$WARNINGS${NC}"
    echo ""

    if [[ $FAILED_CHECKS -gt 0 ]]; then
        echo -e "${RED}VALIDATION FAILED${NC} - $FAILED_CHECKS issue(s) must be fixed"
        exit 1
    else
        echo -e "${GREEN}VALIDATION PASSED${NC} - All checks successful"
        exit 0
    fi
}

main "$@"
