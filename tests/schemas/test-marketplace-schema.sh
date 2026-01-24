#!/usr/bin/env bash
# test-marketplace-schema.sh - Validate marketplace.json schema compliance
# Ensures marketplace.json conforms to Claude Code's expected schema
#
# Valid root fields: $schema, name, version, engine, description, owner, metadata, plugins
# Valid plugin fields: name, description, version, author, category
# Invalid plugin fields: source, featured, engine (these cause CC schema errors)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../.."
MARKETPLACE_FILE="${ROOT_DIR}/.claude-plugin/marketplace.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

errors=0
warnings=0

log_error() {
    echo -e "${RED}ERROR:${NC} $*"
    errors=$((errors + 1))
}

log_warning() {
    echo -e "${YELLOW}WARNING:${NC} $*"
    warnings=$((warnings + 1))
}

log_success() {
    echo -e "${GREEN}OK:${NC} $*"
}

log_info() {
    echo "INFO: $*"
}

# Check if marketplace.json exists
if [[ ! -f "$MARKETPLACE_FILE" ]]; then
    log_info "No marketplace.json found at $MARKETPLACE_FILE - skipping"
    exit 0
fi

echo "========================================"
echo "  Marketplace Schema Validation"
echo "========================================"
echo ""

# 1. Validate JSON syntax
echo "1. Validating JSON syntax..."
if ! jq empty "$MARKETPLACE_FILE" 2>/dev/null; then
    log_error "marketplace.json is not valid JSON"
    exit 1
fi
log_success "JSON syntax is valid"

# 2. Check required root fields
echo ""
echo "2. Checking required root fields..."
required_root_fields=("name" "version" "description" "plugins")
for field in "${required_root_fields[@]}"; do
    value=$(jq -r ".$field // empty" "$MARKETPLACE_FILE")
    if [[ -z "$value" ]]; then
        log_error "Missing required root field: $field"
    else
        log_success "Root field '$field' present"
    fi
done

# 3. Validate version format (semver)
echo ""
echo "3. Validating version format..."
version=$(jq -r '.version // ""' "$MARKETPLACE_FILE")
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$ ]]; then
    log_error "Invalid version format: '$version' (expected semver like 1.0.0)"
else
    log_success "Version '$version' is valid semver"
fi

# 4. Validate engine constraint format (if present)
echo ""
echo "4. Validating engine constraint..."
engine=$(jq -r '.engine // ""' "$MARKETPLACE_FILE")
if [[ -n "$engine" ]]; then
    # Valid formats: >=2.1.19, ^2.1.0, ~2.1.0, 2.1.19, >2.0.0, etc.
    # Use grep for complex regex instead of bash [[ ]]
    if ! echo "$engine" | grep -qE '^[>=<^~]*[0-9]+\.[0-9]+\.[0-9]+$'; then
        log_error "Invalid engine constraint format: '$engine'"
    else
        log_success "Engine constraint '$engine' is valid"
    fi
else
    log_warning "No engine constraint specified (recommended: >=2.1.19)"
fi

# 5. Check for invalid root fields
echo ""
echo "5. Checking for invalid root fields..."
valid_root_fields='["$schema", "name", "version", "engine", "description", "owner", "metadata", "plugins"]'
invalid_root=$(jq -r --argjson valid "$valid_root_fields" 'keys - $valid | .[]' "$MARKETPLACE_FILE")
if [[ -n "$invalid_root" ]]; then
    while IFS= read -r field; do
        log_error "Invalid root field: '$field'"
    done <<< "$invalid_root"
else
    log_success "No invalid root fields"
fi

# 6. Validate plugin entries
echo ""
echo "6. Validating plugin entries..."

# Fields that are NOT allowed in plugin entries (cause CC schema errors)
invalid_plugin_fields='["source", "featured", "engine"]'

# Required plugin fields
required_plugin_fields=("name" "description" "version")

plugin_count=$(jq '.plugins | length' "$MARKETPLACE_FILE")
log_info "Found $plugin_count plugins"

for i in $(seq 0 $((plugin_count - 1))); do
    plugin_name=$(jq -r ".plugins[$i].name // \"plugin_$i\"" "$MARKETPLACE_FILE")

    # Check for invalid fields
    invalid_fields=$(jq -r --argjson invalid "$invalid_plugin_fields" ".plugins[$i] | keys | map(select(. as \$k | \$invalid | index(\$k))) | .[]" "$MARKETPLACE_FILE")
    if [[ -n "$invalid_fields" ]]; then
        while IFS= read -r field; do
            log_error "Plugin '$plugin_name' has invalid field: '$field' (CC schema doesn't allow this)"
        done <<< "$invalid_fields"
    fi

    # Check required fields
    for field in "${required_plugin_fields[@]}"; do
        value=$(jq -r ".plugins[$i].$field // empty" "$MARKETPLACE_FILE")
        if [[ -z "$value" ]]; then
            log_error "Plugin '$plugin_name' missing required field: '$field'"
        fi
    done

    # Validate plugin version format
    plugin_version=$(jq -r ".plugins[$i].version // \"\"" "$MARKETPLACE_FILE")
    if [[ -n "$plugin_version" && ! "$plugin_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
        log_error "Plugin '$plugin_name' has invalid version: '$plugin_version'"
    fi
done

# 7. Summary
echo ""
echo "========================================"
echo "  Validation Summary"
echo "========================================"
echo ""
echo "Plugins validated: $plugin_count"
echo "Errors: $errors"
echo "Warnings: $warnings"
echo ""

if [[ $errors -gt 0 ]]; then
    echo -e "${RED}FAILED: $errors errors found${NC}"
    exit 1
fi

if [[ $warnings -gt 0 ]]; then
    echo -e "${YELLOW}PASSED with $warnings warnings${NC}"
else
    echo -e "${GREEN}PASSED: All validations successful${NC}"
fi

exit 0
