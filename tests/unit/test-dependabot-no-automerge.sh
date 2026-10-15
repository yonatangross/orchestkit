#!/usr/bin/env bash
# dependabot-automerge.yml must never arm auto-merge.
#
# It ran `gh pr merge --auto --squash` on every non-major Dependabot PR, on
# every synchronize, so each rebase re-armed it and a breaking 0.x minor or
# a bump that touched the publish workflows could merge with no human read
# (#4762). Every Dependabot PR now merges through the merge desk. The
# workflow keeps only the major-held label and comment, with no
# contents: write.
#
# Comment lines are ignored, so the header may still describe the old step.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WF="$ROOT/.github/workflows/dependabot-automerge.yml"

PASS=0
FAILS=0
fail() { echo "✗ $1"; FAILS=$((FAILS + 1)); }
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

[[ -f "$WF" ]] || { echo "✗ missing $WF"; exit 1; }

# Prints the problems in a workflow file, one per line; prints nothing when
# the file is clean. Lines whose first non-blank character is # are skipped.
check_workflow() {
  awk '
    /^[[:space:]]*#/ { next }
    /gh[[:space:]]+pr[[:space:]]+merge/ { printf "line %d runs gh pr merge\n", NR }
    /--auto([[:space:]]|$|")/ { printf "line %d passes --auto\n", NR }
    /^[[:space:]]*contents:[[:space:]]*write/ { printf "line %d grants contents: write\n", NR }
    /--add-label[[:space:]]+dependabot-major-held/ { held = 1 }
    END { if (!held) print "the major-held label step is missing" }
  ' "$1"
}

# Self-check: the checker must flag the old workflow shape and pass the new
# one, or a clean result proves nothing.
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-dependabot-wf.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
cat > "$WORK/old.yml" <<'OLD'
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Auto-merge non-major updates
        run: gh pr merge --auto --squash "$PR_URL"
      - name: Label major bumps as held
        run: gh pr edit "$PR_URL" --add-label dependabot-major-held
OLD
cat > "$WORK/new.yml" <<'NEW'
    # the old step ran gh pr merge --auto --squash; removed
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Label major bumps as held
        run: gh pr edit "$PR_URL" --add-label dependabot-major-held
NEW
old_hits="$(check_workflow "$WORK/old.yml")"
if [[ "$(printf '%s\n' "$old_hits" | awk 'NF { n++ } END { print n + 0 }')" -ge 3 ]]; then
  ok "self-check: the old shape is flagged (merge, --auto, contents: write)"
else
  fail "self-check: the old shape was not fully flagged: ${old_hits:-nothing}"
fi
new_hits="$(check_workflow "$WORK/new.yml")"
if [[ -z "$new_hits" ]]; then
  ok "self-check: the new shape passes, a comment naming the old step included"
else
  fail "self-check: the new shape was flagged: $new_hits"
fi

hits="$(check_workflow "$WF")"
if [[ -z "$hits" ]]; then
  ok "dependabot-automerge.yml arms no auto-merge and keeps the major-held label"
else
  while IFS= read -r h; do fail "dependabot-automerge.yml: $h"; done <<< "$hits"  # pipebuf: bounded-small (a handful of short problem lines)
fi

echo "  $PASS passed, $FAILS failed"
[[ "$FAILS" == 0 ]] || exit 1
