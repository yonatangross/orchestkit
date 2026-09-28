#!/usr/bin/env bash
# Test: model lifecycle facts in the estate's sources of truth match Anthropic's docs.
#
# Why (PR #4541, reviewer-estate-15 HOLD, 2026-09-28):
#
# 1. Haiku 4.5 is ACTIVE, not deprecated. Anthropic's model deprecations page
#    lists claude-haiku-4-5-20251001 as Active, Deprecated N/A, retirement "not
#    sooner than October 15, 2026". "Deprecated" there means a replacement is
#    named AND a retirement date is assigned; neither has happened. The Sonnet
#    5.5 adoption moved both Haiku IDs under "Deprecated: pin something newer"
#    in tests/ci/claude-model-ids.txt and wrote "Haiku 4.5 is deprecated" into
#    models.vocab.json, which steers agents and docs off a supported model.
#
# 2. The mid-conversation tool-changes page says a tools change invalidates
#    every later thinking block "On Claude Fable 5.1, Claude Opus 5.5, and
#    Claude Sonnet 5.5". Any line stating that rule must name all three.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Model Lifecycle Facts Test ==="
echo ""

FAILED=0
IDS="$REPO_ROOT/tests/ci/claude-model-ids.txt"
VOCAB="$REPO_ROOT/src/hooks/src/lib/models.vocab.json"

# --- 1a. Haiku 4.5 IDs sit in the Current section, with no DEPRECATED marker ---
for id in claude-haiku-4-5 claude-haiku-4-5-20251001; do
    section=$(awk -v id="$id" '
        /^# ---- / { sec = $0 }
        $1 == id { print sec; exit }
    ' "$IDS")
    line=$(grep -E "^[[:space:]]*${id}([[:space:]]|#|\$)" "$IDS" || true)  # silent: known-noise, absent is reported below
    if [ -z "$line" ]; then
        echo "  FAIL: $id missing from claude-model-ids.txt"
        FAILED=1
    elif [[ "$section" != *"Current"* ]]; then
        echo "  FAIL: $id is under '$section', expected '# ---- Current ----' (Active per the deprecations page)"
        FAILED=1
    elif [[ "$line" == *DEPRECATED* || "$line" == *RETIRED* ]]; then
        echo "  FAIL: $id carries a lifecycle marker it does not have: $line"
        FAILED=1
    else
        echo "  PASS: $id is Current"
    fi
done

# --- 1b. No source claims Haiku 4.5 is deprecated ---
CLAIM_FILES=(
    "$VOCAB"
    "$IDS"
    "$REPO_ROOT/src/skills/doctor/references/version-compatibility.md"
)
for f in "${CLAIM_FILES[@]}"; do
    rel="${f#"$REPO_ROOT"/}"
    if grep -qiE "haiku 4\.5 (is |to )?deprecated" "$f"; then
        echo "  FAIL: $rel says Haiku 4.5 is deprecated (it is Active)"
        grep -noiE ".{0,60}haiku 4\.5 (is |to )?deprecated.{0,40}" "$f" | sed 's/^/        /'
        FAILED=1
    else
        echo "  PASS: $rel does not call Haiku 4.5 deprecated"
    fi
done

# --- 2. Thinking-block invalidation lines name Sonnet 5.5 ---
checked=0
while IFS= read -r hit; do
    [ -n "$hit" ] || continue
    checked=$((checked + 1))
    # Only the clause that carries the rule counts: the text between the last
    # `;` or `(` and the phrase. A "Sonnet 5.5" elsewhere on the same line (for
    # example an inline-tools availability note) must not satisfy the check.
    prefix="${hit%%invalidates later thinking blocks*}"
    clause="${prefix##*[;(]}"
    if [[ "$clause" != *"Sonnet 5.5"* ]]; then
        echo "  FAIL: thinking-block line omits Sonnet 5.5: ${hit:0:160}"
        FAILED=1
    else
        echo "  PASS: ${hit%%:*} names Sonnet 5.5"
    fi
done < <(cd "$REPO_ROOT" && grep -rnE "invalidates later thinking blocks" src || true)  # silent: known-noise, zero hits is checked below

if [ "$checked" -eq 0 ]; then
    echo "  FAIL: no 'invalidates later thinking blocks' line found under src/; the scan lost its input"
    FAILED=1
fi

echo ""
if [ "$FAILED" -ne 0 ]; then
    echo "FAILED"
    exit 1
fi
echo "PASSED"
