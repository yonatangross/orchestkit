#!/bin/bash
# =============================================================================
# OrchestKit Eval Regression Checker
# =============================================================================
# Compares FRESH eval results against committed baselines to detect regressions.
# No Claude API calls — pure JSON comparison.
#
# A REGRESSION is a fresh score that dropped more than TOLERANCE percentage
# points below the committed baseline — NOT a baseline that is merely weak.
# Without --new-dir the check is INFORMATIONAL (reports committed-baseline
# health and always exits 0); only a real new-vs-baseline drop can fail.
#
# Usage:
#   bash tests/evals/scripts/check-eval-regression.sh --new-dir <dir>        # diff fresh vs baseline (gating)
#   bash tests/evals/scripts/check-eval-regression.sh --new-dir <dir> --all  # all baselines, gating
#   bash tests/evals/scripts/check-eval-regression.sh --all                  # informational status only
#   bash tests/evals/scripts/check-eval-regression.sh commit                 # one skill
#
# Exit codes:
#   0 — No regressions (or informational mode)
#   1 — Regression: a fresh score dropped >TOLERANCE pp below its baseline
#
# Designed for CI: orchestkit-eval.yml runs the fresh evals, then calls this
# with --new-dir pointing at the fresh results. Locally it runs informational.
# =============================================================================
# strict-mode: opt-out  arithmetic `(( $(... | bc -l) ))` + `[[ ]] &&` guards return
# non-zero on a FALSE comparison; `set -e` would abort mid-loop. The script manages
# its own exit codes explicitly (0 = pass, 1 = regression) and tags its one stderr suppress.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false

# Source shared library
# shellcheck source=lib/eval-common.sh
source "$SCRIPT_DIR/lib/eval-common.sh"

EVALS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(cd "$EVALS_DIR/../.." && pwd)"
RESULTS_DIR="$EVALS_DIR/results/skills"

SKILL=""
CHECK_ALL=false
NEW_DIR=""
TOLERANCE=5          # percentage points a score may dip before it counts as a regression
REGRESSIONS=0
CHECKED=0
IMPROVED=0
STABLE=0

# --- Argument parsing ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --all) CHECK_ALL=true; shift ;;
        --new-dir) NEW_DIR="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        -*)
            echo -e "${RED}Unknown flag: $1${NC}"; exit 1 ;;
        *)
            SKILL="$1"; shift ;;
    esac
done

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  EVAL REGRESSION CHECK${NC}"
if [[ -n "$NEW_DIR" ]]; then
    echo -e "${BLUE}  mode: diff — fresh vs baseline (tolerance ${TOLERANCE}pp)${NC}"
else
    echo -e "${BLUE}  mode: informational — committed-baseline health (never fails)${NC}"
fi
echo -e "${BLUE}============================================================${NC}"

# --- Determine which skills to check ---
skills_to_check=()

if [[ -n "$SKILL" ]]; then
    skills_to_check=("$SKILL")
elif [[ "$CHECK_ALL" == "true" ]]; then
    for f in "$RESULTS_DIR"/*.trigger.json; do
        [[ -f "$f" ]] || continue
        skills_to_check+=("$(basename "$f" .trigger.json)")
    done
else
    # Auto-detect changed skills from git diff.
    # silent: best-effort  (origin/main may be absent in shallow CI → fall back to HEAD~1 → empty list = exit 0, nothing to check)
    changed_files=$(git diff origin/main --name-only 2>/dev/null || git diff HEAD~1 --name-only 2>/dev/null || echo "")
    for file in $changed_files; do
        if [[ "$file" =~ ^src/skills/([a-z0-9-]+)/ ]]; then
            skill_name="${BASH_REMATCH[1]}"
            # Only check if baseline exists
            if [[ -f "$RESULTS_DIR/${skill_name}.trigger.json" ]]; then
                # Deduplicate
                already_found=false
                for existing in "${skills_to_check[@]}"; do
                    [[ "$existing" == "$skill_name" ]] && already_found=true
                done
                if [[ "$already_found" == "false" ]]; then
                    skills_to_check+=("$skill_name")
                fi
            fi
        fi
    done

    if [[ ${#skills_to_check[@]} -eq 0 ]]; then
        echo -e "  ${GREEN}No skill changes detected — nothing to check${NC}"
        echo -e "${BLUE}============================================================${NC}"
        exit 0
    fi
fi

echo -e "  Checking: ${#skills_to_check[@]} skills"
echo ""

# --- Check each skill ---
for skill_id in "${skills_to_check[@]}"; do
    CHECKED=$((CHECKED + 1))
    baseline_file="$RESULTS_DIR/${skill_id}.trigger.json"

    if [[ ! -f "$baseline_file" ]]; then
        echo -e "  ${YELLOW}$skill_id: no baseline — SKIP${NC}"
        continue
    fi

    # Read committed baseline values
    base_p=$(jq -r '.precision // .effective_precision // 0' "$baseline_file")
    base_r=$(jq -r '.recall // .effective_recall // 0' "$baseline_file")

    if [[ -n "$NEW_DIR" ]]; then
        # ---- DIFF MODE: compare a fresh result against the committed baseline ----
        new_file="$NEW_DIR/${skill_id}.trigger.json"
        if [[ ! -f "$new_file" ]]; then
            printf "  %b %s: no fresh result in --new-dir — SKIP%b\n" "${YELLOW}" "$skill_id" "${NC}"
            continue
        fi
        new_p=$(jq -r '.precision // .effective_precision // 0' "$new_file")
        new_r=$(jq -r '.recall // .effective_recall // 0' "$new_file")

        if (( $(echo "$new_p < ($base_p - $TOLERANCE) || $new_r < ($base_r - $TOLERANCE)" | bc -l) )); then
            printf "  %b %s: P %s→%s R %s→%s — REGRESSED%b\n" "${RED}❌" "$skill_id" "$base_p" "$new_p" "$base_r" "$new_r" "${NC}"
            REGRESSIONS=$((REGRESSIONS + 1))
        elif (( $(echo "$new_p > ($base_p + $TOLERANCE) || $new_r > ($base_r + $TOLERANCE)" | bc -l) )); then
            printf "  %b %s: P %s→%s R %s→%s — IMPROVED%b\n" "${GREEN}⬆" "$skill_id" "$base_p" "$new_p" "$base_r" "$new_r" "${NC}"
            IMPROVED=$((IMPROVED + 1))
        else
            printf "  %b %s: P=%s R=%s — STABLE%b\n" "${GREEN}✅" "$skill_id" "$new_p" "$new_r" "${NC}"
            STABLE=$((STABLE + 1))
        fi
    else
        # ---- INFORMATIONAL MODE: committed-baseline health (a weak baseline is NOT a regression) ----
        if (( $(echo "$base_p >= 80 && $base_r >= 80" | bc -l) )); then
            printf "  %b %s: P=%s R=%s — HEALTHY%b\n" "${GREEN}✅" "$skill_id" "$base_p" "$base_r" "${NC}"
            STABLE=$((STABLE + 1))
        elif (( $(echo "$base_p >= 50 || $base_r >= 50" | bc -l) )); then
            printf "  %b %s: P=%s R=%s — WEAK baseline (not a regression)%b\n" "${YELLOW}⚠️" "$skill_id" "$base_p" "$base_r" "${NC}"
        else
            printf "  %b %s: P=%s R=%s — LOW baseline (not a regression)%b\n" "${YELLOW}⚠️" "$skill_id" "$base_p" "$base_r" "${NC}"
        fi
    fi
done

# --- Summary ---
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "  Checked:     $CHECKED"
echo -e "  Stable:      ${GREEN}$STABLE${NC}"
[[ $IMPROVED -gt 0 ]] && echo -e "  Improved:    ${GREEN}$IMPROVED${NC}"
if [[ $REGRESSIONS -gt 0 ]]; then
    echo -e "  Regressed:   ${RED}$REGRESSIONS${NC}"
fi
echo -e "${BLUE}============================================================${NC}"

if [[ $REGRESSIONS -gt 0 ]]; then
    echo -e "${RED}RESULT: FAILED ($REGRESSIONS skill(s) dropped >${TOLERANCE}pp below baseline)${NC}"
    exit 1
fi

echo -e "${GREEN}RESULT: PASSED${NC}"
exit 0
