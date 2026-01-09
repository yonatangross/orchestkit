#!/usr/bin/env bash
# ============================================================================
# Capabilities Migration Script
# ============================================================================
# Migrates capabilities.json files from verbose format to slim Tier 1 format.
# Moves capability details (keywords, solves) to SKILL.md
#
# Usage:
#   ./bin/migrate-capabilities.sh                    # Migrate all skills
#   ./bin/migrate-capabilities.sh [skill-dir]        # Migrate single skill
#   ./bin/migrate-capabilities.sh --dry-run          # Preview changes
#   ./bin/migrate-capabilities.sh --verify           # Verify migration
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/.claude/skills"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DRY_RUN=false
VERIFY=false
SINGLE_SKILL=""
MIGRATED=0
SKIPPED=0
ERRORS=0

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        --verify) VERIFY=true ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS] [skill-dir]"
            echo ""
            echo "Options:"
            echo "  --dry-run    Preview changes without writing"
            echo "  --verify     Check if skills need migration"
            echo "  --help       Show this help"
            exit 0
            ;;
        *)
            if [[ -d "$arg" ]]; then
                SINGLE_SKILL="$arg"
            elif [[ -d "$SKILLS_DIR/$arg" ]]; then
                SINGLE_SKILL="$SKILLS_DIR/$arg"
            fi
            ;;
    esac
done

info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Check if capabilities.json needs migration (has object capabilities vs array)
needs_migration() {
    local caps_file="$1"

    # Check if capabilities is an object (needs migration) or array (already migrated)
    if jq -e '.capabilities | type == "object"' "$caps_file" >/dev/null 2>&1; then
        return 0  # Needs migration
    else
        return 1  # Already migrated or array format
    fi
}

# Count tokens (chars/4 approximation)
count_tokens() {
    local file="$1"
    if [[ -f "$file" ]]; then
        local chars
        chars=$(wc -c < "$file" | tr -d ' ')
        echo $((chars / 4))
    else
        echo 0
    fi
}

# Migrate a single skill
migrate_skill() {
    local skill_dir="$1"
    local skill_name
    skill_name=$(basename "$skill_dir")
    local caps_file="$skill_dir/capabilities.json"
    local skill_md="$skill_dir/SKILL.md"

    # Check if files exist
    if [[ ! -f "$caps_file" ]]; then
        warn "$skill_name: Missing capabilities.json"
        ((SKIPPED++)) || true
        return 0
    fi

    # Check if already migrated
    if ! needs_migration "$caps_file"; then
        info "$skill_name: Already migrated (skipping)"
        ((SKIPPED++)) || true
        return 0
    fi

    # Get before token count
    local before_tokens
    before_tokens=$(count_tokens "$caps_file")

    # Extract data from current capabilities.json
    local name version description triggers integrates_with capabilities_array capability_details
    name=$(jq -r '.name' "$caps_file")
    version=$(jq -r '.version // "1.0.0"' "$caps_file")
    description=$(jq -r '.description' "$caps_file")
    triggers=$(jq -c '.triggers // {}' "$caps_file")
    integrates_with=$(jq -c '.integrates_with // []' "$caps_file")

    # Extract capability names as array
    capabilities_array=$(jq -c '[.capabilities | keys[]]' "$caps_file")

    # Extract capability details for SKILL.md
    capability_details=$(jq -r '
        .capabilities | to_entries[] |
        "### \(.key)\n" +
        "**Keywords:** \((.value.keywords // []) | join(", "))\n" +
        "**Solves:**\n\((.value.solves // []) | map("- " + .) | join("\n"))\n"
    ' "$caps_file" 2>/dev/null || echo "")

    if [[ "$DRY_RUN" == "true" ]]; then
        info "$skill_name: Would migrate ($before_tokens tokens → ~100 tokens)"
        echo "    Capabilities: $(echo "$capabilities_array" | jq -r 'join(", ")')"
        return 0
    fi

    # Create slim capabilities.json
    local slim_json
    slim_json=$(jq -n \
        --arg schema "../../schemas/skill-capabilities.schema.json" \
        --arg name "$name" \
        --arg version "$version" \
        --arg description "$description" \
        --argjson capabilities "$capabilities_array" \
        --argjson triggers "$triggers" \
        --argjson integrates_with "$integrates_with" \
        '{
            "$schema": $schema,
            "name": $name,
            "version": $version,
            "description": $description,
            "capabilities": $capabilities,
            "triggers": $triggers,
            "integrates_with": $integrates_with
        } | if .integrates_with == [] then del(.integrates_with) else . end
          | if .triggers == {} then del(.triggers) else . end'
    )

    # Write slim capabilities.json
    echo "$slim_json" > "$caps_file"

    # Append capability details to SKILL.md if they exist and file exists
    if [[ -n "$capability_details" ]] && [[ -f "$skill_md" ]]; then
        # Check if "## Capability Details" section already exists
        if ! grep -q "## Capability Details" "$skill_md" 2>/dev/null; then
            # Append capability details section
            echo "" >> "$skill_md"
            echo "## Capability Details" >> "$skill_md"
            echo "" >> "$skill_md"
            echo "$capability_details" >> "$skill_md"
        fi
    fi

    # Get after token count
    local after_tokens
    after_tokens=$(count_tokens "$caps_file")
    local savings=$((before_tokens - after_tokens))

    success "$skill_name: Migrated ($before_tokens → $after_tokens tokens, saved $savings)"
    ((MIGRATED++)) || true
}

# Main execution
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Capabilities Migration Tool"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    warn "DRY RUN MODE - No files will be modified"
    echo ""
fi

if [[ "$VERIFY" == "true" ]]; then
    info "VERIFY MODE - Checking migration status"
    echo ""
    needs_count=0
    done_count=0

    for skill_dir in "$SKILLS_DIR"/*; do
        if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/capabilities.json" ]]; then
            skill_name=$(basename "$skill_dir")
            if needs_migration "$skill_dir/capabilities.json"; then
                warn "$skill_name: Needs migration"
                ((needs_count++)) || true
            else
                success "$skill_name: Already migrated"
                ((done_count++)) || true
            fi
        fi
    done

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Summary: $done_count migrated, $needs_count need migration"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
fi

# Migrate single skill or all skills
if [[ -n "$SINGLE_SKILL" ]]; then
    migrate_skill "$SINGLE_SKILL"
else
    for skill_dir in "$SKILLS_DIR"/*; do
        if [[ -d "$skill_dir" ]]; then
            migrate_skill "$skill_dir"
        fi
    done
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary: $MIGRATED migrated, $SKIPPED skipped, $ERRORS errors"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $ERRORS -gt 0 ]]; then
    exit 1
fi
exit 0