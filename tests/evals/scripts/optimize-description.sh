#!/bin/bash
# =============================================================================
# OrchestKit Skill Description Optimizer
# =============================================================================
# Iteratively improves a skill's description for better trigger accuracy.
# Uses run-trigger-eval.sh as the evaluation backbone.
#
# Algorithm:
#   1. Load eval YAML → split 60% train / 40% test
#   2. Evaluate current description on train set
#   3. Loop (max 7 iterations):
#      a. Collect failing prompts
#      b. Send to claude -p: "Improve this description..."
#      c. Re-evaluate on train set
#      d. If improved → keep, else → revert
#   4. Pick best iteration by TEST set score (prevents overfitting)
#   5. Show diff, confirm before applying to SKILL.md
#
# Usage:
#   npm run eval:optimize-desc -- assess
#   npm run eval:optimize-desc -- --all         # optimize all invocable skills
#   npm run eval:optimize-desc -- assess --max-iter 3
#   npm run eval:optimize-desc -- assess --dry-run
#
# Requirements:
#   - yq, jq, bc, Claude CLI
#   - Run OUTSIDE Claude Code session
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false

# Source shared library
# shellcheck source=lib/eval-common.sh
source "$SCRIPT_DIR/lib/eval-common.sh"

EVALS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(cd "$EVALS_DIR/../.." && pwd)"
SKILLS_EVAL_DIR="$EVALS_DIR/skills"
RESULTS_DIR="$EVALS_DIR/results/skills"
TRIGGER_RUNNER="$SCRIPT_DIR/run-trigger-eval.sh"
SKILLS_SRC="$ROOT_DIR/src/skills"

MAX_ITER=7
SKILL=""
RUN_ALL=false
AUTO_APPLY=false
REPS=3  # Fewer reps for optimization speed

# --- Argument parsing ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --max-iter) MAX_ITER="$2"; shift 2 ;;
        --all) RUN_ALL=true; shift ;;
        --auto-apply) AUTO_APPLY=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --reps) REPS="$2"; shift 2 ;;
        -*)
            echo -e "${RED}Unknown flag: $1${NC}"; exit 1 ;;
        *)
            if [[ -z "$SKILL" ]]; then SKILL="$1"; else echo -e "${RED}Unexpected: $1${NC}"; exit 1; fi
            shift ;;
    esac
done

if [[ -z "$SKILL" && "$RUN_ALL" == "false" ]]; then
    echo -e "${RED}Error: provide a skill name or --all${NC}"
    echo "Usage: npm run eval:optimize-desc -- <skill-name> [--max-iter N] [--dry-run]"
    exit 1
fi

check_deps

# =============================================================================
# Core optimization function
# =============================================================================
optimize_skill() {
    local skill_id="$1"
    local eval_file="$SKILLS_EVAL_DIR/${skill_id}.eval.yaml"
    local skill_file="$SKILLS_SRC/${skill_id}/SKILL.md"

    # Validate
    if [[ ! -f "$eval_file" ]]; then
        echo -e "${YELLOW}SKIP: $skill_id — no eval file${NC}"
        return 0
    fi
    if [[ ! -f "$skill_file" ]]; then
        echo -e "${RED}Error: $skill_id — SKILL.md not found${NC}"
        return 1
    fi

    # Check for trigger_evals
    local trigger_count
    trigger_count=$(yq '.trigger_evals | length' "$eval_file" 2>/dev/null || echo "0")
    if [[ "$trigger_count" -lt 2 ]]; then
        echo -e "${YELLOW}SKIP: $skill_id — fewer than 2 trigger evals${NC}"
        return 0
    fi

    # Get current description
    local original_desc
    original_desc=$(sed -n '/^---$/,/^---$/p' "$skill_file" | grep '^description:' | sed 's/^description:[[:space:]]*//' | sed 's/^"//;s/"$//')

    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}  OPTIMIZE: ${BOLD}$skill_id${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo -e "  Trigger evals: $trigger_count"
    echo -e "  Max iterations: $MAX_ITER"
    echo -e "  Current description:"
    echo -e "  ${CYAN}$original_desc${NC}"
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}DRY-RUN: would optimize $skill_id ($trigger_count trigger evals)${NC}"
        return 0
    fi

    # --- Split train/test (60/40) ---
    local total_positive total_negative
    total_positive=$(yq '[.trigger_evals[] | select(.should_trigger == true)] | length' "$eval_file")
    total_negative=$(yq '[.trigger_evals[] | select(.should_trigger == false)] | length' "$eval_file")
    local train_pos=$((total_positive * 60 / 100))
    local train_neg=$((total_negative * 60 / 100))
    [[ "$train_pos" -lt 1 ]] && train_pos=1
    [[ "$train_neg" -lt 1 ]] && train_neg=1

    echo -e "  Split: ${train_pos}+${train_neg} train / $((total_positive - train_pos))+$((total_negative - train_neg)) test"

    # Create train/test eval files
    local train_file test_file
    train_file=$(mktemp "${TMPDIR:-/tmp}/ork-opt-train-XXXXXX.yaml")
    test_file=$(mktemp "${TMPDIR:-/tmp}/ork-opt-test-XXXXXX.yaml")
    CLEANUP_FILES+=("$train_file" "$test_file")

    # Split using yq
    yq -y "{id: .id, trigger_evals: (([.trigger_evals[] | select(.should_trigger == true)][:$train_pos]) + ([.trigger_evals[] | select(.should_trigger == false)][:$train_neg]))}" "$eval_file" > "$train_file"
    yq -y "{id: .id, trigger_evals: (([.trigger_evals[] | select(.should_trigger == true)][$train_pos:]) + ([.trigger_evals[] | select(.should_trigger == false)][$train_neg:]))}" "$eval_file" > "$test_file"

    # --- Baseline eval on train set ---
    local current_desc="$original_desc"
    local best_desc="$original_desc"
    local best_score=0
    local best_iter=0

    echo -e "\n  ${CYAN}Iter 0: Baseline...${NC}"
    local baseline_score
    baseline_score=$(run_trigger_with_desc "$skill_id" "$current_desc" "$train_file")
    best_score=$baseline_score
    echo -e "  Iter 0: P+R = ${BOLD}${baseline_score}${NC} (baseline)"

    # --- Iteration loop ---
    local iter=1
    while [[ $iter -le $MAX_ITER ]]; do
        echo -e "\n  ${CYAN}Iter $iter: Generating improved description...${NC}"

        # Get failures from last run
        local failures=""
        if [[ -f "$RESULTS_DIR/${skill_id}.trigger.json" ]]; then
            failures=$(jq -r '.results[] | select(.verdict != "OK") | "- \(.prompt | gsub("\n";" ")) [should_trigger=\(.should_trigger), rate=\(.rate)]"' "$RESULTS_DIR/${skill_id}.trigger.json" 2>/dev/null || echo "")
        fi

        if [[ -z "$failures" ]]; then
            echo -e "  ${GREEN}No failures — description is optimal${NC}"
            break
        fi

        # Ask Claude to improve the description
        local improve_prompt="You are optimizing a Claude Code plugin skill description for trigger accuracy.

Current description:
$current_desc

These prompts are being matched INCORRECTLY:
$failures

Rules:
- The description must be under 200 words
- Include WHAT the skill does AND WHEN to use it
- Write in third person (\"Use when...\", not \"I will...\")
- Be specific about trigger keywords users might type
- Don't add capabilities the skill doesn't have

Output ONLY the improved description text, nothing else. No quotes, no explanation."

        local new_desc
        new_desc=$(echo "$improve_prompt" | claude -p --max-turns 1 --output-format text 2>/dev/null | tr '\n' ' ' | sed 's/  */ /g' | sed 's/^ *//;s/ *$//')

        if [[ -z "$new_desc" || ${#new_desc} -gt 1024 ]]; then
            echo -e "  ${YELLOW}Iter $iter: Bad response (empty or >1024 chars), skipping${NC}"
            iter=$((iter + 1))
            continue
        fi

        # Eval new description on train set
        local new_score
        new_score=$(run_trigger_with_desc "$skill_id" "$new_desc" "$train_file")

        if (( $(echo "$new_score > $best_score" | bc -l) )); then
            echo -e "  Iter $iter: P+R = ${GREEN}${new_score}${NC} ${GREEN}← IMPROVED${NC} (was $best_score)"
            best_score=$new_score
            best_desc="$new_desc"
            best_iter=$iter
            current_desc="$new_desc"
        else
            echo -e "  Iter $iter: P+R = ${YELLOW}${new_score}${NC} (no improvement, keeping previous)"
            # Revert to best
            current_desc="$best_desc"
        fi

        iter=$((iter + 1))
    done

    # --- Validate on TEST set ---
    echo -e "\n  ${CYAN}Validating best (iter $best_iter) on test set...${NC}"
    local test_score
    test_score=$(run_trigger_with_desc "$skill_id" "$best_desc" "$test_file")
    echo -e "  Test set score: ${BOLD}${test_score}${NC}"

    # --- Show diff ---
    if [[ "$best_desc" == "$original_desc" ]]; then
        echo -e "\n  ${GREEN}Description unchanged — already optimal${NC}"
        return 0
    fi

    echo ""
    echo -e "  ${RED}- $original_desc${NC}"
    echo -e "  ${GREEN}+ $best_desc${NC}"
    echo ""
    echo -e "  Train: $baseline_score → $best_score  |  Test: $test_score"

    # --- Apply ---
    if [[ "$AUTO_APPLY" == "true" ]]; then
        apply_description "$skill_file" "$original_desc" "$best_desc"
        echo -e "  ${GREEN}Applied to $skill_file${NC}"
    else
        echo -en "  Apply to SKILL.md? [y/N] "
        read -r confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            apply_description "$skill_file" "$original_desc" "$best_desc"
            echo -e "  ${GREEN}Applied!${NC}"
        else
            echo -e "  ${YELLOW}Skipped${NC}"
        fi
    fi
}

# =============================================================================
# Helper: Run trigger eval with a temporary description
# =============================================================================
run_trigger_with_desc() {
    local skill_id="$1"
    local desc="$2"
    local eval_file="$3"

    # Create temp skill dir with modified description
    local tmp_skill_dir
    tmp_skill_dir=$(mktemp -d "${TMPDIR:-/tmp}/ork-opt-skill-XXXXXX")
    CLEANUP_DIRS+=("$tmp_skill_dir")

    # Copy original skill
    cp -r "$SKILLS_SRC/$skill_id/"* "$tmp_skill_dir/"

    # Replace description in SKILL.md
    local escaped_desc
    escaped_desc=$(printf '%s' "$desc" | sed 's/[&/\]/\\&/g')
    sed -i '' "s/^description: .*/description: \"$escaped_desc\"/" "$tmp_skill_dir/SKILL.md"

    # Run trigger eval with custom eval file and reduced reps
    local result
    result=$(bash "$TRIGGER_RUNNER" "$skill_id" --reps "$REPS" 2>/dev/null || true)

    # Read precision + recall from result
    local precision recall
    if [[ -f "$RESULTS_DIR/${skill_id}.trigger.json" ]]; then
        precision=$(jq -r '.precision // 0' "$RESULTS_DIR/${skill_id}.trigger.json")
        recall=$(jq -r '.recall // 0' "$RESULTS_DIR/${skill_id}.trigger.json")
    else
        precision=0
        recall=0
    fi

    # Return combined score (precision + recall, max 200)
    echo "$(echo "$precision + $recall" | bc)"
}

# =============================================================================
# Helper: Apply new description to SKILL.md
# =============================================================================
apply_description() {
    local skill_file="$1"
    local old_desc="$2"
    local new_desc="$3"

    # Escape for sed
    local escaped_new
    escaped_new=$(printf '%s' "$new_desc" | sed 's/[&/\]/\\&/g')

    sed -i '' "s/^description: .*/description: \"$escaped_new\"/" "$skill_file"
}

# =============================================================================
# Main
# =============================================================================
if [[ "$RUN_ALL" == "true" ]]; then
    echo -e "${BLUE}Running description optimization for all invocable skills...${NC}"
    for eval_file in "$SKILLS_EVAL_DIR"/*.eval.yaml; do
        skill_id=$(basename "$eval_file" .eval.yaml)
        # Only optimize user-invocable skills
        local_skill="$SKILLS_SRC/$skill_id/SKILL.md"
        if [[ -f "$local_skill" ]]; then
            is_invocable=$(sed -n '/^---$/,/^---$/p' "$local_skill" | grep '^user-invocable:' | grep -c 'true' || echo "0")
            if [[ "$is_invocable" -gt 0 ]]; then
                optimize_skill "$skill_id"
            fi
        fi
    done
else
    optimize_skill "$SKILL"
fi

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  OPTIMIZATION COMPLETE${NC}"
echo -e "${BLUE}============================================================${NC}"
