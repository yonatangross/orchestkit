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
#   npm run eval:quality -- --grade-only     # re-grade previously captured outputs
#   npm run eval:quality -- --dry-run        # validate YAML only
#   npm run eval:quality -- --reps N         # repeat grading N times for stability
#   npm run eval:quality -- --tag core       # filter by tag
#   npm run eval:quality -- --max-turns N    # override max turns for generation (default 10)
#   npm run eval:quality -- --timeout N      # override generation timeout (seconds)
#   npm run eval:quality -- --skip-baseline   # skip baseline, quality-only (saves ~50% CLI calls)
#   npm run eval:quality -- --force-skill    # TIER 1: inject SKILL.md, bypass routing (unit eval)
#   npm run eval:quality -- --model sonnet   # use cheaper model for evals
#   npm run eval:quality -- --budget N       # max USD per eval run (default 2.00)
#   npm run eval:quality -- --mcp-config F   # load MCP servers from JSON file
#
# Requirements:
#   - yq for YAML parsing
#   - jq for JSON processing
#   - bc for arithmetic (pass rates, deltas)
#   - Claude Code CLI (skipped in --dry-run mode)
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
REPS=1
CAPTURE_ONLY=false
GRADE_ONLY=false
SKILL_FILTER=""
TAG_FILTER=""
MAX_TURNS=10
GEN_TIMEOUT=180
GRADE_TIMEOUT=60
EVAL_MODEL=""
MAX_BUDGET="2.00"
MCP_CONFIG=""
SKIP_BASELINE=false
FORCE_SKILL=false
FORCE_EVAL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --all) SKILL_FILTER="__all__"; shift ;;
        --capture-only) CAPTURE_ONLY=true; shift ;;
        --grade-only) GRADE_ONLY=true; shift ;;
        --skip-baseline) SKIP_BASELINE=true; shift ;;
        --force-skill) FORCE_SKILL=true; SKIP_BASELINE=true; shift ;;
        --force) FORCE_EVAL=true; shift ;;
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
        --tag)
            if [[ $# -lt 2 ]]; then
                echo -e "${RED}Error: --tag requires a value${NC}"; exit 1
            fi
            TAG_FILTER="$2"; shift 2
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
        --model)
            if [[ $# -lt 2 ]]; then
                echo -e "${RED}Error: --model requires a value (e.g., sonnet, opus, haiku)${NC}"; exit 1
            fi
            EVAL_MODEL="$2"; shift 2
            ;;
        --budget)
            if [[ $# -lt 2 ]]; then
                echo -e "${RED}Error: --budget requires a value (e.g., 2.00)${NC}"; exit 1
            fi
            MAX_BUDGET="$2"; shift 2
            ;;
        --mcp-config)
            if [[ $# -lt 2 ]]; then
                echo -e "${RED}Error: --mcp-config requires a file path${NC}"; exit 1
            fi
            if [[ ! -f "$2" ]]; then
                echo -e "${RED}Error: MCP config file not found: $2${NC}"; exit 1
            fi
            MCP_CONFIG="$2"; shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [skill-name|--all] [--capture-only] [--grade-only] [--dry-run] [--skip-baseline] [--force-skill] [--reps N] [--tag TAG] [--max-turns N] [--timeout N] [--model MODEL] [--budget USD] [--mcp-config FILE]"
            echo ""
            echo "  --force-skill    TIER 1 unit eval: inject SKILL.md via --append-system-prompt."
            echo "                   Bypasses agent routing to test skill content quality in isolation."
            echo "                   Implies --skip-baseline and --max-turns 1."
            exit 0
            ;;
        -*) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
        *) SKILL_FILTER="$1"; shift ;;
    esac
done

# Validate mutually exclusive flags (A5)
if [[ "$GRADE_ONLY" == "true" && "$CAPTURE_ONLY" == "true" ]]; then
    echo -e "${RED}Error: --grade-only and --capture-only are mutually exclusive${NC}"
    exit 1
fi
if [[ "$GRADE_ONLY" == "true" && "$DRY_RUN" == "true" ]]; then
    echo -e "${RED}Error: --grade-only and --dry-run are mutually exclusive${NC}"
    exit 1
fi

if [[ -z "$SKILL_FILTER" ]]; then
    echo -e "${RED}Error: specify a skill name or --all${NC}"
    echo "Usage: $0 [skill-name|--all] [--capture-only] [--grade-only] [--dry-run] [--skip-baseline] [--reps N] [--tag TAG] [--max-turns N] [--timeout N]"
    exit 1
fi

# Validate skill name to prevent path traversal (SEC-001)
if [[ "$SKILL_FILTER" != "__all__" ]] && ! [[ "$SKILL_FILTER" =~ $SKILL_NAME_RE ]]; then
    echo -e "${RED}Error: invalid skill name (lowercase alphanumeric and hyphens only)${NC}"
    exit 1
fi

# ─── Functions ────────────────────────────────────────────────────────────────

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

# Build common claude flags for eval runs
build_claude_flags() {
    local include_plugin="$1"  # "true" or "false"
    local flags=()

    if [[ "$include_plugin" == "true" ]]; then
        flags+=(--plugin-dir "$PLUGIN_DIR")
    elif [[ "$BARE_MODE" == "true" ]]; then
        # CC 2.1.81: --bare skips hooks/LSP/plugin sync for faster scripted calls
        flags+=(--bare)
    fi
    flags+=(--dangerously-skip-permissions)
    flags+=(--max-turns "$MAX_TURNS")
    flags+=(--output-format json)
    flags+=(--no-session-persistence)
    flags+=(--max-budget-usd "$MAX_BUDGET")

    # Default to Haiku for eval generation (Sonnet/Opus too expensive for batch eval).
    # Override with --model flag or EVAL_MODEL env var.
    flags+=(--model "${EVAL_MODEL:-haiku}")
    if [[ -n "$MCP_CONFIG" ]]; then
        flags+=(--mcp-config "$MCP_CONFIG")
    fi

    echo "${flags[@]}"
}

# Run a prompt with skill content force-loaded via --append-system-prompt (TIER 1: unit eval).
# Bypasses agent routing entirely — tests skill content quality in isolation.
run_with_forced_skill() {
    local prompt="$1"
    local output_file="$2"
    local stderr_file="$3"
    local skill_id="$4"
    local cwd_arg="$5"  # optional
    local -a flags=()

    # Resolve SKILL.md path
    local skill_path="src/skills/$skill_id/SKILL.md"
    if [[ ! -f "$skill_path" ]]; then
        echo -e "  ${RED}Error: $skill_path not found for --force-skill${NC}" >&2
        echo "SKILL_NOT_FOUND" > "$output_file"
        return 1
    fi

    # Read skill content (strip YAML frontmatter — macOS-compatible)
    local skill_content
    skill_content=$(awk 'BEGIN{skip=0} /^---$/{skip++; next} skip>=2{print}' "$skill_path")

    # Build flags: no --plugin-dir, no tool use (pure text generation)
    # --print forces text-only output with no tool calls — ideal for quality eval
    flags+=(--print)
    flags+=(--no-session-persistence)
    flags+=(--max-budget-usd "$MAX_BUDGET")
    flags+=(--append-system-prompt "$skill_content")

    # CC 2.1.81: --bare skips hooks/LSP/plugin sync for faster isolated eval
    if [[ "$BARE_MODE" == "true" ]]; then
        flags+=(--bare)
    fi

    # Default to Haiku for eval generation
    flags+=(--model "${EVAL_MODEL:-haiku}")

    if [[ -n "$cwd_arg" && "$cwd_arg" != "." ]]; then
        (
            cd "$cwd_arg" || exit 1
            run_with_timeout "$GEN_TIMEOUT" claude -p "$prompt" \
                "${flags[@]}" \
                > "$output_file" 2>"$stderr_file"
        ) || echo -e "  ${YELLOW}Warning: claude exited non-zero for force-skill run${NC}" >&2
    else
        if ! run_with_timeout "$GEN_TIMEOUT" claude -p "$prompt" \
            "${flags[@]}" \
            > "$output_file" 2>"$stderr_file"; then
            echo -e "  ${YELLOW}Warning: claude exited non-zero for force-skill run${NC}" >&2
        fi
    fi
}

# Run a prompt with skill (plugin loaded) and capture output (A6: timeout)
run_with_skill() {
    local prompt="$1"
    local output_file="$2"
    local stderr_file="$3"
    local cwd_arg="$4"  # optional: directory to run from (A8)
    local -a flags
    read -ra flags <<< "$(build_claude_flags true)"

    if [[ -n "$cwd_arg" && "$cwd_arg" != "." ]]; then
        (
            cd "$cwd_arg" || exit 1
            run_with_timeout "$GEN_TIMEOUT" claude -p "$prompt" \
                "${flags[@]}" \
                > "$output_file" 2>"$stderr_file"
        ) || echo -e "  ${YELLOW}Warning: claude exited non-zero for with-skill run${NC}" >&2
    else
        if ! run_with_timeout "$GEN_TIMEOUT" claude -p "$prompt" \
            "${flags[@]}" \
            > "$output_file" 2>"$stderr_file"; then
            echo -e "  ${YELLOW}Warning: claude exited non-zero for with-skill run${NC}" >&2
        fi
    fi
}

# Run a prompt without skill (baseline) and capture output (A6: timeout)
run_baseline() {
    local prompt="$1"
    local output_file="$2"
    local cwd_arg="$3"  # optional: directory to run from (A8)
    local -a flags
    read -ra flags <<< "$(build_claude_flags false)"

    if [[ -n "$cwd_arg" && "$cwd_arg" != "." ]]; then
        (
            cd "$cwd_arg" || exit 1
            run_with_timeout "$GEN_TIMEOUT" claude -p "$prompt" \
                "${flags[@]}" \
                > "$output_file" 2>/dev/null
        ) || echo -e "  ${YELLOW}Warning: claude exited non-zero for baseline run${NC}" >&2
    else
        if ! run_with_timeout "$GEN_TIMEOUT" claude -p "$prompt" \
            "${flags[@]}" \
            > "$output_file" 2>/dev/null; then
            echo -e "  ${YELLOW}Warning: claude exited non-zero for baseline run${NC}" >&2
        fi
    fi
}

# Extract text content from claude JSON output
extract_output_text() {
    local json_file="$1"
    local text
    text=$(jq -r '.result // .content // . | if type == "string" then . else tostring end' "$json_file" 2>/dev/null)
    if [[ -z "$text" || "$text" == "null" ]]; then
        text=$(cat "$json_file" 2>/dev/null)
    fi
    echo "$text"
}

# Grade ALL assertions for a given output in a single Claude call (A3: batch)
# Returns a JSON array: [{"name":"...","verdict":"PASS"|"FAIL","reason":"..."},...]
grade_assertions_batch() {
    local assertions_json="$1"  # JSON array of {name, check}
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

    # CC 2.1.81: --bare + Haiku for grading calls (no plugins needed, 12x cheaper)
    local -a grade_flags=()
    if [[ "$BARE_MODE" == "true" ]]; then grade_flags+=(--bare); fi
    grade_flags+=(--model "$GRADING_MODEL")

    run_with_timeout "$GRADE_TIMEOUT" claude -p "$grading_prompt" \
        "${grade_flags[@]}" \
        --max-turns 1 \
        --output-format text \
        > "$tmpfile" 2>/dev/null || true

    local raw; raw=$(cat "$tmpfile")
    rm -f "$tmpfile"

    # Try to extract a JSON array from the response
    # Strip leading/trailing whitespace and any markdown fences
    local cleaned; cleaned=$(echo "$raw" | sed 's/^```json//;s/^```//;s/```$//' | tr -d '\r')

    # Validate it is a JSON array
    if echo "$cleaned" | jq 'type == "array"' 2>/dev/null | grep -q true; then
        echo "$cleaned"
        return 0
    fi

    # Fallback: return empty to signal caller should use per-assertion grading
    echo ""
    return 1
}

# Grade a single assertion using Claude as grader (fallback for batch failure)
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

    # CC 2.1.81: --bare + Haiku for grading calls (no plugins needed, 12x cheaper)
    local -a grade_flags=()
    if [[ "$BARE_MODE" == "true" ]]; then grade_flags+=(--bare); fi
    grade_flags+=(--model "$GRADING_MODEL")

    run_with_timeout "$GRADE_TIMEOUT" claude -p "$grading_prompt" \
        "${grade_flags[@]}" \
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
        local count
        count=$(grep -ciE "reject(ed)?|hook.*(fail|block)" "$stderr_file" 2>/dev/null) || true
        echo "${count:-0}"
    else
        echo "0"
    fi
}

# ─── Scaffold support (A8) ────────────────────────────────────────────────────

# Prepare a scaffold directory for a quality eval entry.
# Sets _SCAFFOLD_DIR to the directory to use as cwd (or "." for current dir).
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
            # Git repo with staged changes — for commit, create-pr, review-pr evals
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
                cat > tests/auth.test.ts << 'SCAFFOLD_EOF'
import { authenticate } from '../src/auth';
test('rejects invalid token', async () => {
  expect(await authenticate('bad')).toBe(false);
});
SCAFFOLD_EOF
                git add -A
                git commit -q -m "initial commit"
                # Stage a change for commit/PR evals
                cat >> src/auth.ts << 'SCAFFOLD_EOF'

export async function refreshToken(token: string): Promise<string> {
  const decoded = await verifyJwt(token);
  if (!decoded) throw new Error('Invalid token');
  return signJwt({ ...decoded, exp: Date.now() + 3600000 });
}
SCAFFOLD_EOF
                git add src/auth.ts
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

# ─── Sub-functions for eval_skill (A2 refactor) ──────────────────────────────

# Run with-skill + baseline for one eval entry, in parallel (A4).
# Sets _EVAL_WITH_FILE, _EVAL_BASE_FILE, _EVAL_STDERR_FILE.
# When FORCE_SKILL=true, uses --append-system-prompt instead of --plugin-dir.
run_eval_entry() {
    local prompt="$1"
    local scaffold_cwd="$2"

    local with_file; with_file=$(mktemp)
    local base_file; base_file=$(mktemp)
    local with_stderr; with_stderr=$(mktemp)
    CLEANUP_FILES+=("$with_file" "$base_file" "$with_stderr")

    if [[ "$FORCE_SKILL" == "true" ]]; then
        echo -e "${BLUE}||${NC}  ${CYAN}Running force-skill (SKILL.md injected, no routing)...${NC}"
        run_with_forced_skill "$prompt" "$with_file" "$with_stderr" "$_CURRENT_SKILL_ID" "$scaffold_cwd"
    elif [[ "$SKIP_BASELINE" == "true" ]]; then
        echo -e "${BLUE}||${NC}  ${CYAN}Running with-skill (baseline skipped)...${NC}"
        run_with_skill "$prompt" "$with_file" "$with_stderr" "$scaffold_cwd"
    else
        echo -e "${BLUE}||${NC}  ${CYAN}Running with-skill + baseline (parallel)...${NC}"

        # Run both in parallel (A4)
        run_with_skill "$prompt" "$with_file" "$with_stderr" "$scaffold_cwd" &
        local with_pid=$!
        run_baseline "$prompt" "$base_file" "$scaffold_cwd" &
        local base_pid=$!

        wait $with_pid 2>/dev/null || true
        wait $base_pid 2>/dev/null || true
    fi

    _EVAL_WITH_FILE="$with_file"
    _EVAL_BASE_FILE="$base_file"
    _EVAL_STDERR_FILE="$with_stderr"
}

# Grade all assertions for one eval entry (A3: batch + fallback).
# Populates arrays: _GRADE_SKILL_VERDICTS, _GRADE_SKILL_REASONS,
#                   _GRADE_BASE_VERDICTS, _GRADE_BASE_REASONS
grade_eval_entry() {
    local eval_file="$1"
    local ei="$2"
    local with_text="$3"
    local base_text="$4"
    local assertion_count="$5"

    _GRADE_SKILL_VERDICTS=()
    _GRADE_SKILL_REASONS=()
    _GRADE_BASE_VERDICTS=()
    _GRADE_BASE_REASONS=()

    # Build assertions JSON array for batch grading (A3)
    local assertions_arr="["
    local first_a=true
    for ((ai=0; ai<assertion_count; ai++)); do
        local aname; aname=$(yq -r ".quality_evals[$ei].assertions[$ai].name" "$eval_file")
        local acheck; acheck=$(yq -r ".quality_evals[$ei].assertions[$ai].check" "$eval_file")
        [[ "$first_a" == "true" ]] && first_a=false || assertions_arr+=","
        assertions_arr+="{\"name\":$(echo "$aname" | jq -Rs .),\"check\":$(echo "$acheck" | jq -Rs .)}"
    done
    assertions_arr+="]"

    # --- Grade with-skill output (batch) ---
    local batch_skill_ok=false
    if [[ "$REPS" -eq 1 ]]; then
        local batch_result; batch_result=$(grade_assertions_batch "$assertions_arr" "$with_text")
        if [[ -n "$batch_result" ]]; then
            local parsed_count; parsed_count=$(echo "$batch_result" | jq 'length' 2>/dev/null)
            if [[ "$parsed_count" == "$assertion_count" ]]; then
                batch_skill_ok=true
                for ((ai=0; ai<assertion_count; ai++)); do
                    local v; v=$(echo "$batch_result" | jq -r ".[$ai].verdict" 2>/dev/null | tr '[:lower:]' '[:upper:]')
                    local r; r=$(echo "$batch_result" | jq -r ".[$ai].reason // \"\"" 2>/dev/null)
                    [[ "$v" == "PASS" ]] && _GRADE_SKILL_VERDICTS+=("PASS") || _GRADE_SKILL_VERDICTS+=("FAIL")
                    _GRADE_SKILL_REASONS+=("$r")
                done
            fi
        fi
    fi

    # Fallback: per-assertion grading
    if [[ "$batch_skill_ok" == "false" ]]; then
        for ((ai=0; ai<assertion_count; ai++)); do
            local acheck; acheck=$(yq -r ".quality_evals[$ei].assertions[$ai].check" "$eval_file")
            local result; result=$(grade_assertion_with_reps "$acheck" "$with_text" "$REPS")
            _GRADE_SKILL_VERDICTS+=("$(echo "$result" | cut -d'|' -f1)")
            _GRADE_SKILL_REASONS+=("$(echo "$result" | cut -d'|' -f2-)")
        done
    fi

    # --- Grade baseline output (batch) ---
    if [[ "$SKIP_BASELINE" == "true" ]]; then
        # Fill baseline arrays with N/A when skipped
        for ((ai=0; ai<assertion_count; ai++)); do
            _GRADE_BASE_VERDICTS+=("N/A")
            _GRADE_BASE_REASONS+=("baseline skipped")
        done
    else
        local batch_base_ok=false
        if [[ "$REPS" -eq 1 ]]; then
            local batch_result; batch_result=$(grade_assertions_batch "$assertions_arr" "$base_text")
            if [[ -n "$batch_result" ]]; then
                local parsed_count; parsed_count=$(echo "$batch_result" | jq 'length' 2>/dev/null)
                if [[ "$parsed_count" == "$assertion_count" ]]; then
                    batch_base_ok=true
                    for ((ai=0; ai<assertion_count; ai++)); do
                        local v; v=$(echo "$batch_result" | jq -r ".[$ai].verdict" 2>/dev/null | tr '[:lower:]' '[:upper:]')
                        local r; r=$(echo "$batch_result" | jq -r ".[$ai].reason // \"\"" 2>/dev/null)
                        [[ "$v" == "PASS" ]] && _GRADE_BASE_VERDICTS+=("PASS") || _GRADE_BASE_VERDICTS+=("FAIL")
                        _GRADE_BASE_REASONS+=("$r")
                    done
                fi
            fi
        fi

        # Fallback: per-assertion grading
        if [[ "$batch_base_ok" == "false" ]]; then
            for ((ai=0; ai<assertion_count; ai++)); do
                local acheck; acheck=$(yq -r ".quality_evals[$ei].assertions[$ai].check" "$eval_file")
                local result; result=$(grade_assertion_with_reps "$acheck" "$base_text" "$REPS")
                _GRADE_BASE_VERDICTS+=("$(echo "$result" | cut -d'|' -f1)")
                _GRADE_BASE_REASONS+=("$(echo "$result" | cut -d'|' -f2-)")
            done
        fi
    fi
}

# Compute pass rates and delta for one eval entry.
# Sets _EVAL_SKILL_RATE, _EVAL_BASE_RATE, _EVAL_DELTA,
#      _EVAL_SKILL_PASS, _EVAL_BASE_PASS, _EVAL_DISCRIMINATING
compute_eval_metrics() {
    local assertion_count="$1"

    _EVAL_SKILL_PASS=0
    _EVAL_BASE_PASS=0
    _EVAL_DISCRIMINATING=0

    for ((ai=0; ai<assertion_count; ai++)); do
        [[ "${_GRADE_SKILL_VERDICTS[$ai]}" == "PASS" ]] && ((_EVAL_SKILL_PASS++))
        if [[ "$SKIP_BASELINE" != "true" ]]; then
            [[ "${_GRADE_BASE_VERDICTS[$ai]}" == "PASS" ]] && ((_EVAL_BASE_PASS++))
            if [[ "${_GRADE_SKILL_VERDICTS[$ai]}" != "${_GRADE_BASE_VERDICTS[$ai]}" ]]; then
                ((_EVAL_DISCRIMINATING++))
            fi
        fi
    done

    _EVAL_SKILL_RATE=0
    _EVAL_BASE_RATE=0
    _EVAL_DELTA=0
    if [[ "$assertion_count" -gt 0 ]]; then
        _EVAL_SKILL_RATE=$(echo "scale=0; $_EVAL_SKILL_PASS * 100 / $assertion_count" | bc)
        if [[ "$SKIP_BASELINE" != "true" ]]; then
            _EVAL_BASE_RATE=$(echo "scale=0; $_EVAL_BASE_PASS * 100 / $assertion_count" | bc)
            _EVAL_DELTA=$((_EVAL_SKILL_RATE - _EVAL_BASE_RATE))
        fi
    fi
}

# Write the results JSON file for a skill.
write_results_json() {
    local skill_id="$1"
    local evals_json="$2"
    local agg_skill_rate="$3"
    local agg_base_rate="$4"
    local agg_delta="$5"
    local agg_discriminating="$6"
    local agg_skill_total="$7"
    local agg_hook_rejections="$8"
    local verdict="$9"
    local duration="${10}"

    mkdir -p "$RESULTS_DIR"
    local safe_skill; safe_skill=$(echo "$skill_id" | jq -Rs .)
    local safe_verdict; safe_verdict=$(echo "$verdict" | jq -Rs .)
    local safe_ts; safe_ts=$(date -u +%Y-%m-%dT%H:%M:%SZ | jq -Rs .)
    cat > "$RESULTS_DIR/$skill_id.quality.json" <<ENDJSON
{
  "skill": $safe_skill,
  "timestamp": $safe_ts,
  "evals": $evals_json,
  "aggregate": {
    "skill_pass_rate": $agg_skill_rate,
    "baseline_pass_rate": $agg_base_rate,
    "delta": $agg_delta,
    "discriminating_assertions": $agg_discriminating,
    "total_assertions": $agg_skill_total,
    "hook_rejections": $agg_hook_rejections,
    "verdict": $safe_verdict
  },
  "reps": $REPS,
  "duration_seconds": $duration
}
ENDJSON
}

# ─── Main eval_skill orchestrator (A2) ───────────────────────────────────────

eval_skill() {
    local eval_file="$1"
    local skill_id; skill_id=$(yq -r '.id' "$eval_file")
    _CURRENT_SKILL_ID="$skill_id"  # Expose to run_eval_entry for --force-skill
    # Validate skill_id from YAML to prevent path traversal (SEC-002)
    if ! [[ "$skill_id" =~ $SKILL_NAME_RE ]]; then
        echo -e "  ${RED}Invalid skill id in $eval_file: '$skill_id'${NC}"
        return 1
    fi
    local quality_count; quality_count=$(yq -r '.quality_evals | length' "$eval_file")
    local start_time; start_time=$(date +%s)

    echo -e "\n${BLUE}+=======================================================+${NC}"
    echo -e "${BLUE}|  QUALITY EVAL -- ${BOLD}$skill_id${NC}${BLUE}$(printf '%*s' $((36 - ${#skill_id})) '')|${NC}"
    echo -e "${BLUE}+========================================================+${NC}"

    # Validate YAML
    echo -e "${CYAN}  Validating quality_evals YAML...${NC}"
    if ! validate_quality_yaml "$eval_file"; then
        echo -e "${BLUE}|${NC}  ${RED}YAML validation failed -- skipping${NC}"
        echo -e "${BLUE}+========================================================+${NC}"
        return 1
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${BLUE}|${NC}  ${YELLOW}DRY-RUN: YAML valid, skipping Claude calls${NC}"
        echo -e "${BLUE}|${NC}  Quality evals: $quality_count entries"
        local total_assertions=0
        for ((i=0; i<quality_count; i++)); do
            local ac; ac=$(yq -r ".quality_evals[$i].assertions | length" "$eval_file")
            total_assertions=$((total_assertions + ac))
        done
        echo -e "${BLUE}|${NC}  Total assertions: $total_assertions"
        echo -e "${BLUE}+========================================================+${NC}"
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
        local scaffold_type; scaffold_type=$(yq -r ".quality_evals[$ei].scaffold // \"\"" "$eval_file")

        # Truncate prompt for display
        local display_prompt; display_prompt=$(echo "$prompt" | tr '\n' ' ' | sed 's/  */ /g')
        display_prompt="${display_prompt:0:48}"
        [[ ${#prompt} -gt 48 ]] && display_prompt="${display_prompt}..."

        echo -e "${BLUE}|${NC}"
        echo -e "${BLUE}|${NC}  ${BOLD}Eval $((ei+1)):${NC} \"$display_prompt\""
        echo -e "${BLUE}|${NC}"

        # Prepare scaffold (A8)
        prepare_scaffold "$scaffold_type"
        local scaffold_cwd="$_SCAFFOLD_DIR"

        local with_text="" base_text="" with_stderr_file=""

        if [[ "$GRADE_ONLY" == "true" ]]; then
            # (A5) Load previously captured outputs
            local saved_with="$RESULTS_DIR/${skill_id}.eval${ei}.with_skill.json"
            local saved_base="$RESULTS_DIR/${skill_id}.eval${ei}.baseline.json"
            if [[ ! -f "$saved_with" ]]; then
                echo -e "${BLUE}|${NC}  ${RED}GRADE-ONLY: captured with-skill output not found (run --capture-only first)${NC}"
                echo -e "${BLUE}|${NC}  ${RED}Expected: $saved_with${NC}"
                echo -e "${BLUE}+========================================================+${NC}"
                return 1
            fi
            if [[ "$SKIP_BASELINE" != "true" && ! -f "$saved_base" ]]; then
                echo -e "${BLUE}|${NC}  ${RED}GRADE-ONLY: captured baseline output not found (run --capture-only first, or use --skip-baseline)${NC}"
                echo -e "${BLUE}+========================================================+${NC}"
                return 1
            fi
            echo -e "${BLUE}|${NC}  ${CYAN}Loading captured outputs...${NC}"
            with_text=$(extract_output_text "$saved_with")
            if [[ "$SKIP_BASELINE" != "true" ]]; then
                base_text=$(extract_output_text "$saved_base")
            fi
        else
            # (A4) Run with-skill + baseline in parallel
            run_eval_entry "$prompt" "$scaffold_cwd"
            with_text=$(extract_output_text "$_EVAL_WITH_FILE")
            base_text=$(extract_output_text "$_EVAL_BASE_FILE")
            with_stderr_file="$_EVAL_STDERR_FILE"

            # Check hook rejections from with-skill stderr
            local hook_rej; hook_rej=$(count_hook_rejections "$with_stderr_file")
            agg_hook_rejections=$((agg_hook_rejections + hook_rej))

            if [[ "$CAPTURE_ONLY" == "true" ]]; then
                echo -e "${BLUE}|${NC}  ${YELLOW}CAPTURE-ONLY: outputs saved, skipping grading${NC}"
                mkdir -p "$RESULTS_DIR"
                cp "$_EVAL_WITH_FILE" "$RESULTS_DIR/${skill_id}.eval${ei}.with_skill.json"
                if [[ "$SKIP_BASELINE" != "true" ]]; then
                    cp "$_EVAL_BASE_FILE" "$RESULTS_DIR/${skill_id}.eval${ei}.baseline.json"
                fi
                # Clean up temp files + scaffold for this entry
                rm -f "$_EVAL_WITH_FILE" "$_EVAL_STDERR_FILE" "$_EVAL_BASE_FILE"
                [[ "$scaffold_cwd" != "." ]] && rm -rf "$scaffold_cwd"
                continue
            fi
        fi

        # Grade assertions (A2 + A3: batch then fallback)
        grade_eval_entry "$eval_file" "$ei" "$with_text" "$base_text" "$assertion_count"

        # Compute metrics (A2)
        compute_eval_metrics "$assertion_count"

        # Display assertion results
        if [[ "$SKIP_BASELINE" == "true" ]]; then
            printf "${BLUE}|${NC}  %-25s %-14s\n" "" "With Skill"
        else
            printf "${BLUE}|${NC}  %-25s %-14s %-14s\n" "" "With Skill" "Baseline"
        fi

        local assertions_json="["
        local first_assertion=true

        for ((ai=0; ai<assertion_count; ai++)); do
            local aname; aname=$(yq -r ".quality_evals[$ei].assertions[$ai].name" "$eval_file")
            local acheck; acheck=$(yq -r ".quality_evals[$ei].assertions[$ai].check" "$eval_file")
            local skill_verdict="${_GRADE_SKILL_VERDICTS[$ai]}"
            local skill_reason="${_GRADE_SKILL_REASONS[$ai]}"
            local base_verdict="${_GRADE_BASE_VERDICTS[$ai]}"
            local base_reason="${_GRADE_BASE_REASONS[$ai]}"

            local is_discriminating=false
            local disc_marker=""
            if [[ "$SKIP_BASELINE" != "true" ]]; then
                if [[ "$skill_verdict" != "$base_verdict" ]]; then
                    is_discriminating=true
                else
                    disc_marker="  (=)"
                fi
            fi

            local skill_sym base_sym
            [[ "$skill_verdict" == "PASS" ]] && skill_sym="${GREEN}PASS${NC}" || skill_sym="${RED}FAIL${NC}"

            local padded_name; padded_name=$(printf "%-23s" "$aname")
            if [[ "$SKIP_BASELINE" == "true" ]]; then
                echo -e "${BLUE}|${NC}  ${padded_name}  $skill_sym"
            else
                [[ "$base_verdict" == "PASS" ]] && base_sym="${GREEN}PASS${NC}" || base_sym="${RED}FAIL${NC}"
                echo -e "${BLUE}|${NC}  ${padded_name}  $skill_sym       $base_sym${disc_marker}"
            fi

            [[ "$first_assertion" == "true" ]] && first_assertion=false || assertions_json+=","
            assertions_json+="{\"name\":$(echo "$aname" | jq -Rs .),\"check\":$(echo "$acheck" | jq -Rs .),\"with_skill\":\"$skill_verdict\",\"baseline\":\"$base_verdict\",\"discriminating\":$is_discriminating,\"grader_reason\":$(echo "$skill_reason" | jq -Rs .)}"
        done

        assertions_json+="]"

        echo -e "${BLUE}|${NC}"
        if [[ "$SKIP_BASELINE" == "true" ]]; then
            echo -e "${BLUE}|${NC}  Score: ${BOLD}$_EVAL_SKILL_PASS/$assertion_count ($_EVAL_SKILL_RATE%)${NC}"
        else
            echo -e "${BLUE}|${NC}  Score: ${BOLD}$_EVAL_SKILL_PASS/$assertion_count ($_EVAL_SKILL_RATE%)${NC}  vs  $_EVAL_BASE_PASS/$assertion_count ($_EVAL_BASE_RATE%)   ${BOLD}D $_EVAL_DELTA%${NC}"
        fi

        # Update aggregates
        agg_skill_pass=$((agg_skill_pass + _EVAL_SKILL_PASS))
        agg_base_pass=$((agg_base_pass + _EVAL_BASE_PASS))
        agg_skill_total=$((agg_skill_total + assertion_count))
        agg_base_total=$((agg_base_total + assertion_count))
        agg_discriminating=$((agg_discriminating + _EVAL_DISCRIMINATING))

        # Accumulate eval JSON
        [[ "$first_eval" == "true" ]] && first_eval=false || evals_json+=","
        evals_json+="{\"prompt\":$(echo "$prompt" | jq -Rs .),\"assertions\":$assertions_json,\"skill_pass_rate\":$_EVAL_SKILL_RATE,\"baseline_pass_rate\":$_EVAL_BASE_RATE,\"delta\":$_EVAL_DELTA}"

        # Clean up temp files + scaffold for this eval entry
        if [[ "$GRADE_ONLY" != "true" ]]; then
            rm -f "$_EVAL_WITH_FILE" "$_EVAL_STDERR_FILE" "$_EVAL_BASE_FILE"
        fi
        [[ "$scaffold_cwd" != "." ]] && rm -rf "$scaffold_cwd"
    done

    evals_json+="]"

    if [[ "$CAPTURE_ONLY" == "true" ]]; then
        echo -e "${BLUE}+========================================================+${NC}"
        echo -e "${BLUE}|${NC}  ${YELLOW}Outputs saved to $RESULTS_DIR/${NC}"
        echo -e "${BLUE}+========================================================+${NC}"
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
    if [[ "$SKIP_BASELINE" == "true" ]]; then
        if [[ "$agg_skill_rate" -ge 80 ]]; then
            verdict="PASS"
            verdict_display="${GREEN}PASS (${agg_skill_rate}%)${NC}"
        elif [[ "$agg_skill_rate" -ge 50 ]]; then
            verdict="PARTIAL"
            verdict_display="${YELLOW}PARTIAL (${agg_skill_rate}%)${NC}"
        else
            verdict="FAIL"
            verdict_display="${RED}FAIL (${agg_skill_rate}%)${NC}"
        fi
    elif [[ "$agg_delta" -gt 0 ]]; then
        verdict="SKILL_ADDS_VALUE"
        verdict_display="${GREEN}SKILL ADDS VALUE${NC}"
    elif [[ "$agg_delta" -eq 0 ]]; then
        verdict="NEUTRAL"
        verdict_display="${YELLOW}NEUTRAL${NC}"
    else
        verdict="SKILL_REGRESSES"
        verdict_display="${RED}SKILL REGRESSES${NC}"
    fi

    local non_disc=$((agg_skill_total - agg_discriminating))
    local end_time; end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo -e "${BLUE}+========================================================+${NC}"
    if [[ "$non_disc" -gt 0 ]]; then
        echo -e "${BLUE}|${NC}  ${YELLOW}Non-discriminating: $non_disc assertion(s)${NC}"
    fi
    echo -e "${BLUE}|${NC}  Hook rejections: $agg_hook_rejections"
    echo -e "${BLUE}|${NC}  Verdict: ${BOLD}$verdict_display${NC}"
    echo -e "${BLUE}|${NC}  Duration: ${duration}s"
    echo -e "${BLUE}+========================================================+${NC}"

    # Write results JSON (A2)
    write_results_json "$skill_id" "$evals_json" \
        "$agg_skill_rate" "$agg_base_rate" "$agg_delta" \
        "$agg_discriminating" "$agg_skill_total" "$agg_hook_rejections" \
        "$verdict" "$duration"

    # Return pass/fail: regress or fail = failure
    if [[ "$verdict" == "SKILL_REGRESSES" || "$verdict" == "FAIL" ]]; then
        return 1
    fi
    return 0
}

# ─── Main ─────────────────────────────────────────────────────────────────────

check_deps

echo -e "${BLUE}----------------------------------------------------${NC}"
echo -e "${BLUE}  OrchestKit Skill Quality Evaluation${NC}"
if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${BLUE}  Mode: ${YELLOW}DRY-RUN (YAML validation only)${NC}"
elif [[ "$CAPTURE_ONLY" == "true" ]]; then
    echo -e "${BLUE}  Mode: ${YELLOW}CAPTURE-ONLY (outputs saved, no grading)${NC}"
elif [[ "$GRADE_ONLY" == "true" ]]; then
    echo -e "${BLUE}  Mode: ${YELLOW}GRADE-ONLY (re-grading captured outputs)${NC}"
elif [[ "$FORCE_SKILL" == "true" ]]; then
    echo -e "${BLUE}  Mode: ${CYAN}TIER 1 UNIT (SKILL.md injected, no routing)${NC}"
else
    echo -e "${BLUE}  Mode: ${GREEN}LIVE (grading with ${REPS}x reps)${NC}"
fi
echo "  Max turns: $MAX_TURNS  |  Timeout: ${GEN_TIMEOUT}s  |  Budget: \$${MAX_BUDGET}  |  Grader: $GRADING_MODEL"
[[ "$SKIP_BASELINE" == "true" ]] && echo -e "  Baseline: ${YELLOW}SKIPPED${NC}"
[[ -n "$EVAL_MODEL" ]] && echo "  Model: $EVAL_MODEL"
[[ -n "$MCP_CONFIG" ]] && echo "  MCP config: $MCP_CONFIG"
echo -e "${BLUE}----------------------------------------------------${NC}"

# Collect eval files (only those with quality_evals)
eval_files=()
if [[ "$SKILL_FILTER" == "__all__" ]]; then
    for f in "$SKILLS_EVAL_DIR"/*.eval.yaml; do
        [[ -f "$f" ]] || continue
        local_quality_count=$(yq -r '.quality_evals | length' "$f" 2>/dev/null)
        if [[ "$local_quality_count" != "null" && "$local_quality_count" -gt 0 ]]; then
            # Tag filter (A7)
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

skipped=0
for eval_file in "${eval_files[@]}"; do
    local_skill_id=$(yq -r '.id' "$eval_file")

    # Content hash cache: skip if unchanged (unless --force or --grade-only)
    if [[ "$DRY_RUN" == "false" && "$GRADE_ONLY" == "false" && "${FORCE_EVAL:-false}" == "false" ]]; then
        if check_eval_cache "$local_skill_id" "quality"; then
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
        [[ "$DRY_RUN" == "false" ]] && save_eval_cache "$local_skill_id" "quality"
    else
        ((failed++))
        failed_skills+=("$(yq -r '.id' "$eval_file")")
    fi
done

# Summary
echo ""
echo -e "${BLUE}----------------------------------------------------${NC}"
echo -e "${BLUE}  SUMMARY${NC}"
echo -e "${BLUE}----------------------------------------------------${NC}"
echo -e "  Total:  $total"
[[ "$skipped" -gt 0 ]] && echo -e "  Cached: ${CYAN}$skipped${NC}"
echo -e "  Passed: ${GREEN}$passed${NC}"
if [[ "$failed" -gt 0 ]]; then
    echo -e "  Failed: ${RED}$failed${NC} (${failed_skills[*]})"
fi
echo -e "${BLUE}----------------------------------------------------${NC}"

if [[ "$failed" -gt 0 ]]; then
    exit 1
fi
exit 0
