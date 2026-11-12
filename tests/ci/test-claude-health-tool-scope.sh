#!/usr/bin/env bash
# Test: the claude-health workflow keeps its model away from credentials and untrusted text.
#
# The model step reads repository data on a public repo. Four assertions on the
# workflow file (WORKFLOW_FILE overrides the path, so a bad fixture can prove each arm):
#   1. the model step passes --tools "" and --strict-mcp-config and no --allowedTools
#   2. the model step sees no GH_TOKEN (data is collected in an earlier step)
#   3. no artifact upload of the raw model report
#   4. the data-collection step emits no free text fields (title, body, name)
# Each assertion first proves its target exists, so an empty parse cannot pass.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WF="${WORKFLOW_FILE:-$REPO_ROOT/.github/workflows/claude-health.yml}"

[ -f "$WF" ] || { echo "FAIL: $WF not found"; exit 1; }

fail=0
bad() { echo "FAIL: $1"; fail=1; }

grep -q 'claude -p' "$WF" || bad "no claude -p step found, parse proved nothing"

# The model gets no tools at all: an empty --tools list, and no allowlist that
# could grant Bash, Read, Grep, Glob or cat back (any --allowedTools fails).
if ! grep -q -e '--tools ""' "$WF"; then
  bad "model step does not pass --tools \"\" (no tools defined)"
fi
if grep -q -e '--allowedTools' "$WF"; then
  bad "an --allowedTools list is present, the model must get no tools"
fi
if ! grep -q -e '--strict-mcp-config' "$WF"; then
  bad "model step does not pass --strict-mcp-config"
fi

# The step that runs claude -p must not carry GH_TOKEN in its env block.
model_step="$(awk '/- name: Run health assessment/{f=1;next} /^      - name:/{f=0} f' "$WF")"
if [ -z "$model_step" ]; then
  bad "model step 'Run health assessment' not found"
elif [[ "$model_step" == *GH_TOKEN* ]]; then
  bad "model step still holds GH_TOKEN"
fi

if grep -q 'upload-artifact' "$WF"; then
  bad "workflow uploads an artifact, the raw report must not be public"
fi

collect="$(awk '/- name: Collect repository data/{f=1;next} /^      - name:/{f=0} f' "$WF")"
if [ -z "$collect" ]; then
  bad "data collection step 'Collect repository data' not found"
elif [[ "$collect" =~ title|body|headRefName|author ]]; then
  bad "collection step emits free text fields from outside contributors"
fi

# ---- Behaviour: drive the shipped step text, not just grep it ----------------
# A green exit with no output is not proof the Claude call worked. These cases
# extract the real run blocks of "Run health assessment" and "Parse and display
# report", point their /tmp paths at a scratch dir, and run them under bash -e
# (as Actions does) with a stub claude on PATH. The known-good case is the
# positive control: a guard that fails everything would fail it too.
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/claude-health-guard.XXXXXX")"
trap 'rm -rf "$TMP_ROOT"' EXIT

extract_run() { # $1 = step name; prints the dedented run block
  awk -v name="$1" '
    $0 ~ "- name: " name {f=1; next}
    f && /^      - name:/ {f=0}
    f && /^        run: \|/ {r=1; next}
    f && r {sub(/^          /, ""); print}
  ' "$WF"
}

mkdir -p "$TMP_ROOT/bin"
cat > "$TMP_ROOT/bin/claude" <<'STUB'
#!/usr/bin/env bash
cat > /dev/null
printf '%s' "${STUB_BODY:-}"
exit "${STUB_RC:-0}"
STUB
chmod +x "$TMP_ROOT/bin/claude"

# Writes the step script for $1 into $2 with /tmp paths redirected to $3.
make_script() {
  extract_run "$1" | sed "s#/tmp/#$3/#g" > "$2"
  [ -s "$2" ] || bad "could not extract run block of step '$1'"
}

# run_assess <case> <body> -> sets A_RC and A_OUT
run_assess() {
  local d="$TMP_ROOT/$1"
  mkdir -p "$d"
  : > "$d/summary.md"
  echo '{}' > "$d/health-data.json"
  make_script "Run health assessment" "$d/assess.sh" "$d"
  A_RC=0
  A_OUT="$(cd "$d" && PATH="$TMP_ROOT/bin:$PATH" RUNNER_TEMP="$d" GITHUB_STEP_SUMMARY="$d/summary.md" \
    STUB_BODY="$2" bash -e "$d/assess.sh" 2>&1)" || A_RC=$?
}

GOOD='{"is_error":false,"subtype":"success","num_turns":1,"duration_api_ms":900,"usage":{"output_tokens":120},"result":"{\"overall_score\":8}"}'

# Positive control: a good report passes, prints the field line, not the body.
run_assess good "$GOOD"
[ "$A_RC" -eq 0 ] || bad "control: a good report must pass (rc=$A_RC): $A_OUT"
[[ "$A_OUT" == *'"output_tokens":120'* && "$A_OUT" == *'"starts":'* ]] \
  || bad "step does not print the one-line result fields (is_error, subtype, output_tokens, starts)"
[[ "$A_OUT" != *overall_score* ]] || bad "step printed the report body, only the field line may be printed"

# is_error true must fail the step and name the subtype.
run_assess iserror '{"is_error":true,"subtype":"error_max_turns","num_turns":25,"duration_api_ms":5,"usage":{"output_tokens":50},"result":"x"}'
{ [ "$A_RC" -ne 0 ] && [[ "$A_OUT" == *'::error::'*error_max_turns* ]]; } \
  || bad "is_error true must exit 1 with an ::error:: naming the subtype (rc=$A_RC)"

# A green exit with no output is not proof: zero or missing tokens, empty result.
run_assess zerotok '{"is_error":false,"subtype":"success","num_turns":1,"usage":{"output_tokens":0},"result":"{\"overall_score\":8}"}'
{ [ "$A_RC" -ne 0 ] && [[ "$A_OUT" == *'::error::'* ]]; } || bad "output_tokens 0 must exit 1 with ::error::"
run_assess notok '{"is_error":false,"subtype":"success","num_turns":1,"result":"{\"overall_score\":8}"}'
{ [ "$A_RC" -ne 0 ] && [[ "$A_OUT" == *'::error::'* ]]; } || bad "missing output_tokens must exit 1 with ::error::"
run_assess emptyres '{"is_error":false,"subtype":"success","num_turns":1,"usage":{"output_tokens":9},"result":""}'
{ [ "$A_RC" -ne 0 ] && [[ "$A_OUT" == *'::error::'* ]]; } || bad "empty result must exit 1 with ::error::"

# run_parse <case> <raw report file body> -> sets P_RC and P_OUT (the step summary).
# The parse step must always exit 0 (it reports into the summary), so P_RC is asserted.
run_parse() {
  local d="$TMP_ROOT/$1"
  mkdir -p "$d"
  : > "$d/summary.md"
  printf '%s' "$2" > "$d/health-report.json"
  make_script "Parse and display report" "$d/parse.sh" "$d"
  P_RC=0
  (cd "$d" && GITHUB_STEP_SUMMARY="$d/summary.md" bash -e "$d/parse.sh" > /dev/null 2>&1) || P_RC=$?
  P_OUT="$(cat "$d/summary.md")"
  [ "$P_RC" -eq 0 ] || bad "parse step ($1) exited $P_RC, it must report into the summary and exit 0"
}

FENCE='```'
run_parse fenced '{"result":"'"$FENCE"'json\n{\"overall_score\":7,\"sections\":{}}\n'"$FENCE"'"}'
[[ "$P_OUT" == *'| Overall | 7/10 |'* ]] || bad "parser must strip a code fence before JSON.parse: $P_OUT"
run_parse plain '{"result":"{\"overall_score\":7,\"sections\":{}}"}'
[[ "$P_OUT" == *'| Overall | 7/10 |'* ]] || bad "control: an unfenced report must still render: $P_OUT"
run_parse notjson '{"result":"I could not score this."}'
[[ "$P_OUT" == *'Report parsing failed (not JSON)'* ]] || bad "non-JSON result must print 'Report parsing failed (not JSON)': $P_OUT"
run_parse noscore '{"result":"{\"foo\":1}"}'
{ [[ "$P_OUT" == *'Report parsing failed'* ]] && [[ "$P_OUT" != *'(not JSON)'* ]]; } \
  || bad "missing overall_score must print plain 'Report parsing failed': $P_OUT"
[[ "$P_OUT" != *'saved as artifact'* ]] || bad "stale text 'Raw output saved as artifact' (no upload step exists)"
grep -q 'result fields line in the job log' "$WF" || bad "missing-score message must point at the result fields line in the job log"

if [ "$fail" -ne 0 ]; then exit 1; fi
echo "PASS: claude-health tool scope"
