#!/bin/bash
# =============================================================================
# OrchestKit Skill Quality Evaluation Runner
# =============================================================================
# A/B comparison: skill-assisted output vs baseline Claude output, graded
# against assertions defined in each skill's .eval.yaml quality_evals section.
#
# Usage:
#   npm run eval:quality -- commit           # one skill
#   npm run eval:quality -- --all            # all skills with quality_evals
#   npm run eval:quality -- --capture-only   # run prompts, save outputs, skip grading
#   npm run eval:quality -- --dry-run        # validate YAML only
#   npm run eval:quality -- --reps N         # repeat grading N times for stability
#
# Requirements:
#   - yq for YAML parsing
#   - jq for JSON processing
#   - bc for arithmetic (pass rates, deltas)
#   - Claude Code CLI (skipped in --dry-run mode)
#   - Run OUTSIDE Claude Code session (unsets CLAUDECODE)
# =============================================================================

set -uo pipefail

# Cleanup temp files on exit (Ctrl+C safe)
CLEANUP_FILES=()
cleanup() { rm -f "${CLEANUP_FILES[@]}" 2>/dev/null; }
trap cleanup EXIT INT TERM

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
REPS=1
DRY_RUN=false
CAPTURE_ONLY=false
SKILL_FILTER=""
MAX_TURNS=3

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --all) SKILL_FILTER="__all__"; shift ;;
        --capture-only) CAPTURE_ONLY=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --reps)
            if [[ $# -lt 2 ]]; then
                echo -e "${RED}Error: --reps requires a positive integer${NC}"
                exit 1
            fi
            if ! [[ "$2" =~ ^[1-9][0-9]*$ ]]; then
                echo -e "${RED}Error: --reps must be a positive integer (got: '$2')${NC}"
                exit 1
            fi
            REPS="$2"; shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [skill-name|--all] [--capture-only] [--dry-run] [--reps N]"
            exit 0
            ;;
        -*) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
        *) SKILL_FILTER="$1"; shift ;;
    esac
done

if [[ -z "$SKILL_FILTER" ]]; then
    echo -e "${RED}Error: specify a skill name or --all${NC}"
    echo "Usage: $0 [skill-name|--all] [--capture-only] [--dry-run] [--reps N]"
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
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: jq is required (brew install jq)${NC}"
        exit 1
    fi
    if ! command -v bc &> /dev/null; then
        echo -e "${RED}Error: bc is required (brew install bc)${NC}"
        exit 1
    fi
    if [[ "$DRY_RUN" == "false" ]] && ! command -v claude &> /dev/null; then
        echo -e "${YELLOW}Warning: Claude CLI not found — switching to dry-run mode${NC}"
        DRY_RUN=true
    fi
}

# Validate quality_evals section in YAML
validate_quality_yaml() {
    local file="$1"
    local errors=0

    local id; id=$(yq -r '.id' "$file" 2>/dev/null)
    if [[ -z "$id" || "$id" == "null" ]]; then
        echo -e "  ${RED}Missing: id${NC}"; ((errors++))
    fi

    local quality_count; quality_count=$(yq -r '.quality_evals | length' "$file" 2>/dev/null)
    if [[ "$quality_count" == "null" || "$quality_count" -eq 0 ]]; then
        echo -e "  ${RED}Missing or empty: quality_evals${NC}"; ((errors++))
        return "$errors"
    fi

    # Validate each quality eval entry
    for ((i=0; i<quality_count; i++)); do
        local prompt; prompt=$(yq -r ".quality_evals[$i].prompt" "$file" 2>/dev/null)
        if [[ -z "$prompt" || "$prompt" == "null" ]]; then
            echo -e "  ${RED}quality_evals[$i]: missing prompt${NC}"; ((errors++))
        fi

        local assertion_count; assertion_count=$(yq -r ".quality_evals[$i].assertions | length" "$file" 2>/dev/null)
        if [[ "$assertion_count" == "null" || "$assertion_count" -eq 0 ]]; then
            echo -e "  ${RED}quality_evals[$i]: missing or empty assertions${NC}"; ((errors++))
        fi

        # Validate each assertion has name and check
        for ((j=0; j<assertion_count; j++)); do
            local aname; aname=$(yq -r ".quality_evals[$i].assertions[$j].name" "$file" 2>/dev/null)
            local acheck; acheck=$(yq -r ".quality_evals[$i].assertions[$j].check" "$file" 2>/dev/null)
            if [[ -z "$aname" || "$aname" == "null" ]]; then
                echo -e "  ${RED}quality_evals[$i].assertions[$j]: missing name${NC}"; ((errors++))
            fi
            if [[ -z "$acheck" || "$acheck" == "null" ]]; then
                echo -e "  ${RED}quality_evals[$i].assertions[$j]: missing check${NC}"; ((errors++))
            fi
        done
    done

    return "$errors"
}

# Run a prompt with skill (plugin loaded) and capture output
run_with_skill() {
    local prompt="$1"
    local output_file="$2"
    local stderr_file="$3"

    claude -p "$prompt" \
        --plugin-dir "$PLUGIN_DIR" \
        --dangerously-skip-permissions \
        --max-turns "$MAX_TURNS" \
        --output-format json \
        > "$output_file" 2>"$stderr_file"
}

# Run a prompt without skill (baseline) and capture output
run_baseline() {
    local prompt="$1"
    local output_file="$2"

    claude -p "$prompt" \
        --dangerously-skip-permissions \
        --max-turns "$MAX_TURNS" \
        --output-format json \
        > "$output_file" 2>/dev/null
}

# Extract text content from claude JSON output
extract_output_text() {
    local json_file="$1"
    # Try .result first (common output field), then fall back to full content
    local text
    text=$(jq -r '.result // .content // . | if type == "string" then . else tostring end' "$json_file" 2>/dev/null)
    if [[ -z "$text" || "$text" == "null" ]]; then
        text=$(cat "$json_file" 2>/dev/null)
    fi
    echo "$text"
}

# Grade an output against a single assertion using Claude as grader
# Returns "PASS|reason" or "FAIL|reason"
grade_assertion() {
    local assertion_check="$1"
    local output_text="$2"
    local tmpfile; tmpfile=$(mktemp)
    CLEANUP_FILES+=("$tmpfile")

    local grading_prompt
    grading_prompt="Grade this output against the assertion. Output ONLY 'PASS' or 'FAIL' followed by a one-line reason.

ASSERTION: $assertion_check

OUTPUT:
$output_text"

    claude -p "$grading_prompt" \
        --max-turns 1 \
        --output-format text \
        > "$tmpfile" 2>/dev/null

    local grader_output; grader_output=$(cat "$tmpfile")
    rm -f "$tmpfile"

    # Parse PASS/FAIL from grader output
    if echo "$grader_output" | grep -qiw "PASS"; then
        local reason; reason=$(echo "$grader_output" | sed 's/^[[:space:]]*PASS[[:space:]]*//' | head -1)
        echo "PASS|$reason"
    else
        local reason; reason=$(echo "$grader_output" | sed 's/^[[:space:]]*FAIL[[:space:]]*//' | head -1)
        echo "FAIL|$reason"
    fi
}

# Grade with majority vote across N reps
grade_assertion_with_reps() {
    local assertion_check="$1"
    local output_text="$2"
    local reps="$3"

    local pass_count=0
    local last_reason=""

    for ((r=1; r<=reps; r++)); do
        local result; result=$(grade_assertion "$assertion_check" "$output_text")
        local verdict; verdict=$(echo "$result" | cut -d'|' -f1)
        local reason; reason=$(echo "$result" | cut -d'|' -f2-)
        last_reason="$reason"
        if [[ "$verdict" == "PASS" ]]; then
            ((pass_count++))
        fi
    done

    # Majority vote
    local majority; majority=$(( (reps / 2) + 1 ))
    if [[ "$pass_count" -ge "$majority" ]]; then
        echo "PASS|$last_reason"
    else
        echo "FAIL|$last_reason"
    fi
}

# Check stderr for hook rejections
count_hook_rejections() {
    local stderr_file="$1"
    if [[ -f "$stderr_file" ]]; then
        grep -ciw "reject\|rejected\|hook.*fail\|hook.*block" "$stderr_file" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Evaluate one skill
eval_skill() {
    local eval_file="$1"
    local skill_id; skill_id=$(yq -r '.id' "$eval_file")
    local quality_count; quality_count=$(yq -r '.quality_evals | length' "$eval_file")
    local start_time; start_time=$(date +%s)

    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  QUALITY EVAL — ${BOLD}$skill_id${NC}${BLUE}$(printf '%*s' $((36 - ${#skill_id})) '')║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════════════════════╣${NC}"

    # Validate YAML
    echo -e "${CYAN}  Validating quality_evals YAML...${NC}"
    if ! validate_quality_yaml "$eval_file"; then
        echo -e "${BLUE}║${NC}  ${RED}YAML validation failed — skipping${NC}"
        echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
        return 1
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${BLUE}║${NC}  ${YELLOW}DRY-RUN: YAML valid, skipping Claude calls${NC}"
        echo -e "${BLUE}║${NC}  Quality evals: $quality_count entries"
        local total_assertions=0
        for ((i=0; i<quality_count; i++)); do
            local ac; ac=$(yq -r ".quality_evals[$i].assertions | length" "$eval_file")
            total_assertions=$((total_assertions + ac))
        done
        echo -e "${BLUE}║${NC}  Total assertions: $total_assertions"
        echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
        return 0
    fi

    # Aggregate counters
    local agg_skill_pass=0 agg_skill_total=0
    local agg_base_pass=0 agg_base_total=0
    local agg_discriminating=0
    local agg_hook_rejections=0
    local evals_json="["
    local first_eval=true

    # Iterate over each quality eval entry
    for ((ei=0; ei<quality_count; ei++)); do
        local prompt; prompt=$(yq -r ".quality_evals[$ei].prompt" "$eval_file")
        local assertion_count; assertion_count=$(yq -r ".quality_evals[$ei].assertions | length" "$eval_file")

        # Truncate prompt for display
        local display_prompt; display_prompt=$(echo "$prompt" | tr '\n' ' ' | sed 's/  */ /g')
        display_prompt="${display_prompt:0:48}"
        [[ ${#prompt} -gt 48 ]] && display_prompt="${display_prompt}..."

        echo -e "${BLUE}║${NC}"
        echo -e "${BLUE}║${NC}  ${BOLD}Eval $((ei+1)):${NC} \"$display_prompt\""
        echo -e "${BLUE}║${NC}"

        # Run with skill
        local with_file; with_file=$(mktemp)
        local with_stderr; with_stderr=$(mktemp)
        CLEANUP_FILES+=("$with_file" "$with_stderr")
        echo -e "${BLUE}║${NC}  ${CYAN}Running with skill...${NC}"
        run_with_skill "$prompt" "$with_file" "$with_stderr"
        local with_text; with_text=$(extract_output_text "$with_file")

        # Run baseline
        local base_file; base_file=$(mktemp)
        CLEANUP_FILES+=("$base_file")
        echo -e "${BLUE}║${NC}  ${CYAN}Running baseline...${NC}"
        run_baseline "$prompt" "$base_file"
        local base_text; base_text=$(extract_output_text "$base_file")

        # Check hook rejections from with-skill stderr
        local hook_rej; hook_rej=$(count_hook_rejections "$with_stderr")
        agg_hook_rejections=$((agg_hook_rejections + hook_rej))

        if [[ "$CAPTURE_ONLY" == "true" ]]; then
            echo -e "${BLUE}║${NC}  ${YELLOW}CAPTURE-ONLY: outputs saved, skipping grading${NC}"
            # Save captured outputs for manual review
            mkdir -p "$RESULTS_DIR"
            cp "$with_file" "$RESULTS_DIR/${skill_id}.eval${ei}.with_skill.json"
            cp "$base_file" "$RESULTS_DIR/${skill_id}.eval${ei}.baseline.json"
            continue
        fi

        # Grade each assertion against both outputs
        local eval_skill_pass=0 eval_base_pass=0 eval_discriminating=0
        local assertions_json="["
        local first_assertion=true

        printf "${BLUE}║${NC}  %-25s %-14s %-14s\n" "" "With Skill" "Baseline"

        for ((ai=0; ai<assertion_count; ai++)); do
            local aname; aname=$(yq -r ".quality_evals[$ei].assertions[$ai].name" "$eval_file")
            local acheck; acheck=$(yq -r ".quality_evals[$ei].assertions[$ai].check" "$eval_file")

            # Grade with skill output
            local skill_result; skill_result=$(grade_assertion_with_reps "$acheck" "$with_text" "$REPS")
            local skill_verdict; skill_verdict=$(echo "$skill_result" | cut -d'|' -f1)
            local skill_reason; skill_reason=$(echo "$skill_result" | cut -d'|' -f2-)

            # Grade baseline output
            local base_result; base_result=$(grade_assertion_with_reps "$acheck" "$base_text" "$REPS")
            local base_verdict; base_verdict=$(echo "$base_result" | cut -d'|' -f1)
            local base_reason; base_reason=$(echo "$base_result" | cut -d'|' -f2-)

            # Track pass counts
            [[ "$skill_verdict" == "PASS" ]] && ((eval_skill_pass++))
            [[ "$base_verdict" == "PASS" ]] && ((eval_base_pass++))

            # Determine if discriminating
            local is_discriminating=false
            local disc_marker=""
            if [[ "$skill_verdict" != "$base_verdict" ]]; then
                is_discriminating=true
                ((eval_discriminating++))
            else
                disc_marker="  (=)"
            fi

            # Display row
            local skill_sym base_sym
            [[ "$skill_verdict" == "PASS" ]] && skill_sym="${GREEN}PASS${NC}" || skill_sym="${RED}FAIL${NC}"
            [[ "$base_verdict" == "PASS" ]] && base_sym="${GREEN}PASS${NC}" || base_sym="${RED}FAIL${NC}"

            # Use raw formatting to align columns properly
            local padded_name; padded_name=$(printf "%-23s" "$aname")
            echo -e "${BLUE}║${NC}  ${padded_name}  $skill_sym       $base_sym${disc_marker}"

            # Accumulate assertion JSON
            [[ "$first_assertion" == "true" ]] && first_assertion=false || assertions_json+=","
            assertions_json+="{\"name\":$(echo "$aname" | jq -Rs .),\"check\":$(echo "$acheck" | jq -Rs .),\"with_skill\":\"$skill_verdict\",\"baseline\":\"$base_verdict\",\"discriminating\":$is_discriminating,\"grader_reason\":$(echo "$skill_reason" | jq -Rs .)}"
        done

        assertions_json+="]"

        # Per-eval metrics
        local skill_rate=0 base_rate=0 delta=0
        if [[ "$assertion_count" -gt 0 ]]; then
            skill_rate=$(echo "scale=0; $eval_skill_pass * 100 / $assertion_count" | bc)
            base_rate=$(echo "scale=0; $eval_base_pass * 100 / $assertion_count" | bc)
            delta=$((skill_rate - base_rate))
        fi

        echo -e "${BLUE}║${NC}"
        echo -e "${BLUE}║${NC}  Score: ${BOLD}$eval_skill_pass/$assertion_count ($skill_rate%)${NC}  vs  $eval_base_pass/$assertion_count ($base_rate%)   ${BOLD}D ${delta}%${NC}"

        # Update aggregates
        agg_skill_pass=$((agg_skill_pass + eval_skill_pass))
        agg_base_pass=$((agg_base_pass + eval_base_pass))
        agg_skill_total=$((agg_skill_total + assertion_count))
        agg_base_total=$((agg_base_total + assertion_count))
        agg_discriminating=$((agg_discriminating + eval_discriminating))

        # Accumulate eval JSON
        [[ "$first_eval" == "true" ]] && first_eval=false || evals_json+=","
        evals_json+="{\"prompt\":$(echo "$prompt" | jq -Rs .),\"assertions\":$assertions_json,\"skill_pass_rate\":$skill_rate,\"baseline_pass_rate\":$base_rate,\"delta\":$delta}"

        # Clean up temp files for this eval entry
        rm -f "$with_file" "$with_stderr" "$base_file"
    done

    evals_json+="]"

    if [[ "$CAPTURE_ONLY" == "true" ]]; then
        echo -e "${BLUE}╠══════════════════════════════════════════════════════╣${NC}"
        echo -e "${BLUE}║${NC}  ${YELLOW}Outputs saved to $RESULTS_DIR/${NC}"
        echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
        return 0
    fi

    # Aggregate metrics
    local agg_skill_rate=0 agg_base_rate=0 agg_delta=0
    if [[ "$agg_skill_total" -gt 0 ]]; then
        agg_skill_rate=$(echo "scale=0; $agg_skill_pass * 100 / $agg_skill_total" | bc)
        agg_base_rate=$(echo "scale=0; $agg_base_pass * 100 / $agg_base_total" | bc)
        agg_delta=$((agg_skill_rate - agg_base_rate))
    fi

    # Determine verdict
    local verdict verdict_display
    if [[ "$agg_delta" -gt 0 ]]; then
        verdict="SKILL_ADDS_VALUE"
        verdict_display="${GREEN}SKILL ADDS VALUE${NC}"
    elif [[ "$agg_delta" -eq 0 ]]; then
        verdict="NEUTRAL"
        verdict_display="${YELLOW}NEUTRAL${NC}"
    else
        verdict="SKILL_REGRESSES"
        verdict_display="${RED}SKILL REGRESSES${NC}"
    fi

    # Non-discriminating count
    local non_disc=$((agg_skill_total - agg_discriminating))

    local end_time; end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo -e "${BLUE}╠══════════════════════════════════════════════════════╣${NC}"
    if [[ "$non_disc" -gt 0 ]]; then
        echo -e "${BLUE}║${NC}  ${YELLOW}Non-discriminating: $non_disc assertion(s)${NC}"
    fi
    echo -e "${BLUE}║${NC}  Hook rejections: $agg_hook_rejections"
    echo -e "${BLUE}║${NC}  Verdict: ${BOLD}$verdict_display${NC}"
    echo -e "${BLUE}║${NC}  Duration: ${duration}s"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"

    # Write results JSON
    mkdir -p "$RESULTS_DIR"
    cat > "$RESULTS_DIR/$skill_id.quality.json" <<ENDJSON
{
  "skill": "$skill_id",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "evals": $evals_json,
  "aggregate": {
    "skill_pass_rate": $agg_skill_rate,
    "baseline_pass_rate": $agg_base_rate,
    "delta": $agg_delta,
    "discriminating_assertions": $agg_discriminating,
    "total_assertions": $agg_skill_total,
    "hook_rejections": $agg_hook_rejections,
    "verdict": "$verdict"
  },
  "reps": $REPS,
  "duration_seconds": $duration
}
ENDJSON

    # Return pass/fail: regress = failure
    if [[ "$verdict" == "SKILL_REGRESSES" ]]; then
        return 1
    fi
    return 0
}

# ─── Main ─────────────────────────────────────────────────────────────────────

check_deps

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  OrchestKit Skill Quality Evaluation${NC}"
if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${BLUE}  Mode: ${YELLOW}DRY-RUN (YAML validation only)${NC}"
elif [[ "$CAPTURE_ONLY" == "true" ]]; then
    echo -e "${BLUE}  Mode: ${YELLOW}CAPTURE-ONLY (outputs saved, no grading)${NC}"
else
    echo -e "${BLUE}  Mode: ${GREEN}LIVE (grading with ${REPS}x reps)${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Collect eval files (only those with quality_evals)
eval_files=()
if [[ "$SKILL_FILTER" == "__all__" ]]; then
    for f in "$SKILLS_EVAL_DIR"/*.eval.yaml; do
        [[ -f "$f" ]] || continue
        local_quality_count=$(yq -r '.quality_evals | length' "$f" 2>/dev/null)
        if [[ "$local_quality_count" != "null" && "$local_quality_count" -gt 0 ]]; then
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
        failed_skills+=("$(yq -r '.id' "$eval_file")")
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
