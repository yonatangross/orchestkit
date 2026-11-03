#!/usr/bin/env bash
# Test: the ci-sentinel headless claude -p runs with no tools (#4771, #5014).
#
# The sentinel model reads untrusted CI logs, and its verdict is posted as a
# public comment. Assertions on the workflow file (WORKFLOW_FILE overrides the
# path, so a bad fixture can prove each arm):
#   1. the per-PR claude -p call uses --permission-mode dontAsk, never
#      acceptEdits or bypassPermissions
#   2. it runs with --tools "" and no allow rule at all (b47: any tool that
#      runs a command can read the env, and gojq can @base64, reverse, slice
#      or split a secret past any content check), with Bash denied as a belt
#   3. the gh data is prefetched by the step BEFORE claude runs, fed on stdin
#   4. the failure branch prints no raw model output or stderr (public log)
# Each assertion first proves its target exists, so an empty parse cannot pass.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WF="${WORKFLOW_FILE:-$REPO_ROOT/.github/workflows/ci-sentinel.yml}"

[ -f "$WF" ] || { echo "FAIL: $WF not found"; exit 1; }

fail=0
bad() { echo "FAIL: $1"; fail=1; }
# Lines between `# BEGIN <name>` and `# END <name>` in the workflow.
snippet() { awk -v b="# BEGIN $1" -v e="# END $1" 'index($0,b){f=1;next} index($0,e){exit} f' "$WF"; }

# The per-PR call: from `claude -p \` with a following prompt line to the
# redirect into verdict.json (the auth smoke call is one line and excluded).
call="$(awk '/claude -p \\$/{f=1} f{print} /verdict\.json/{if(f){exit}}' "$WF")"
if [ -z "$call" ]; then
  bad "per-PR claude -p call not found, parse proved nothing"
else
  [[ "$call" == *"--permission-mode dontAsk"* ]] || bad "claude -p does not use --permission-mode dontAsk"
  [[ "$call" == *acceptEdits* ]] && bad "claude -p still uses acceptEdits"
  [[ "$call" == *bypassPermissions* ]] && bad "claude -p uses bypassPermissions"
  # 2. No tools: an empty built-in tool set and no allow rule of any kind.
  [[ "$call" == *'--tools ""'* ]] || bad "claude -p does not run with an empty tool set (--tools \"\")"
  [[ "$call" == *"--allowedTools"* || "$call" == *"--allowed-tools"* ]] && bad "claude -p still has an allow list"
  [[ "$call" == *'Bash('* ]] && bad "claude -p still names a Bash rule"
  [[ "$call" == *'--disallowedTools "*" "Bash"'* ]] || bad "claude -p does not deny every tool (\"*\") and Bash as belts"
  [[ "$call" == *"--strict-mcp-config"* ]] || bad "claude -p can load MCP servers"
  [[ "$call" == *"--safe-mode"* ]] || bad "claude -p loads customizations (hooks, plugins) from the checkout"
  [[ "$call" == *"env -u GH_TOKEN claude -p"* ]] || bad "the model process still inherits GH_TOKEN"
  # Flags that would hand tools, settings or directories back, and repeats
  # (a later flag can override an earlier one).
  for f in '--tools default' '--settings' '--mcp-config' '--add-dir' '--plugin-dir' '--dangerously'; do
    [[ "$call" == *"$f"* ]] && bad "claude -p passes $f"
  done
  for f in '--tools' '--permission-mode' '--disallowedTools' '--strict-mcp-config' '--safe-mode' '--max-turns'; do
    # Word count with awk (exit 0 on zero hits; a grep here would end the
    # script under set -e on the first missing flag).
    n="$(printf '%s\n' "$call" | tr -s ' \t' '\n\n' | awk -v w="$f" '$0 == w {c++} END {print c+0}')"
    [ "$n" -eq 1 ] || bad "claude -p passes $f $n times (want exactly 1)"
  done
  # 3. Fed from the prefetched file.
  [[ "$call" == *'< "$ctx_file"'* ]] || bad "claude -p is not fed the prefetched CI data on stdin"
fi
grep -qE '^ *(dis)?allowed_tools=\(' "$WF" && bad "a tool rule array is still defined"

# b47's four transforms, each one allowed gh api call under the old rule
# Bash(gh api repos/*). Every allow rule left in the workflow (an inline
# Bash(...) after --allowedTools, or an element of an allowed_tools array) is
# matched against each; with no allow rule, none has a tool to run in.
mapfile -t allow_rules < <(awk '
  /--allowedTools|--allowed-tools|^ *allowed_tools=\(/ {f=1}
  f && /--disallowedTools|^ *\)/ {f=0}
  f { s=$0; while (match(s, /Bash\([^)]*\)/)) { print substr(s, RSTART, RLENGTH); s=substr(s, RSTART+RLENGTH) } }
' "$WF")
for t in '@base64' 'explode | reverse | implode' '.[3:]' 'split("") | join(" ")'; do
  cmd="gh api repos/O/R --jq '\$E''NV.X | $t'"
  for rule in "${allow_rules[@]+"${allow_rules[@]}"}"; do
    glob="${rule#Bash(}"; glob="${glob%)}"
    # shellcheck disable=SC2053
    [[ "$cmd" == $glob ]] && bad "transform form still fits allow rule $rule: $t"
  done
done

pf="$(snippet prefetch)"
if [ -z "$pf" ]; then
  bad "no prefetch block: the step does not fetch the gh data itself"
else
  [[ "$pf" == *"gh pr checks"* ]] || bad "prefetch does not read the PR checks"
  [[ "$pf" == *"--log-failed"* ]] || bad "prefetch does not read the failed logs"
  pf_at="$(grep -n '# BEGIN prefetch' "$WF" | head -1 | cut -d: -f1)"
  call_at="$(grep -nE 'claude -p \\$' "$WF" | head -1 | cut -d: -f1)"
  if [ -z "$call_at" ] || [ "$pf_at" -ge "$call_at" ]; then bad "prefetch does not run before claude -p"; fi
fi

# 2b. CC 2.1.295 fixed --tools "" not applying to built-in tools that register
#     after launch (pilot HOLD on #5014), so the sentinel installs at least that.
install="$(awk '/- name: Install Claude Code/{f=1} f&&/claude --version/{print; exit} f' "$WF")"
if [ -z "$install" ]; then
  bad "Install Claude Code step not found"
else
  min="$(printf '%s\n' "$install" | sed -nE 's/^ *SENTINEL_CC_MIN="([0-9.]+)".*/\1/p')"
  if [ -z "$min" ]; then
    bad "install step has no SENTINEL_CC_MIN"
  else
    lowest="$(printf '%s\n%s\n' "$min" "2.1.295" | sort -V | head -n 1)"
    [ "$lowest" = "2.1.295" ] || bad "SENTINEL_CC_MIN $min is below 2.1.295"
  fi
  [[ "$install" == *'claude-code@${CC_PIN}'* ]] || bad "install does not use the pinned CC_PIN"
  [[ "$install" == *'sort -V | tail -n 1'* ]] || bad "CC_PIN is not the higher of the floor and SENTINEL_CC_MIN"
  # Behaviour: the pin rule picks the higher version both ways round.
  pick() { printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n 1; }
  [ "$(pick 2.1.277 2.1.295)" = "2.1.295" ] || bad "pin rule keeps a floor below the minimum"
  [ "$(pick 2.1.310 2.1.295)" = "2.1.310" ] || bad "pin rule drops a floor above the minimum"
fi

# 4. The failure branch prints a fixed line and the exit code, never the files.
#    Allow-list: only these line shapes may appear in it.
fb="$(snippet failure-branch)"
if [ -z "$fb" ]; then
  bad "no failure-branch block after claude -p"
else
  [[ "$fb" == *continue* ]] || bad "failure branch does not skip the PR"
  while IFS= read -r line; do
    case "$(printf '%s' "$line" | sed -E 's/^[[:space:]]+//')" in
      ''|'if '*|'fi'|'continue'|'rm -rf "$tmpdir"'|'echo "::warning::claude run failed for #${number} (exit ${claude_rc}); output withheld from the public log"') ;;
      *) bad "failure branch has a line outside the allow-list: $line" ;;
    esac
  done <<EOF
$fb
EOF
fi
# Nowhere in the file is the model's raw output or stderr printed.
if grep -vE '^[[:space:]]*#' "$WF" | grep -qE '(cat|head|tail|less|more)[^|>]*(verdict\.json|err\.log)'; then
  bad "the workflow prints verdict.json or err.log to the log"
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
  rt="$(mktemp -d "${TMPDIR:-/tmp}/ork.XXXXXX")"
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
    local d; d="$(mktemp -d "${TMPDIR:-/tmp}/ork.XXXXXX")"
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
  # One failed comment must not stop the loop under set -e.
  [[ "$post" == *'if ! gh pr comment'* ]] || bad "a failed gh pr comment stops the post loop"
fi

# 7. post sanitises the verdict before posting (pilot should-fix on #5014):
#    run the real snippet on a hostile verdict and check the body.
san="$(snippet verdict-sanitise)"
if [ -z "$san" ]; then
  bad "post has no verdict-sanitise block"
else
  sd="$(mktemp -d "${TMPDIR:-/tmp}/ork.XXXXXX")"
  hostile='ok</details><img src=x> ![p](https://e.x/p.png) [docs](https://e.x/d) ping @someone'
  jq -n --arg v "$hostile$(printf 'A%.0s' $(seq 1 100))" '{pr: 7, sha: "abcdef1", verdict: $v}' > "$sd/7.json"
  f="$sd/7.json" body_file="$sd/body.md" sha=abcdef1 MARKER_PREFIX="<!-- ork:ci-sentinel" MAX_VERDICT_CHARS=120 SAN="$san" \
    bash -c 'set -euo pipefail; eval "$SAN"'
  body="$(cat "$sd/body.md")"
  inner="${body#*</summary>}"; inner="${inner%</details>*}"
  [[ "$inner" == *'</details>'* || "$inner" == *'<img'* ]] && bad "sanitised verdict still carries HTML"
  [[ "$inner" == *'e.x/p.png'* ]] && bad "sanitised verdict still carries an image"
  [[ "$inner" == *'https://e.x/d'* ]] && bad "sanitised verdict still carries a link target"
  [[ "$inner" == *docs* ]] || bad "sanitised verdict lost the link text"
  [[ "$inner" == *'@someone'* ]] && bad "sanitised verdict can still @mention"
  a_only="${inner//[^A]/}"
  [ "${#a_only}" -lt 100 ] || bad "sanitised verdict is not capped"
  rm -rf "$sd"
fi

if [ "$fail" -ne 0 ]; then exit 1; fi
echo "PASS: ci-sentinel tool scope"
