#!/bin/bash
# Security Tests: jq program-argument injection in shell scripts
#
# Priority: CRITICAL
# Reference: OWASP Injection Prevention, CWE-78 (argument injection)
#
# =============================================================================
# WHAT THIS FILE USED TO BE
# =============================================================================
# It tested a runtime premise that died with the TypeScript hook migration.
# Hooks parse stdin with JSON.parse; they do not shell out to jq. Concretely:
#
#   * Both "scan the hooks for dangerous patterns" loops (old :110 and :154) ran
#     `find "$HOOKS_DIR" -name "*.sh"` against src/hooks, which contains exactly
#     ONE .sh file (src/hooks/bin/file-suggestion.sh) whose only jq line is
#     `jq -r '.query // ""'` - single-quoted, no variable. The loops could never
#     find anything.
#   * Old :114-116 printed "WARNING: Potential jq injection" to stdout and then
#     old :119 hit an unconditional `return 0`. A hit could not fail the test.
#   * Old :158-165 assigned `$line`, never read it, `continue`d, and old :167
#     was another unconditional `return 0`.
#   * Old :96-106 grepped src/hooks/src/lib/common.ts for "jq.*-r". That file is
#     a pure barrel re-export with zero occurrences of jq, so the block was
#     never entered.
#   * The remaining assertions (old :41, :59, :69, :132, :180) piped a static
#     literal through a STATIC jq filter and asserted the result. They tested
#     that upstream jq works, not that anything in this repo is safe.
#
# So the suite reported green because the thing it looked for was unreachable.
#
# =============================================================================
# WHAT IT TESTS NOW: a static property of this repo's shell scripts
# =============================================================================
# The real, checkable jq-injection property is static, not runtime:
#
#   Does any shell script interpolate a variable into the jq PROGRAM argument
#   instead of passing it as DATA via --arg / --argjson?
#
#   VULNERABLE   jq -r ".${key}"           <- $key becomes part of the program
#   CORRECT      jq --arg k "$key" '.[$k]' <- $key is data; program is a literal
#
# The distinction matters because the jq program is a language: a value that
# lands inside it can add filters, read sibling keys, or call `env`. A value
# passed via --arg cannot - it is a string binding.
#
# The scanner below locates the jq PROGRAM argument properly (it tokenises the
# invocation and skips option values, so `jq --arg v "$x" '.a=$v'` and
# `jq -r '.v' "$FILE"` are correctly NOT flagged) and fails on any program that
# is not single-quoted and contains a `$`.
#
# ALLOWLIST KEYING: entries are keyed on `path ==> program-text`, NOT on a line
# number. Line numbers in these files churn constantly, and a stale allowlist
# that silently stops matching turns straight back into the green-because-blind
# failure this rewrite exists to remove. The program text is the thing actually
# reviewed, so it is the thing keyed on.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PASS=0
FAIL=0

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
log_pass() { echo "  ${GREEN}✓${NC} $1"; }
log_fail() { echo "  ${RED}✗${NC} $1"; }
section()  { echo; echo "${YELLOW}$1${NC}"; }

TMPD="$(mktemp -d)"
trap 'rm -rf "$TMPD"' EXIT

# ============================================================================
# THE DETECTOR
# ============================================================================

# Join backslash-continued lines so a program on a continuation line is still
# attributed to the invocation that owns it, and report the STARTING line.
JOIN_CONTINUATIONS='
{
  if (buf == "") start = FNR
  if ($0 ~ /\\[ \t]*$/) { sub(/\\[ \t]*$/, " ", $0); buf = buf $0; next }
  print start "\t" buf $0
  buf = ""
}
END { if (buf != "") print start "\t" buf }
'

# jq_program <text-after-the-jq-word>
#
# Tokenises a jq invocation with shell quoting rules and prints the PROGRAM
# argument verbatim (quotes included). Returns 1 when the invocation has no
# inline program (e.g. `jq -f prog.jq`, or a truncated/continued line).
jq_program() {
  local s="$1" tok="" q="" i=0 n c
  local -a toks=()
  n=${#s}

  while ((i < n)); do
    c="${s:i:1}"
    if [[ -z "$q" ]]; then
      case "$c" in
        \'|\")
          q="$c"; tok+="$c"
          ;;
        ' '|$'\t')
          if [[ -n "$tok" ]]; then toks+=("$tok"); tok=""; fi
          ;;
        '|'|';'|'&'|'>'|'<'|')')
          # End of this simple command. Anything past here belongs to another
          # command, and gluing it on would corrupt the program text.
          break
          ;;
        '\')
          i=$((i + 1)); tok+="${s:i:1}"
          ;;
        *)
          tok+="$c"
          ;;
      esac
    elif [[ "$q" == '"' && "$c" == '\' ]]; then
      # Backslash escapes are live inside double quotes, so \" does NOT close
      # the string. Without this, every program containing \" gets mis-split.
      tok+="$c"; i=$((i + 1)); tok+="${s:i:1}"
    else
      tok+="$c"
      if [[ "$c" == "$q" ]]; then q=""; fi
    fi
    i=$((i + 1))
  done
  if [[ -n "$tok" ]]; then toks+=("$tok"); fi

  # Walk the tokens, consuming option values, and return the first positional.
  local skip=0 t
  for t in ${toks+"${toks[@]}"}; do
    if ((skip > 0)); then skip=$((skip - 1)); continue; fi
    case "$t" in
      --arg|--argjson|--slurpfile|--rawfile) skip=2 ;;
      -f|--from-file)                        return 1 ;;   # program is in a file
      --indent|-L)                           skip=1 ;;
      --)                                    skip=0 ;;
      -*)                                    ;;            # valueless flag
      *)  printf '%s' "$t"; return 0 ;;
    esac
  done
  return 1
}

# scan_files: reads file paths on stdin, writes "path<TAB>program<TAB>line" for
# every jq invocation whose PROGRAM argument is not single-quoted and contains $.
scan_files() {
  local file lineno text rest pre before after prog
  while IFS= read -r file; do
    [[ -r "$file" ]] || continue
    while IFS=$'\t' read -r lineno text; do
      rest="$text"
      while [[ "$rest" == *jq* ]]; do
        pre="${rest%%jq*}"
        rest="${rest#*jq}"
        before="${pre: -1}"
        after="${rest:0:1}"
        # `jq` must be its own word, and must be followed by whitespace.
        [[ -n "$before" && "$before" =~ [A-Za-z0-9_./-] ]] && continue
        [[ "$after" =~ [[:space:]] ]] || continue

        prog="$(jq_program "$rest")" || continue
        [[ "$prog" == \'* ]] && continue      # single-quoted: literal program
        [[ "$prog" == *'$'* ]] || continue    # no interpolation: nothing to do
        printf '%s\t%s\t%s\n' "$file" "$prog" "$lineno"
      done
    done < <(awk "$JOIN_CONTINUATIONS" "$file")
  done
  return 0
}

# worktree_prunes: `-not -path` args for every OTHER checkout of this repo.
#
# Two layouts exist and hardcoding one was the #3410 bug: this scan excluded
# `.worktrees/*` (the layout global CLAUDE.md mandates) but not
# `.claude/worktrees/*` (the layout CC creates natively since 2.1.121, and the
# default since #3315 retired ork's own provisioning). The scanner walked into a
# live CC worktree, found this repo's own sources a second time, and reported
# 49 violations with ZERO hits in tracked source. Green in CI's clean clone, red
# for any developer with a CC worktree open — a security suite that gates push
# (bin/git-hooks/pre-push) teaching its operator to ignore it.
#
# Derived from `git worktree list`, not from literals, so a third layout cannot
# repeat this. The two literals remain as a backstop for UNregistered debris: an
# aborted `git worktree add` leaves a directory git does not list (the case
# lifecycle/sweep-stale-worktrees exists to clean up), and that debris would
# otherwise still be scanned.
worktree_prunes() {
  local me other
  me="$(cd "$REPO_ROOT" && pwd -P)"
  while IFS= read -r other; do
    [ -n "$other" ] || continue
    other="$(cd "$other" 2>/dev/null && pwd -P)" || continue
    # Skip the tree being scanned, AND any checkout that CONTAINS it. The
    # mandated layout nests worktrees inside the repo (<repo>/.worktrees/<task>),
    # so the main checkout is an ANCESTOR of this one; pruning it would exclude
    # the entire scan. Measured while writing this fix: that mistake took
    # repo_targets to ZERO files and the suite still printed "3 passed", because
    # a scan of nothing finds nothing. Hence also the vacuity guard below.
    [ "$other" = "$me" ] && continue
    case "$me" in "$other"/*) continue ;; esac
    printf -- '-not\n-path\n%s/*\n' "$other"
  # silent: best-effort — not a git repo yields nothing and the literals below carry it
  done < <(git -C "$REPO_ROOT" worktree list --porcelain 2>/dev/null \
           | awk '/^worktree /{print $2}')
  # Backstop for UNregistered debris git will not list (aborted `worktree add`,
  # the case lifecycle/sweep-stale-worktrees cleans up). Only emitted when the
  # literal is not an ancestor of the scanned tree.
  local lit
  for lit in "$REPO_ROOT/.worktrees" "$REPO_ROOT/.claude/worktrees"; do
    case "$me" in "$lit"/*) continue ;; esac
    printf -- '-not\n-path\n%s/*\n' "$lit"
  done
}

# repo_targets: every shell script the property applies to.
#   other checkouts - see worktree_prunes above
#   node_modules    - vendored
#   plugins/        - GENERATED from src/ by npm run build; src/ is the real target
#   this file       - necessarily contains example jq lines of both shapes
repo_targets() {
  local -a prunes=()
  while IFS= read -r arg; do prunes+=("$arg"); done < <(worktree_prunes)
  find "$REPO_ROOT" -name '*.sh' -type f \
    "${prunes[@]}" \
    -not -path '*/node_modules/*' \
    -not -path "$REPO_ROOT/plugins/*" \
    -not -name 'test-jq-injection.sh' \
    | sort
}

# ============================================================================
# ALLOWLIST - reviewed existing hits, one reason each
# ============================================================================
# Format: a `#` comment carrying the reason, then `path ==> program`.
# Paths are relative to the repo root. Adding an entry here is a review claim:
# that the value reaching the jq program cannot be attacker-controlled.
#
# NOTHING below is on the hook-input path. Hooks are TypeScript and parse stdin
# with JSON.parse, so no tool input, prompt text, or network data reaches any
# jq program in this repo. That is what makes these reviewable at all.

ALLOWLIST_RAW="$(cat <<'ALLOWLIST'
# --- .claude/scripts/config-loader.sh - local config reader, no hook-input path
# $path is get_bool's 2nd arg; all call sites (:91,:118,:156,:174,:308+) pass literals
.claude/scripts/config-loader.sh ==> "if $path == null then \"$default\" else ($path | tostring) end"
# $skill_id is is_skill_enabled's parameter, supplied by in-repo callers as a literal
.claude/scripts/config-loader.sh ==> ".skills.disabled | index(\"$skill_id\")"
# $agent_id is is_agent_enabled's parameter, same literal-only call pattern
.claude/scripts/config-loader.sh ==> ".agents.disabled | index(\"$agent_id\")"
# $hook_name is is_hook_enabled's parameter, same literal-only call pattern
.claude/scripts/config-loader.sh ==> ".hooks.disabled | index(\"$hook_name\")"
# $command_id is is_command_enabled's parameter, same literal-only call pattern
.claude/scripts/config-loader.sh ==> ".commands.disabled | index(\"$command_id\")"

# --- .claude/scripts/feedback-lib.sh
# $key/$default are get_preference args; all call sites (:587,:938,:940,:942) pass literals
.claude/scripts/feedback-lib.sh ==> ".${key} // \"${default}\""
# $key/$value are set_preference args, same literal-only call pattern
.claude/scripts/feedback-lib.sh ==> ".${key} = ${value}"

# --- shared/_lib/common.sh
# get_field's $filter: the ONE dynamic program that was ever on the hook-input
# path. :74-79 rejects a filter containing a backtick, `$(` or `;` before it
# runs, and every in-repo caller passes a literal like '.tool_name'. Weakest
# entry here - if any caller ever forwards external data, delete this line.
shared/_lib/common.sh ==> "$filter"
# atomic_json_update: the detector resolves the "${jq_args[@]}" expansion as the
# program token; the real program is the $jq_filter positional, a caller-supplied
# literal. Function has no non-doc call sites in this tree.
shared/_lib/common.sh ==> "${jq_args[@]}"

# --- scripts/
# read_metric's $filter; all 3 call sites (:98,:99,:103) pass single-quoted literals
scripts/eval/aggregate-quality-index.sh ==> "$filter // empty"
# dev CLI: $SET comes from the --set flag, $1 from the literal g() calls at :40-42
scripts/render-ascii.sh ==> ".sets.\"$SET\".$1"

# --- src/
# ${q} is a file-local literal program defined immediately above at :52-59
src/skills/dev/scripts/boot.sh ==> "${q}"

# --- tests/evals/scripts/ - eval harnesses; indices come from C-style for loops
# $ai is the integer loop counter of `for ((ai=0; ai<assertion_count; ai++))`
tests/evals/scripts/run-agent-eval.sh ==> ".[$ai].verdict"
tests/evals/scripts/run-agent-eval.sh ==> ".[$ai].reason // \"\""
tests/evals/scripts/run-quality-eval.sh ==> ".[$ai].verdict"
tests/evals/scripts/run-quality-eval.sh ==> ".[$ai].reason // \"\""
# $DEAD_ENVELOPE_JQ is a file-local literal program defined at :432
tests/evals/scripts/run-quality-eval.sh ==> "$DEAD_ENVELOPE_JQ"

# --- tests/fixtures/test-helpers.sh - shared harness, parameters are literals
# $field is assert_json_field's parameter, passed as a literal by every test
tests/fixtures/test-helpers.sh ==> "$field"
# $hook_type/$matcher are run_hook_chain's parameters, e.g. "PreToolUse" "Bash"
tests/fixtures/test-helpers.sh ==> ".hooks.\"$hook_type\"[] | select(.matcher == \"$matcher\" or .matcher == \"*\") | .hooks[].command"
# $fixture_key is load_fixture's parameter, a literal key into a checked-in fixture
tests/fixtures/test-helpers.sh ==> ".\"$fixture_key\""
# check_jq_injection: hostile input is the POINT - this helper exists to feed a
# malicious filter to jq and observe the result. Flagging it would be a category error.
tests/fixtures/test-helpers.sh ==> "$malicious_filter // \"\""

# --- tests/integration/
# $field/$path are assert_* helper parameters, literal jq paths written by the test
tests/integration/hooks/test-output-guard-dispatcher.sh ==> ".hookSpecificOutput.${field}"
tests/integration/hooks/test-output-guard-dispatcher.sh ==> "$path"
# $event/$matcher are get_hooks_for_event's parameters, e.g. "PreToolUse" "Bash"
tests/integration/test-hook-chains.sh ==> ".hooks.${event}[] | select(.matcher == \"$matcher\" or .matcher == null) | .hooks[] | (.command + (if has(\"args\") and (.args|type) == \"array\" then \" \" + (.args | join(\" \")) else \"\" end))"

# --- tests/plugins/ + tests/schemas/ - schema validators over checked-in JSON
# $hook_type iterates the literal list `PreToolUse PostToolUse SessionStart Stop ...`
tests/plugins/structure/test-plugin-structure-compliance.sh ==> ".hooks.$hook_type"
# $field iterates the literal list `name version description author`
tests/plugins/structure/test-plugin-structure-compliance.sh ==> ".$field"
# $event is a key read from the repo's own checked-in plugin.json
tests/plugins/test-cc-discovery-simulation.sh ==> ".hooks.$event | if type == \"array\" then .[0].hooks | length else 0 end"
# $field is get_field_type's parameter, a literal field name
tests/plugins/test-plugin-json-schema.sh ==> "if .$field == null then \"null\" elif .$field | type == \"object\" then \"object\" elif .$field | type == \"array\" then \"array\" elif .$field | type == \"string\" then \"string\" else \"other\" end"
# $field iterates the literal list `name version`
tests/plugins/test-plugin-json-schema.sh ==> ".$field // empty"
# $event is a key read from the repo's own checked-in plugin.json
tests/plugins/test-plugin-json-schema.sh ==> ".hooks[\"$event\"][] | .hooks[]? // . | select(.type == \"command\" and .command == null) | \"$event\""
tests/plugins/test-plugin-json-schema.sh ==> ".hooks[\"$event\"][] | .hooks[]? // . | select(.type == \"http\" and .url == null) | \"$event\""
# $plugin_name is read from the repo's own checked-in marketplace.json
tests/plugins/validate-all.sh ==> ".plugins[] | select(.name == \"$plugin_name\") | .source"
# $dir_name is a basename of a directory under plugins/, repo-controlled
tests/plugins/validate-all.sh ==> ".plugins[] | select(.name == \"$dir_name\") | .name // empty"
# $field iterates the literal list `name version description plugins`
tests/schemas/test-marketplace-schema.sh ==> ".$field // empty"
# $i is the integer index from `seq 0 $((plugin_count - 1))`
tests/schemas/test-marketplace-schema.sh ==> ".plugins[$i].name // \"plugin_$i\""
tests/schemas/test-marketplace-schema.sh ==> ".plugins[$i] | keys - \$valid | .[]"
tests/schemas/test-marketplace-schema.sh ==> ".plugins[$i].version // \"\""
tests/schemas/test-marketplace-schema.sh ==> ".plugins[$i].source // \"\""
# $i is that same integer index; $field iterates a literal required-fields array
tests/schemas/test-marketplace-schema.sh ==> ".plugins[$i].$field // empty"
# $field iterates the literal list `name version description`
tests/schemas/test-plugin-schema.sh ==> ".$field // empty"

# --- tests/skills/ + tests/unit/
# $i and $b are integer indices from `seq 0 $((count - 1))`
tests/skills/functional/test-rule-traceability.sh ==> ".testCases[$i].id"
tests/skills/functional/test-rule-traceability.sh ==> ".testCases[$i].rule // empty"
tests/skills/functional/test-rule-traceability.sh ==> ".testCases[$i].expectedBehavior | length"
tests/skills/functional/test-rule-traceability.sh ==> ".testCases[$i].expectedBehavior[$b]"
# get_fixture's $1 is a literal fixture key written by the test
tests/unit/test-hooks-unit.sh ==> ".$1"
ALLOWLIST
)"

# ============================================================================
# CONTROLS - prove the detector can both fire and stay quiet
# ============================================================================

section "1. Positive control - the detector must flag a real vulnerable shape"
cat > "$TMPD/vulnerable.sh" <<'FIXTURE'
#!/bin/bash
# Positive control: $UNTRUSTED becomes part of the jq PROGRAM.
UNTRUSTED="$1"
jq -r ".$UNTRUSTED" data.json
FIXTURE

printf '%s\n' "$TMPD/vulnerable.sh" | scan_files > "$TMPD/positive.tsv"
if [[ -s "$TMPD/positive.tsv" ]]; then
  log_pass "flagged \`jq -r \".\$UNTRUSTED\"\` (detector can fire)"
  PASS=$((PASS + 1))
else
  log_fail "MISSED the positive control - the scan below cannot fail, so its green would be meaningless"
  FAIL=$((FAIL + 1))
fi

section "2. Negative control - --arg usage must NOT be flagged"
# bin/bump-version.sh is correct-by-construction: every dynamic value is bound
# with --arg and every program is a single-quoted literal.
printf '%s\n' "$REPO_ROOT/bin/bump-version.sh" | scan_files > "$TMPD/negative.tsv"
if [[ -s "$TMPD/negative.tsv" ]]; then
  log_fail "false positive on correct --arg usage:"
  sed 's/^/      /' "$TMPD/negative.tsv"
  FAIL=$((FAIL + 1))
else
  log_pass "bin/bump-version.sh (--arg bindings, literal programs) is clean"
  PASS=$((PASS + 1))
fi

# ============================================================================
# THE SCAN
# ============================================================================

section "3. Repo-wide scan for interpolation into the jq program"

# sed (not grep -v) so an empty allowlist still exits 0, and a FILE (not a
# here-string) so the lookup neither SIGPIPEs the producer under pipefail nor
# trips the bash 5.3 here-string PIPE_BUF deadlock.
printf '%s\n' "$ALLOWLIST_RAW" \
  | sed -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d' > "$TMPD/allow.keys"

# VACUITY GUARD (#3410). A scan of zero files finds zero violations and prints
# a clean pass. That is not hypothetical: the first version of worktree_prunes
# pruned an ANCESTOR checkout of this tree, took repo_targets to 0, and this
# section still reported success. The sibling test-json-island-breakout.sh has
# the same assertion and it is the only reason that bug was caught, so this one
# gets it too. The floor is deliberately loose — it only has to catch "the
# target list collapsed", not track the real file count.
scanned_count="$(repo_targets | wc -l | tr -d ' ')"
if [ "${scanned_count:-0}" -lt 100 ]; then
  log_fail "target list collapsed to ${scanned_count} shell scripts — the scan below would be vacuous, not clean (check worktree_prunes)"
  FAIL=$((FAIL + 1))
else
  log_pass "target list is live (${scanned_count} shell scripts in scope)"
  PASS=$((PASS + 1))
fi

repo_targets | scan_files > "$TMPD/findings.tsv"

unreviewed=0
while IFS=$'\t' read -r file prog lineno; do
  [[ -n "$file" ]] || continue
  rel="${file#"$REPO_ROOT"/}"
  if grep -Fxq -- "$rel ==> $prog" "$TMPD/allow.keys"; then
    continue
  fi
  log_fail "$rel:$lineno interpolates into the jq PROGRAM: $prog"
  unreviewed=$((unreviewed + 1))
done < "$TMPD/findings.tsv"

if ((unreviewed == 0)); then
  log_pass "no unreviewed interpolation into a jq program"
  PASS=$((PASS + 1))
else
  echo
  echo "  ${YELLOW}Fix by passing the value as DATA, not as program text:${NC}"
  echo "      jq --arg k \"\$key\" '.[\$k]'      # instead of  jq \".\${key}\""
  echo "  If the value is provably a local literal, add it to the ALLOWLIST"
  echo "  above with a one-line reason."
  FAIL=$((FAIL + unreviewed))
fi

echo
echo "=========================================="
echo "  ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "=========================================="
[[ $FAIL -eq 0 ]]
