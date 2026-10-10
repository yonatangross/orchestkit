#!/usr/bin/env bash
# Test: agent frontmatter `isolation:` is an allowlist (#4557).
#
# Frontmatter `isolation: worktree` is forced on every spawn and cannot be
# overridden per spawn (per-spawn isolation only ADDS isolation). An agent
# that declares it fails to spawn at all from a non-git cwd with
# "Cannot create agent worktree: not in a git repository". So only agents
# whose work always needs a repo may declare it, and their descriptions must
# say so, so a conductor spawns them from inside the target repo instead of
# falling back to general-purpose.
#
# Static check only: no real spawn (no real LLM calls in CI).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/src/agents"

ALLOWED="git-operations-engineer release-engineer"

FAIL_COUNT=0
fail() { echo "FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

# Print the YAML frontmatter block (between the first two --- lines).
frontmatter() {
  awk 'NR==1 && $0=="---" {inside=1; next} inside && $0=="---" {exit} inside {print}' "$1"
}

# Print one top-level frontmatter key line, lowercased (empty when absent).
fm_key() {
  frontmatter "$1" | awk -v k="$2:" 'index($0, k) == 1 {print tolower($0); exit}'
}

# True when the isolation line is exactly `isolation: worktree` (any other
# value, such as `true` or `none`, is not the supported setting).
value_ok() {
  [[ "$(fm_key "$1" isolation | sed 's/[[:space:]]*$//')" == "isolation: worktree" ]]
}

echo "=== Agent isolation allowlist (#4557) ==="

# Self-check: value_ok must reject a wrong value, or the exact-value check
# below would pass anything.
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/iso-allowlist.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT
printf '%s\n' '---' 'name: probe' 'isolation: true' '---' > "$tmp_dir/probe.md"
if value_ok "$tmp_dir/probe.md"; then fail "value_ok accepted 'isolation: true'"; fi
printf '%s\n' '---' 'name: probe' 'isolation: worktree' '---' > "$tmp_dir/probe.md"
value_ok "$tmp_dir/probe.md" || fail "value_ok rejected 'isolation: worktree'"

found=""
for agent_file in "$AGENTS_DIR"/*.md; do
  name=$(basename "$agent_file" .md)
  if [[ -n "$(fm_key "$agent_file" isolation)" ]]; then
    found="$found $name"
    case " $ALLOWED " in
      *" $name "*) ;;
      *) fail "$name declares frontmatter isolation; only [$ALLOWED] may (it breaks spawns from a non-git cwd)" ;;
    esac
  fi
done

for name in $ALLOWED; do
  f="$AGENTS_DIR/$name.md"
  if [[ ! -f "$f" ]]; then
    fail "$name.md missing"
    continue
  fi
  case " $found " in
    *" $name "*) ;;
    *) fail "$name lost its isolation: worktree key" ;;
  esac
  value_ok "$f" || fail "$name isolation value is '$(fm_key "$f" isolation)', expected exactly 'isolation: worktree'"
  desc="$(fm_key "$f" description)"
  case "$desc" in
    *"git repository"*) ;;
    *) fail "$name description must say it needs a git repository cwd" ;;
  esac
done

# Callers opt in per spawn instead (#4557, codex HOLD 6101554389 and
# 6101854689). In the caller templates below, a writer spawn that runs
# concurrently must pass isolation="worktree". Concurrent means: marked
# run_in_background=true/True, created as a teammate (team_name=), or the
# design-import Phase 4 loop. A call block ends when its parentheses balance,
# so a one-line or multi-line call is read whole. Skipped: **Incorrect**
# examples, agent-phases.md Phase 4 (architecture specs, no file writes),
# prompts that cd into a manual worktree, and fix-issue spawns other than
# test-generator (design only). Isolated writers in implement, design-import
# and fix-issue must also be told to commit.
writer_re='ork:(backend-system-architect|frontend-ui-developer|test-generator|llm-integrator)"'
caller_files=$(find "$REPO_ROOT/src/skills/implement" -name '*.md'; printf '%s\n' "$REPO_ROOT/src/skills/design-import/SKILL.md" "$REPO_ROOT/src/skills/chain-patterns/SKILL.md" "$REPO_ROOT/src/skills/fix-issue/references/fix-phases.md" "$REPO_ROOT/src/skills/fix-issue/references/agent-teams-rca.md")
scan=$(awk -v re="$writer_re" '
  FNR == 1 { inc = 0; open_ = 0; skip = 0; loop = 0 }
  FILENAME ~ /agent-phases[.]md$/ && /^## Phase 4/ { skip = 1 }
  FILENAME ~ /agent-phases[.]md$/ && /^## Phase 5/ { skip = 0 }
  FILENAME ~ /design-import\/SKILL[.]md$/ && /^## Phase 4/ { loop = 1 }
  FILENAME ~ /design-import\/SKILL[.]md$/ && /^## Phase 5/ { loop = 0 }
  !open_ && /^[*][*]Incorrect/ { inc = 1 }
  !open_ && (/^[*][*]Correct/ || /^##+ /) { inc = 0 }
  !open_ && /Agent[(]/ { open_ = 1; buf = ""; depth = 0; start = FNR }
  open_ {
    buf = buf " " $0
    t = $0; o = gsub(/[(]/, "", t); t = $0; c = gsub(/[)]/, "", t); depth += o - c
    if (depth <= 0) {
      open_ = 0
      if (inc || skip || buf !~ re) next
      # fix-issue: only test-generator writes; the backend and frontend experts design.
      if (FILENAME ~ /fix-issue\// && buf !~ /ork:test-generator/) next
      print "SEEN"
      conc = (buf ~ /run_in_background=(true|True)/ || buf ~ /team_name=/ || loop)
      if (conc && buf !~ /isolation="worktree"/ && buf !~ /cd [{][a-z_]*wt[}]/) print FILENAME ":" start
      # A worktree branch is merged, so an uncommitted file is lost: the
      # implement and design-import writers must be told to commit.
      if (buf ~ /isolation="worktree"/ && FILENAME ~ /(agent-phases|agent-teams-phases|design-import\/SKILL|fix-phases|agent-teams-rca)[.]md$/ && buf !~ /[Cc]ommit/) print "NOCOMMIT " FILENAME ":" start
    }
  }
' $caller_files)
writers_seen=$(printf '%s\n' "$scan" | awk '$0 == "SEEN" { n++ } END { print n + 0 }')
[[ "$writers_seen" -gt 0 ]] || fail "no writer spawn found in the caller templates; the caller check cannot pass vacuously"
for loc in $(printf '%s\n' "$scan" | grep '^NOCOMMIT ' | cut -d' ' -f2 || true); do
  fail "isolated writer at ${loc#"$REPO_ROOT/"} is not told to commit before it returns"
done
for loc in $(printf '%s\n' "$scan" | grep -v -e '^SEEN$' -e '^NOCOMMIT ' || true); do
  fail "concurrent writer spawn without isolation=\"worktree\" at ${loc#"$REPO_ROOT/"}"
done
echo "caller templates: $writers_seen writer spawns checked"

echo "agents with isolation:${found:- none}"
if [[ $FAIL_COUNT -gt 0 ]]; then
  echo "RESULT: $FAIL_COUNT failure(s)"
  exit 1
fi
echo "RESULT: all checks passed"
