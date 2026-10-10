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

# Callers opt in per spawn instead: every writer spawn in a "Correct" template
# under src/skills/implement must pass isolation (#4557, codex HOLD 6101554389).
writer_re='Agent[(]subagent_type="ork:(backend-system-architect|frontend-ui-developer|test-generator|llm-integrator)"'
bare=$(awk -v re="$writer_re" '
  FNR == 1 { ok = 0; open_ = 0 }
  /^\*\*Correct/ { ok = 1 } /^\*\*Incorrect/ || /^#{2,} / { ok = 0 }
  ok && $0 ~ re { open_ = 1; buf = ""; start = FNR }
  open_ { buf = buf $0 }
  open_ && /run_in_background/ { open_ = 0; if (buf !~ /isolation="worktree"/) print FILENAME ":" start }
' $(find "$REPO_ROOT/src/skills/implement" -name '*.md'))
writers_seen=$(grep -rlE "^\*\*Correct" "$REPO_ROOT/src/skills/implement" | xargs grep -cE "$writer_re" | awk -F: '{n += $2} END {print n + 0}')
[[ "$writers_seen" -gt 0 ]] || fail "no writer spawn found in any Correct template; the caller check cannot pass vacuously"
for loc in $bare; do fail "writer spawn without isolation=\"worktree\" at ${loc#"$REPO_ROOT/"}"; done

echo "agents with isolation:${found:- none}"
if [[ $FAIL_COUNT -gt 0 ]]; then
  echo "RESULT: $FAIL_COUNT failure(s)"
  exit 1
fi
echo "RESULT: all checks passed"
