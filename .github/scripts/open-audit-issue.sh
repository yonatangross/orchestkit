#!/usr/bin/env bash
# Open or update ONE issue for the advisory set a whole-tree audit found (orchestkit row 10,
# part 1; conductor335's ruling, condition 1: a red whole-tree audit must open a visible
# item, never leave a silent log line).
#
# Input: the summary JSON written by .github/scripts/audit-whole-tree.sh --summary-out.
# One issue per advisory SET: the set is the sorted unique advisory ids, hashed into the
# issue title as "[set <12 hex>]". A later run with the same set finds that open issue
# and edits its body (last seen, run link) instead of opening a second one. A different
# set opens its own issue. An advisory set that is fixed leaves its issue open for a
# human to close; this script never closes anything.
#
# Usage:
#   .github/scripts/open-audit-issue.sh --summary FILE [--repo OWNER/REPO] [--label NAME]
#                                  [--run-url URL] [--dry-run]
#
# --dry-run prints the exact gh commands and the issue body, and runs no gh command at all
# (no read, no write). Without it the script needs GH_TOKEN with issues: write.
# Exit status: 0 nothing to open, or opened/updated; 2 the summary could not be read or gh failed.
#
# Test seam: ORK_GH names a replacement for the gh binary (tests/security/test-audit-whole-tree.sh).

set -euo pipefail

GH="${ORK_GH:-gh}"
SUMMARY=""
REPO="${GITHUB_REPOSITORY:-}"
LABEL="security"
RUN_URL="${ORK_AUDIT_RUN_URL:-}"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --summary) SUMMARY="${2:?--summary needs a file}"; shift 2 ;;
    --repo) REPO="${2:?--repo needs OWNER/REPO}"; shift 2 ;;
    --label) LABEL="${2:?--label needs a name}"; shift 2 ;;
    --run-url) RUN_URL="${2:?--run-url needs a URL}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,22p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "open-audit-issue: unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$SUMMARY" || ! -s "$SUMMARY" ]] || ! jq -e '.hits | type == "array"' "$SUMMARY" > /dev/null; then
  echo "open-audit-issue: --summary must name a summary written by audit-whole-tree.sh" >&2
  exit 2
fi
if [[ -z "$REPO" ]]; then
  echo "open-audit-issue: no repository: pass --repo OWNER/REPO or set GITHUB_REPOSITORY" >&2
  exit 2
fi

COUNT="$(jq '.hits | length' "$SUMMARY")"
if [[ "$COUNT" -eq 0 ]]; then
  echo "open-audit-issue: the summary has no advisory hits, nothing to open"
  exit 0
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-audit-issue.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

# The set key: sorted unique advisory ids, so the same advisories give the same key however
# many lockfiles they appear in and in whatever order npm lists them.
IDS="$(jq -r '[.hits[].id] | unique | join(",")' "$SUMMARY")"
if command -v sha256sum > /dev/null; then
  KEY="$(printf '%s' "$IDS" | sha256sum | cut -c1-12)"
else
  KEY="$(printf '%s' "$IDS" | shasum -a 256 | cut -c1-12)"
fi
TITLE="$(jq -r --arg key "$KEY" '"npm audit: \([.hits[].id] | unique | length) advisories at \(.level) or above [set " + $key + "]"' "$SUMMARY")"
NOW="$(date -u +%Y-%m-%dT%H:%MZ)"

# Advisory titles and package names come from the registry, so they are untrusted text: put
# them in code spans (a backtick inside one is replaced, a pipe would break the table) so a
# name like @scope/pkg cannot become a mention. The jq program is in a quoted heredoc so the
# backticks in it reach jq untouched.
cat > "$WORK/rows.jq" <<'JQ'
.hits[] | "| `\(.dir | gsub("`"; "’"))` | \(.id) | \(.severity) | `\(.name | gsub("`"; "’"))` | `\(.title | gsub("`"; "’") | gsub("[|]"; "/"))` |"
JQ
{
  echo "<!-- npm-audit-set:${KEY} -->"
  echo "The scheduled whole-tree npm audit found advisories at \`$(jq -r '.level' "$SUMMARY")\` or above that are not in \`.claude/audit-allowlist.json\`."
  echo ""
  echo "| lockfile | advisory | severity | package | title |"
  echo "|---|---|---|---|---|"
  jq -r -f "$WORK/rows.jq" "$SUMMARY"
  echo ""
  echo "- Last seen: ${NOW}${RUN_URL:+ in ${RUN_URL}}"
  echo "- Examined: $(jq -r '.examined' "$SUMMARY") packages in $(jq -r '.dirs | length' "$SUMMARY") lockfiles."
  echo "- Fix: bump the direct dependency that pulls the package (or refresh the lockfile inside its range), as #5225 and #5226 did. An allowlist entry needs a reachability note and an \`until\` date."
  echo "- This issue is updated, not duplicated, while the same advisory set stays red. It is not closed automatically."
} > "$WORK/body.md"

SEARCH=("$GH" issue list --repo "$REPO" --state open --label "$LABEL" --limit 200 --json number,title)

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "open-audit-issue: DRY RUN, no gh command is executed"
  echo "set key: ${KEY} (ids: ${IDS})"
  echo "1. find an open issue for this set:"
  echo "   ${SEARCH[*]} | jq -r '[.[] | select(.title | contains(\"[set ${KEY}]\"))] | .[0].number // empty'"
  echo "2a. none found: $GH issue create --repo ${REPO} --label ${LABEL} --title '${TITLE}' --body-file <body below>"
  echo "2b. found #N:   $GH issue edit N --repo ${REPO} --body-file <body below>"
  echo "--- body ---"
  cat "$WORK/body.md"
  exit 0
fi

"${SEARCH[@]}" > "$WORK/open.json"
EXISTING="$(jq -r --arg key "[set ${KEY}]" '[.[] | select(.title | contains($key))] | .[0].number // empty' "$WORK/open.json")"

if [[ -n "$EXISTING" ]]; then
  "$GH" issue edit "$EXISTING" --repo "$REPO" --body-file "$WORK/body.md"
  echo "open-audit-issue: updated existing issue #${EXISTING} for set ${KEY}"
else
  "$GH" issue create --repo "$REPO" --label "$LABEL" --title "$TITLE" --body-file "$WORK/body.md"
  echo "open-audit-issue: opened a new issue for set ${KEY}"
fi
