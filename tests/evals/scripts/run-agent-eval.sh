#!/bin/bash
# =============================================================================
# OrchestKit Agent Evaluation Runner
# =============================================================================
# Quality evaluation for agents. No baseline comparison — agents always run
# with their full skill set. Grading uses the same assertion mechanism as
# the skill quality runner.
#
# Usage:
#   npm run eval:agent -- backend-system-architect  # one agent
#   npm run eval:agent -- --all                     # all agents with eval YAMLs
#   npm run eval:agent -- --capture-only            # save outputs, skip grading
#   npm run eval:agent -- --grade-only              # re-grade captured outputs
#   npm run eval:agent -- --dry-run                 # validate YAML only
#   npm run eval:agent -- --reps N                  # repeat grading N times
#   npm run eval:agent -- --tag TAG                 # filter by tag
#   npm run eval:agent -- --max-turns N             # override max turns (default 15)
#   npm run eval:agent -- --timeout N               # override timeout (default 300s)
#   npm run eval:agent -- --model MODEL             # model override
#   npm run eval:agent -- --budget N                # max USD per run (default 3.00)
#
# Requirements:
#   - yq, jq, bc
#   - Claude Code CLI
#   - Run OUTSIDE Claude Code session
# =============================================================================

# Configuration (set BEFORE sourcing common lib)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false

# Source shared library
# shellcheck source=lib/eval-common.sh
source "$SCRIPT_DIR/lib/eval-common.sh"

# Runner-specific configuration
EVALS_DIR="$(dirname "$SCRIPT_DIR")"
AGENTS_EVAL_DIR="$EVALS_DIR/agents"
RESULTS_DIR="$EVALS_DIR/results/agents"
PLUGIN_DIR="plugins/ork"
REPS=1
CAPTURE_ONLY=false
GRADE_ONLY=false
AGENT_FILTER=""
TAG_FILTER=""
MAX_TURNS=15
GEN_TIMEOUT=300
GRADE_TIMEOUT=60
EVAL_MODEL=""
MAX_BUDGET="3.00"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --all) AGENT_FILTER="__all__"; shift ;;
        --capture-only) CAPTURE_ONLY=true; shift ;;
        --grade-only) GRADE_ONLY=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --reps)
            if [[ $# -lt 2 ]] || ! [[ "$2" =~ ^[1-9][0-9]*$ ]]; then
                echo -e "${RED}Error: --reps requires a positive integer${NC}"; exit 1
            fi
            REPS="$2"; shift 2 ;;
        --tag)
            if [[ $# -lt 2 ]]; then echo -e "${RED}Error: --tag requires a value${NC}"; exit 1; fi
            TAG_FILTER="$2"; shift 2 ;;
        --max-turns)
            if [[ $# -lt 2 ]] || ! [[ "$2" =~ ^[1-9][0-9]*$ ]]; then
                echo -e "${RED}Error: --max-turns requires a positive integer${NC}"; exit 1
            fi
            MAX_TURNS="$2"; shift 2 ;;
        --timeout)
            if [[ $# -lt 2 ]] || ! [[ "$2" =~ ^[1-9][0-9]*$ ]]; then
                echo -e "${RED}Error: --timeout requires a positive integer${NC}"; exit 1
            fi
            GEN_TIMEOUT="$2"; shift 2 ;;
        --model)
            if [[ $# -lt 2 ]]; then echo -e "${RED}Error: --model requires a value${NC}"; exit 1; fi
            EVAL_MODEL="$2"; shift 2 ;;
        --budget)
            if [[ $# -lt 2 ]]; then echo -e "${RED}Error: --budget requires a value${NC}"; exit 1; fi
            MAX_BUDGET="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: $0 [agent-name|--all] [--capture-only] [--grade-only] [--dry-run] [--reps N] [--tag TAG] [--max-turns N] [--timeout N] [--model MODEL] [--budget USD]"
            exit 0 ;;
        -*) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
        *) AGENT_FILTER="$1"; shift ;;
    esac
done

# Validate
if [[ "$GRADE_ONLY" == "true" && "$CAPTURE_ONLY" == "true" ]]; then
    echo -e "${RED}Error: --grade-only and --capture-only are mutually exclusive${NC}"; exit 1
fi
if [[ -z "$AGENT_FILTER" ]]; then
    echo -e "${RED}Error: specify an agent name or --all${NC}"
    echo "Usage: $0 [agent-name|--all] [--capture-only] [--grade-only] [--dry-run] [--reps N] [--tag TAG] [--max-turns N] [--timeout N]"
    exit 1
fi
# Agent names use same pattern as skills
if [[ "$AGENT_FILTER" != "__all__" ]] && ! [[ "$AGENT_FILTER" =~ $SKILL_NAME_RE ]]; then
    echo -e "${RED}Error: invalid agent name (lowercase alphanumeric and hyphens only)${NC}"; exit 1
fi

# ─── Functions ────────────────────────────────────────────────────────────────

validate_agent_yaml() {
    local file="$1"
    local errors=0

    local id; id=$(yq -r '.id' "$file" 2>/dev/null)
    if [[ -z "$id" || "$id" == "null" ]]; then
        echo -e "  ${RED}Missing: id${NC}"; ((errors++))
    fi

    local eval_count; eval_count=$(yq -r '.agent_evals | length' "$file" 2>/dev/null)
    if [[ "$eval_count" == "null" || "$eval_count" -eq 0 ]]; then
        echo -e "  ${RED}Missing or empty: agent_evals${NC}"; ((errors++))
        return "$errors"
    fi

    for ((i=0; i<eval_count; i++)); do
        local prompt; prompt=$(yq -r ".agent_evals[$i].prompt" "$file" 2>/dev/null)
        if [[ -z "$prompt" || "$prompt" == "null" ]]; then
            echo -e "  ${RED}agent_evals[$i]: missing prompt${NC}"; ((errors++))
        fi

        local assertion_count; assertion_count=$(yq -r ".agent_evals[$i].assertions | length" "$file" 2>/dev/null)
        if [[ "$assertion_count" == "null" || "$assertion_count" -eq 0 ]]; then
            echo -e "  ${RED}agent_evals[$i]: missing or empty assertions${NC}"; ((errors++))
        fi

        for ((j=0; j<assertion_count; j++)); do
            local aname; aname=$(yq -r ".agent_evals[$i].assertions[$j].name" "$file" 2>/dev/null)
            local acheck; acheck=$(yq -r ".agent_evals[$i].assertions[$j].check" "$file" 2>/dev/null)
            if [[ -z "$aname" || "$aname" == "null" ]]; then
                echo -e "  ${RED}agent_evals[$i].assertions[$j]: missing name${NC}"; ((errors++))
            fi
            if [[ -z "$acheck" || "$acheck" == "null" ]]; then
                echo -e "  ${RED}agent_evals[$i].assertions[$j]: missing check${NC}"; ((errors++))
            fi
        done
    done

    return "$errors"
}

build_claude_flags() {
    local flags=()
    flags+=(--plugin-dir "$PLUGIN_DIR")
    flags+=(--dangerously-skip-permissions)
    flags+=(--max-turns "$MAX_TURNS")
    flags+=(--output-format json)
    flags+=(--no-session-persistence)
    flags+=(--max-budget-usd "$MAX_BUDGET")
    if [[ -n "$EVAL_MODEL" ]]; then
        flags+=(--model "$EVAL_MODEL")
    fi
    echo "${flags[@]}"
}

# Run agent with prompt
run_agent() {
    local agent_id="$1"
    local prompt="$2"
    local output_file="$3"
    local stderr_file="$4"
    local cwd_arg="$5"
    local -a flags
    read -ra flags <<< "$(build_claude_flags)"

    # Wrap prompt to trigger agent spawning
    local wrapped_prompt="Using the ${agent_id} subagent, perform this task: ${prompt}"

    if [[ -n "$cwd_arg" && "$cwd_arg" != "." ]]; then
        (
            cd "$cwd_arg" || exit 1
            run_with_timeout "$GEN_TIMEOUT" claude -p "$wrapped_prompt" \
                "${flags[@]}" \
                > "$output_file" 2>"$stderr_file"
        ) || echo -e "  ${YELLOW}Warning: claude exited non-zero for agent run${NC}" >&2
    else
        if ! run_with_timeout "$GEN_TIMEOUT" claude -p "$wrapped_prompt" \
            "${flags[@]}" \
            > "$output_file" 2>"$stderr_file"; then
            echo -e "  ${YELLOW}Warning: claude exited non-zero for agent run${NC}" >&2
        fi
    fi
}

extract_output_text() {
    local json_file="$1"
    local text
    text=$(jq -r '.result // .content // . | if type == "string" then . else tostring end' "$json_file" 2>/dev/null)
    if [[ -z "$text" || "$text" == "null" ]]; then
        text=$(cat "$json_file" 2>/dev/null)
    fi
    echo "$text"
}

# Batch grade assertions (same as quality runner)
grade_assertions_batch() {
    local assertions_json="$1"
    local output_text="$2"
    local tmpfile; tmpfile=$(mktemp)
    CLEANUP_FILES+=("$tmpfile")

    local grading_prompt
    grading_prompt="You are an assertion grader. Grade this output against EACH assertion below.
For each assertion, output a JSON object: {\"name\": \"...\", \"verdict\": \"PASS\" or \"FAIL\", \"reason\": \"one-line reason\"}
Return ONLY a valid JSON array of all results. No other text.

ASSERTIONS:
$assertions_json

OUTPUT:
$output_text"

    # CC 2.1.81: --bare for grading calls (no plugins needed)
    local -a bare_flag=()
    if [[ "$BARE_MODE" == "true" ]]; then bare_flag=(--bare); fi

    run_with_timeout "$GRADE_TIMEOUT" claude -p "$grading_prompt" \
        "${bare_flag[@]}" \
        --max-turns 1 \
        --output-format text \
        > "$tmpfile" 2>/dev/null || true

    local raw; raw=$(cat "$tmpfile")
    rm -f "$tmpfile"

    local cleaned; cleaned=$(echo "$raw" | sed 's/^```json//;s/^```//;s/```$//' | tr -d '\r')

    if echo "$cleaned" | jq 'type == "array"' 2>/dev/null | grep -q true; then
        echo "$cleaned"
        return 0
    fi

    echo ""
    return 1
}

# Grade single assertion (fallback)
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

    # CC 2.1.81: --bare for grading calls (no plugins needed)
    local -a bare_flag=()
    if [[ "$BARE_MODE" == "true" ]]; then bare_flag=(--bare); fi

    run_with_timeout "$GRADE_TIMEOUT" claude -p "$grading_prompt" \
        "${bare_flag[@]}" \
        --max-turns 1 \
        --output-format text \
        > "$tmpfile" 2>/dev/null || true

    local grader_output; grader_output=$(cat "$tmpfile")
    rm -f "$tmpfile"

    local first_token; first_token=$(echo "$grader_output" | head -1 | awk '{print toupper($1)}')
    local reason; reason=$(echo "$grader_output" | head -1 | sed 's/^[[:space:]]*[A-Za-z]*[[:space:]]*//')
    if [[ "$first_token" == "PASS" ]]; then
        echo "PASS|$reason"
    else
        echo "FAIL|$reason"
    fi
}

# Scaffold support (reuse from quality runner)
prepare_scaffold() {
    local scaffold_type="$1"
    _SCAFFOLD_DIR="."

    if [[ -z "$scaffold_type" || "$scaffold_type" == "null" || "$scaffold_type" == "empty" ]]; then
        return 0
    fi

    local scaffold_dir; scaffold_dir=$(mktemp -d)
    CLEANUP_DIRS+=("$scaffold_dir")

    case "$scaffold_type" in
        typescript-nextjs)
            mkdir -p "$scaffold_dir/src" "$scaffold_dir/pages/api"
            echo '{"name":"eval-scaffold","scripts":{"dev":"next dev","build":"next build","test":"jest"}}' > "$scaffold_dir/package.json"
            echo '{"compilerOptions":{"target":"es5","lib":["dom","esnext"],"jsx":"preserve","module":"esnext","moduleResolution":"node","strict":true}}' > "$scaffold_dir/tsconfig.json"
            ;;
        git-repo)
            (
                cd "$scaffold_dir" || exit 1
                git init -q
                git config user.email "eval@orchestkit.dev"
                git config user.name "Eval Runner"
                mkdir -p src tests
                echo '{"name":"eval-project","scripts":{"test":"echo ok","build":"echo ok"}}' > package.json
                cat > src/auth.ts << 'SCAFFOLD_EOF'
export async function authenticate(token: string): Promise<boolean> {
  const decoded = await verifyJwt(token);
  return decoded !== null;
}
SCAFFOLD_EOF
                cat > src/db.ts << 'SCAFFOLD_EOF'
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export async function query(sql: string, params?: unknown[]) {
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}
SCAFFOLD_EOF
                git add -A
                git commit -q -m "initial commit"
            ) 2>/dev/null
            ;;
        python-fastapi)
            mkdir -p "$scaffold_dir/app" "$scaffold_dir/tests"
            cat > "$scaffold_dir/app/main.py" << 'SCAFFOLD_EOF'
from fastapi import FastAPI
app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "ok"}
SCAFFOLD_EOF
            cat > "$scaffold_dir/pyproject.toml" << 'SCAFFOLD_EOF'
[project]
name = "eval-project"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["fastapi", "uvicorn"]
SCAFFOLD_EOF
            ;;
        *)
            echo -e "  ${YELLOW}Warning: unknown scaffold type '$scaffold_type', using current dir${NC}" >&2
            rm -rf "$scaffold_dir"
            return 0
            ;;
    esac

    _SCAFFOLD_DIR="$scaffold_dir"
}

# ─── Main eval_agent orchestrator ─────────────────────────────────────────────

eval_agent() {
    local eval_file="$1"
    local agent_id; agent_id=$(yq -r '.id' "$eval_file")
    if ! [[ "$agent_id" =~ $SKILL_NAME_RE ]]; then
        echo -e "  ${RED}Invalid agent id in $eval_file: '$agent_id'${NC}"
        return 1
    fi
    local eval_count; eval_count=$(yq -r '.agent_evals | length' "$eval_file")
    local start_time; start_time=$(date +%s)

    echo -e "\n${BLUE}+=======================================================+${NC}"
    echo -e "${BLUE}|  AGENT EVAL -- ${BOLD}$agent_id${NC}${BLUE}$(printf '%*s' $((36 - ${#agent_id})) '')|${NC}"
    echo -e "${BLUE}+========================================================+${NC}"

    echo -e "${CYAN}  Validating agent_evals YAML...${NC}"
    if ! validate_agent_yaml "$eval_file"; then
        echo -e "${BLUE}|${NC}  ${RED}YAML validation failed -- skipping${NC}"
        echo -e "${BLUE}+========================================================+${NC}"
        return 1
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${BLUE}|${NC}  ${YELLOW}DRY-RUN: YAML valid, skipping Claude calls${NC}"
        echo -e "${BLUE}|${NC}  Agent evals: $eval_count entries"
        local total_assertions=0
        for ((i=0; i<eval_count; i++)); do
            local ac; ac=$(yq -r ".agent_evals[$i].assertions | length" "$eval_file")
            total_assertions=$((total_assertions + ac))
        done
        echo -e "${BLUE}|${NC}  Total assertions: $total_assertions"
        echo -e "${BLUE}+========================================================+${NC}"
        return 0
    fi

    # Aggregate counters
    local agg_pass=0 agg_total=0
    local evals_json="["
    local first_eval=true

    for ((ei=0; ei<eval_count; ei++)); do
        local prompt; prompt=$(yq -r ".agent_evals[$ei].prompt" "$eval_file")
        local assertion_count; assertion_count=$(yq -r ".agent_evals[$ei].assertions | length" "$eval_file")
        local scaffold_type; scaffold_type=$(yq -r ".agent_evals[$ei].scaffold // \"\"" "$eval_file")

        local display_prompt; display_prompt=$(echo "$prompt" | tr '\n' ' ' | sed 's/  */ /g')
        display_prompt="${display_prompt:0:48}"
        [[ ${#prompt} -gt 48 ]] && display_prompt="${display_prompt}..."

        echo -e "${BLUE}|${NC}"
        echo -e "${BLUE}|${NC}  ${BOLD}Eval $((ei+1)):${NC} \"$display_prompt\""
        echo -e "${BLUE}|${NC}"

        prepare_scaffold "$scaffold_type"
        local scaffold_cwd="$_SCAFFOLD_DIR"

        local output_text=""

        if [[ "$GRADE_ONLY" == "true" ]]; then
            local saved_file="$RESULTS_DIR/${agent_id}.eval${ei}.output.json"
            if [[ ! -f "$saved_file" ]]; then
                echo -e "${BLUE}|${NC}  ${RED}GRADE-ONLY: captured output not found (run --capture-only first)${NC}"
                echo -e "${BLUE}+========================================================+${NC}"
                return 1
            fi
            echo -e "${BLUE}|${NC}  ${CYAN}Loading captured output...${NC}"
            output_text=$(extract_output_text "$saved_file")
        else
            # Run agent
            local out_file; out_file=$(mktemp)
            local err_file; err_file=$(mktemp)
            CLEANUP_FILES+=("$out_file" "$err_file")

            echo -e "${BLUE}||${NC}  ${CYAN}Running agent ${agent_id}...${NC}"
            run_agent "$agent_id" "$prompt" "$out_file" "$err_file" "$scaffold_cwd"
            output_text=$(extract_output_text "$out_file")

            if [[ "$CAPTURE_ONLY" == "true" ]]; then
                echo -e "${BLUE}|${NC}  ${YELLOW}CAPTURE-ONLY: output saved, skipping grading${NC}"
                mkdir -p "$RESULTS_DIR"
                cp "$out_file" "$RESULTS_DIR/${agent_id}.eval${ei}.output.json"
                rm -f "$out_file" "$err_file"
                [[ "$scaffold_cwd" != "." ]] && rm -rf "$scaffold_cwd"
                continue
            fi

            rm -f "$out_file" "$err_file"
        fi

        # Grade assertions (batch + fallback)
        local verdicts=()
        local reasons=()

        # Build assertions JSON
        local assertions_arr="["
        local first_a=true
        for ((ai=0; ai<assertion_count; ai++)); do
            local aname; aname=$(yq -r ".agent_evals[$ei].assertions[$ai].name" "$eval_file")
            local acheck; acheck=$(yq -r ".agent_evals[$ei].assertions[$ai].check" "$eval_file")
            [[ "$first_a" == "true" ]] && first_a=false || assertions_arr+=","
            assertions_arr+="{\"name\":$(echo "$aname" | jq -Rs .),\"check\":$(echo "$acheck" | jq -Rs .)}"
        done
        assertions_arr+="]"

        # Try batch grading
        local batch_ok=false
        if [[ "$REPS" -eq 1 ]]; then
            local batch_result; batch_result=$(grade_assertions_batch "$assertions_arr" "$output_text")
            if [[ -n "$batch_result" ]]; then
                local parsed_count; parsed_count=$(echo "$batch_result" | jq 'length' 2>/dev/null)
                if [[ "$parsed_count" == "$assertion_count" ]]; then
                    batch_ok=true
                    for ((ai=0; ai<assertion_count; ai++)); do
                        local v; v=$(echo "$batch_result" | jq -r ".[$ai].verdict" 2>/dev/null | tr '[:lower:]' '[:upper:]')
                        local r; r=$(echo "$batch_result" | jq -r ".[$ai].reason // \"\"" 2>/dev/null)
                        [[ "$v" == "PASS" ]] && verdicts+=("PASS") || verdicts+=("FAIL")
                        reasons+=("$r")
                    done
                fi
            fi
        fi

        # Fallback: per-assertion
        if [[ "$batch_ok" == "false" ]]; then
            for ((ai=0; ai<assertion_count; ai++)); do
                local acheck; acheck=$(yq -r ".agent_evals[$ei].assertions[$ai].check" "$eval_file")
                local result; result=$(grade_assertion "$acheck" "$output_text")
                verdicts+=("$(echo "$result" | cut -d'|' -f1)")
                reasons+=("$(echo "$result" | cut -d'|' -f2-)")
            done
        fi

        # Display results
        local eval_pass=0
        printf "${BLUE}|${NC}  %-30s %-10s\n" "" "Verdict"
        local assertions_json="["
        local first_assertion=true

        for ((ai=0; ai<assertion_count; ai++)); do
            local aname; aname=$(yq -r ".agent_evals[$ei].assertions[$ai].name" "$eval_file")
            local acheck; acheck=$(yq -r ".agent_evals[$ei].assertions[$ai].check" "$eval_file")
            local v="${verdicts[$ai]}"
            local r="${reasons[$ai]}"

            local sym
            [[ "$v" == "PASS" ]] && sym="${GREEN}PASS${NC}" && ((eval_pass++)) || sym="${RED}FAIL${NC}"

            local padded_name; padded_name=$(printf "%-28s" "$aname")
            echo -e "${BLUE}|${NC}  ${padded_name}  $sym"

            [[ "$first_assertion" == "true" ]] && first_assertion=false || assertions_json+=","
            assertions_json+="{\"name\":$(echo "$aname" | jq -Rs .),\"check\":$(echo "$acheck" | jq -Rs .),\"verdict\":\"$v\",\"reason\":$(echo "$r" | jq -Rs .)}"
        done
        assertions_json+="]"

        local eval_rate=0
        if [[ "$assertion_count" -gt 0 ]]; then
            eval_rate=$(echo "scale=0; $eval_pass * 100 / $assertion_count" | bc)
        fi

        echo -e "${BLUE}|${NC}"
        echo -e "${BLUE}|${NC}  Score: ${BOLD}$eval_pass/$assertion_count (${eval_rate}%)${NC}"

        agg_pass=$((agg_pass + eval_pass))
        agg_total=$((agg_total + assertion_count))

        [[ "$first_eval" == "true" ]] && first_eval=false || evals_json+=","
        evals_json+="{\"prompt\":$(echo "$prompt" | jq -Rs .),\"assertions\":$assertions_json,\"pass_rate\":$eval_rate}"

        [[ "$scaffold_cwd" != "." ]] && rm -rf "$scaffold_cwd"
    done

    evals_json+="]"

    if [[ "$CAPTURE_ONLY" == "true" ]]; then
        echo -e "${BLUE}+========================================================+${NC}"
        echo -e "${BLUE}|${NC}  ${YELLOW}Outputs saved to $RESULTS_DIR/${NC}"
        echo -e "${BLUE}+========================================================+${NC}"
        return 0
    fi

    # Aggregate
    local agg_rate=0
    if [[ "$agg_total" -gt 0 ]]; then
        agg_rate=$(echo "scale=0; $agg_pass * 100 / $agg_total" | bc)
    fi

    local verdict verdict_display
    if [[ "$agg_rate" -ge 80 ]]; then
        verdict="PASS"; verdict_display="${GREEN}PASS (${agg_rate}%)${NC}"
    elif [[ "$agg_rate" -ge 50 ]]; then
        verdict="PARTIAL"; verdict_display="${YELLOW}PARTIAL (${agg_rate}%)${NC}"
    else
        verdict="FAIL"; verdict_display="${RED}FAIL (${agg_rate}%)${NC}"
    fi

    local end_time; end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo -e "${BLUE}+========================================================+${NC}"
    echo -e "${BLUE}|${NC}  Verdict: ${BOLD}$verdict_display${NC}"
    echo -e "${BLUE}|${NC}  Duration: ${duration}s"
    echo -e "${BLUE}+========================================================+${NC}"

    # Write results
    mkdir -p "$RESULTS_DIR"
    cat > "$RESULTS_DIR/$agent_id.quality.json" <<ENDJSON
{
  "agent": $(echo "$agent_id" | jq -Rs .),
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "evals": $evals_json,
  "aggregate": {
    "pass_rate": $agg_rate,
    "total_assertions": $agg_total,
    "passed_assertions": $agg_pass,
    "verdict": $(echo "$verdict" | jq -Rs .)
  },
  "reps": $REPS,
  "duration_seconds": $duration
}
ENDJSON

    if [[ "$verdict" == "FAIL" ]]; then
        return 1
    fi
    return 0
}

# ─── Main ─────────────────────────────────────────────────────────────────────

check_deps

echo -e "${BLUE}----------------------------------------------------${NC}"
echo -e "${BLUE}  OrchestKit Agent Quality Evaluation${NC}"
if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${BLUE}  Mode: ${YELLOW}DRY-RUN (YAML validation only)${NC}"
elif [[ "$CAPTURE_ONLY" == "true" ]]; then
    echo -e "${BLUE}  Mode: ${YELLOW}CAPTURE-ONLY (outputs saved, no grading)${NC}"
elif [[ "$GRADE_ONLY" == "true" ]]; then
    echo -e "${BLUE}  Mode: ${YELLOW}GRADE-ONLY (re-grading captured outputs)${NC}"
else
    echo -e "${BLUE}  Mode: ${GREEN}LIVE (grading with ${REPS}x reps)${NC}"
fi
echo "  Max turns: $MAX_TURNS  |  Timeout: ${GEN_TIMEOUT}s  |  Budget: \$${MAX_BUDGET}"
[[ -n "$EVAL_MODEL" ]] && echo "  Model: $EVAL_MODEL"
echo -e "${BLUE}----------------------------------------------------${NC}"

# Collect eval files
eval_files=()
if [[ "$AGENT_FILTER" == "__all__" ]]; then
    for f in "$AGENTS_EVAL_DIR"/*.eval.yaml; do
        [[ -f "$f" ]] || continue
        local_eval_count=$(yq -r '.agent_evals | length' "$f" 2>/dev/null)
        if [[ "$local_eval_count" != "null" && "$local_eval_count" -gt 0 ]]; then
            if [[ -n "$TAG_FILTER" ]]; then
                if yq -r ".tags[]" "$f" 2>/dev/null | grep -q "$TAG_FILTER"; then
                    eval_files+=("$f")
                fi
            else
                eval_files+=("$f")
            fi
        fi
    done
else
    local_file="$AGENTS_EVAL_DIR/$AGENT_FILTER.eval.yaml"
    if [[ ! -f "$local_file" ]]; then
        echo -e "${RED}Error: $local_file not found${NC}"
        exit 1
    fi
    eval_files+=("$local_file")
fi

echo -e "  Agents: ${#eval_files[@]}"

# Run evals
total=0; passed=0; failed=0
failed_agents=()

for eval_file in "${eval_files[@]}"; do
    ((total++))
    if eval_agent "$eval_file"; then
        ((passed++))
    else
        ((failed++))
        failed_agents+=("$(yq -r '.id' "$eval_file")")
    fi
done

# Summary
echo ""
echo -e "${BLUE}----------------------------------------------------${NC}"
echo -e "${BLUE}  SUMMARY${NC}"
echo -e "${BLUE}----------------------------------------------------${NC}"
echo -e "  Total:  $total"
echo -e "  Passed: ${GREEN}$passed${NC}"
if [[ "$failed" -gt 0 ]]; then
    echo -e "  Failed: ${RED}$failed${NC} (${failed_agents[*]})"
fi
echo -e "${BLUE}----------------------------------------------------${NC}"

if [[ "$failed" -gt 0 ]]; then
    exit 1
fi
exit 0
