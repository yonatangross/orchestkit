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
#   npm run eval:skill -- --all --force      # bypass content hash cache
#   npm run eval:skill -- --changed          # only eval skills changed vs main
#   npm run eval:skill -- --tag core         # filter by tag
#   npm run eval:skill -- --holdout-promote commit   # champion/challenger bake-off (#2555)
#   npm run eval:skill -- --holdout-promote commit --challenger /path/to/SKILL.md --margin 0.5
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
USE_CHANGED=false
PASSTHROUGH_ARGS=()
HOLDOUT_PROMOTE_SKILL=""        # #2555: champion/challenger bake-off target skill
HOLDOUT_CHALLENGER=""          # optional path to candidate SKILL.md
HOLDOUT_MARGIN=""              # optional override of holdout.lock.json.margin

while [[ $# -gt 0 ]]; do
    case "$1" in
        --trigger-only) RUN_QUALITY=false; shift ;;
        --quality-only) RUN_TRIGGER=false; shift ;;
        --dry-run) DRY_RUN=true; PASSTHROUGH_ARGS+=("$1"); shift ;;
        --changed) USE_CHANGED=true; shift ;;
        --holdout-promote) HOLDOUT_PROMOTE_SKILL="${2:-}"; shift 2 ;;
        --challenger) HOLDOUT_CHALLENGER="${2:-}"; shift 2 ;;
        --margin) HOLDOUT_MARGIN="${2:-}"; shift 2 ;;
        --force) PASSTHROUGH_ARGS+=("$1"); shift ;;
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

# --- Git-diff mode: only eval skills whose source changed vs main ---
if [[ "$USE_CHANGED" == "true" ]]; then
    CHANGED_SKILLS=()
    declare -A _seen_skills=()
    while IFS= read -r line; do
        skill_name=$(echo "$line" | sed 's|src/skills/||;s|tests/evals/skills/||;s|/.*||;s|\.eval\.yaml||')
        if [[ "$skill_name" =~ $SKILL_NAME_RE && -z "${_seen_skills[$skill_name]:-}" ]]; then
            CHANGED_SKILLS+=("$skill_name")
            _seen_skills[$skill_name]=1
        fi
    done < <(git diff --name-only origin/main -- src/skills/ tests/evals/skills/ 2>/dev/null | sort -u)

    if [[ ${#CHANGED_SKILLS[@]} -eq 0 ]]; then
        echo -e "${GREEN}No skill changes detected vs main — nothing to eval.${NC}"
        exit 0
    fi

    echo -e "${CYAN}Changed skills: ${CHANGED_SKILLS[*]}${NC}"
    echo ""

    # Run eval for each changed skill
    overall_exit=0
    for skill_name in "${CHANGED_SKILLS[@]}"; do
        eval_yaml="$EVALS_DIR/skills/${skill_name}.eval.yaml"
        if [[ ! -f "$eval_yaml" ]]; then
            echo -e "  ${YELLOW}$skill_name: no .eval.yaml, skipping${NC}"
            continue
        fi
        echo -e "${BLUE}>>> Evaluating changed skill: $skill_name${NC}"
        if ! bash "$0" "$skill_name" "${PASSTHROUGH_ARGS[@]}"; then
            overall_exit=1
        fi
    done
    exit $overall_exit
fi

# =============================================================================
# --holdout-promote <skill>  (#2555)
# =============================================================================
# Champion/challenger holdout bake-off implementing the protocol in
# src/skills/skill-evolution/references/holdout-promotion-gate.md.
#
# Terminal mode: runs the sealed-holdout bake-off and exits — it does NOT fall
# through to the trigger/quality flow below.
#
# Exit codes (contract):
#   0  promoted | accepted (incumbent retained, no real challenger)
#   1  rejected (a real challenger ran and lost / failed a gate clause)
#   2  holdout eval set missing
#   3  holdout hash mismatch (fail-closed anti-tuning seal)
# =============================================================================
if [[ -n "$HOLDOUT_PROMOTE_SKILL" ]]; then
    hp_skill="$HOLDOUT_PROMOTE_SKILL"

    # --- Validate skill name (SEC: prevent path traversal) ---
    if [[ ! "$hp_skill" =~ $SKILL_NAME_RE ]]; then
        echo -e "${RED}Error: invalid skill name '$hp_skill'${NC}" >&2
        exit 2
    fi

    HP_SKILL_DIR="$REPO_ROOT/src/skills/$hp_skill"
    HP_EVALS_DIR="$HP_SKILL_DIR/evals"
    HP_HOLDOUT="$HP_EVALS_DIR/holdout.jsonl"
    HP_LOCK="$HP_EVALS_DIR/holdout.lock.json"
    HP_SKILL_MD="$HP_SKILL_DIR/SKILL.md"
    HP_LEDGER="$HP_EVALS_DIR/promotion-ledger.jsonl"

    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}  HOLDOUT-PROMOTION BAKE-OFF  (#2555)${NC}"
    echo -e "${BLUE}  skill: ${CYAN}${hp_skill}${NC}"
    echo -e "${BLUE}============================================================${NC}"

    # --- Step 1: resolve the sealed holdout set; fail-closed if absent ---
    if [[ ! -f "$HP_HOLDOUT" || ! -f "$HP_LOCK" ]]; then
        echo -e "${RED}Error: holdout eval set not found for skill '$hp_skill'.${NC}" >&2
        echo -e "${RED}  expected: $HP_HOLDOUT${NC}" >&2
        echo -e "${RED}            $HP_LOCK${NC}" >&2
        echo -e "${YELLOW}  Build a sealed holdout (holdout.jsonl + holdout.lock.json) per${NC}" >&2
        echo -e "${YELLOW}  src/skills/skill-evolution/references/holdout-promotion-gate.md first.${NC}" >&2
        exit 2
    fi
    if [[ ! -f "$HP_SKILL_MD" ]]; then
        echo -e "${RED}Error: champion SKILL.md not found: $HP_SKILL_MD${NC}" >&2
        exit 2
    fi

    # --- jq availability (used for parsing; we keep a fallback for the ledger) ---
    HP_HAVE_JQ=false
    command -v jq >/dev/null 2>&1 && HP_HAVE_JQ=true

    # sha256 helper (prefer sha256sum, fall back to shasum -a 256)
    hp_sha256() {
        if command -v sha256sum >/dev/null 2>&1; then
            sha256sum | awk '{print $1}'
        else
            shasum -a 256 | awk '{print $1}'
        fi
    }

    # --- Step 2: HASH SEAL — recompute LC_ALL=C sha256(sort) and compare ---
    # LC_ALL=C makes the sort (and therefore the hash) locale-independent.
    HP_COMPUTED_HASH="$(LC_ALL=C sort "$HP_HOLDOUT" | hp_sha256)"
    if [[ "$HP_HAVE_JQ" == "true" ]]; then
        HP_LOCKED_HASH_RAW="$(jq -r '.hash // empty' "$HP_LOCK" 2>/dev/null)"  # silent: best-effort
    else
        # Fallback: grep the "hash" field out of the lock JSON.
        HP_LOCKED_HASH_RAW="$(grep -oE '"hash"[[:space:]]*:[[:space:]]*"[^"]*"' "$HP_LOCK" 2>/dev/null | head -1 | sed -E 's/.*"hash"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"  # silent: best-effort
    fi
    # Lock stores the hash as "sha256:<hex>"; strip the algo prefix for comparison.
    HP_LOCKED_HASH="${HP_LOCKED_HASH_RAW#sha256:}"

    if [[ -z "$HP_LOCKED_HASH" ]]; then
        echo -e "${RED}holdout hash mismatch: lock file has no readable .hash${NC}" >&2
        echo -e "${RED}  $HP_LOCK${NC}" >&2
        exit 3
    fi
    if [[ "$HP_COMPUTED_HASH" != "$HP_LOCKED_HASH" ]]; then
        echo -e "${RED}holdout hash mismatch${NC}" >&2
        echo -e "${RED}  computed: sha256:$HP_COMPUTED_HASH${NC}" >&2
        echo -e "${RED}  locked:   sha256:$HP_LOCKED_HASH${NC}" >&2
        echo -e "${YELLOW}  The holdout was edited without a reviewed re-freeze. Fail-closed; no promotion.${NC}" >&2
        exit 3
    fi
    echo -e "  Hash seal: ${GREEN}OK${NC} (sha256:${HP_COMPUTED_HASH:0:12}...)"

    # --- Read lock metadata (n, margin, rubric path, min_pass); lock already
    #     proven readable by the seal, so absent fields just take defaults. ---
    if [[ "$HP_HAVE_JQ" == "true" ]]; then
        HP_N="$(jq -r '.n // empty' "$HP_LOCK" 2>/dev/null)"  # silent: best-effort
        HP_LOCK_MARGIN="$(jq -r '.margin // empty' "$HP_LOCK" 2>/dev/null)"  # silent: best-effort
        HP_RUBRIC_REL="$(jq -r '.rubric // empty' "$HP_LOCK" 2>/dev/null)"  # silent: best-effort
        HP_LOCK_MIN_PASS="$(jq -r '.min_pass // empty' "$HP_LOCK" 2>/dev/null)"  # silent: best-effort
    else
        HP_N=""; HP_LOCK_MARGIN=""; HP_RUBRIC_REL=""; HP_LOCK_MIN_PASS=""
    fi

    # Margin: CLI override > lock > default 0.5 (per design doc).
    HP_MARGIN="${HOLDOUT_MARGIN:-${HP_LOCK_MARGIN:-0.5}}"

    # Resolve rubric.json: lock's .rubric (repo-relative) > per-skill rubric.json.
    if [[ -n "$HP_RUBRIC_REL" && -f "$REPO_ROOT/$HP_RUBRIC_REL" ]]; then
        HP_RUBRIC="$REPO_ROOT/$HP_RUBRIC_REL"
    elif [[ -n "$HP_RUBRIC_REL" && -f "$HP_RUBRIC_REL" ]]; then
        HP_RUBRIC="$HP_RUBRIC_REL"
    else
        HP_RUBRIC="$HP_SKILL_DIR/rubric.json"
    fi
    if [[ ! -f "$HP_RUBRIC" ]]; then
        echo -e "${RED}Error: rubric.json not found for skill '$hp_skill' (looked at $HP_RUBRIC)${NC}" >&2
        exit 2
    fi

    # min_pass: the LOCK is the AUTHORITATIVE composite gate (anti-gaming — the
    # sealed holdout bar can be set stricter than the rubric's day-to-day floor
    # and cannot be lowered by editing rubric.json). Per holdout-promotion-gate.md
    # the rubric's own composite.min_pass is NOT consulted by the Decision Rule.
    # LOCK min_pass > default 5.5.
    HP_MIN_PASS="${HP_LOCK_MIN_PASS:-5.5}"

    # --- Step 3 prep: champion + challenger SKILL.md content ---
    HP_CHALLENGER_MD="$HOLDOUT_CHALLENGER"
    HP_HAVE_CHALLENGER=false
    if [[ -n "$HP_CHALLENGER_MD" ]]; then
        if [[ ! -f "$HP_CHALLENGER_MD" ]]; then
            echo -e "${RED}Error: --challenger path not found: $HP_CHALLENGER_MD${NC}" >&2
            exit 2
        fi
        HP_HAVE_CHALLENGER=true
        HP_CHALLENGER_SOURCE="$HP_CHALLENGER_MD"
    else
        # Scaffold mode: no challenger supplied → grade champion vs champion.
        HP_CHALLENGER_MD="$HP_SKILL_MD"
        HP_CHALLENGER_SOURCE="none (champion-vs-champion scaffold)"
    fi

    # Champion frontmatter version (best-effort; null if absent).
    HP_CHAMPION_VERSION="$(grep -m1 -E '^version:' "$HP_SKILL_MD" 2>/dev/null | sed -E 's/^version:[[:space:]]*//; s/[[:space:]]*$//')"  # silent: best-effort
    HP_CHAMPION_VERSION="${HP_CHAMPION_VERSION:-null}"

    HP_GRADER_MODEL="${EVAL_GRADING_MODEL:-claude-opus-4-8[1m]}"

    echo -e "  Holdout:   ${CYAN}${HP_N:-?}${NC} cases   Margin: ${CYAN}${HP_MARGIN}${NC}   min_pass: ${CYAN}${HP_MIN_PASS}${NC}"
    echo -e "  Rubric:    ${CYAN}${HP_RUBRIC#$REPO_ROOT/}${NC}"
    echo -e "  Challenger:${CYAN} ${HP_CHALLENGER_SOURCE}${NC}"
    echo ""

    # --- Build the grader output JSON Schema from rubric dimensions ---
    # NOTE: rubric.json (ork-rubric/1.0) is NOT itself a valid output schema —
    # it carries weights/blockers, not a request shape. We derive a proper
    # --json-schema that asks the grader for a 0-10 score per rubric dimension,
    # then compute the weighted composite here. The rubric supplies the dimension
    # list + weights + min_blocker thresholds. (See human-review note.)
    if [[ "$HP_HAVE_JQ" != "true" ]]; then
        echo -e "${RED}Error: jq is required to build the grader schema from rubric.json.${NC}" >&2
        exit 2
    fi
    HP_DIM_NAMES=()
    while IFS= read -r _dim; do
        [[ -n "$_dim" ]] && HP_DIM_NAMES+=("$_dim")
    done < <(jq -r '.dimensions[].name' "$HP_RUBRIC" 2>/dev/null)  # silent: best-effort
    if [[ ${#HP_DIM_NAMES[@]} -eq 0 ]]; then
        echo -e "${RED}Error: rubric '$HP_RUBRIC' declares no dimensions.${NC}" >&2
        exit 2
    fi

    # Grader schema: { <dim>: number(0-10), ..., notes: string }, all dims required.
    HP_GRADER_SCHEMA="$(jq -c \
        --argjson dims "$(jq -c '[.dimensions[].name]' "$HP_RUBRIC")" \
        -n '
        {
          type: "object",
          additionalProperties: false,
          required: ($dims + []),
          properties: (
            reduce $dims[] as $d ({};
              . + { ($d): { type: "number", minimum: 0, maximum: 10 } }
            ) + { notes: { type: "string" } }
          )
        }')"

    # --- Grader invocation helper ---------------------------------------------
    # Prefer the cheap isolated --bare form when ANTHROPIC_API_KEY is set
    # (BARE_MODE from eval-common.sh); else plain `claude -p` (the spike showed
    # --bare is broken without the key, plain -p works but needs --max-turns 3
    # because it burns turn 1 on tool_use loading full plugin context).
    # Echoes the structured_output JSON object on success; empty on failure.
    export CLAUDE_CODE_FORK_SUBAGENT=1   # fresh context per grader case
    hp_grade_one() {
        local skill_md_content="$1" case_prompt="$2" musts="$3"
        local grade_prompt out structured
        grade_prompt=$(cat <<EOF
You are an impartial grader. Score how well the SKILL below would handle the TASK.
Score each rubric dimension on a 0-10 scale. Return ONLY the structured JSON.

=== SKILL UNDER TEST ===
${skill_md_content}

=== TASK (holdout case) ===
${case_prompt}

=== REQUIRED ASSERTIONS (must appear / be satisfied in a correct response) ===
${musts}

Grade strictly. A dimension the skill does not address scores low.
EOF
)
        # grader stderr is non-actionable subprocess noise; an empty/unparseable
        # result is handled by the caller (case skipped + logged).
        if [[ "$BARE_MODE" == "true" ]]; then
            out=$(claude -p "$grade_prompt" --bare --print --max-turns 1 --json-schema "$HP_GRADER_SCHEMA" --output-format json < /dev/null 2>/dev/null)  # silent: best-effort
        else
            out=$(claude -p "$grade_prompt" --print --max-turns 3 --json-schema "$HP_GRADER_SCHEMA" --output-format json < /dev/null 2>/dev/null)  # silent: best-effort
        fi
        # The result JSON carries the schema-shaped object under .structured_output.
        structured=$(echo "$out" | jq -c '.structured_output // empty' 2>/dev/null)  # silent: best-effort
        echo "$structured"
    }

    # Weighted composite from a structured grader object using rubric weights.
    hp_composite() {
        local structured="$1"
        [[ -z "$structured" ]] && { echo ""; return; }
        jq -n -r --argjson g "$structured" --slurpfile r "$HP_RUBRIC" '($r[0].dimensions) as $dims | ($dims | map(.weight) | add) as $wsum | (reduce $dims[] as $d (0; . + (($g[$d.name] // 0) * $d.weight))) as $raw | if ($wsum > 0) then ($raw / $wsum) else 0 end' 2>/dev/null  # silent: best-effort
    }

    # --- Step 4: grade every holdout case, champion AND challenger ------------
    if [[ "$DRY_RUN" == "true" ]] || ! command -v claude >/dev/null 2>&1; then
        echo -e "${YELLOW}  Dry-run / no Claude CLI — schema + seal validated, skipping grader calls.${NC}"
        echo -e "${GREEN}  Hash seal OK, rubric parsed (${#HP_DIM_NAMES[@]} dims). Bake-off not executed.${NC}"
        exit 0
    fi

    HP_CHAMP_SUM=0; HP_CHAL_SUM=0; HP_CASES=0
    declare -A HP_DIM_CHAMP_SUM=(); declare -A HP_DIM_CHAL_SUM=()
    declare -A HP_DIM_CHAL_MIN=()
    for _d in "${HP_DIM_NAMES[@]}"; do
        HP_DIM_CHAMP_SUM["$_d"]=0; HP_DIM_CHAL_SUM["$_d"]=0; HP_DIM_CHAL_MIN["$_d"]=10
    done

    HP_CHAMPION_CONTENT="$(cat "$HP_SKILL_MD")"
    HP_CHALLENGER_CONTENT="$(cat "$HP_CHALLENGER_MD")"

    while IFS= read -r _case || [[ -n "$_case" ]]; do
        [[ -z "$_case" ]] && continue
        _cid="$(echo "$_case" | jq -r '.id // "?"' 2>/dev/null)"  # silent: best-effort
        _cprompt="$(echo "$_case" | jq -r '.prompt // ""' 2>/dev/null)"  # silent: best-effort
        _cmust="$(echo "$_case" | jq -r '(.must // []) | join("\n- ")' 2>/dev/null)"  # silent: best-effort
        [[ -n "$_cmust" ]] && _cmust="- $_cmust"

        echo -e "  ${CYAN}grading${NC} case ${_cid}..."
        _champ_struct="$(hp_grade_one "$HP_CHAMPION_CONTENT" "$_cprompt" "$_cmust")"
        if [[ "$HP_HAVE_CHALLENGER" == "true" ]]; then
            _chal_struct="$(hp_grade_one "$HP_CHALLENGER_CONTENT" "$_cprompt" "$_cmust")"
        else
            _chal_struct="$_champ_struct"   # scaffold: identical to champion
        fi

        _champ_comp="$(hp_composite "$_champ_struct")"
        _chal_comp="$(hp_composite "$_chal_struct")"
        if [[ -z "$_champ_comp" || -z "$_chal_comp" ]]; then
            echo -e "    ${YELLOW}grader returned no parseable score for case ${_cid} — skipping case${NC}" >&2
            continue
        fi

        HP_CHAMP_SUM="$(echo "$HP_CHAMP_SUM + $_champ_comp" | bc -l)"
        HP_CHAL_SUM="$(echo "$HP_CHAL_SUM + $_chal_comp" | bc -l)"
        HP_CASES=$((HP_CASES + 1))

        # Per-dimension accumulation (for ledger + min_blocker check).
        # An absent dim in grader output reads as 0 (penalized) — by design.
        for _d in "${HP_DIM_NAMES[@]}"; do
            _dc="$(echo "$_champ_struct" | jq -r --arg d "$_d" '.[$d] // 0' 2>/dev/null)"  # silent: best-effort
            _dl="$(echo "$_chal_struct"  | jq -r --arg d "$_d" '.[$d] // 0' 2>/dev/null)"  # silent: best-effort
            HP_DIM_CHAMP_SUM["$_d"]="$(echo "${HP_DIM_CHAMP_SUM[$_d]} + $_dc" | bc -l)"
            HP_DIM_CHAL_SUM["$_d"]="$(echo "${HP_DIM_CHAL_SUM[$_d]} + $_dl" | bc -l)"
            if (( $(echo "$_dl < ${HP_DIM_CHAL_MIN[$_d]}" | bc -l) )); then
                HP_DIM_CHAL_MIN["$_d"]="$_dl"
            fi
        done
    done < "$HP_HOLDOUT"

    if [[ "$HP_CASES" -eq 0 ]]; then
        echo -e "${RED}Error: no holdout case produced a gradeable score — cannot decide.${NC}" >&2
        exit 1
    fi

    HP_CHAMP_AVG="$(echo "scale=4; $HP_CHAMP_SUM / $HP_CASES" | bc -l)"
    HP_CHAL_AVG="$(echo "scale=4; $HP_CHAL_SUM / $HP_CASES" | bc -l)"
    HP_DELTA="$(echo "scale=4; $HP_CHAL_AVG - $HP_CHAMP_AVG" | bc -l)"

    # --- Step 5: DECISION RULE ------------------------------------------------
    # promote IFF: delta>=margin AND challenger>=min_pass AND no dim<min_blocker
    #              AND hash matched (already enforced above).
    HP_BLOCKER_HIT=""
    for _d in "${HP_DIM_NAMES[@]}"; do
        # A dimension without min_blocker has no hard floor → skip it.
        _blk="$(jq -r --arg d "$_d" '.dimensions[] | select(.name==$d) | .min_blocker // empty' "$HP_RUBRIC" 2>/dev/null)"  # silent: best-effort
        [[ -z "$_blk" ]] && continue
        if (( $(echo "${HP_DIM_CHAL_MIN[$_d]} < $_blk" | bc -l) )); then
            HP_BLOCKER_HIT="$_d (min ${HP_DIM_CHAL_MIN[$_d]} < blocker $_blk)"
            break
        fi
    done

    HP_GE_MARGIN=0; (( $(echo "$HP_DELTA >= $HP_MARGIN" | bc -l) )) && HP_GE_MARGIN=1
    HP_GE_MINPASS=0; (( $(echo "$HP_CHAL_AVG >= $HP_MIN_PASS" | bc -l) )) && HP_GE_MINPASS=1

    if [[ "$HP_HAVE_CHALLENGER" != "true" ]]; then
        # Scaffold: no real challenger. Incumbent retained — "accepted", exit 0.
        HP_DECISION="accepted"
        HP_REASON="no challenger supplied (champion-vs-champion scaffold); incumbent retained"
        HP_EXIT=0
    elif [[ -n "$HP_BLOCKER_HIT" ]]; then
        HP_DECISION="rejected"
        HP_REASON="challenger dimension under min_blocker: $HP_BLOCKER_HIT"
        HP_EXIT=1
    elif [[ "$HP_GE_MARGIN" -eq 1 && "$HP_GE_MINPASS" -eq 1 ]]; then
        HP_DECISION="promoted"
        HP_REASON="delta $HP_DELTA >= margin $HP_MARGIN; min_pass $HP_MIN_PASS met; no dimension under blocker"
        HP_EXIT=0
    else
        HP_DECISION="rejected"
        if [[ "$HP_GE_MARGIN" -ne 1 ]]; then
            HP_REASON="delta $HP_DELTA < margin $HP_MARGIN (incumbent wins ties)"
        else
            HP_REASON="challenger composite $HP_CHAL_AVG < min_pass $HP_MIN_PASS"
        fi
        HP_EXIT=1
    fi
    # promoted_to_version stays null: the ACT step (snapshot champion, copy
    # challenger over SKILL.md, bump frontmatter) is intentionally out of scope
    # for this gate scaffold (see human-review note).

    # --- Build per_dimension map { dim: {champion, challenger} } -------------
    HP_PERDIM_JSON="{}"
    for _d in "${HP_DIM_NAMES[@]}"; do
        _ca="$(echo "scale=4; ${HP_DIM_CHAMP_SUM[$_d]} / $HP_CASES" | bc -l)"
        _la="$(echo "scale=4; ${HP_DIM_CHAL_SUM[$_d]} / $HP_CASES" | bc -l)"
        HP_PERDIM_JSON="$(echo "$HP_PERDIM_JSON" | jq -c --arg d "$_d" --argjson c "$_ca" --argjson l "$_la" '. + {($d): {champion: $c, challenger: $l}}')"
    done

    HP_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    # --- Step 6: RECORD — append one ledger line (BOTH outcomes), atomically --
    mkdir -p "$HP_EVALS_DIR"
    HP_LEDGER_TMP="$(mktemp)"
    CLEANUP_FILES+=("$HP_LEDGER_TMP")
    if [[ "$HP_HAVE_JQ" == "true" ]]; then
        jq -c -n \
            --arg skill "$hp_skill" \
            --arg ts "$HP_TS" \
            --arg hh "sha256:$HP_LOCKED_HASH" \
            --argjson hn "${HP_N:-$HP_CASES}" \
            --argjson margin "$HP_MARGIN" \
            --arg cv "$HP_CHAMPION_VERSION" \
            --arg cs "$HP_CHALLENGER_SOURCE" \
            --argjson champ "$HP_CHAMP_AVG" \
            --argjson chal "$HP_CHAL_AVG" \
            --argjson delta "$HP_DELTA" \
            --argjson perdim "$HP_PERDIM_JSON" \
            --arg decision "$HP_DECISION" \
            --arg reason "$HP_REASON" \
            --arg gm "$HP_GRADER_MODEL" \
            '{
              schema: "ork-promotion/1.0",
              skill: $skill,
              ts: $ts,
              holdout_hash: $hh,
              holdout_n: $hn,
              margin: $margin,
              champion_version: (if $cv == "null" then null else $cv end),
              challenger_source: $cs,
              champion_score: $champ,
              challenger_score: $chal,
              delta: $delta,
              per_dimension: $perdim,
              decision: $decision,
              reason: $reason,
              promoted_to_version: null,
              grader_model: $gm,
              fork_subagent: true
            }' > "$HP_LEDGER_TMP"
    else
        # jq-less fallback: hand-assemble the JSON line. per_dimension omitted ({}).
        _cv_json="null"; [[ "$HP_CHAMPION_VERSION" != "null" ]] && _cv_json="\"$HP_CHAMPION_VERSION\""
        printf '{"schema":"ork-promotion/1.0","skill":"%s","ts":"%s","holdout_hash":"sha256:%s","holdout_n":%s,"margin":%s,"champion_version":%s,"challenger_source":"%s","champion_score":%s,"challenger_score":%s,"delta":%s,"per_dimension":{},"decision":"%s","reason":"%s","promoted_to_version":null,"grader_model":"%s","fork_subagent":true}\n' \
            "$hp_skill" "$HP_TS" "$HP_LOCKED_HASH" "${HP_N:-$HP_CASES}" "$HP_MARGIN" \
            "$_cv_json" "$HP_CHALLENGER_SOURCE" "$HP_CHAMP_AVG" "$HP_CHAL_AVG" "$HP_DELTA" \
            "$HP_DECISION" "$HP_REASON" "$HP_GRADER_MODEL" > "$HP_LEDGER_TMP"
    fi

    # Never leave a partial ledger: only append if the temp line is non-empty.
    if [[ ! -s "$HP_LEDGER_TMP" ]]; then
        echo -e "${RED}Error: failed to assemble ledger record — refusing partial write.${NC}" >&2
        exit 1
    fi
    cat "$HP_LEDGER_TMP" >> "$HP_LEDGER"

    # --- Step 7/8: REPORT -----------------------------------------------------
    echo ""
    echo -e "${BLUE}------------------------------------------------------------${NC}"
    printf "  %-16s %8s  %8s  %8s\n" "dimension" "champ" "chall" "delta"
    for _d in "${HP_DIM_NAMES[@]}"; do
        _ca="$(echo "$HP_PERDIM_JSON" | jq -r --arg d "$_d" '.[$d].champion')"
        _la="$(echo "$HP_PERDIM_JSON" | jq -r --arg d "$_d" '.[$d].challenger')"
        _dd="$(echo "scale=2; $_la - $_ca" | bc -l)"
        printf "  %-16s %8.2f  %8.2f  %8.2f\n" "$_d" "$_ca" "$_la" "$_dd"
    done
    echo -e "${BLUE}------------------------------------------------------------${NC}"
    printf "  %-16s %8.3f  %8.3f  %8.3f\n" "COMPOSITE" "$HP_CHAMP_AVG" "$HP_CHAL_AVG" "$HP_DELTA"
    echo ""
    case "$HP_DECISION" in
        promoted) echo -e "  Decision:  ${GREEN}PROMOTED${NC}  — $HP_REASON" ;;
        accepted) echo -e "  Decision:  ${GREEN}ACCEPTED${NC} (incumbent) — $HP_REASON" ;;
        *)        echo -e "  Decision:  ${RED}REJECTED${NC}  — $HP_REASON" ;;
    esac
    echo -e "  Ledger:    ${CYAN}${HP_LEDGER#$REPO_ROOT/}${NC}"
    echo -e "${BLUE}============================================================${NC}"

    exit "$HP_EXIT"
fi

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
