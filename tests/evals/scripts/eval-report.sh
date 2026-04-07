#!/bin/bash
# =============================================================================
# OrchestKit Eval Duration Report
# =============================================================================
# Aggregates per-skill trigger + quality eval durations from result JSONs.
# Flags outliers (>3× median) and prints a formatted comparison table.
#
# Usage:
#   npm run eval:report              # all skills with results
#   npm run eval:report -- --json    # machine-readable JSON output
#   npm run eval:report -- --top N   # show top N slowest (default 25)
#
# Reads from: tests/evals/results/skills/*.{trigger,quality}.json
# Requires: jq
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source shared library for colors + REPO_ROOT
DRY_RUN=true  # eval-report doesn't call Claude
source "$SCRIPT_DIR/lib/eval-common.sh"

RESULTS_DIR="$REPO_ROOT/tests/evals/results/skills"

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
OUTPUT_JSON=false
TOP_N=25

usage() {
    echo "Usage: eval-report.sh [--json] [--top N] [--help]"
    echo ""
    echo "  --json    Machine-readable JSON output"
    echo "  --top N   Show top N slowest skills (default 25)"
    echo "  --help    Show this help message"
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --json) OUTPUT_JSON=true; shift ;;
        --top)  TOP_N="$2"; shift 2 ;;
        -h|--help) usage ;;
        *)      shift ;;
    esac
done

# ---------------------------------------------------------------------------
# Dependency check (jq + bc — no Claude CLI needed)
# ---------------------------------------------------------------------------
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required (brew install jq)${NC}"
    exit 1
fi
if ! command -v bc &> /dev/null; then
    echo -e "${RED}Error: bc is required (brew install bc)${NC}"
    exit 1
fi

# ---------------------------------------------------------------------------
# Collect durations from result JSONs
# ---------------------------------------------------------------------------
if [[ ! -d "$RESULTS_DIR" ]]; then
    echo -e "${RED}No results directory found at $RESULTS_DIR${NC}"
    echo "Run eval:trigger or eval:quality first to generate results."
    exit 1
fi

# Iterate result files and build aggregated report data
REPORT_JSON=$(
    for f in "$RESULTS_DIR"/*.json; do
        [[ -f "$f" ]] || continue
        basename="$(basename "$f")"
        # Skip hash files and summary files
        [[ "$basename" == *.hash ]] && continue
        [[ "$basename" == "summary.json" ]] && continue

        if [[ "$basename" == *.trigger.json ]]; then
            skill="${basename%.trigger.json}"
            dur=$(jq -r '.duration_seconds // 0' "$f" 2>/dev/null)
            echo "${skill}|trigger|${dur}"
        elif [[ "$basename" == *.quality.json ]]; then
            skill="${basename%.quality.json}"
            dur=$(jq -r '.duration_seconds // (.aggregate.duration_seconds // 0)' "$f" 2>/dev/null)
            echo "${skill}|quality|${dur}"
        fi
    done | sort | awk -F'|' '
    {
        skill=$1; type=$2; dur=$3
        if (dur == "" || dur == "null") dur = 0
        if (type == "trigger") trigger[skill] = dur
        if (type == "quality") quality[skill] = dur
        if (!(skill in seen)) { order[++n] = skill; seen[skill] = 1 }
    }
    END {
        for (i = 1; i <= n; i++) {
            s = order[i]
            t = (s in trigger) ? trigger[s]+0 : 0
            q = (s in quality) ? quality[s]+0 : 0
            total = t + q
            print s "|" t "|" q "|" total
        }
    }
    '
)

if [[ -z "$REPORT_JSON" ]]; then
    echo -e "${RED}No eval results found in $RESULTS_DIR${NC}"
    exit 1
fi

# ---------------------------------------------------------------------------
# Compute stats
# ---------------------------------------------------------------------------
SKILL_COUNT=$(echo "$REPORT_JSON" | wc -l | tr -d ' ')

# Sort by total descending for display
SORTED=$(echo "$REPORT_JSON" | sort -t'|' -k4 -rn)

# Compute median quality duration for outlier detection
MEDIAN_QUALITY=$(echo "$REPORT_JSON" | awk -F'|' '$3 > 0 { print $3 }' | sort -n | awk '
    { vals[NR] = $1; n = NR }
    END {
        if (n == 0) { print 0; exit }
        if (n % 2 == 1) print vals[int(n/2)+1]
        else print int((vals[n/2] + vals[n/2+1]) / 2)
    }
')

TOTAL_TRIGGER=$(echo "$REPORT_JSON" | awk -F'|' '{ sum += $2 } END { print sum+0 }')
TOTAL_QUALITY=$(echo "$REPORT_JSON" | awk -F'|' '{ sum += $3 } END { print sum+0 }')
GRAND_TOTAL=$((TOTAL_TRIGGER + TOTAL_QUALITY))

OUTLIER_THRESHOLD=$(echo "$MEDIAN_QUALITY * 3" | bc 2>/dev/null || echo "999999")
OUTLIER_COUNT=$(echo "$REPORT_JSON" | awk -F'|' -v thresh="$OUTLIER_THRESHOLD" '
    { if ($3 > thresh && $3 > 0) count++ }
    END { print count+0 }
')

# ---------------------------------------------------------------------------
# Format duration helper
# ---------------------------------------------------------------------------
fmt_dur() {
    local s="$1"
    if [[ "$s" -eq 0 ]] 2>/dev/null; then
        echo "—"
    elif [[ "$s" -lt 60 ]]; then
        echo "${s}s"
    else
        printf "%dm %02ds" $((s / 60)) $((s % 60))
    fi
}

# ---------------------------------------------------------------------------
# JSON output mode
# ---------------------------------------------------------------------------
if [[ "$OUTPUT_JSON" == "true" ]]; then
    echo "$REPORT_JSON" | awk -F'|' -v median="$MEDIAN_QUALITY" -v thresh="$OUTLIER_THRESHOLD" '
    BEGIN { printf "[" }
    NR > 1 { printf "," }
    {
        outlier = ($3 > thresh && $3 > 0) ? "true" : "false"
        printf "{\"skill\":\"%s\",\"trigger_seconds\":%d,\"quality_seconds\":%d,\"total_seconds\":%d,\"outlier\":%s}", $1, $2, $3, $4, outlier
    }
    END { printf "]\n" }
    ' | jq '{
        skills: .,
        summary: {
            skill_count: (. | length),
            total_trigger_seconds: ([.[].trigger_seconds] | add),
            total_quality_seconds: ([.[].quality_seconds] | add),
            grand_total_seconds: ([.[].total_seconds] | add),
            median_quality_seconds: '"$MEDIAN_QUALITY"',
            outlier_count: ([.[] | select(.outlier)] | length)
        }
    }'
    exit 0
fi

# ---------------------------------------------------------------------------
# Formatted table output
# ---------------------------------------------------------------------------
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  OrchestKit Eval Duration Report${NC}"
echo -e "${BLUE}  Results: ${CYAN}$RESULTS_DIR${NC}"
echo -e "${BLUE}  Skills: ${CYAN}$SKILL_COUNT${NC}  Median quality: ${CYAN}$(fmt_dur "$MEDIAN_QUALITY")${NC}  Outlier threshold: ${CYAN}$(fmt_dur "${OUTLIER_THRESHOLD%.*}")${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Header
printf "  ${BOLD}%-40s %9s %9s %9s${NC}\n" "Skill" "Trigger" "Quality" "Total"
printf "  %-40s %9s %9s %9s\n" "$(printf '─%.0s' {1..40})" "$(printf '─%.0s' {1..9})" "$(printf '─%.0s' {1..9})" "$(printf '─%.0s' {1..9})"

# Rows (top N)
DISPLAYED=0
echo "$SORTED" | while IFS='|' read -r skill trigger quality total; do
    DISPLAYED=$((DISPLAYED + 1))
    [[ $DISPLAYED -gt $TOP_N ]] && break

    t_fmt=$(fmt_dur "$trigger")
    q_fmt=$(fmt_dur "$quality")
    total_fmt=$(fmt_dur "$total")

    # Flag outliers
    is_outlier=false
    if [[ "$quality" -gt "${OUTLIER_THRESHOLD%.*}" ]] 2>/dev/null && [[ "$quality" -gt 0 ]]; then
        is_outlier=true
    fi

    if [[ "$is_outlier" == "true" ]]; then
        printf "  ${RED}⚠ %-38s %9s %9s %9s${NC}\n" "$skill" "$t_fmt" "$q_fmt" "$total_fmt"
    else
        printf "  %-40s %9s %9s %9s\n" "$skill" "$t_fmt" "$q_fmt" "$total_fmt"
    fi
done

REMAINING=$((SKILL_COUNT - TOP_N))
if [[ $REMAINING -gt 0 ]]; then
    echo -e "  ${YELLOW}... +$REMAINING more (use --top $SKILL_COUNT to show all)${NC}"
fi

# Footer
printf "  %-40s %9s %9s %9s\n" "$(printf '─%.0s' {1..40})" "$(printf '─%.0s' {1..9})" "$(printf '─%.0s' {1..9})" "$(printf '─%.0s' {1..9})"
printf "  ${BOLD}%-40s %9s %9s %9s${NC}\n" "TOTAL ($SKILL_COUNT skills)" "$(fmt_dur "$TOTAL_TRIGGER")" "$(fmt_dur "$TOTAL_QUALITY")" "$(fmt_dur "$GRAND_TOTAL")"

# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------
echo ""
echo -e "${BLUE}  Insights${NC}"

if [[ $OUTLIER_COUNT -gt 0 ]]; then
    echo -e "  ${RED}⚠ $OUTLIER_COUNT outlier(s) exceed 3× median quality duration ($(fmt_dur "${OUTLIER_THRESHOLD%.*}"))${NC}"
fi

# Slowest skill
SLOWEST=$(echo "$SORTED" | head -1)
SLOWEST_SKILL=$(echo "$SLOWEST" | cut -d'|' -f1)
SLOWEST_TOTAL=$(echo "$SLOWEST" | cut -d'|' -f4)
echo -e "  Slowest:  ${RED}$SLOWEST_SKILL${NC} ($(fmt_dur "$SLOWEST_TOTAL"))"

# Fastest skill (with nonzero total)
FASTEST=$(echo "$REPORT_JSON" | awk -F'|' '$4 > 0' | sort -t'|' -k4 -n | head -1)
FASTEST_SKILL=$(echo "$FASTEST" | cut -d'|' -f1)
FASTEST_TOTAL=$(echo "$FASTEST" | cut -d'|' -f4)
echo -e "  Fastest:  ${GREEN}$FASTEST_SKILL${NC} ($(fmt_dur "$FASTEST_TOTAL"))"

# --changed savings estimate
SAVINGS=$((GRAND_TOTAL - SLOWEST_TOTAL))
echo -e "  ${CYAN}--changed vs --all saves ~$(fmt_dur "$SAVINGS") per PR${NC}"

echo ""
