#!/usr/bin/env bash
# test-marketplace-schema.sh - Validate marketplace.json schema compliance
# Ensures marketplace.json conforms to Claude Code's expected schema
#
# Based on official CC marketplace format from anthropics/claude-code:
# - Required plugin fields: name, description, source, category
# - Optional plugin fields: version, author
# - ONLY allowed plugin fields: name, description, source, category, version, author
# - ANY other field (deps, featured, engine, etc.) causes CC schema errors
#
# Root-level schema shape (unknown fields, required fields) is covered by
# `claude plugin validate --strict` (adopted #3349) and NOT re-asserted here —
# it already catches things this test didn't (e.g. it found `engine` itself).
# What stays: checks CC's validator does NOT perform, per #3349 — unrecognized
# fields WITHIN a plugins[] entry are silently ignored by `claude plugin
# validate` (proven #3340), and local git-subdir path existence is never
# checked by a schema validator operating on a remote source descriptor.

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

# 4. Check for invalid root fields
#
# `engine` is deliberately NOT in this allowlist: it is not a recognized CC
# marketplace field (`claude plugin validate --strict` flags it as an unknown
# field CC ignores at load time, #3349). The CC-version floor lives solely in
# shared/cc-support.json now.
echo ""
echo "4. Checking for invalid root fields..."
valid_root_fields='["$schema", "name", "version", "description", "owner", "metadata", "plugins"]'
invalid_root=$(jq -r --argjson valid "$valid_root_fields" 'keys - $valid | .[]' "$MARKETPLACE_FILE")
if [[ -n "$invalid_root" ]]; then
    while IFS= read -r field; do
        log_error "Invalid root field: '$field'"
    done < <(printf '%s\n' "$invalid_root")
else
    log_success "No invalid root fields"
fi

# 5. Validate plugin entries
echo ""
echo "5. Validating plugin entries..."

# Required plugin fields (based on official CC marketplace)
required_plugin_fields=("name" "description" "source" "category")

# Valid plugin fields — ONLY these are allowed by Claude Code's schema validator.
# Any other key (e.g., "deps", "featured", "engine") causes:
#   "Invalid schema: plugins.N: Unrecognized key: ..."
valid_plugin_fields='["name", "description", "source", "category", "version", "author"]'

plugin_count=$(jq '.plugins | length' "$MARKETPLACE_FILE")
log_info "Found $plugin_count plugins"

for i in $(seq 0 $((plugin_count - 1))); do
    plugin_name=$(jq -r ".plugins[$i].name // \"plugin_$i\"" "$MARKETPLACE_FILE")

    # Check for ANY unrecognized fields (allowlist enforcement)
    # Claude Code rejects all keys not in its schema — use allowlist, not denylist
    unrecognized_fields=$(jq -r --argjson valid "$valid_plugin_fields" ".plugins[$i] | keys - \$valid | .[]" "$MARKETPLACE_FILE")
    if [[ -n "$unrecognized_fields" ]]; then
        while IFS= read -r field; do
            log_error "Plugin '$plugin_name' has unrecognized field: '$field' (CC schema only allows: name, description, source, category, version, author)"
        done < <(printf '%s\n' "$unrecognized_fields")
    fi

    # Check required fields
    for field in "${required_plugin_fields[@]}"; do
        value=$(jq -r ".plugins[$i].$field // empty" "$MARKETPLACE_FILE")
        if [[ -z "$value" ]]; then
            log_error "Plugin '$plugin_name' missing required field: '$field'"
        fi
    done

    # Validate plugin version format (if present)
    plugin_version=$(jq -r ".plugins[$i].version // \"\"" "$MARKETPLACE_FILE")
    if [[ -n "$plugin_version" && ! "$plugin_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
        log_error "Plugin '$plugin_name' has invalid version: '$plugin_version'"
    fi

    # Validate source field format.
    #
    # `source` is either a relative-path STRING or an OBJECT naming a remote
    # source. This used to assume the string form and warn on anything else,
    # which would have fired on every entry once the alpha channel landed.
    # The object form is what CC's own validator accepts; probed against the
    # 2.1.226 binary with a typed test (a string passes, a number is rejected,
    # an unknown key is silently ignored) rather than read off documentation:
    #
    #   github      repo (required) · ref · sha (40-hex, format-checked)
    #   git-subdir  url (required) · path (required) · ref
    source_type=$(jq -r --argjson i "$i" '.plugins[$i].source | type' "$MARKETPLACE_FILE")
    case "$source_type" in
      string)
        source=$(jq -r --argjson i "$i" '.plugins[$i].source' "$MARKETPLACE_FILE")
        if [[ ! "$source" =~ ^\.(/|$) ]]; then
            log_warning "Plugin '$plugin_name' source '$source' should be relative path (e.g., './plugins/...')"
        fi
        ;;
      object)
        kind=$(jq -r --argjson i "$i" '.plugins[$i].source.source // ""' "$MARKETPLACE_FILE")
        case "$kind" in
          github)
            [[ -n "$(jq -r --argjson i "$i" '.plugins[$i].source.repo // ""' "$MARKETPLACE_FILE")" ]] \
              || log_error "Plugin '$plugin_name' github source is missing 'repo'"
            ;;
          git-subdir)
            [[ -n "$(jq -r --argjson i "$i" '.plugins[$i].source.url // ""' "$MARKETPLACE_FILE")" ]] \
              || log_error "Plugin '$plugin_name' git-subdir source is missing 'url'"
            [[ -n "$(jq -r --argjson i "$i" '.plugins[$i].source.path // ""' "$MARKETPLACE_FILE")" ]] \
              || log_error "Plugin '$plugin_name' git-subdir source is missing 'path'"
            ;;
          npm|url|archive)
            : # remote forms CC accepts; no extra shape assertion here yet
            ;;
          *)
            log_error "Plugin '$plugin_name' has unsupported source type '$kind' (expected github, git-subdir, npm, url, archive)"
            ;;
        esac
        ;;
      null) : ;;  # silent: absence is caught by the required-fields check above
      *)
        log_error "Plugin '$plugin_name' source must be a string or an object, got $source_type"
        ;;
    esac
done

# 6. E2E validation: Check that plugin source paths exist
echo ""
echo "6. Validating plugin source paths exist..."
for i in $(seq 0 $((plugin_count - 1))); do
    plugin_name=$(jq -r ".plugins[$i].name // \"plugin_$i\"" "$MARKETPLACE_FILE")

    # Only a relative-path source resolves against this checkout. A remote
    # source names a repo and a ref, so there is no local directory to stat;
    # asserting one would fail every entry in the alpha-channel layout. The
    # in-repo path those entries point at is covered by the git-subdir check
    # below instead.
    if [[ "$(jq -r --argjson i "$i" '.plugins[$i].source | type' "$MARKETPLACE_FILE")" != "string" ]]; then
        subpath=$(jq -r --argjson i "$i" '.plugins[$i].source.path // ""' "$MARKETPLACE_FILE")
        if [[ -n "$subpath" && ! -d "${ROOT_DIR}/${subpath}" ]]; then
            log_error "Plugin '$plugin_name' git-subdir path '$subpath' does not exist in this repo"
        fi
        continue
    fi

    source=$(jq -r --argjson i "$i" '.plugins[$i].source' "$MARKETPLACE_FILE")
    if [[ -n "$source" ]]; then
        # Resolve relative to ROOT_DIR
        full_path="${ROOT_DIR}/${source}"
        if [[ ! -d "$full_path" ]]; then
            log_error "Plugin '$plugin_name' source path does not exist: $source"
        else
            # Check if plugin has plugin.json
            if [[ "$source" != "." && ! -f "$full_path/.claude-plugin/plugin.json" && ! -f "$full_path/plugin.json" ]]; then
                log_warning "Plugin '$plugin_name' has no plugin.json at $source"
            fi
        fi
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
