#!/bin/bash
# Version Manager - Manages skill version snapshots and rollbacks
#
# Part of: #58 (Skill Evolution System)
# Usage:
#   version-manager.sh create <skill-id> [message]   - Create new version
#   version-manager.sh restore <skill-id> <version>  - Restore old version
#   version-manager.sh list <skill-id>               - List version history
#   version-manager.sh diff <skill-id> <v1> <v2>     - Compare versions
#   version-manager.sh metrics <skill-id>            - Show version metrics
#
# Version: 1.0.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Configuration
SKILLS_ROOT="${PROJECT_ROOT}/skills"
METRICS_FILE="${PROJECT_ROOT}/.claude/feedback/metrics.json"
EVOLUTION_REGISTRY="${PROJECT_ROOT}/.claude/feedback/evolution-registry.json"

# ANSI colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' NC=''
fi

# Cross-platform math helpers (awk-based, no bc dependency)
calc_divide() {
    local num="$1" denom="$2" scale="${3:-2}"
    awk -v n="$num" -v d="$denom" -v s="$scale" 'BEGIN { printf "%.*f", s, (d != 0 ? n/d : 0) }'
}
calc_percent() {
    local val="$1" scale="${2:-0}"
    awk -v v="$val" -v s="$scale" 'BEGIN { printf "%.*f", s, v * 100 }'
}
calc_gt() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a > b) }'; }
calc_lt() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a < b) }'; }

# Find skill directory by ID (searches all categories)
find_skill_dir() {
    local skill_id="$1"
    local skill_dir=""

    # Search in all category directories
    for category_dir in "$SKILLS_ROOT"/*/; do
        local candidate="${category_dir}${skill_id}"
        if [[ -d "$candidate" ]]; then
            skill_dir="$candidate"
            break
        fi
    done

    echo "$skill_dir"
}

# Get current version from SKILL.md
get_current_version() {
    local skill_dir="$1"
    local caps_file="${skill_dir}/SKILL.md"

    if [[ -f "$caps_file" ]]; then
        jq -r '.version // "1.0.0"' "$caps_file" 2>/dev/null || echo "1.0.0"
    else
        echo "1.0.0"
    fi
}

# Bump version (semver)
bump_version() {
    local version="$1"
    local bump_type="${2:-patch}"

    local major minor patch
    IFS='.' read -r major minor patch <<< "$version"

    case "$bump_type" in
        major)
            ((major++))
            minor=0
            patch=0
            ;;
        minor)
            ((minor++))
            patch=0
            ;;
        patch|*)
            ((patch++))
            ;;
    esac

    echo "${major}.${minor}.${patch}"
}

# Initialize versions directory
init_versions_dir() {
    local skill_dir="$1"
    local versions_dir="${skill_dir}/versions"

    mkdir -p "$versions_dir"

    if [[ ! -f "${versions_dir}/manifest.json" ]]; then
        local skill_id
        skill_id=$(basename "$skill_dir")
        local current_version
        current_version=$(get_current_version "$skill_dir")

        cat > "${versions_dir}/manifest.json" << EOF
{
  "\$schema": "../../../../../../.claude/schemas/skill-evolution.schema.json#/definitions/skillEvolution",
  "skillId": "$skill_id",
  "currentVersion": "$current_version",
  "versions": [],
  "suggestions": [],
  "editPatterns": {},
  "lastAnalyzed": null
}
EOF
    fi
}

# Create a new version snapshot
cmd_create() {
    local skill_id="${1:-}"
    local message="${2:-}"

    if [[ -z "$skill_id" ]]; then
        echo -e "${RED}Error: skill-id required${NC}"
        echo "Usage: version-manager.sh create <skill-id> [message]"
        exit 1
    fi

    local skill_dir
    skill_dir=$(find_skill_dir "$skill_id")

    if [[ -z "$skill_dir" ]]; then
        echo -e "${RED}Error: Skill '$skill_id' not found${NC}"
        exit 1
    fi

    # Initialize versions directory
    init_versions_dir "$skill_dir"

    local versions_dir="${skill_dir}/versions"
    local manifest_file="${versions_dir}/manifest.json"

    # Get current version and bump it
    local current_version
    current_version=$(get_current_version "$skill_dir")
    local new_version
    new_version=$(bump_version "$current_version")

    # Create version snapshot directory
    local snapshot_dir="${versions_dir}/${new_version}"
    mkdir -p "$snapshot_dir"

    # Copy current skill files to snapshot
    [[ -f "${skill_dir}/SKILL.md" ]] && cp "${skill_dir}/SKILL.md" "$snapshot_dir/"
    [[ -f "${skill_dir}/SKILL.md" ]] && cp "${skill_dir}/SKILL.md" "$snapshot_dir/"
    [[ -d "${skill_dir}/references" ]] && cp -r "${skill_dir}/references" "$snapshot_dir/" 2>/dev/null || true
    [[ -d "${skill_dir}/templates" ]] && cp -r "${skill_dir}/templates" "$snapshot_dir/" 2>/dev/null || true

    # Get metrics for this version
    local uses successes avg_edits success_rate
    if [[ -f "$METRICS_FILE" ]]; then
        uses=$(jq -r --arg skill "$skill_id" '.skills[$skill].uses // 0' "$METRICS_FILE" 2>/dev/null || echo "0")
        successes=$(jq -r --arg skill "$skill_id" '.skills[$skill].successes // 0' "$METRICS_FILE" 2>/dev/null || echo "0")
        avg_edits=$(jq -r --arg skill "$skill_id" '.skills[$skill].avgEdits // 0' "$METRICS_FILE" 2>/dev/null || echo "0")
    else
        uses=0
        successes=0
        avg_edits=0
    fi

    if [[ "$uses" -gt 0 ]]; then
        success_rate=$(calc_divide "$successes" "$uses" 2)
    else
        success_rate="0"
    fi

    # Auto-generate message if not provided
    if [[ -z "$message" ]]; then
        message="Version ${new_version} snapshot"
    fi

    # Create changelog
    cat > "${snapshot_dir}/CHANGELOG.md" << EOF
# Version ${new_version}

**Date**: $(date +%Y-%m-%d)
**Previous Version**: ${current_version}

## Changes
${message}

## Metrics at Snapshot
- Uses: ${uses}
- Success Rate: ${success_rate}
- Average Edits: ${avg_edits}
EOF

    # Update manifest
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local today
    today=$(date +%Y-%m-%d)

    local tmp_file
    tmp_file=$(mktemp)

    jq --arg version "$new_version" \
       --arg date "$today" \
       --argjson successRate "$success_rate" \
       --argjson uses "$uses" \
       --argjson avgEdits "$avg_edits" \
       --arg changelog "$message" \
       '
        .currentVersion = $version |
        .versions += [{
            version: $version,
            date: $date,
            successRate: $successRate,
            uses: ($uses | tonumber),
            avgEdits: $avgEdits,
            changelog: $changelog
        }]
       ' "$manifest_file" > "$tmp_file" && mv "$tmp_file" "$manifest_file"

    # Update SKILL.md with new version
    local caps_file="${skill_dir}/SKILL.md"
    if [[ -f "$caps_file" ]]; then
        tmp_file=$(mktemp)
        jq --arg version "$new_version" '.version = $version' "$caps_file" > "$tmp_file" && mv "$tmp_file" "$caps_file"
    fi

    echo ""
    echo -e "${GREEN}Created version ${new_version} for ${skill_id}${NC}"
    echo -e "Snapshot: ${CYAN}${snapshot_dir}${NC}"
    echo -e "Changelog: ${message}"
    echo ""
}

# Restore a previous version
cmd_restore() {
    local skill_id="${1:-}"
    local target_version="${2:-}"

    if [[ -z "$skill_id" || -z "$target_version" ]]; then
        echo -e "${RED}Error: skill-id and version required${NC}"
        echo "Usage: version-manager.sh restore <skill-id> <version>"
        exit 1
    fi

    local skill_dir
    skill_dir=$(find_skill_dir "$skill_id")

    if [[ -z "$skill_dir" ]]; then
        echo -e "${RED}Error: Skill '$skill_id' not found${NC}"
        exit 1
    fi

    local snapshot_dir="${skill_dir}/versions/${target_version}"
    if [[ ! -d "$snapshot_dir" ]]; then
        echo -e "${RED}Error: Version '$target_version' not found${NC}"
        echo "Available versions:"
        cmd_list "$skill_id"
        exit 1
    fi

    # Backup current version first
    local current_version
    current_version=$(get_current_version "$skill_dir")
    local backup_dir="${skill_dir}/versions/.backup-${current_version}-$(date +%s)"
    mkdir -p "$backup_dir"

    # Backup current files
    [[ -f "${skill_dir}/SKILL.md" ]] && cp "${skill_dir}/SKILL.md" "$backup_dir/"
    [[ -f "${skill_dir}/SKILL.md" ]] && cp "${skill_dir}/SKILL.md" "$backup_dir/"
    [[ -d "${skill_dir}/references" ]] && cp -r "${skill_dir}/references" "$backup_dir/" 2>/dev/null || true
    [[ -d "${skill_dir}/templates" ]] && cp -r "${skill_dir}/templates" "$backup_dir/" 2>/dev/null || true

    # Restore from snapshot
    [[ -f "${snapshot_dir}/SKILL.md" ]] && cp "${snapshot_dir}/SKILL.md" "${skill_dir}/"
    [[ -f "${snapshot_dir}/SKILL.md" ]] && cp "${snapshot_dir}/SKILL.md" "${skill_dir}/"

    # Remove and restore directories
    if [[ -d "${snapshot_dir}/references" ]]; then
        rm -rf "${skill_dir}/references"
        cp -r "${snapshot_dir}/references" "${skill_dir}/"
    fi
    if [[ -d "${snapshot_dir}/templates" ]]; then
        rm -rf "${skill_dir}/templates"
        cp -r "${snapshot_dir}/templates" "${skill_dir}/"
    fi

    # Update manifest to indicate rollback
    local manifest_file="${skill_dir}/versions/manifest.json"
    if [[ -f "$manifest_file" ]]; then
        local tmp_file
        tmp_file=$(mktemp)
        jq --arg version "$target_version" \
           --arg from "$current_version" \
           '
            .currentVersion = $version |
            .versions += [{
                version: ($version + "-restored"),
                date: (now | strftime("%Y-%m-%d")),
                changelog: ("Restored from " + $version + " (was " + $from + ")")
            }]
           ' "$manifest_file" > "$tmp_file" && mv "$tmp_file" "$manifest_file"
    fi

    echo ""
    echo -e "${GREEN}Restored ${skill_id} to version ${target_version}${NC}"
    echo -e "Previous version backed up to: ${CYAN}${backup_dir}${NC}"
    echo ""
}

# List version history
cmd_list() {
    local skill_id="${1:-}"

    if [[ -z "$skill_id" ]]; then
        echo -e "${RED}Error: skill-id required${NC}"
        echo "Usage: version-manager.sh list <skill-id>"
        exit 1
    fi

    local skill_dir
    skill_dir=$(find_skill_dir "$skill_id")

    if [[ -z "$skill_dir" ]]; then
        echo -e "${RED}Error: Skill '$skill_id' not found${NC}"
        exit 1
    fi

    local manifest_file="${skill_dir}/versions/manifest.json"
    if [[ ! -f "$manifest_file" ]]; then
        echo -e "${YELLOW}No version history for ${skill_id}${NC}"
        echo "Current version: $(get_current_version "$skill_dir")"
        exit 0
    fi

    echo ""
    echo -e "${BOLD}Version History: ${skill_id}${NC}"
    echo "══════════════════════════════════════════════════════════════"
    echo ""

    local current_version
    current_version=$(jq -r '.currentVersion' "$manifest_file")
    echo -e "Current Version: ${GREEN}${current_version}${NC}"
    echo ""

    echo "┌─────────┬────────────┬─────────┬───────┬───────────┬────────────────────────────┐"
    echo "│ Version │ Date       │ Success │ Uses  │ Avg Edits │ Changelog                  │"
    echo "├─────────┼────────────┼─────────┼───────┼───────────┼────────────────────────────┤"

    jq -r '.versions | reverse | .[] | "\(.version)\t\(.date // "N/A")\t\(.successRate // 0)\t\(.uses // 0)\t\(.avgEdits // 0)\t\(.changelog // "No changelog")[0:26]"' "$manifest_file" 2>/dev/null | \
    while IFS=$'\t' read -r version date success uses avg_edits changelog; do
        local success_pct
        success_pct=$(calc_percent "$success" 0)
        printf "│ %-7s │ %-10s │ %6s%% │ %5s │ %9s │ %-26s │\n" \
            "${version:0:7}" "${date:0:10}" "$success_pct" "$uses" "$avg_edits" "${changelog:0:26}"
    done

    echo "└─────────┴────────────┴─────────┴───────┴───────────┴────────────────────────────┘"
    echo ""
}

# Compare two versions
cmd_diff() {
    local skill_id="${1:-}"
    local v1="${2:-}"
    local v2="${3:-}"

    if [[ -z "$skill_id" || -z "$v1" || -z "$v2" ]]; then
        echo -e "${RED}Error: skill-id, v1, and v2 required${NC}"
        echo "Usage: version-manager.sh diff <skill-id> <v1> <v2>"
        exit 1
    fi

    local skill_dir
    skill_dir=$(find_skill_dir "$skill_id")

    if [[ -z "$skill_dir" ]]; then
        echo -e "${RED}Error: Skill '$skill_id' not found${NC}"
        exit 1
    fi

    local dir1="${skill_dir}/versions/${v1}"
    local dir2="${skill_dir}/versions/${v2}"

    if [[ ! -d "$dir1" ]]; then
        echo -e "${RED}Error: Version '$v1' not found${NC}"
        exit 1
    fi
    if [[ ! -d "$dir2" ]]; then
        echo -e "${RED}Error: Version '$v2' not found${NC}"
        exit 1
    fi

    echo ""
    echo -e "${BOLD}Diff: ${skill_id} ${v1} → ${v2}${NC}"
    echo "══════════════════════════════════════════════════════════════"
    echo ""

    # Diff SKILL.md
    if [[ -f "${dir1}/SKILL.md" && -f "${dir2}/SKILL.md" ]]; then
        echo -e "${CYAN}SKILL.md changes:${NC}"
        diff --color=auto -u "${dir1}/SKILL.md" "${dir2}/SKILL.md" 2>/dev/null || true
        echo ""
    fi

    # Diff SKILL.md
    if [[ -f "${dir1}/SKILL.md" && -f "${dir2}/SKILL.md" ]]; then
        echo -e "${CYAN}SKILL.md changes:${NC}"
        diff --color=auto -u "${dir1}/SKILL.md" "${dir2}/SKILL.md" 2>/dev/null || true
        echo ""
    fi

    # Compare metrics
    local manifest_file="${skill_dir}/versions/manifest.json"
    if [[ -f "$manifest_file" ]]; then
        echo -e "${CYAN}Metrics comparison:${NC}"
        echo "┌─────────┬─────────┬───────┬───────────┐"
        echo "│ Version │ Success │ Uses  │ Avg Edits │"
        echo "├─────────┼─────────┼───────┼───────────┤"

        for v in "$v1" "$v2"; do
            local metrics
            metrics=$(jq -r --arg v "$v" '.versions[] | select(.version == $v)' "$manifest_file" 2>/dev/null)
            if [[ -n "$metrics" ]]; then
                local success uses avg_edits
                success=$(echo "$metrics" | jq -r '.successRate // 0')
                uses=$(echo "$metrics" | jq -r '.uses // 0')
                avg_edits=$(echo "$metrics" | jq -r '.avgEdits // 0')
                local success_pct
                success_pct=$(calc_percent "$success" 0)
                printf "│ %-7s │ %6s%% │ %5s │ %9s │\n" "$v" "$success_pct" "$uses" "$avg_edits"
            fi
        done

        echo "└─────────┴─────────┴───────┴───────────┘"
    fi
    echo ""
}

# Show version metrics
cmd_metrics() {
    local skill_id="${1:-}"

    if [[ -z "$skill_id" ]]; then
        echo -e "${RED}Error: skill-id required${NC}"
        echo "Usage: version-manager.sh metrics <skill-id>"
        exit 1
    fi

    local skill_dir
    skill_dir=$(find_skill_dir "$skill_id")

    if [[ -z "$skill_dir" ]]; then
        echo -e "${RED}Error: Skill '$skill_id' not found${NC}"
        exit 1
    fi

    local manifest_file="${skill_dir}/versions/manifest.json"

    echo ""
    echo -e "${BOLD}Version Metrics: ${skill_id}${NC}"
    echo "══════════════════════════════════════════════════════════════"
    echo ""

    # Current metrics from feedback system
    if [[ -f "$METRICS_FILE" ]]; then
        local uses successes avg_edits last_used
        uses=$(jq -r --arg skill "$skill_id" '.skills[$skill].uses // 0' "$METRICS_FILE" 2>/dev/null || echo "0")
        successes=$(jq -r --arg skill "$skill_id" '.skills[$skill].successes // 0' "$METRICS_FILE" 2>/dev/null || echo "0")
        avg_edits=$(jq -r --arg skill "$skill_id" '.skills[$skill].avgEdits // 0' "$METRICS_FILE" 2>/dev/null || echo "0")
        last_used=$(jq -r --arg skill "$skill_id" '.skills[$skill].lastUsed // "Never"' "$METRICS_FILE" 2>/dev/null || echo "Never")

        local success_rate=0
        if [[ "$uses" -gt 0 ]]; then
            success_rate=$(awk -v s="$successes" -v u="$uses" 'BEGIN { printf "%.0f", s * 100 / u }')
        fi

        echo -e "${CYAN}Current Performance:${NC}"
        echo "  Uses: $uses"
        echo "  Success Rate: ${success_rate}%"
        echo "  Average Edits: $avg_edits"
        echo "  Last Used: $last_used"
        echo ""
    fi

    # Version history metrics
    if [[ -f "$manifest_file" ]]; then
        local version_count
        version_count=$(jq '.versions | length' "$manifest_file")

        if [[ "$version_count" -gt 0 ]]; then
            echo -e "${CYAN}Version History Analysis:${NC}"
            echo "  Total Versions: $version_count"

            # Best performing version
            local best_version
            best_version=$(jq -r '.versions | max_by(.successRate // 0) | "\(.version) (\(.successRate // 0 | . * 100 | floor)%)"' "$manifest_file" 2>/dev/null)
            echo "  Best Version: $best_version"

            # Most used version
            local most_used
            most_used=$(jq -r '.versions | max_by(.uses // 0) | "\(.version) (\(.uses // 0) uses)"' "$manifest_file" 2>/dev/null)
            echo "  Most Used: $most_used"

            # Trend analysis
            local first_success last_success
            first_success=$(jq -r '.versions[0].successRate // 0' "$manifest_file" 2>/dev/null)
            last_success=$(jq -r '.versions[-1].successRate // 0' "$manifest_file" 2>/dev/null)

            local trend
            # Use awk for floating-point comparison (cross-platform, no bc)
            local threshold=0.05
            if awk -v l="$last_success" -v f="$first_success" -v t="$threshold" 'BEGIN { exit !(l > f + t) }'; then
                trend="${GREEN}Improving${NC}"
            elif awk -v l="$last_success" -v f="$first_success" -v t="$threshold" 'BEGIN { exit !(l < f - t) }'; then
                trend="${RED}Declining${NC}"
            else
                trend="${YELLOW}Stable${NC}"
            fi
            echo -e "  Trend: $trend"
        fi
    else
        echo -e "${YELLOW}No version history available.${NC}"
        echo "Run: version-manager.sh create $skill_id \"Initial version\""
    fi
    echo ""
}

# Show help
cmd_help() {
    cat << EOF
Version Manager - Manage skill version snapshots and rollbacks

Usage: version-manager.sh <command> [options]

Commands:
  create <skill-id> [message]   Create new version snapshot
  restore <skill-id> <version>  Restore previous version
  list <skill-id>               List version history
  diff <skill-id> <v1> <v2>     Compare two versions
  metrics <skill-id>            Show version metrics
  help                          Show this help

Examples:
  version-manager.sh create api-design-framework "Added pagination pattern"
  version-manager.sh list api-design-framework
  version-manager.sh restore api-design-framework 1.0.0
  version-manager.sh diff api-design-framework 1.0.0 1.1.0
  version-manager.sh metrics api-design-framework

Files:
  Version snapshots: skills/<cat>/<name>/versions/
  Manifest: skills/<cat>/<name>/versions/manifest.json
  Metrics: .claude/feedback/metrics.json
EOF
}

# Main
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
    create)
        cmd_create "$@"
        ;;
    restore)
        cmd_restore "$@"
        ;;
    list)
        cmd_list "$@"
        ;;
    diff)
        cmd_diff "$@"
        ;;
    metrics)
        cmd_metrics "$@"
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        cmd_help
        exit 1
        ;;
esac