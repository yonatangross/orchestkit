#!/bin/bash
# Evolution Engine - Analyzes edit patterns and generates skill improvement suggestions
#
# Part of: #58 (Skill Evolution System)
# Usage:
#   evolution-engine.sh analyze <skill-id>   - Analyze patterns for skill
#   evolution-engine.sh suggest <skill-id>   - Generate suggestions
#   evolution-engine.sh pending [skill-id]   - List pending suggestions
#   evolution-engine.sh accept <skill-id> <suggestion-id>  - Accept suggestion
#   evolution-engine.sh reject <skill-id> <suggestion-id>  - Reject suggestion
#   evolution-engine.sh apply <skill-id> <suggestion-id>   - Apply suggestion
#   evolution-engine.sh report               - Full evolution report
#
# Version: 1.1.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Configuration
EDIT_PATTERNS_FILE="${PROJECT_ROOT}/.claude/feedback/edit-patterns.jsonl"
EVOLUTION_REGISTRY="${PROJECT_ROOT}/.claude/feedback/evolution-registry.json"
METRICS_FILE="${PROJECT_ROOT}/.claude/feedback/metrics.json"
SKILLS_DIR="${PROJECT_ROOT}/skills"
VERSION_MANAGER="${SCRIPT_DIR}/version-manager.sh"

# Thresholds (configurable)
MIN_SAMPLES=${MIN_SAMPLES:-5}
ADD_THRESHOLD=${ADD_THRESHOLD:-0.70}
REMOVE_THRESHOLD=${REMOVE_THRESHOLD:-0.70}
AUTO_APPLY_CONFIDENCE=${AUTO_APPLY_CONFIDENCE:-0.85}

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
calc_percent_int() {
    local num="$1" denom="$2"
    awk -v n="$num" -v d="$denom" 'BEGIN { printf "%.0f", (d != 0 ? n * 100 / d : 0) }'
}

# Initialize evolution registry if not exists
init_registry() {
    local dir
    dir=$(dirname "$EVOLUTION_REGISTRY")
    mkdir -p "$dir"

    if [[ ! -f "$EVOLUTION_REGISTRY" ]]; then
        cat > "$EVOLUTION_REGISTRY" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "config": {
    "minSamplesForSuggestion": 5,
    "minFrequencyForSuggestion": 0.70,
    "autoVersionOnImprovement": false
  },
  "skills": {},
  "summary": {
    "totalSkillsTracked": 0,
    "totalVersionsCreated": 0,
    "totalSuggestionsPending": 0,
    "totalSuggestionsImplemented": 0,
    "averageSuccessRate": 0
  }
}
EOF
    fi
}

# Find skill directory by ID
find_skill_dir() {
    local skill_id="$1"
    local skill_dir=""

    for category_dir in "$SKILLS_DIR"/*/; do
        local candidate="${category_dir}${skill_id}"
        if [[ -d "$candidate" ]]; then
            skill_dir="$candidate"
            break
        fi
    done

    echo "$skill_dir"
}

# Get skill metrics from feedback system
get_skill_metrics() {
    local skill_id="$1"

    if [[ ! -f "$METRICS_FILE" ]]; then
        echo '{}'
        return
    fi

    jq -r --arg skill "$skill_id" '.skills[$skill] // {}' "$METRICS_FILE" 2>/dev/null || echo '{}'
}

# Get all skills with usage data
get_tracked_skills() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo '[]'
        return
    fi

    jq -r '.skills | keys' "$METRICS_FILE" 2>/dev/null || echo '[]'
}

# Aggregate edit patterns for a skill
aggregate_patterns() {
    local skill_id="$1"

    if [[ ! -f "$EDIT_PATTERNS_FILE" ]]; then
        echo '{}'
        return
    fi

    # Count occurrences of each pattern for this skill
    grep "\"skill_id\":\"$skill_id\"" "$EDIT_PATTERNS_FILE" 2>/dev/null | \
        jq -s '
            [.[].patterns[]] |
            group_by(.) |
            map({key: .[0], value: length}) |
            from_entries
        ' 2>/dev/null || echo '{}'
}

# Generate suggestions based on pattern analysis
generate_suggestions() {
    local skill_id="$1"

    # Get skill metrics
    local metrics
    metrics=$(get_skill_metrics "$skill_id")

    local uses
    uses=$(echo "$metrics" | jq -r '.uses // 0')

    if [[ "$uses" -lt "$MIN_SAMPLES" ]]; then
        echo "[]"
        return
    fi

    # Get pattern counts
    local pattern_counts
    pattern_counts=$(aggregate_patterns "$skill_id")

    if [[ "$pattern_counts" == "{}" ]]; then
        echo "[]"
        return
    fi

    # Generate suggestions for patterns above threshold
    echo "$pattern_counts" | jq --argjson uses "$uses" --argjson threshold "$ADD_THRESHOLD" '
        to_entries |
        map(
            select((.value / $uses) >= $threshold) |
            {
                id: ("SUG-" + .key + "-" + (now | tostring | split(".")[0])),
                type: (if .key | startswith("remove_") then "remove" else "add" end),
                target: (
                    if .key | contains("error") then "reference"
                    elif .key | contains("type") then "capability"
                    elif .key | contains("test") then "integration"
                    else "template"
                    end
                ),
                pattern: .key,
                frequency: (.value / $uses),
                occurrences: .value,
                confidence: ((.value / $uses) * ([.value / 20, 1] | min)),
                status: "pending",
                reason: "Pattern detected in \(.value)/\($uses) uses (\((.value / $uses * 100) | floor)%)",
                createdAt: (now | todate)
            }
        ) |
        sort_by(-.confidence)
    '
}

# Update suggestion status in registry
update_suggestion_status() {
    local skill_id="$1"
    local suggestion_id="$2"
    local new_status="$3"

    init_registry

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local tmp_file
    tmp_file=$(mktemp)

    jq --arg skill "$skill_id" --arg sug_id "$suggestion_id" --arg status "$new_status" --arg now "$now" '
        .updated = $now |
        .skills[$skill].suggestions = [
            .skills[$skill].suggestions[] |
            if .id == $sug_id then
                .status = $status |
                .resolvedAt = $now
            else
                .
            end
        ] |
        .summary.totalSuggestionsPending = ([.skills[].suggestions[] | select(.status == "pending")] | length) |
        .summary.totalSuggestionsImplemented = ([.skills[].suggestions[] | select(.status == "implemented")] | length)
    ' "$EVOLUTION_REGISTRY" > "$tmp_file" && mv "$tmp_file" "$EVOLUTION_REGISTRY"
}

# Get suggestion by ID
get_suggestion() {
    local skill_id="$1"
    local suggestion_id="$2"

    if [[ ! -f "$EVOLUTION_REGISTRY" ]]; then
        echo '{}'
        return
    fi

    jq -r --arg skill "$skill_id" --arg sug_id "$suggestion_id" '
        .skills[$skill].suggestions[] | select(.id == $sug_id)
    ' "$EVOLUTION_REGISTRY" 2>/dev/null || echo '{}'
}

# Analyze a specific skill
cmd_analyze() {
    local skill_id="${1:-}"

    if [[ -z "$skill_id" ]]; then
        echo -e "${RED}Error: skill-id required${NC}"
        echo "Usage: evolution-engine.sh analyze <skill-id>"
        exit 1
    fi

    # Get metrics
    local metrics
    metrics=$(get_skill_metrics "$skill_id")

    local uses successes avg_edits
    uses=$(echo "$metrics" | jq -r '.uses // 0')
    successes=$(echo "$metrics" | jq -r '.successes // 0')
    avg_edits=$(echo "$metrics" | jq -r '.avgEdits // 0')

    if [[ "$uses" -eq 0 ]]; then
        echo -e "${YELLOW}No usage data for skill: $skill_id${NC}"
        exit 0
    fi

    local success_rate
    if [[ "$uses" -gt 0 ]]; then
        success_rate=$(calc_percent_int "$successes" "$uses")
    else
        success_rate=0
    fi

    # Get pattern counts
    local pattern_counts
    pattern_counts=$(aggregate_patterns "$skill_id")

    echo ""
    echo -e "${BOLD}Skill Analysis: $skill_id${NC}"
    echo "────────────────────────────────────"
    echo -e "Uses: ${CYAN}$uses${NC} | Success: ${GREEN}${success_rate}%${NC} | Avg Edits: ${YELLOW}$avg_edits${NC}"
    echo ""

    if [[ "$pattern_counts" == "{}" ]]; then
        echo -e "${YELLOW}No edit patterns detected yet.${NC}"
        exit 0
    fi

    echo -e "${BOLD}Edit Patterns Detected:${NC}"
    echo "┌──────────────────────────┬─────────┬──────────┬────────────┐"
    echo "│ Pattern                  │ Freq    │ Samples  │ Confidence │"
    echo "├──────────────────────────┼─────────┼──────────┼────────────┤"

    echo "$pattern_counts" | jq -r --argjson uses "$uses" '
        to_entries |
        sort_by(-.value) |
        .[] |
        @sh "printf \"│ %-24s │ %5.0f%% │ %3d/%-3d  │ %6.2f     │\n\" \(.key) (\(.value / $uses * 100)) \(.value) $uses ((.value / $uses) * ([.value / 20, 1] | min))"
    ' | while read -r line; do eval "$line"; done

    echo "└──────────────────────────┴─────────┴──────────┴────────────┘"
    echo ""

    # Generate suggestions
    local suggestions
    suggestions=$(generate_suggestions "$skill_id")

    local suggestion_count
    suggestion_count=$(echo "$suggestions" | jq 'length')

    if [[ "$suggestion_count" -gt 0 ]]; then
        echo -e "${BOLD}Pending Suggestions:${NC}"
        echo "$suggestions" | jq -r '.[] | "\(.confidence | . * 100 | floor)% conf: \(.type | ascii_upcase) \(.pattern) to \(.target)"' | \
            nl -w2 -s". "
        echo ""
        echo -e "Run ${CYAN}evolution-engine.sh suggest $skill_id${NC} to save suggestions"
    else
        echo -e "${GREEN}No suggestions - skill is performing well!${NC}"
    fi
}

# Generate and save suggestions for a skill
cmd_suggest() {
    local skill_id="${1:-}"

    if [[ -z "$skill_id" ]]; then
        echo -e "${RED}Error: skill-id required${NC}"
        exit 1
    fi

    init_registry

    local suggestions
    suggestions=$(generate_suggestions "$skill_id")

    local suggestion_count
    suggestion_count=$(echo "$suggestions" | jq 'length')

    if [[ "$suggestion_count" -eq 0 ]]; then
        echo -e "${GREEN}No suggestions for $skill_id${NC}"
        exit 0
    fi

    # Update registry with suggestions
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local tmp_file
    tmp_file=$(mktemp)

    jq --arg skill "$skill_id" --arg now "$now" --argjson suggestions "$suggestions" '
        .updated = $now |
        .skills[$skill] = (
            .skills[$skill] // {
                skillId: $skill,
                currentVersion: "1.0.0",
                versions: [],
                suggestions: [],
                editPatterns: {},
                lastAnalyzed: null
            }
        ) |
        .skills[$skill].suggestions = $suggestions |
        .skills[$skill].lastAnalyzed = $now |
        .summary.totalSuggestionsPending = ([.skills[].suggestions[] | select(.status == "pending")] | length)
    ' "$EVOLUTION_REGISTRY" > "$tmp_file" && mv "$tmp_file" "$EVOLUTION_REGISTRY"

    # Output suggestions as JSON
    echo "$suggestions"
}

# List pending suggestions
cmd_pending() {
    local skill_id="${1:-}"

    init_registry

    echo ""
    echo -e "${BOLD}Pending Suggestions${NC}"
    echo "════════════════════════════════════════════════════════════"
    echo ""

    if [[ -n "$skill_id" ]]; then
        # Show pending for specific skill
        local pending
        pending=$(jq -r --arg skill "$skill_id" '
            .skills[$skill].suggestions // [] | map(select(.status == "pending"))
        ' "$EVOLUTION_REGISTRY" 2>/dev/null)

        local count
        count=$(echo "$pending" | jq 'length')

        if [[ "$count" -eq 0 ]]; then
            echo -e "${GREEN}No pending suggestions for $skill_id${NC}"
            exit 0
        fi

        echo -e "${CYAN}$skill_id${NC} ($count pending):"
        echo "$pending" | jq -r '.[] | "  [\(.id)] \(.confidence * 100 | floor)% - \(.type | ascii_upcase) \(.pattern) → \(.target)"'
    else
        # Show all pending
        local has_pending=false

        jq -r '.skills | to_entries[] | select(.value.suggestions != null) | .key' "$EVOLUTION_REGISTRY" 2>/dev/null | while read -r sid; do
            local pending
            pending=$(jq -r --arg skill "$sid" '
                .skills[$skill].suggestions // [] | map(select(.status == "pending"))
            ' "$EVOLUTION_REGISTRY" 2>/dev/null)

            local count
            count=$(echo "$pending" | jq 'length')

            if [[ "$count" -gt 0 ]]; then
                has_pending=true
                echo -e "${CYAN}$sid${NC} ($count pending):"
                echo "$pending" | jq -r '.[] | "  [\(.id)] \(.confidence * 100 | floor)% - \(.type | ascii_upcase) \(.pattern) → \(.target)"'
                echo ""
            fi
        done

        if [[ "$has_pending" == "false" ]]; then
            echo -e "${GREEN}No pending suggestions across all skills.${NC}"
        fi
    fi

    echo ""
    echo "Commands:"
    echo "  accept <skill-id> <suggestion-id>  - Mark as accepted"
    echo "  reject <skill-id> <suggestion-id>  - Mark as rejected"
    echo "  apply <skill-id> <suggestion-id>   - Apply the suggestion"
}

# Accept a suggestion
cmd_accept() {
    local skill_id="${1:-}"
    local suggestion_id="${2:-}"

    if [[ -z "$skill_id" || -z "$suggestion_id" ]]; then
        echo -e "${RED}Error: skill-id and suggestion-id required${NC}"
        echo "Usage: evolution-engine.sh accept <skill-id> <suggestion-id>"
        exit 1
    fi

    local suggestion
    suggestion=$(get_suggestion "$skill_id" "$suggestion_id")

    if [[ -z "$suggestion" || "$suggestion" == "{}" ]]; then
        echo -e "${RED}Error: Suggestion not found${NC}"
        exit 1
    fi

    update_suggestion_status "$skill_id" "$suggestion_id" "accepted"

    echo -e "${GREEN}Accepted suggestion: $suggestion_id${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: evolution-engine.sh apply $skill_id $suggestion_id"
    echo "  2. Or implement manually and run: evolution-engine.sh implement $skill_id $suggestion_id"
}

# Reject a suggestion
cmd_reject() {
    local skill_id="${1:-}"
    local suggestion_id="${2:-}"

    if [[ -z "$skill_id" || -z "$suggestion_id" ]]; then
        echo -e "${RED}Error: skill-id and suggestion-id required${NC}"
        echo "Usage: evolution-engine.sh reject <skill-id> <suggestion-id>"
        exit 1
    fi

    local suggestion
    suggestion=$(get_suggestion "$skill_id" "$suggestion_id")

    if [[ -z "$suggestion" || "$suggestion" == "{}" ]]; then
        echo -e "${RED}Error: Suggestion not found${NC}"
        exit 1
    fi

    update_suggestion_status "$skill_id" "$suggestion_id" "rejected"

    echo -e "${YELLOW}Rejected suggestion: $suggestion_id${NC}"
    echo "This suggestion will not be shown again."
}

# Apply a suggestion
cmd_apply() {
    local skill_id="${1:-}"
    local suggestion_id="${2:-}"

    if [[ -z "$skill_id" || -z "$suggestion_id" ]]; then
        echo -e "${RED}Error: skill-id and suggestion-id required${NC}"
        echo "Usage: evolution-engine.sh apply <skill-id> <suggestion-id>"
        exit 1
    fi

    # Get the suggestion
    local suggestion
    suggestion=$(get_suggestion "$skill_id" "$suggestion_id")

    if [[ -z "$suggestion" || "$suggestion" == "{}" ]]; then
        echo -e "${RED}Error: Suggestion not found${NC}"
        exit 1
    fi

    local status
    status=$(echo "$suggestion" | jq -r '.status')

    if [[ "$status" == "implemented" ]]; then
        echo -e "${YELLOW}Suggestion already implemented${NC}"
        exit 0
    fi

    if [[ "$status" == "rejected" ]]; then
        echo -e "${RED}Cannot apply rejected suggestion${NC}"
        exit 1
    fi

    # Find skill directory
    local skill_dir
    skill_dir=$(find_skill_dir "$skill_id")

    if [[ -z "$skill_dir" ]]; then
        echo -e "${RED}Error: Skill directory not found for $skill_id${NC}"
        exit 1
    fi

    local pattern type target
    pattern=$(echo "$suggestion" | jq -r '.pattern')
    type=$(echo "$suggestion" | jq -r '.type')
    target=$(echo "$suggestion" | jq -r '.target')

    echo ""
    echo -e "${BOLD}Applying Suggestion${NC}"
    echo "────────────────────────────────────"
    echo "Skill: $skill_id"
    echo "Pattern: $pattern"
    echo "Type: $type"
    echo "Target: $target"
    echo ""

    # Create version snapshot before applying
    if [[ -x "$VERSION_MANAGER" ]]; then
        echo -e "${CYAN}Creating version snapshot...${NC}"
        "$VERSION_MANAGER" create "$skill_id" "Before applying: $pattern" 2>/dev/null || true
    fi

    # Apply based on target type
    case "$target" in
        capability)
            if [[ -f "$caps_file" ]]; then
                local cap_name
                cap_name=$(echo "$pattern" | sed 's/add_//' | tr '_' '-')

                local tmp_file
                tmp_file=$(mktemp)

                jq --arg cap "$cap_name" '
                    if .capabilities | type == "array" then
                        .capabilities += [$cap] | .capabilities |= unique
                    else
                        .capabilities[$cap] = {
                            "description": "Auto-added from evolution suggestion"
                        }
                    end
                ' "$caps_file" > "$tmp_file" && mv "$tmp_file" "$caps_file"

                echo -e "${GREEN}Added capability: $cap_name${NC}"
            fi
            ;;

        reference)
            # Create reference file
            local ref_dir="${skill_dir}/references"
            mkdir -p "$ref_dir"

            local ref_name
            ref_name=$(echo "$pattern" | sed 's/add_//' | tr '_' '-')
            local ref_file="${ref_dir}/${ref_name}.md"

            if [[ ! -f "$ref_file" ]]; then
                cat > "$ref_file" << EOF
# ${ref_name^} Reference

Auto-generated reference based on usage patterns.

## Overview

This reference was created because ${pattern} was detected in a high percentage of uses.

## Guidelines

<!-- TODO: Add specific guidelines for ${ref_name} -->

## Examples

<!-- TODO: Add examples -->
EOF
                echo -e "${GREEN}Created reference: references/${ref_name}.md${NC}"
            else
                echo -e "${YELLOW}Reference already exists: references/${ref_name}.md${NC}"
            fi
            ;;

        integration)
            if [[ -f "$caps_file" ]]; then
                local int_name
                int_name=$(echo "$pattern" | sed 's/add_//' | tr '_' '-')

                local tmp_file
                tmp_file=$(mktemp)

                jq --arg int "$int_name" '
                    .integrates_with = ((.integrates_with // []) + [$int] | unique)
                ' "$caps_file" > "$tmp_file" && mv "$tmp_file" "$caps_file"

                echo -e "${GREEN}Added integration: $int_name${NC}"
            fi
            ;;

        template)
            # Note: Templates need manual implementation
            echo -e "${YELLOW}Template modifications require manual implementation.${NC}"
            echo ""
            echo "Recommended action for '$pattern':"
            if [[ "$type" == "add" ]]; then
                echo "  Add ${pattern#add_} pattern to skill templates"
            else
                echo "  Remove ${pattern#remove_} pattern from skill templates"
            fi
            ;;

        *)
            echo -e "${YELLOW}Unknown target type: $target${NC}"
            echo "Please implement this suggestion manually."
            ;;
    esac

    # Update suggestion status
    update_suggestion_status "$skill_id" "$suggestion_id" "implemented"

    echo ""
    echo -e "${GREEN}Suggestion applied and marked as implemented.${NC}"

    # Update registry summary
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local tmp_file
    tmp_file=$(mktemp)

    jq --arg now "$now" '
        .updated = $now |
        .summary.totalSuggestionsImplemented = ([.skills[].suggestions[] | select(.status == "implemented")] | length) |
        .summary.totalSuggestionsPending = ([.skills[].suggestions[] | select(.status == "pending")] | length)
    ' "$EVOLUTION_REGISTRY" > "$tmp_file" && mv "$tmp_file" "$EVOLUTION_REGISTRY"
}

# Generate full evolution report
cmd_report() {
    init_registry

    echo ""
    echo -e "${BOLD}Skill Evolution Report${NC}"
    echo "══════════════════════════════════════════════════════════════"
    echo ""

    # Get all tracked skills
    local skills
    skills=$(get_tracked_skills)

    local skill_count
    skill_count=$(echo "$skills" | jq 'length')

    if [[ "$skill_count" -eq 0 ]]; then
        echo -e "${YELLOW}No skills tracked yet.${NC}"
        echo "Skills will be tracked as you use them."
        exit 0
    fi

    echo -e "${BOLD}Skills Summary:${NC}"
    echo "┌────────────────────────────┬─────────┬─────────┬───────────┬────────────┐"
    echo "│ Skill                      │ Uses    │ Success │ Avg Edits │ Suggestions│"
    echo "├────────────────────────────┼─────────┼─────────┼───────────┼────────────┤"

    echo "$skills" | jq -r '.[]' | while read -r skill_id; do
        local metrics
        metrics=$(get_skill_metrics "$skill_id")

        local uses successes avg_edits
        uses=$(echo "$metrics" | jq -r '.uses // 0')
        successes=$(echo "$metrics" | jq -r '.successes // 0')
        avg_edits=$(echo "$metrics" | jq -r '.avgEdits // 0' | xargs printf "%.1f")

        local success_rate=0
        if [[ "$uses" -gt 0 ]]; then
            success_rate=$(calc_percent_int "$successes" "$uses")
        fi

        # Count suggestions
        local suggestions
        suggestions=$(generate_suggestions "$skill_id")
        local sug_count
        sug_count=$(echo "$suggestions" | jq 'length')

        printf "│ %-26s │ %7d │ %6d%% │ %9s │ %10d │\n" \
            "${skill_id:0:26}" "$uses" "$success_rate" "$avg_edits" "$sug_count"
    done

    echo "└────────────────────────────┴─────────┴─────────┴───────────┴────────────┘"
    echo ""

    # Summary stats
    local total_uses total_successes
    if [[ -f "$METRICS_FILE" ]]; then
        total_uses=$(jq '[.skills[].uses // 0] | add // 0' "$METRICS_FILE")
        total_successes=$(jq '[.skills[].successes // 0] | add // 0' "$METRICS_FILE")
    else
        total_uses=0
        total_successes=0
    fi

    local overall_success=0
    if [[ "$total_uses" -gt 0 ]]; then
        overall_success=$(calc_percent_int "$total_successes" "$total_uses")
    fi

    # Registry summary
    local pending_count implemented_count
    pending_count=$(jq '[.skills[].suggestions[] | select(.status == "pending")] | length' "$EVOLUTION_REGISTRY" 2>/dev/null || echo "0")
    implemented_count=$(jq '[.skills[].suggestions[] | select(.status == "implemented")] | length' "$EVOLUTION_REGISTRY" 2>/dev/null || echo "0")

    echo -e "${BOLD}Summary:${NC}"
    echo "  Skills tracked: $skill_count"
    echo "  Total uses: $total_uses"
    echo "  Overall success rate: ${overall_success}%"
    echo "  Pending suggestions: $pending_count"
    echo "  Implemented suggestions: $implemented_count"
    echo ""

    # Show top suggestions
    echo -e "${BOLD}Top Pending Suggestions:${NC}"

    echo "$skills" | jq -r '.[]' | while read -r skill_id; do
        local sug
        sug=$(generate_suggestions "$skill_id")
        if [[ "$sug" != "[]" ]]; then
            echo "$sug" | jq -r --arg skill "$skill_id" '.[] | "\(.confidence | . * 100 | floor)% | \($skill) | \(.type) \(.pattern)"'
        fi
    done | sort -rn | head -5 | nl -w2 -s". "

    echo ""
}

# Show help
cmd_help() {
    cat << EOF
Evolution Engine - Analyze skill usage and generate improvement suggestions

Usage: evolution-engine.sh <command> [options]

Commands:
  analyze <skill-id>                   Analyze edit patterns for a skill
  suggest <skill-id>                   Generate and save suggestions (JSON output)
  pending [skill-id]                   List pending suggestions
  accept <skill-id> <suggestion-id>    Mark suggestion as accepted
  reject <skill-id> <suggestion-id>    Mark suggestion as rejected (won't appear again)
  apply <skill-id> <suggestion-id>     Apply suggestion to skill files
  report                               Full evolution report for all skills
  help                                 Show this help

Workflow:
  1. Use skills normally - edit patterns are tracked automatically
  2. Run 'analyze <skill>' to see patterns and suggestions
  3. Run 'suggest <skill>' to save suggestions to registry
  4. Run 'pending' to see all pending suggestions
  5. Run 'accept' or 'reject' to triage suggestions
  6. Run 'apply' to automatically implement accepted suggestions

Configuration (environment variables):
  MIN_SAMPLES              Minimum uses before suggestions (default: 5)
  ADD_THRESHOLD            Frequency threshold for add suggestions (default: 0.70)
  REMOVE_THRESHOLD         Frequency threshold for remove suggestions (default: 0.70)
  AUTO_APPLY_CONFIDENCE    Confidence level for auto-apply (default: 0.85)

Files:
  Edit patterns: .claude/feedback/edit-patterns.jsonl
  Registry:      .claude/feedback/evolution-registry.json
  Metrics:       .claude/feedback/metrics.json
EOF
}

# Main
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
    analyze)
        cmd_analyze "$@"
        ;;
    suggest)
        cmd_suggest "$@"
        ;;
    pending)
        cmd_pending "$@"
        ;;
    accept)
        cmd_accept "$@"
        ;;
    reject)
        cmd_reject "$@"
        ;;
    apply)
        cmd_apply "$@"
        ;;
    report)
        cmd_report "$@"
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