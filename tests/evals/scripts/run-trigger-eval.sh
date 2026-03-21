#!/bin/bash
# =============================================================================
# OrchestKit Skill Trigger Evaluation Runner
# =============================================================================
# Tests whether skill descriptions correctly trigger for eval prompts.
# Uses CC 2.1.74+ --json-schema for structured classification:
#   1. Extracts user-invocable skill names + descriptions from plugin frontmatter
#   2. Sends classification prompt via claude -p with --json-schema
#   3. Parses structured_output from JSON response for skill match
# No --plugin-dir or --dangerously-skip-permissions needed.
#
# Usage:
#   npm run eval:trigger -- commit           # one skill
#   npm run eval:trigger -- --all            # all skills with .eval.yaml
#   npm run eval:trigger -- --tag core       # filter by tag
#   npm run eval:trigger -- --reps 3         # override repetitions
#   npm run eval:trigger -- --max-turns N    # override max turns (default 2)
#   npm run eval:trigger -- --timeout N      # override timeout (seconds)
#   npm run eval:trigger -- --dry-run        # validate YAML only
#
# Requirements:
#   - yq for YAML parsing
#   - jq for JSON parsing (structured_output extraction)
#   - bc for arithmetic (precision/recall)
#   - Claude Code CLI >= 2.1.74 (--json-schema support, tested on 2.1.75)
#   - Run OUTSIDE Claude Code session (unsets CLAUDECODE)
# =============================================================================

# Configuration (set BEFORE sourcing common lib so check_deps can use DRY_RUN)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false

# Source shared library (A1)
# shellcheck source=lib/eval-common.sh
source "$SCRIPT_DIR/lib/eval-common.sh"

# Runner-specific configuration
EVALS_DIR="$(dirname "$SCRIPT_DIR")"
SKILLS_EVAL_DIR="$EVALS_DIR/skills"
RESULTS_DIR="$EVALS_DIR/results/skills"
PLUGIN_DIR="plugins/ork"
REPS=3
SKILL_FILTER=""
TAG_FILTER=""
FORCE_EVAL=false
PASS_THRESHOLD=80  # Minimum recall % to pass
MAX_TURNS=2        # json-schema uses tool_use internally, needs 2 turns
GEN_TIMEOUT=60
SKILLS_CATALOG=""  # Built at startup from plugin skill frontmatter

# JSON schema for structured trigger detection (CC 2.1.74+)
TRIGGER_SCHEMA='{"type":"object","properties":{"skill_triggered":{"type":"boolean"},"skill_name":{"type":"string"},"confidence":{"type":"number"}},"required":["skill_triggered","skill_name","confidence"]}'
CLASSIFIER_SYSTEM_PROMPT="You are a skill classifier. Given a list of available skills and a user prompt, determine which skill best matches the user's intent. If no skill matches, set skill_triggered to false. Respond with the JSON schema output."

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --all) SKILL_FILTER="__all__"; shift ;;
        --tag)
            if [[ $# -lt 2 ]]; then
                echo -e "${RED}Error: --tag requires a value${NC}"
                exit 1
            fi
            TAG_FILTER="$2"; shift 2
            ;;
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
        --max-turns)
            if [[ $# -lt 2 ]]; then
                echo -e "${RED}Error: --max-turns requires a positive integer${NC}"; exit 1
            fi
            if ! [[ "$2" =~ ^[1-9][0-9]*$ ]]; then
                echo -e "${RED}Error: --max-turns must be a positive integer${NC}"; exit 1
            fi
            MAX_TURNS="$2"; shift 2
            ;;
        --timeout)
            if [[ $# -lt 2 ]]; then
                echo -e "${RED}Error: --timeout requires a positive integer${NC}"; exit 1
            fi
            if ! [[ "$2" =~ ^[1-9][0-9]*$ ]]; then
                echo -e "${RED}Error: --timeout must be a positive integer (seconds)${NC}"; exit 1
            fi
            GEN_TIMEOUT="$2"; shift 2
            ;;
        --dry-run) DRY_RUN=true; shift ;;
        --force) FORCE_EVAL=true; shift ;;
        --help|-h)
            echo "Usage: $0 [skill-name|--all] [--tag TAG] [--reps N] [--max-turns N] [--timeout N] [--dry-run] [--force]"
            exit 0
            ;;
        -*) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
        *) SKILL_FILTER="$1"; shift ;;
    esac
done

if [[ -z "$SKILL_FILTER" ]]; then
    echo -e "${RED}Error: specify a skill name or --all${NC}"
    echo "Usage: $0 [skill-name|--all] [--tag TAG] [--reps N] [--max-turns N] [--timeout N] [--dry-run]"
    exit 1
fi

# Validate skill name to prevent path traversal
if [[ "$SKILL_FILTER" != "__all__" ]] && ! [[ "$SKILL_FILTER" =~ $SKILL_NAME_RE ]]; then
    echo -e "${RED}Error: invalid skill name (lowercase alphanumeric and hyphens only)${NC}"
    exit 1
fi

# ─── Functions ────────────────────────────────────────────────────────────────

# Validate eval YAML schema
validate_yaml() {
    local file="$1"
    local errors=0

    local id; id=$(yq -r '.id' "$file" 2>/dev/null)
    if [[ -z "$id" || "$id" == "null" ]]; then
        echo -e "  ${RED}Missing: id${NC}"; ((errors++))
    fi

    local trigger_count; trigger_count=$(yq -r '.trigger_evals | length' "$file" 2>/dev/null)
    if [[ "$trigger_count" -lt 5 ]]; then
        echo -e "  ${YELLOW}Warning: only $trigger_count trigger entries (recommend 5+)${NC}"
    fi

    local true_count; true_count=$(yq -r '[.trigger_evals[] | select(.should_trigger == true)] | length' "$file" 2>/dev/null)
    local false_count; false_count=$(yq -r '[.trigger_evals[] | select(.should_trigger == false)] | length' "$file" 2>/dev/null)
    if [[ "$true_count" -lt 3 ]]; then
        echo -e "  ${YELLOW}Warning: only $true_count should_trigger:true entries (recommend 3+)${NC}"
    fi
    if [[ "$false_count" -lt 2 ]]; then
        echo -e "  ${YELLOW}Warning: only $false_count should_trigger:false entries (recommend 2+)${NC}"
    fi

    return "$errors"
}

# Build skills catalog from plugin skill frontmatter (run once at startup)
build_skills_catalog() {
    local catalog=""
    for skill_dir in "$PLUGIN_DIR"/skills/*/; do
        local skill_file="$skill_dir/SKILL.md"
        [[ -f "$skill_file" ]] || continue
        local name; name=$(grep '^name:' "$skill_file" | head -1 | sed 's/name: *//' | tr -d '"')
        local desc; desc=$(grep '^description:' "$skill_file" | head -1 | sed 's/description: *//' | tr -d '"')
        local invocable; invocable=$(grep '^user-invocable:' "$skill_file" | head -1 | sed 's/user-invocable: *//' | tr -d '"')
        [[ "$invocable" == "true" ]] && catalog="$catalog- ork:$name: $desc\n"
    done
    SKILLS_CATALOG="$catalog"
}

# Detect skill trigger from --json-schema structured output (CC 2.1.74+)
# Uses structured_output field from --output-format json response.
detect_trigger() {
    local output_file="$1"
    local skill_name="$2"

    # Parse structured_output from JSON response
    local triggered_skill
    triggered_skill=$(jq -r '.structured_output.skill_name // empty' "$output_file" 2>/dev/null)
    local was_triggered
    was_triggered=$(jq -r '.structured_output.skill_triggered // false' "$output_file" 2>/dev/null)

    if [[ "$was_triggered" == "true" && "$triggered_skill" == "ork:$skill_name" ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# CC 2.1.81: --bare flag (computed once, not per-call)
BARE_FLAG=()
if [[ "$BARE_MODE" == "true" ]]; then BARE_FLAG=(--bare); fi

# Run one prompt N times and return trigger count (A6: timeout)
# Uses --json-schema for structured classification instead of plugin execution.
run_prompt() {
    local prompt="$1"
    local skill_name="$2"
    local reps="$3"
    local triggered=0
    local tmpfile; tmpfile=$(mktemp)
    CLEANUP_FILES+=("$tmpfile")

    local classification_prompt
    classification_prompt="Which skill would be triggered by this user prompt: \"$prompt\"

Available skills:
$(echo -e "$SKILLS_CATALOG")"

    for ((i=1; i<=reps; i++)); do
        run_with_timeout "$GEN_TIMEOUT" claude -p "$classification_prompt" \
            "${BARE_FLAG[@]}" \
            --system-prompt "$CLASSIFIER_SYSTEM_PROMPT" \
            --output-format json \
            --json-schema "$TRIGGER_SCHEMA" \
            --max-turns "$MAX_TURNS" \
            > "$tmpfile" 2>/dev/null || true

        local result; result=$(detect_trigger "$tmpfile" "$skill_name")
        if [[ "$result" == "true" ]]; then
            ((triggered++))
        fi
    done

    rm -f "$tmpfile"
    echo "$triggered"
}

# Run one eval entry in isolation — writes result to a temp file for parallel collection.
# Args: eval_file, idx, skill_id, reps, result_dir
run_prompt_parallel() {
    local eval_file="$1"
    local idx="$2"
    local skill_id="$3"
    local reps="$4"
    local result_dir="$5"

    local prompt; prompt=$(yq -r ".trigger_evals[$idx].prompt" "$eval_file")
    local should_trigger; should_trigger=$(yq -r ".trigger_evals[$idx].should_trigger" "$eval_file")
    local triggered; triggered=$(run_prompt "$prompt" "$skill_id" "$reps")
    local rate; rate=$(echo "scale=2; $triggered / $reps" | bc)

    # Write result to file for parent to collect
    echo "${idx}|${should_trigger}|${triggered}|${reps}|${rate}|${prompt}" > "$result_dir/result_${idx}"
}

# Max parallel prompt workers (controls concurrency)
MAX_PARALLEL=${EVAL_MAX_PARALLEL:-6}

# Evaluate one skill
eval_skill() {
    local eval_file="$1"
    local skill_id; skill_id=$(yq -r '.id' "$eval_file")
    local skill_name; skill_name=$(yq -r '.name' "$eval_file")
    local trigger_count; trigger_count=$(yq -r '.trigger_evals | length' "$eval_file")
    local start_time; start_time=$(date +%s)

    # Skip skills with no trigger_evals (don't print noisy empty boxes)
    if [[ "$trigger_count" -eq 0 && "$DRY_RUN" == "false" ]]; then
        return 0
    fi

    # Skip non-invocable skills — trigger eval only tests slash command routing
    if [[ "$DRY_RUN" == "false" && "$trigger_count" -gt 0 ]]; then
        local skill_md="src/skills/$skill_id/SKILL.md"
        if [[ -f "$skill_md" ]]; then
            local invocable; invocable=$(grep '^user-invocable:' "$skill_md" | awk '{print $2}')
            if [[ "$invocable" != "true" ]]; then
                echo -e "  ${CYAN}$skill_id${NC}: ${YELLOW}SKIP (not user-invocable, trigger eval N/A)${NC}"
                return 0
            fi
        fi
    fi

    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  TRIGGER EVAL — ${BOLD}$skill_id${NC}${BLUE}$(printf '%*s' $((36 - ${#skill_id})) '')║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════════════════════╣${NC}"

    # Validate YAML
    echo -e "${CYAN}  Validating YAML...${NC}"
    if ! validate_yaml "$eval_file"; then
        echo -e "${BLUE}║${NC}  ${RED}YAML validation failed — skipping${NC}"
        echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
        return 1
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${BLUE}║${NC}  ${YELLOW}DRY-RUN: YAML valid, skipping Claude calls${NC}"
        echo -e "${BLUE}║${NC}  Triggers: $trigger_count entries"
        echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
        return 0
    fi

    # --- Parallel prompt execution ---
    # Launch all prompts concurrently (up to MAX_PARALLEL), collect results via temp files.
    local result_dir; result_dir=$(mktemp -d)
    CLEANUP_DIRS+=("$result_dir")
    local pids=()
    local running=0

    echo -e "${BLUE}║${NC}  ${CYAN}Running $trigger_count prompts × $REPS reps (${MAX_PARALLEL} parallel)...${NC}"

    for ((idx=0; idx<trigger_count; idx++)); do
        run_prompt_parallel "$eval_file" "$idx" "$skill_id" "$REPS" "$result_dir" &
        pids+=($!)
        ((running++))

        # Throttle to MAX_PARALLEL
        if [[ "$running" -ge "$MAX_PARALLEL" ]]; then
            wait "${pids[0]}" 2>/dev/null || true
            pids=("${pids[@]:1}")
            ((running--))
        fi
    done

    # Wait for remaining
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done

    # --- Collect results (sorted by index) ---
    local tp=0 fp=0 tn=0 fn=0 flaky=0
    local tp_partial="0" fp_partial="0"
    local results_json="["
    local first_result=true

    # Two-pass display: should_trigger=true first, then false
    for pass in true false; do
        if [[ "$pass" == "true" ]]; then
            echo -e "${BLUE}║${NC}  ${BOLD}SHOULD TRIGGER${NC}"
        else
            echo -e "${BLUE}║${NC}  ${BOLD}SHOULD NOT TRIGGER${NC}"
        fi

        for ((idx=0; idx<trigger_count; idx++)); do
            local rfile="$result_dir/result_${idx}"
            [[ -f "$rfile" ]] || continue

            IFS='|' read -r _idx should_trigger triggered reps rate prompt < "$rfile"
            [[ "$should_trigger" != "$pass" ]] && continue

            # Determine verdict
            local verdict="" symbol=""
            if [[ "$should_trigger" == "true" ]]; then
                if [[ "$triggered" -eq "$reps" ]]; then
                    verdict="OK"; symbol="${GREEN}v${NC}"; ((tp++))
                    tp_partial=$(echo "$tp_partial + 1" | bc)
                elif [[ "$triggered" -eq 0 ]]; then
                    verdict="MISS"; symbol="${RED}x${NC}"; ((fn++))
                else
                    verdict="FLAKY"; symbol="${YELLOW}~${NC}"; ((flaky++))
                    tp_partial=$(echo "$tp_partial + $rate" | bc)
                fi
            else
                if [[ "$triggered" -eq 0 ]]; then
                    verdict="OK"; symbol="${GREEN}v${NC}"; ((tn++))
                elif [[ "$triggered" -eq "$reps" ]]; then
                    verdict="FALSE+"; symbol="${RED}x${NC}"; ((fp++))
                    fp_partial=$(echo "$fp_partial + 1" | bc)
                else
                    verdict="FLAKY"; symbol="${YELLOW}~${NC}"; ((flaky++))
                    fp_partial=$(echo "$fp_partial + $rate" | bc)
                fi
            fi

            local display_prompt="${prompt:0:38}"
            [[ ${#prompt} -gt 38 ]] && display_prompt="${display_prompt}..."

            printf "${BLUE}║${NC}  %b %-42s %d/%d  %s\n" "$symbol" "\"$display_prompt\"" "$triggered" "$reps" "$verdict"

            [[ "$first_result" == "true" ]] && first_result=false || results_json+=","
            results_json+="{\"prompt\":$(echo "$prompt" | jq -Rs .),\"should_trigger\":$should_trigger,\"triggered\":$triggered,\"reps\":$REPS,\"rate\":$rate,\"verdict\":\"$verdict\"}"
        done
    done

    results_json+="]"
    rm -rf "$result_dir"

    # Calculate effective precision and recall (flaky = partial weight)
    local precision=0 recall=0 eff_recall=0 eff_precision=0
    if [[ $((tp + fp)) -gt 0 ]]; then
        precision=$(echo "scale=1; $tp * 100 / ($tp + $fp)" | bc)
    fi
    if [[ $((tp + fn)) -gt 0 ]]; then
        recall=$(echo "scale=1; $tp * 100 / ($tp + $fn)" | bc)
    fi
    local tp_fn_partial; tp_fn_partial=$(echo "$tp_partial + $fn" | bc)
    if [[ $(echo "$tp_fn_partial > 0" | bc) -eq 1 ]]; then
        eff_recall=$(echo "scale=1; $tp_partial * 100 / $tp_fn_partial" | bc)
    fi
    local tp_fp_partial; tp_fp_partial=$(echo "$tp_partial + $fp_partial" | bc)
    if [[ $(echo "$tp_fp_partial > 0" | bc) -eq 1 ]]; then
        eff_precision=$(echo "scale=1; $tp_partial * 100 / $tp_fp_partial" | bc)
    fi

    local end_time; end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo -e "${BLUE}╠══════════════════════════════════════════════════════╣${NC}"
    printf "${BLUE}║${NC}  Precision: ${BOLD}%s%%${NC}  │  Recall: ${BOLD}%s%%${NC}  │  %dx reps\n" "$precision" "$recall" "$REPS"
    if [[ "$flaky" -gt 0 ]]; then
        echo -e "${BLUE}║${NC}  ${YELLOW}Flaky: $flaky prompts (1-$((REPS-1)) out of $REPS)${NC}"
        printf "${BLUE}║${NC}  Effective (flaky-weighted): P=${BOLD}%s%%${NC}  R=${BOLD}%s%%${NC}\n" "$eff_precision" "$eff_recall"
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
  "effective_precision": $eff_precision,
  "effective_recall": $eff_recall,
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

    # Return pass/fail based on effective recall threshold
    local eff_recall_int=${eff_recall%.*}
    [[ -z "$eff_recall_int" ]] && eff_recall_int=0
    if [[ "$eff_recall_int" -lt "$PASS_THRESHOLD" ]]; then
        return 1
    fi
    return 0
}

# ─── Main ─────────────────────────────────────────────────────────────────────

check_deps

# Build skills catalog for --json-schema classification
if [[ "$DRY_RUN" == "false" ]]; then
    echo -e "${CYAN}  Building skills catalog...${NC}"
    build_skills_catalog
    skill_count=$(echo -e "$SKILLS_CATALOG" | grep -c "^- ork:" || true)
    if [[ "$skill_count" -eq 0 ]]; then
        echo -e "${RED}Error: No user-invocable skills found in $PLUGIN_DIR/skills/${NC}"
        exit 1
    fi
    echo -e "${GREEN}  Found $skill_count user-invocable skills${NC}"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  OrchestKit Skill Trigger Evaluation${NC}"
if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${BLUE}  Mode: ${YELLOW}DRY-RUN (YAML validation only)${NC}"
else
    echo -e "${BLUE}  Mode: ${GREEN}LIVE (${REPS}x reps, --json-schema classifier)${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Collect eval files
eval_files=()
if [[ "$SKILL_FILTER" == "__all__" ]]; then
    for f in "$SKILLS_EVAL_DIR"/*.eval.yaml; do
        [[ -f "$f" ]] || continue
        if [[ -n "$TAG_FILTER" ]]; then
            if yq -r ".tags[]" "$f" 2>/dev/null | grep -q "$TAG_FILTER"; then
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
skipped=0
failed_skills=()

for eval_file in "${eval_files[@]}"; do
    local_skill_id=$(yq -r '.id' "$eval_file")

    # Content hash cache: skip if unchanged (unless --force)
    if [[ "$DRY_RUN" == "false" && "$FORCE_EVAL" == "false" ]]; then
        if check_eval_cache "$local_skill_id" "trigger"; then
            echo -e "  ${CYAN}$local_skill_id${NC}: ${GREEN}CACHED${NC} (unchanged, use --force to re-eval)"
            ((skipped++))
            ((total++))
            ((passed++))
            continue
        fi
    fi

    ((total++))
    if eval_skill "$eval_file"; then
        ((passed++))
        # Save cache on success
        [[ "$DRY_RUN" == "false" ]] && save_eval_cache "$local_skill_id" "trigger"
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
[[ "$skipped" -gt 0 ]] && echo -e "  Cached: ${CYAN}$skipped${NC}"
echo -e "  Passed: ${GREEN}$passed${NC}"
if [[ "$failed" -gt 0 ]]; then
    echo -e "  Failed: ${RED}$failed${NC} (${failed_skills[*]})"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ "$failed" -gt 0 ]]; then
    exit 1
fi
exit 0
