#!/bin/bash
# =============================================================================
# OrchestKit Unified Skill Evaluation Runner
# =============================================================================
# Runs BOTH trigger + quality evaluation for a single skill (or all skills).
# Thin orchestrator around run-trigger-eval.sh and run-quality-eval.sh.
#
# Usage:
#   npm run eval:skill -- commit             # trigger + quality for one skill
#   npm run eval:skill -- commit --trigger-only
#   npm run eval:skill -- commit --quality-only
#   npm run eval:skill -- --all              # all skills with .eval.yaml
#   npm run eval:skill -- --all --dry-run    # validate YAML only
#   npm run eval:skill -- --tag core         # filter by tag
#
# Requirements:
#   - All dependencies from run-trigger-eval.sh and run-quality-eval.sh
#   - Run OUTSIDE Claude Code session
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false

# Source shared library
# shellcheck source=lib/eval-common.sh
source "$SCRIPT_DIR/lib/eval-common.sh"

EVALS_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$EVALS_DIR/results/skills"
TRIGGER_RUNNER="$SCRIPT_DIR/run-trigger-eval.sh"
QUALITY_RUNNER="$SCRIPT_DIR/run-quality-eval.sh"

# --- Argument parsing ---
SKILL=""
RUN_TRIGGER=true
RUN_QUALITY=true
PASSTHROUGH_ARGS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --trigger-only) RUN_QUALITY=false; shift ;;
        --quality-only) RUN_TRIGGER=false; shift ;;
        --dry-run) DRY_RUN=true; PASSTHROUGH_ARGS+=("$1"); shift ;;
        --all|--tag|--reps|--timeout|--max-turns|--skip-baseline|--force-skill)
            PASSTHROUGH_ARGS+=("$1")
            if [[ "$1" == "--tag" || "$1" == "--reps" || "$1" == "--timeout" || "$1" == "--max-turns" ]]; then
                PASSTHROUGH_ARGS+=("$2"); shift
            fi
            shift ;;
        -*)
            echo -e "${RED}Unknown flag: $1${NC}"; exit 1 ;;
        *)
            if [[ -z "$SKILL" ]]; then
                SKILL="$1"
            else
                echo -e "${RED}Error: unexpected argument '$1' (skill already set to '$SKILL')${NC}"; exit 1
            fi
            shift ;;
    esac
done

# Validate skill name if provided
if [[ -n "$SKILL" && ! "$SKILL" =~ $SKILL_NAME_RE ]]; then
    echo -e "${RED}Error: invalid skill name '$SKILL'${NC}"
    exit 1
fi

# Need either a skill name or --all
HAS_ALL=false
for arg in "${PASSTHROUGH_ARGS[@]}"; do
    [[ "$arg" == "--all" ]] && HAS_ALL=true
done
if [[ -z "$SKILL" && "$HAS_ALL" == "false" ]]; then
    echo -e "${RED}Error: provide a skill name or --all${NC}"
    echo "Usage: npm run eval:skill -- <skill-name> [--trigger-only|--quality-only|--dry-run]"
    exit 1
fi

# Build skill args for runners
SKILL_ARGS=()
if [[ -n "$SKILL" ]]; then
    SKILL_ARGS=("$SKILL")
fi

# --- Header ---
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  ORCHESTKIT SKILL EVALUATION${NC}"
echo -e "${BLUE}============================================================${NC}"
if [[ -n "$SKILL" ]]; then
    echo -e "  Skill:    ${CYAN}$SKILL${NC}"
else
    echo -e "  Scope:    ${CYAN}--all${NC}"
fi
echo -e "  Trigger:  $(if $RUN_TRIGGER; then echo -e "${GREEN}YES${NC}"; else echo -e "${YELLOW}SKIP${NC}"; fi)"
echo -e "  Quality:  $(if $RUN_QUALITY; then echo -e "${GREEN}YES${NC}"; else echo -e "${YELLOW}SKIP${NC}"; fi)"
echo -e "  Dry-run:  $(if $DRY_RUN; then echo -e "${YELLOW}YES${NC}"; else echo "no"; fi)"
echo -e "${BLUE}============================================================${NC}"
echo ""

TRIGGER_EXIT=0
QUALITY_EXIT=0
TRIGGER_RESULT=""
QUALITY_RESULT=""

# --- Run trigger eval ---
if $RUN_TRIGGER; then
    echo -e "${CYAN}>>> Running trigger evaluation...${NC}"
    echo ""
    if bash "$TRIGGER_RUNNER" "${SKILL_ARGS[@]}" "${PASSTHROUGH_ARGS[@]}"; then
        TRIGGER_EXIT=0
    else
        TRIGGER_EXIT=$?
    fi
    echo ""

    # Read trigger result if available
    if [[ -n "$SKILL" && -f "$RESULTS_DIR/${SKILL}.trigger.json" ]]; then
        TRIGGER_RESULT=$(jq -r '"P:" + (.precision // .effective_precision | tostring) + " R:" + (.recall // .effective_recall | tostring)' "$RESULTS_DIR/${SKILL}.trigger.json" 2>/dev/null || echo "N/A")
    fi
fi

# --- Run quality eval ---
if $RUN_QUALITY; then
    echo -e "${CYAN}>>> Running quality evaluation...${NC}"
    echo ""
    if bash "$QUALITY_RUNNER" "${SKILL_ARGS[@]}" "${PASSTHROUGH_ARGS[@]}"; then
        QUALITY_EXIT=0
    else
        QUALITY_EXIT=$?
    fi
    echo ""

    # Read quality result if available
    if [[ -n "$SKILL" && -f "$RESULTS_DIR/${SKILL}.quality.json" ]]; then
        QUALITY_RESULT=$(jq -r '.aggregate.skill_pass_rate | tostring' "$RESULTS_DIR/${SKILL}.quality.json" 2>/dev/null || echo "N/A")
    fi
fi

# --- Summary ---
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  UNIFIED RESULTS${NC}"
echo -e "${BLUE}============================================================${NC}"

if [[ -n "$SKILL" ]]; then
    echo -e "  Skill:     ${CYAN}$SKILL${NC}"
    echo ""

    # Trigger row
    if $RUN_TRIGGER; then
        if [[ $TRIGGER_EXIT -eq 0 ]]; then
            echo -e "  Trigger:   ${GREEN}PASS${NC}  ($TRIGGER_RESULT)"
        else
            echo -e "  Trigger:   ${RED}FAIL${NC}  ($TRIGGER_RESULT)"
        fi
    else
        echo -e "  Trigger:   ${YELLOW}SKIPPED${NC}"
    fi

    # Quality row
    if $RUN_QUALITY; then
        if [[ $QUALITY_EXIT -eq 0 ]]; then
            echo -e "  Quality:   ${GREEN}PASS${NC}  (${QUALITY_RESULT}%)"
        else
            echo -e "  Quality:   ${RED}FAIL${NC}  (${QUALITY_RESULT}%)"
        fi
    else
        echo -e "  Quality:   ${YELLOW}SKIPPED${NC}"
    fi

    # Overall
    echo ""
    if [[ $TRIGGER_EXIT -eq 0 && $QUALITY_EXIT -eq 0 ]]; then
        echo -e "  Overall:   ${GREEN}PASS${NC}"
    else
        echo -e "  Overall:   ${RED}FAIL${NC}"
    fi
else
    echo "  (Per-skill results printed above)"
fi

echo -e "${BLUE}============================================================${NC}"

# Exit with failure if either runner failed
if [[ $TRIGGER_EXIT -ne 0 || $QUALITY_EXIT -ne 0 ]]; then
    exit 1
fi
exit 0
