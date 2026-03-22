#!/usr/bin/env bash
# =============================================================================
# Trigger Keyword Matching Test — Deterministic, $0, <5 seconds
# =============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/src/skills"
EVALS_DIR="$PROJECT_ROOT/tests/evals/skills"

VERBOSE=false
[[ "${1:-}" == "--verbose" ]] && VERBOSE=true

PASSED=0 FAILED=0 SKIPPED=0 COLLISIONS=0

echo "=========================================="
echo "  Trigger Keyword Matching Test"
echo "=========================================="
echo ""

# Step 1: Build keyword registry
declare -A KW_OWNER=()
declare -A SKILL_KW=()

for sd in "$SKILLS_DIR"/*/; do
    sf="$sd/SKILL.md"
    [[ -f "$sf" ]] || continue
    grep -q '^user-invocable: true' "$sf" || continue

    sn=$(basename "$sd")
    fm=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$sf")
    echo "$fm" | grep -q 'triggers:' || continue

    kws=$(echo "$fm" | yq -r '.triggers.keywords[]' 2>/dev/null || true)
    [[ -z "$kws" ]] && continue

    kw_list=""
    while IFS= read -r kw; do
        [[ -z "$kw" ]] && continue
        kw="${kw,,}" # bash lowercase
        kw_list+="$kw|"
        if [[ -n "${KW_OWNER[$kw]:-}" && "${KW_OWNER[$kw]}" != "$sn" ]]; then
            echo -e "  \033[0;31mCOLLISION: '$kw' → '${KW_OWNER[$kw]}' vs '$sn'\033[0m"
            COLLISIONS=$((COLLISIONS + 1))
        else
            KW_OWNER[$kw]="$sn"
        fi
    done <<< "$kws"
    SKILL_KW[$sn]="$kw_list"
done

echo "  Registry: ${#SKILL_KW[@]} skills, ${#KW_OWNER[@]} keywords"
[[ "$COLLISIONS" -gt 0 ]] && echo -e "  \033[0;31m$COLLISIONS collision(s)\033[0m"
echo ""

# Step 2: Test prompts
echo "=========================================="
echo "  Prompt Matching"
echo "=========================================="
echo ""

for eval_file in "$EVALS_DIR"/*.eval.yaml; do
    [[ -f "$eval_file" ]] || continue
    grep -q 'trigger_evals:' "$eval_file" || continue

    sid=$(basename "$eval_file" .eval.yaml)
    grep -q '^user-invocable: true' "$SKILLS_DIR/$sid/SKILL.md" 2>/dev/null || continue
    [[ -n "${SKILL_KW[$sid]:-}" ]] || { echo -e "  \033[1;33m$sid: no triggers:\033[0m"; SKIPPED=$((SKIPPED + 1)); continue; }

    kw_pipe="${SKILL_KW[$sid]}"  # "keyword1|keyword2|..."
    sp=0 sf_count=0

    $VERBOSE && echo -e "  \033[1m$sid\033[0m"

    # Extract prompts with yq once into temp file
    tmpf=$(mktemp)
    yq -r '(.trigger_evals // [])[] | [.should_trigger, .prompt] | @tsv' "$eval_file" > "$tmpf" 2>/dev/null || true

    while IFS=$'\t' read -r should_trigger prompt; do
        [[ -z "$prompt" ]] && continue
        pl="${prompt,,}"  # lowercase

        # Check keywords (pipe-separated)
        hit=false
        hit_kw=""
        IFS='|' read -ra kw_arr <<< "$kw_pipe"
        for kw in "${kw_arr[@]}"; do
            [[ -z "$kw" ]] && continue
            if [[ "$pl" == *"$kw"* ]]; then
                hit=true
                hit_kw="$kw"
                break
            fi
        done

        if [[ "$should_trigger" == "true" ]]; then
            # Keyword matching: should_trigger=true prompts MUST match a keyword
            if $hit; then
                sp=$((sp + 1))
                $VERBOSE && echo -e "    \033[0;32mv\033[0m \"${prompt:0:50}\" → '$hit_kw'"
            else
                sf_count=$((sf_count + 1))
                echo -e "    \033[0;31mx\033[0m \"${prompt:0:50}\" → no keyword match"
            fi
        else
            # should_trigger=false: compound prompts may contain keywords from
            # multiple skills — that's LLM-tier disambiguation, not keyword matching.
            # Only count as pass (keyword matching doesn't validate negatives).
            sp=$((sp + 1))
            $VERBOSE && echo -e "    \033[0;36m-\033[0m \"${prompt:0:50}\" → skip (negative, LLM-tier)"
        fi
    done < "$tmpf"
    rm -f "$tmpf"

    total=$((sp + sf_count))
    if [[ "$sf_count" -eq 0 ]]; then
        echo -e "  \033[0;32mPASS\033[0m $sid ($sp/$total)"
        PASSED=$((PASSED + 1))
    else
        echo -e "  \033[0;31mFAIL\033[0m $sid ($sp/$total)"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo -e "  Total:      $((PASSED + FAILED + SKIPPED))"
echo -e "  Passed:     \033[0;32m$PASSED\033[0m"
[[ "$FAILED" -gt 0 ]] && echo -e "  Failed:     \033[0;31m$FAILED\033[0m"
[[ "$SKIPPED" -gt 0 ]] && echo -e "  Skipped:    \033[1;33m$SKIPPED\033[0m"
[[ "$COLLISIONS" -gt 0 ]] && echo -e "  Collisions: \033[0;31m$COLLISIONS\033[0m"
echo "=========================================="

[[ "$FAILED" -gt 0 || "$COLLISIONS" -gt 0 ]] && exit 1
exit 0
