#!/bin/bash
# =============================================================================
# OrchestKit Skill Trigger Evaluation Runner
# =============================================================================
# Tests whether skill descriptions correctly trigger for eval prompts.
# Uses claude -p locally with CC Max (free, 5x per query by default).
#
# Usage:
#   npm run eval:trigger -- commit           # one skill
#   npm run eval:trigger -- --all            # all skills with .eval.yaml
#   npm run eval:trigger -- --tag core       # filter by tag
#   npm run eval:trigger -- --reps 3         # override repetitions
#   npm run eval:trigger -- --dry-run        # validate YAML only
#
# Requirements:
#   - yq for YAML parsing
#   - Claude Code CLI (skipped in --dry-run mode)
#   - Run OUTSIDE Claude Code session (unsets CLAUDECODE)
# =============================================================================

set -uo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVALS_DIR="$(dirname "$SCRIPT_DIR")"
SKILLS_EVAL_DIR="$EVALS_DIR/skills"
RESULTS_DIR="$EVALS_DIR/results/skills"
PLUGIN_DIR="plugins/ork"
REPS=5
DRY_RUN=false
SKILL_FILTER=""
TAG_FILTER=""
PASS_THRESHOLD=80  # Minimum recall % to pass

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --all) SKILL_FILTER="__all__"; shift ;;
        --tag) TAG_FILTER="$2"; shift 2 ;;
        --reps) REPS="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --help|-h)
            echo "Usage: $0 [skill-name|--all] [--tag TAG] [--reps N] [--dry-run]"
            exit 0
            ;;
        -*) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
        *) SKILL_FILTER="$1"; shift ;;
    esac
done

if [[ -z "$SKILL_FILTER" ]]; then
    echo -e "${RED}Error: specify a skill name or --all${NC}"
    echo "Usage: $0 [skill-name|--all] [--tag TAG] [--reps N] [--dry-run]"
    exit 1
fi

# Ensure we're not inside a Claude Code session
unset CLAUDECODE 2>/dev/null || true

# Check dependencies
check_deps() {
    if ! command -v yq &> /dev/null; then
        echo -e "${RED}Error: yq is required (brew install yq)${NC}"
        exit 1
    fi
    if [[ "$DRY_RUN" == "false" ]] && ! command -v claude &> /dev/null; then
        echo -e "${YELLOW}Warning: Claude CLI not found — switching to dry-run mode${NC}"
        DRY_RUN=true
    fi
}

# Validate eval YAML schema
validate_yaml() {
    local file="$1"
    local errors=0

    local id; id=$(yq '.id' "$file" 2>/dev/null)
    if [[ -z "$id" || "$id" == "null" ]]; then
        echo -e "  ${RED}Missing: id${NC}"; ((errors++))
    fi

    local trigger_count; trigger_count=$(yq '.trigger_evals | length' "$file" 2>/dev/null)
    if [[ "$trigger_count" -lt 5 ]]; then
        echo -e "  ${YELLOW}Warning: only $trigger_count trigger entries (recommend 5+)${NC}"
    fi

    local true_count; true_count=$(yq '[.trigger_evals[] | select(.should_trigger == true)] | length' "$file" 2>/dev/null)
    local false_count; false_count=$(yq '[.trigger_evals[] | select(.should_trigger == false)] | length' "$file" 2>/dev/null)
    if [[ "$true_count" -lt 3 ]]; then
        echo -e "  ${YELLOW}Warning: only $true_count should_trigger:true entries (recommend 3+)${NC}"
    fi
    if [[ "$false_count" -lt 2 ]]; then
        echo -e "  ${YELLOW}Warning: only $false_count should_trigger:false entries (recommend 2+)${NC}"
    fi

    return "$errors"
}

# Detect skill trigger from stream-json output
detect_trigger() {
    local output_file="$1"
    local skill_name="$2"

    # Check stream-json output for Skill tool invocation or skill name in tool_use
    if grep -qi "\"tool\".*\"Skill\"\|\"name\".*\"Skill\"\|\"skill\".*\"$skill_name\"" "$output_file" 2>/dev/null; then
        echo "true"
        return
    fi

    # Fallback: check if skill content patterns appear (skill was loaded)
    if grep -qi "skill.*$skill_name\|command.*$skill_name\|ork:$skill_name" "$output_file" 2>/dev/null; then
        echo "true"
        return
    fi

    echo "false"
}

# Run one prompt N times and return trigger count
run_prompt() {
    local prompt="$1"
    local skill_name="$2"
    local reps="$3"
    local triggered=0
    local tmpfile; tmpfile=$(mktemp)

    for ((i=1; i<=reps; i++)); do
        claude -p "$prompt" \
            --plugin-dir "$PLUGIN_DIR" \
            --dangerously-skip-permissions \
            --max-turns 1 \
            --output-format stream-json \
            > "$tmpfile" 2>/dev/null

        local result; result=$(detect_trigger "$tmpfile" "$skill_name")
        if [[ "$result" == "true" ]]; then
            ((triggered++))
        fi
    done

    rm -f "$tmpfile"
    echo "$triggered"
}

# Evaluate one skill
eval_skill() {
    local eval_file="$1"
    local skill_id; skill_id=$(yq '.id' "$eval_file")
    local skill_name; skill_name=$(yq '.name' "$eval_file")
    local trigger_count; trigger_count=$(yq '.trigger_evals | length' "$eval_file")
    local start_time; start_time=$(date +%s)

    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  TRIGGER EVAL — ${BOLD}$skill_id${NC}${BLUE}$(printf '%*s' $((36 - ${#skill_id})) '')║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════════════════════╣${NC}"

    # Validate YAML
    echo -e "${CYAN}  Validating YAML...${NC}"
    validate_yaml "$eval_file"

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${BLUE}║${NC}  ${YELLOW}DRY-RUN: YAML valid, skipping Claude calls${NC}"
        echo -e "${BLUE}║${NC}  Triggers: $trigger_count entries"
        echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
        return 0
    fi

    # Run trigger evals
    local tp=0 fp=0 tn=0 fn=0 flaky=0
    local results_json="["

    echo -e "${BLUE}║${NC}  ${BOLD}SHOULD TRIGGER${NC}"

    for ((idx=0; idx<trigger_count; idx++)); do
        local prompt; prompt=$(yq ".trigger_evals[$idx].prompt" "$eval_file")
        local should_trigger; should_trigger=$(yq ".trigger_evals[$idx].should_trigger" "$eval_file")
        local triggered; triggered=$(run_prompt "$prompt" "$skill_id" "$REPS")
        local rate; rate=$(echo "scale=2; $triggered / $REPS" | bc)

        # Determine verdict
        local verdict=""
        local symbol=""
        if [[ "$should_trigger" == "true" ]]; then
            if [[ "$triggered" -eq "$REPS" ]]; then
                verdict="OK"; symbol="${GREEN}✓${NC}"; ((tp++))
            elif [[ "$triggered" -eq 0 ]]; then
                verdict="MISS"; symbol="${RED}✗${NC}"; ((fn++))
            else
                verdict="FLAKY"; symbol="${YELLOW}⚠${NC}"; ((flaky++))
            fi
        else
            # Print header for negatives on first negative
            if [[ "$idx" -gt 0 ]] && [[ "$(yq ".trigger_evals[$((idx-1))].should_trigger" "$eval_file")" == "true" ]]; then
                echo -e "${BLUE}║${NC}  ${BOLD}SHOULD NOT TRIGGER${NC}"
            fi
            if [[ "$triggered" -eq 0 ]]; then
                verdict="OK"; symbol="${GREEN}✓${NC}"; ((tn++))
            elif [[ "$triggered" -eq "$REPS" ]]; then
                verdict="FALSE+"; symbol="${RED}✗${NC}"; ((fp++))
            else
                verdict="FLAKY"; symbol="${YELLOW}⚠${NC}"; ((flaky++))
            fi
        fi

        # Truncate prompt for display
        local display_prompt="${prompt:0:38}"
        [[ ${#prompt} -gt 38 ]] && display_prompt="${display_prompt}..."

        printf "${BLUE}║${NC}  %b %-42s %d/%d  %s\n" "$symbol" "\"$display_prompt\"" "$triggered" "$REPS" "$verdict"

        # Accumulate JSON results
        local triggered_arr="["
        # Simplified: just store count, not per-rep array
        triggered_arr="$triggered/$REPS"
        [[ "$idx" -gt 0 ]] && results_json+=","
        results_json+="{\"prompt\":$(echo "$prompt" | jq -Rs .),\"should_trigger\":$should_trigger,\"triggered\":$triggered,\"reps\":$REPS,\"rate\":$rate,\"verdict\":\"$verdict\"}"
    done

    results_json+="]"

    # Calculate precision and recall
    local precision=0 recall=0
    if [[ $((tp + fp)) -gt 0 ]]; then
        precision=$(echo "scale=1; $tp * 100 / ($tp + $fp)" | bc)
    fi
    if [[ $((tp + fn)) -gt 0 ]]; then
        recall=$(echo "scale=1; $tp * 100 / ($tp + $fn)" | bc)
    fi

    local end_time; end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo -e "${BLUE}╠══════════════════════════════════════════════════════╣${NC}"
    printf "${BLUE}║${NC}  Precision: ${BOLD}%s%%${NC}  │  Recall: ${BOLD}%s%%${NC}  │  %dx reps\n" "$precision" "$recall" "$REPS"
    if [[ "$flaky" -gt 0 ]]; then
        echo -e "${BLUE}║${NC}  ${YELLOW}Flaky: $flaky prompts (1-$((REPS-1)) out of $REPS)${NC}"
    fi
    echo -e "${BLUE}║${NC}  Duration: ${duration}s"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"

    # Write results JSON
    mkdir -p "$RESULTS_DIR"
    cat > "$RESULTS_DIR/$skill_id.trigger.json" <<ENDJSON
{
  "skill": "$skill_id",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "precision": $precision,
  "recall": $recall,
  "true_positives": $tp,
  "false_positives": $fp,
  "true_negatives": $tn,
  "false_negatives": $fn,
  "flaky": $flaky,
  "total_prompts": $trigger_count,
  "reps_per_prompt": $REPS,
  "duration_seconds": $duration,
  "results": $results_json
}
ENDJSON

    # Return pass/fail based on recall threshold
    local recall_int=${recall%.*}
    [[ -z "$recall_int" ]] && recall_int=0
    if [[ "$recall_int" -lt "$PASS_THRESHOLD" ]]; then
        return 1
    fi
    return 0
}

# ─── Main ─────────────────────────────────────────────────────────────────────

check_deps

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  OrchestKit Skill Trigger Evaluation${NC}"
if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${BLUE}  Mode: ${YELLOW}DRY-RUN (YAML validation only)${NC}"
else
    echo -e "${BLUE}  Mode: ${GREEN}LIVE (${REPS}x reps per prompt)${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Collect eval files
eval_files=()
if [[ "$SKILL_FILTER" == "__all__" ]]; then
    for f in "$SKILLS_EVAL_DIR"/*.eval.yaml; do
        [[ -f "$f" ]] || continue
        if [[ -n "$TAG_FILTER" ]]; then
            if yq ".tags[]" "$f" 2>/dev/null | grep -q "$TAG_FILTER"; then
                eval_files+=("$f")
            fi
        else
            eval_files+=("$f")
        fi
    done
else
    local_file="$SKILLS_EVAL_DIR/$SKILL_FILTER.eval.yaml"
    if [[ ! -f "$local_file" ]]; then
        echo -e "${RED}Error: $local_file not found${NC}"
        exit 1
    fi
    eval_files+=("$local_file")
fi

echo -e "  Skills: ${#eval_files[@]}"

# Run evals
total=0
passed=0
failed=0
failed_skills=()

for eval_file in "${eval_files[@]}"; do
    ((total++))
    if eval_skill "$eval_file"; then
        ((passed++))
    else
        ((failed++))
        failed_skills+=("$(yq '.id' "$eval_file")")
    fi
done

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Total:  $total"
echo -e "  Passed: ${GREEN}$passed${NC}"
if [[ "$failed" -gt 0 ]]; then
    echo -e "  Failed: ${RED}$failed${NC} (${failed_skills[*]})"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ "$failed" -gt 0 ]]; then
    exit 1
fi
exit 0
