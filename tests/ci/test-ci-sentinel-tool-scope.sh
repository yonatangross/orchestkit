#!/usr/bin/env bash
# Test: the ci-sentinel headless claude -p runs only the gh reads it needs (#4771).
#
# The sentinel model reads untrusted CI logs while the job token holds
# pull-requests: write and issues: write. Assertions on the workflow file
# (WORKFLOW_FILE overrides the path, so a bad fixture can prove each arm):
#   1. the claude -p call uses --permission-mode dontAsk, never acceptEdits or
#      bypassPermissions
#   2. it passes --allowedTools and --disallowedTools
#   3. every allow rule is one of the gh reads (no bare Bash, no grep, head,
#      jq, cat or a wildcard-only rule)
#   4. the deny list covers every gh api write form and env reads
# Each assertion first proves its target exists, so an empty parse cannot pass.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WF="${WORKFLOW_FILE:-$REPO_ROOT/.github/workflows/ci-sentinel.yml}"

[ -f "$WF" ] || { echo "FAIL: $WF not found"; exit 1; }

fail=0
bad() { echo "FAIL: $1"; fail=1; }

# The per-PR call: from `claude -p \` with a following prompt line to the
# redirect into verdict.json (the auth smoke call is one line and excluded).
call="$(awk '/claude -p \\$/{f=1} f{print} /verdict\.json/{if(f){exit}}' "$WF")"
if [ -z "$call" ]; then
  bad "per-PR claude -p call not found, parse proved nothing"
else
  [[ "$call" == *"--permission-mode dontAsk"* ]] || bad "claude -p does not use --permission-mode dontAsk"
  [[ "$call" == *acceptEdits* ]] && bad "claude -p still uses acceptEdits"
  [[ "$call" == *bypassPermissions* ]] && bad "claude -p uses bypassPermissions"
  [[ "$call" == *"--allowedTools"* ]] || bad "claude -p has no --allowedTools"
  [[ "$call" == *"--disallowedTools"* ]] || bad "claude -p has no --disallowedTools"
fi

# The rule arrays the call expands, one rule per element.
mapfile -t allowed < <(awk '/^ *allowed_tools=\(/{f=1;next} f&&/^ *\)/{exit} f' "$WF" | sed -E 's/^ *"(.*)"$/\1/')
mapfile -t denied < <(awk '/^ *disallowed_tools=\(/{f=1;next} f&&/^ *\)/{exit} f' "$WF" | sed -E 's/^ *"(.*)"$/\1/')

if [ "${#allowed[@]}" -eq 0 ]; then
  bad "allowed_tools list not found"
else
  for rule in "${allowed[@]}"; do
    case "$rule" in
      "Bash(gh pr checks *)"|"Bash(gh pr view *)"|"Bash(gh run view *)"|"Bash(gh api repos/*)") ;;
      *) bad "allow rule is not one of the gh reads: $rule" ;;
    esac
  done
fi

if [ "${#denied[@]}" -eq 0 ]; then
  bad "disallowed_tools list not found"
else
  for want in 'Bash(gh api *-X*)' 'Bash(gh api *--method*)' 'Bash(gh api *-f*)' 'Bash(gh api *-F*)' \
              'Bash(gh api *--field*)' 'Bash(gh api *--raw-field*)' 'Bash(gh api *--input*)' \
              'Bash(gh api *graphql*)' 'Bash(gh *env*)' 'Bash(gh *ENV*)'; do
    found=0
    for rule in "${denied[@]}"; do
      [ "$rule" = "$want" ] && found=1
    done
    [ "$found" -eq 1 ] || bad "deny list misses $want"
  done
fi

# 5. The token split (#5014, reviews b34 and b35). Deny rules match raw text,
#    so quoted or escaped flags pass them: gh api ... -"X" GET (b34),
#    -''X PATCH, -\X PATCH, --meth""od PATCH, -'f'body=x (b35). The fix is the
#    token: the job that runs claude -p may only read, and the job that
#    posts runs no model.
top_perms="$(awk '/^permissions:/{f=1;next} f&&/^[^ ]/{exit} f' "$WF")"
[ -n "$top_perms" ] || bad "no workflow-level permissions block"
[[ "$top_perms" == *write* ]] && bad "workflow-level permissions grant write: $top_perms"

# Every job block: name line `  <job>:` up to the next job name line.
claude_job="$(awk '/^jobs:/{j=1;next} j&&/^  [a-z][a-z0-9_-]*:$/{name=$1} j&&!/^[[:space:]]*#/&&/claude -p/{print name; exit}' "$WF" | tr -d ':')"
[ -n "$claude_job" ] || bad "no job runs claude -p"
job_block() { awk -v j="  $1:" '$0==j{f=1;next} f&&/^  [a-z][a-z0-9_-]*:$/{exit} f' "$WF"; }
if [ -n "$claude_job" ]; then
  cj="$(job_block "$claude_job")"
  cj_perms="$(printf '%s\n' "$cj" | awk '/^    permissions:/{f=1;next} f&&/^    [a-z]/{exit} f')"
  [ -n "$cj_perms" ] || bad "job $claude_job (runs claude -p) has no permissions block"
  [[ "$cj_perms" == *write* ]] && bad "job $claude_job runs claude -p with a write permission"
  [[ "$cj" == *"gh pr comment"* ]] && bad "job $claude_job runs claude -p and also posts"
fi
post="$(job_block post)"
if [ -z "$post" ]; then
  bad "no post job"
else
  [[ "$post" == *"claude"* || "$post" == *"CLAUDE_CODE_OAUTH_TOKEN"* ]] && bad "post job runs or can reach the model"
  [[ "$post" == *"needs: $claude_job"* ]] || bad "post job does not need $claude_job"
  [[ "$post" == *"pull-requests: write"* ]] || bad "post job cannot comment"
fi
# Every action in the file is pinned by a 40-hex SHA.
while IFS= read -r use; do
  [[ "$use" =~ @[0-9a-f]{40}([[:space:]]|$) ]] || bad "action not pinned by SHA: $use"
done < <(grep -E '^[[:space:]]*(- )?uses:' "$WF" | sed -E 's/^[[:space:]]*(- )?uses:[[:space:]]*//')

# 6. Secret values never reach the public comment (#5014, review b45). gh's
#    --jq reads the environment and a quote-split spelling ($E''NV.X) passes
#    the text deny, so the guard checks the verdict CONTENT, not the command.
#    (a) the job that runs claude -p drops a verdict holding the exact value of
#        CLAUDE_CODE_OAUTH_TOKEN or GH_TOKEN, before it writes the artifact;
#    (b) post (no secret to compare) refuses known token shapes;
#    (c) both snippets, run for real on fake values, drop the bad verdict and
#        keep a clean one, and an empty secret does not drop everything;
#    (d) post checks PR and SHA against its own read, not sweep's queue.json.
snippet() { awk -v b="# BEGIN $1" -v e="# END $1" 'index($0,b){f=1;next} index($0,e){exit} f' "$WF"; }
sg="$(snippet secret-value-guard)"
belt="$(snippet token-shape-belt)"
if [ -z "$sg" ]; then
  bad "sweep has no secret-value-guard block"
else
  [[ "$sg" == *'grep -qF'* ]] || bad "secret-value guard is not a fixed-string grep"
  [[ "$sg" == *CLAUDE_CODE_OAUTH_TOKEN* && "$sg" == *GH_TOKEN* ]] || bad "secret-value guard misses a secret"
  [[ "$sg" == *RUNNER_TEMP* ]] || bad "secret-value guard temp file is not under RUNNER_TEMP"
  [[ "$sg" == *".sentinel"* ]] && bad "secret-value guard writes inside the artifact path"
  [[ "$sg" == *'rm -f'* ]] || bad "secret-value guard does not remove its temp file"
  if [ -n "$claude_job" ]; then
    guard_at="$(printf '%s\n' "$cj" | grep -n '# BEGIN secret-value-guard' | head -1 | cut -d: -f1)"
    write_at="$(printf '%s\n' "$cj" | grep -n 'sentinel/out/\${number}\.json' | head -1 | cut -d: -f1)"
    if [ -z "$guard_at" ] || [ -z "$write_at" ]; then
      bad "secret-value guard or artifact write is not in job $claude_job"
    elif [ "$guard_at" -ge "$write_at" ]; then
      bad "secret-value guard runs after the artifact write"
    fi
  fi
  # Behaviour: run the real snippet inside a one-pass loop (it uses continue).
  rt="$(mktemp -d)"
  run_guard() {
    RUNNER_TEMP="$rt" CLAUDE_CODE_OAUTH_TOKEN="$1" GH_TOKEN="$2" verdict_md="$3" number=7 SG="$sg" \
      bash -c 'set -uo pipefail; for _ in 1; do eval "$SG"; echo KEPT; done' 2>&1
  }
  fake_oauth="fake-oauth-value-b45-$$"
  fake_gh="fake-gh-value-b45-$$"
  out="$(run_guard "$fake_oauth" "$fake_gh" "report ... $fake_oauth ... end")"
  [[ "$out" == *KEPT* ]] && bad "secret-value guard kept a verdict holding the OAuth value"
  [[ "$out" == *"$fake_oauth"* ]] && bad "secret-value guard printed the secret"
  out="$(run_guard "$fake_oauth" "$fake_gh" "report $fake_gh")"
  [[ "$out" == *KEPT* ]] && bad "secret-value guard kept a verdict holding the GH_TOKEN value"
  out="$(run_guard "$fake_oauth" "$fake_gh" "clean report")"
  [[ "$out" == *KEPT* ]] || bad "secret-value guard dropped a clean verdict"
  out="$(run_guard "" "" "clean report")"
  [[ "$out" == *KEPT* ]] || bad "secret-value guard with empty secrets dropped a clean verdict"
  [ -z "$(ls -A "$rt")" ] || bad "secret-value guard left a temp file behind"
  rm -rf "$rt"
fi
if [ -z "$belt" ]; then
  bad "post has no token-shape-belt block"
else
  [[ "$post" == *'# BEGIN token-shape-belt'* ]] || bad "token-shape belt is not in the post job"
  run_belt() {
    local d; d="$(mktemp -d)"
    jq -n --arg v "$1" '{pr: 7, sha: "abcdef1", verdict: $v}' > "$d/7.json"
    f="$d/7.json" BELT="$belt" bash -c 'set -euo pipefail; for _ in 1; do eval "$BELT"; echo KEPT; done' 2>&1
    rm -rf "$d"
  }
  # Fake shapes are joined at runtime so no token-shaped literal sits in the repo.
  filler="$(printf 'A%.0s' $(seq 1 24))"
  shapes=(
    "sk""-ant-""oat01-${filler}"
    "gh""s_${filler}" "gh""p_${filler}" "gh""o_${filler}" "gh""u_${filler}"
    "github""_pat_${filler}"
  )
  for shape in "${shapes[@]}"; do
    out="$(run_belt "leak: $shape")"
    [[ "$out" == *KEPT* ]] && bad "token-shape belt kept a verdict holding ${shape:0:4}..."
    [[ "$out" == *"$shape"* ]] && bad "token-shape belt printed the match"
  done
  out="$(run_belt "clean report about a failing lint step")"
  [[ "$out" == *KEPT* ]] || bad "token-shape belt dropped a clean verdict"
fi
if [ -n "$post" ]; then
  [[ "$post" == *"queue.json"* ]] && bad "post still trusts queue.json written by $claude_job"
  [[ "$post" == *"gh pr list"* ]] || bad "post does not rebuild the PR and SHA list with its own read"
fi

if [ "$fail" -ne 0 ]; then exit 1; fi
echo "PASS: ci-sentinel tool scope"
