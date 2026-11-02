#!/usr/bin/env bash
# check-repo-description.sh: the GitHub repo description must not carry stale
# component counts (#3667).
#
# The description is repository metadata, not a file: stamp-counts.sh cannot
# rewrite it and no in-tree drift test can read it, yet it is the copy with the
# widest reach (search results, the repo card, social embeds). README's
# <!--ork:skills|agents|hooks--> markers are the reference: stamp-counts.sh
# --check already gates them against src/ on every PR.
#
# Usage:
#   check-repo-description.sh --description "<text>"   # test or offline use
#   check-repo-description.sh --repo owner/name         # reads it with gh api
#
# Exit: 0 the counts match, or the description names none (nothing to drift);
#       1 a named count disagrees (prints the expected fragment to paste);
#       2 the description could not be read, or README has no markers.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESC=""
HAVE_DESC=0
REPO=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --description) DESC="${2-}"; HAVE_DESC=1; shift 2 ;;
    --repo) REPO="${2-}"; shift 2 ;;
    *) echo "usage: $0 --description <text> | --repo owner/name" >&2; exit 2 ;;
  esac
done

if [[ "$HAVE_DESC" -eq 0 ]]; then
  if [[ -z "$REPO" ]]; then
    echo "check-repo-description: pass --description or --repo" >&2
    exit 2
  fi
  if ! DESC="$(gh api "repos/$REPO" --jq '.description // ""')"; then
    echo "check-repo-description: could not read the description of $REPO" >&2
    exit 2
  fi
fi

if [[ -z "$DESC" ]]; then
  echo "check-repo-description: the description is empty or unreadable" >&2
  exit 2
fi

marker() {
  local v
  v="$(grep -o "<!--ork:$1-->[0-9]*<!--/ork-->" "$ROOT/README.md" | head -1 | grep -o '[0-9]\+' || true)" # silent: a missing marker is reported below as exit 2
  echo "$v"
}
SKILLS="$(marker skills)"
AGENTS="$(marker agents)"
HOOKS="$(marker hooks)"
if [[ -z "$SKILLS" || -z "$AGENTS" || -z "$HOOKS" ]]; then
  echo "check-repo-description: README.md has no skills/agents/hooks count markers" >&2
  exit 2
fi

# Each count the description names; a description that names none has
# nothing to drift.
named() {
  local n
  n="$(printf '%s\n' "$DESC" | grep -oE "[0-9]+ $1" | head -1 | grep -oE '^[0-9]+' || true)" # silent: no count named is a valid description
  echo "$n"
}
D_SKILLS="$(named skills)"
D_AGENTS="$(named agents)"
D_HOOKS="$(named hooks)"

drift=()
[[ -n "$D_SKILLS" && "$D_SKILLS" != "$SKILLS" ]] && drift+=("skills: description $D_SKILLS, README $SKILLS")
[[ -n "$D_AGENTS" && "$D_AGENTS" != "$AGENTS" ]] && drift+=("agents: description $D_AGENTS, README $AGENTS")
[[ -n "$D_HOOKS" && "$D_HOOKS" != "$HOOKS" ]] && drift+=("hooks: description $D_HOOKS, README $HOOKS")

if [[ ${#drift[@]} -eq 0 ]]; then
  if [[ -z "$D_SKILLS$D_AGENTS$D_HOOKS" ]]; then
    echo "check-repo-description: OK (the description names no counts)"
  else
    echo "check-repo-description: OK (${SKILLS} skills, ${AGENTS} agents, ${HOOKS} hooks)"
  fi
  exit 0
fi

echo "check-repo-description: the repo description carries stale counts (#3667):"
for d in "${drift[@]}"; do echo "  $d"; done
echo "Set the description to read: ${SKILLS} skills, ${AGENTS} agents, ${HOOKS} hooks"
echo "(Settings > General > Description, or: gh repo edit --description \"...\")"
exit 1
