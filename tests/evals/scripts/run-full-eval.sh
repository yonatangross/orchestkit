#!/bin/bash
# =============================================================================
# OrchestKit Full Evaluation Orchestrator
# =============================================================================
# Runs all evals across skills and agents with rate-limit-aware scheduling.
# Separates capture (generation) from grading for resilience.
#
# Usage:
#   ./run-full-eval.sh --tier 1              # Existing 17 skill quality evals
#   ./run-full-eval.sh --tier 2              # Background skill evals
#   ./run-full-eval.sh --tier 3              # Agent evals
#   ./run-full-eval.sh --tier all            # Everything
#   ./run-full-eval.sh --tier 1 --grade-only # Re-grade captured outputs
#   ./run-full-eval.sh --tier all --model sonnet --skip-baseline
#
# Options:
#   --tier 1|2|3|all       Which tier to run
#   --model MODEL          Model override (sonnet, opus, haiku)
#   --skip-baseline        Skip baseline runs (saves ~50% CLI calls)
#   --capture-only         Capture outputs only, skip grading
#   --grade-only           Re-grade previously captured outputs
#   --parallelism N        Skills to run in parallel (default 1)
#   --delay N              Seconds between skill runs (default 5)
#   --max-retries N        Retries per failed skill (default 2)
#   --dry-run              Validate YAML only
#
# Requirements:
#   - All dependencies from run-quality-eval.sh and run-agent-eval.sh
#   - Run OUTSIDE Claude Code session
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVALS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(cd "$EVALS_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# Configuration
TIER=""
MODEL=""
SKIP_BASELINE=false
CAPTURE_ONLY=false
GRADE_ONLY=false
DRY_RUN=false
PARALLELISM=1
DELAY=5
MAX_RETRIES=2

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --tier)
            if [[ $# -lt 2 ]]; then echo -e "${RED}Error: --tier requires 1|2|3|all${NC}"; exit 1; fi
            TIER="$2"; shift 2 ;;
        --model)
            if [[ $# -lt 2 ]]; then echo -e "${RED}Error: --model requires a value${NC}"; exit 1; fi
            MODEL="$2"; shift 2 ;;
        --skip-baseline) SKIP_BASELINE=true; shift ;;
        --capture-only) CAPTURE_ONLY=true; shift ;;
        --grade-only) GRADE_ONLY=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --parallelism)
            if [[ $# -lt 2 ]]; then echo -e "${RED}Error: --parallelism requires N${NC}"; exit 1; fi
            PARALLELISM="$2"; shift 2 ;;
        --delay)
            if [[ $# -lt 2 ]]; then echo -e "${RED}Error: --delay requires N${NC}"; exit 1; fi
            DELAY="$2"; shift 2 ;;
        --max-retries)
            if [[ $# -lt 2 ]]; then echo -e "${RED}Error: --max-retries requires N${NC}"; exit 1; fi
            MAX_RETRIES="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: $0 --tier 1|2|3|all [--model MODEL] [--skip-baseline] [--capture-only] [--grade-only] [--dry-run] [--parallelism N] [--delay N] [--max-retries N]"
            exit 0 ;;
        *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
    esac
done

if [[ -z "$TIER" ]]; then
    echo -e "${RED}Error: --tier is required (1, 2, 3, or all)${NC}"
    exit 1
fi

# Validate tier
if [[ "$TIER" != "1" && "$TIER" != "2" && "$TIER" != "3" && "$TIER" != "all" ]]; then
    echo -e "${RED}Error: --tier must be 1, 2, 3, or all${NC}"
    exit 1
fi

# Validate mutually exclusive
if [[ "$CAPTURE_ONLY" == "true" && "$GRADE_ONLY" == "true" ]]; then
    echo -e "${RED}Error: --capture-only and --grade-only are mutually exclusive${NC}"
    exit 1
fi

# Create run directory
RUN_ID="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$EVALS_DIR/results/runs/$RUN_ID"
mkdir -p "$RUN_DIR"

# Log helper
log() {
    local msg="[$(date +%H:%M:%S)] $1"
    echo -e "$msg"
    echo -e "$msg" >> "$RUN_DIR/orchestrator.log"
}

# ─── Build common flags ──────────────────────────────────────────────────────

build_runner_flags() {
    local flags=()
    [[ -n "$MODEL" ]] && flags+=(--model "$MODEL")
    [[ "$SKIP_BASELINE" == "true" ]] && flags+=(--skip-baseline)
    [[ "$CAPTURE_ONLY" == "true" ]] && flags+=(--capture-only)
    [[ "$GRADE_ONLY" == "true" ]] && flags+=(--grade-only)
    [[ "$DRY_RUN" == "true" ]] && flags+=(--dry-run)
    echo "${flags[*]}"
}

# ─── Run a single skill eval with retries ────────────────────────────────────

run_skill_eval() {
    local skill_name="$1"
    local runner="$2"
    local flags; flags=$(build_runner_flags)
    local attempt=0
    local log_file="$RUN_DIR/${skill_name}.log"

    while [[ $attempt -lt $MAX_RETRIES ]]; do
        ((attempt++))
        log "${CYAN}[$skill_name] Attempt $attempt/$MAX_RETRIES${NC}"

        # shellcheck disable=SC2086
        if bash "$runner" "$skill_name" $flags > "$log_file" 2>&1; then
            log "${GREEN}[$skill_name] PASSED${NC}"
            echo "$skill_name:PASS" >> "$RUN_DIR/summary.txt"
            return 0
        fi

        # Check for rate limit in output
        if grep -qi "rate.limit" "$log_file" 2>/dev/null; then
            log "${YELLOW}[$skill_name] Rate limited, waiting 300s...${NC}"
            sleep 300
        elif [[ $attempt -lt $MAX_RETRIES ]]; then
            log "${YELLOW}[$skill_name] Failed, retrying in 60s...${NC}"
            sleep 60
        fi
    done

    log "${RED}[$skill_name] FAILED after $MAX_RETRIES attempts${NC}"
    echo "$skill_name:FAIL" >> "$RUN_DIR/summary.txt"
    return 1
}

# ─── Collect skills per tier ─────────────────────────────────────────────────

collect_tier1_skills() {
    # Existing eval YAMLs (user-invocable + api-design)
    for f in "$EVALS_DIR"/skills/*.eval.yaml; do
        [[ -f "$f" ]] || continue
        basename "$f" .eval.yaml
    done
}

collect_tier2_skills() {
    # Background skills with eval YAMLs (tagged 'background')
    for f in "$EVALS_DIR"/skills/*.eval.yaml; do
        [[ -f "$f" ]] || continue
        if yq -r '.tags[]' "$f" 2>/dev/null | grep -q 'background'; then
            basename "$f" .eval.yaml
        fi
    done
}

collect_tier3_agents() {
    # Agent eval YAMLs
    for f in "$EVALS_DIR"/agents/*.eval.yaml; do
        [[ -f "$f" ]] || continue
        basename "$f" .eval.yaml
    done
}

# ─── Main ────────────────────────────────────────────────────────────────────

log "${BLUE}============================================================${NC}"
log "${BLUE}  OrchestKit Full Evaluation Orchestrator${NC}"
log "${BLUE}  Run ID: ${BOLD}$RUN_ID${NC}"
log "${BLUE}  Tier: ${BOLD}$TIER${NC}"
log "${BLUE}============================================================${NC}"
log "  Flags: $(build_runner_flags)"
log "  Parallelism: $PARALLELISM  |  Delay: ${DELAY}s  |  Retries: $MAX_RETRIES"
log "  Results: $RUN_DIR"
log ""

total=0; passed=0; failed=0
failed_list=()
start_time=$(date +%s)

# ─── Tier 1: Existing skill quality evals ────────────────────────────────────

run_tier() {
    local tier_name="$1"
    local runner="$2"
    shift 2
    local skills=("$@")

    if [[ ${#skills[@]} -eq 0 ]]; then
        log "${YELLOW}  No eval files found for $tier_name${NC}"
        return
    fi

    log ""
    log "${BLUE}── $tier_name (${#skills[@]} evals) ──${NC}"

    for skill in "${skills[@]}"; do
        ((total++))
        if run_skill_eval "$skill" "$runner"; then
            ((passed++))
        else
            ((failed++))
            failed_list+=("$skill")
        fi
        # Delay between skills (skip on dry-run)
        if [[ "$DRY_RUN" != "true" && $DELAY -gt 0 ]]; then
            sleep "$DELAY"
        fi
    done
}

QUALITY_RUNNER="$SCRIPT_DIR/run-quality-eval.sh"
AGENT_RUNNER="$SCRIPT_DIR/run-agent-eval.sh"

if [[ "$TIER" == "1" || "$TIER" == "all" ]]; then
    mapfile -t tier1_skills < <(collect_tier1_skills)
    run_tier "Tier 1: Skill Quality Evals" "$QUALITY_RUNNER" "${tier1_skills[@]}"
fi

if [[ "$TIER" == "2" || "$TIER" == "all" ]]; then
    mapfile -t tier2_skills < <(collect_tier2_skills)
    run_tier "Tier 2: Background Skill Evals" "$QUALITY_RUNNER" "${tier2_skills[@]}"
fi

if [[ "$TIER" == "3" || "$TIER" == "all" ]]; then
    if [[ ! -f "$AGENT_RUNNER" ]]; then
        log "${RED}Error: Agent eval runner not found at $AGENT_RUNNER${NC}"
        log "${YELLOW}Build it first (Phase 4 of eval plan)${NC}"
    else
        mapfile -t tier3_agents < <(collect_tier3_agents)
        run_tier "Tier 3: Agent Evals" "$AGENT_RUNNER" "${tier3_agents[@]}"
    fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

end_time=$(date +%s)
duration=$((end_time - start_time))

log ""
log "${BLUE}============================================================${NC}"
log "${BLUE}  ORCHESTRATOR SUMMARY${NC}"
log "${BLUE}============================================================${NC}"
log "  Run ID:   $RUN_ID"
log "  Tier:     $TIER"
log "  Total:    $total"
log "  Passed:   ${GREEN}$passed${NC}"
if [[ $failed -gt 0 ]]; then
    log "  Failed:   ${RED}$failed${NC} (${failed_list[*]})"
fi
log "  Duration: ${duration}s ($(( duration / 60 ))m $(( duration % 60 ))s)"
log "  Results:  $RUN_DIR"
log "${BLUE}============================================================${NC}"

# Write summary JSON
cat > "$RUN_DIR/summary.json" <<ENDJSON
{
  "run_id": "$RUN_ID",
  "tier": "$TIER",
  "total": $total,
  "passed": $passed,
  "failed": $failed,
  "failed_skills": $(printf '%s\n' "${failed_list[@]}" | jq -R . | jq -s .),
  "duration_seconds": $duration,
  "flags": "$(build_runner_flags)",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
ENDJSON

if [[ $failed -gt 0 ]]; then
    exit 1
fi
exit 0
