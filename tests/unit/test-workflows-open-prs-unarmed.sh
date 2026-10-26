#!/usr/bin/env bash
# No workflow may arm auto-merge on a PR it opens (#4914).
#
# release.yml's bump-stable-pin job opened the stable-pin PR and armed it
# with `gh pr merge --squash --auto`. The required checks are CI only, so
# #4913 merged on CI alone, before any reviewer read it. A workflow opens
# its PR unarmed; the merge desk arms it after a LAND names the head.
#
# One rule, no allowlist: any workflow or composite action that runs
# `gh pr merge` with `--auto` (on one line or across `\` continuations),
# calls the enablePullRequestAutoMerge mutation, or uses an automerge
# action fails this test. Comment lines are ignored, so a comment may still
# describe the old step.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

PASS=0
FAILS=0
fail() { echo "✗ $1"; FAILS=$((FAILS + 1)); }
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }

# Prints one line per self-arm in a workflow file, nothing when clean.
# A command continued with a trailing backslash is joined into one logical
# line first, so `gh pr merge "$N" \` followed by `--auto \` is caught.
check_workflow() {
  awk '
    function judge(text, at) {
      if (text ~ /gh[[:space:]]+pr[[:space:]]+merge/ && text ~ /--auto([^[:alnum:]_-]|$)/)
        printf "line %d runs gh pr merge with --auto\n", at
      if (text ~ /enablePullRequestAutoMerge/)
        printf "line %d calls enablePullRequestAutoMerge\n", at
      if (text ~ /enable-pull-request-automerge/)
        printf "line %d uses an automerge action\n", at
    }
    /^[[:space:]]*#/ { next }
    {
      line = $0
      if (buf == "") start = NR
      if (line ~ /\\[[:space:]]*$/) {
        sub(/\\[[:space:]]*$/, " ", line)
        buf = buf line
        next
      }
      judge(buf line, start)
      buf = ""
    }
    END { if (buf != "") judge(buf, start) }
  ' "$1"
}

# Self-check: the checker must flag every arm shape and pass the unarmed
# shape, or a clean result proves nothing.
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-unarmed-wf.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

cat > "$WORK/one-line.yml" <<'ONE'
        run: |
          gh pr create --base main --head "$BRANCH" --title t --body-file b.md
          gh pr merge "$BRANCH" --squash --auto
ONE
cat > "$WORK/continued.yml" <<'CONT'
        run: |
          gh pr merge "$PR_NUMBER" \
            --repo "$REPO" \
            --auto \
            --squash \
            --delete-branch
CONT
cat > "$WORK/graphql.yml" <<'GQL'
        run: gh api graphql -f query='mutation { enablePullRequestAutoMerge(input: {pullRequestId: "x"}) { clientMutationId } }'
GQL
cat > "$WORK/action.yml" <<'ACT'
      - uses: peter-evans/enable-pull-request-automerge@v3
ACT
cat > "$WORK/unarmed.yml" <<'CLEAN'
        run: |
          # Opened unarmed: the old step ran gh pr merge "$BRANCH" --squash --auto
          gh pr create --base main --head "$BRANCH" --title t --body-file b.md
          gh pr merge "$BRANCH" --squash \
            --delete-branch
CLEAN

for shape in one-line continued graphql action; do
  hits="$(check_workflow "$WORK/$shape.yml")"
  if [[ -n "$hits" ]]; then
    ok "self-check: the $shape arm is flagged"
  else
    fail "self-check: the $shape arm was not flagged"
  fi
done
clean_hits="$(check_workflow "$WORK/unarmed.yml")"
if [[ -z "$clean_hits" ]]; then
  ok "self-check: an unarmed PR passes, a comment naming the old arm included"
else
  fail "self-check: the unarmed shape was flagged: $clean_hits"
fi

# The real scan: every workflow and composite action, no allowlist.
# Only directories that exist are passed to find, so find's own errors
# stay visible instead of being discarded.
dirs=()
for d in "$ROOT/.github/workflows" "$ROOT/.github/actions"; do
  [[ -d "$d" ]] && dirs+=("$d")
done

scanned=0
if [[ "${#dirs[@]}" -gt 0 ]]; then
  while IFS= read -r -d '' wf; do
    scanned=$((scanned + 1))
    rel="${wf#"$ROOT"/}"
    hits="$(check_workflow "$wf")"
    [[ -z "$hits" ]] && continue
    while IFS= read -r h; do fail "$rel: $h"; done <<< "$hits"  # pipebuf: bounded-small (a few short problem lines)
  done < <(find "${dirs[@]}" -type f \( -name '*.yml' -o -name '*.yaml' \) -print0)
fi

if [[ "$scanned" -eq 0 ]]; then
  fail "scanned 0 workflow files; the scan proves nothing"
else
  ok "scanned $scanned workflow and action files"
fi

echo "  $PASS passed, $FAILS failed"
[[ "$FAILS" == 0 ]] || exit 1
