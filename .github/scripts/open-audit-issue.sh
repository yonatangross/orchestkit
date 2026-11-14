#!/usr/bin/env bash
# Open or update ONE issue for a red whole-tree audit (orchestkit row 10, part 1; conductor335's
# ruling, condition 1: a red whole-tree audit must open a visible item, never leave a silent
# log line). Two kinds of item, kept apart so the three states stay distinct:
#
#   --mode advisories (default)  the advisory SET the audit found. One issue per set: the sorted
#       unique advisory ids are hashed into the title as "[set <12 hex>]". A later run with the
#       same set finds that open issue and edits its body (last seen, run link) instead of
#       opening a second one. A different set opens its own issue.
#   --mode cannot-audit          the audit could not complete (registry down, no report, zero
#       packages in a lockfile, a failed issue step). ONE issue with the fixed title key
#       "[cannot-audit]", edited on every later run. It never claims an advisory was found.
#
# A fixed or a gone state leaves its issue open for a human to close; this script never closes
# anything.
#
# Input: the summary JSON written by .github/scripts/audit-whole-tree.sh --summary-out.
#
# Usage:
#   .github/scripts/open-audit-issue.sh --summary FILE [--mode advisories|cannot-audit]
#                                  [--reason TEXT] [--repo OWNER/REPO] [--label NAME]
#                                  [--run-url URL] [--dry-run]
#
# --reason is the workflow's own short text for a cannot-audit item (never registry text).
# In cannot-audit mode the summary may be missing or empty (the audit died before writing it).
#
# --dry-run prints the exact lookup, create and edit commands and the issue body, and runs no gh
# command at all (no read, no write). Three values only exist at run time and are shown as
# placeholders in the dry run, and the output says so: <N> (the issue number the lookup returns),
# the title (printed exactly), and the body file (the body printed below the commands).
# Without --dry-run the script needs GH_TOKEN with issues: write.
# Exit status: 0 nothing to open, or opened/updated; 2 the summary could not be read or gh failed.
#
# Test seam: ORK_GH names a replacement for the gh binary (tests/security/test-audit-whole-tree.sh).

set -euo pipefail

GH="${ORK_GH:-gh}"
SUMMARY=""
MODE="advisories"
REASON=""
REPO="${GITHUB_REPOSITORY:-}"
LABEL="security"
RUN_URL="${ORK_AUDIT_RUN_URL:-}"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --summary) SUMMARY="${2:?--summary needs a file}"; shift 2 ;;
    --mode) MODE="${2:?--mode needs advisories or cannot-audit}"; shift 2 ;;
    --reason) REASON="${2:?--reason needs text}"; shift 2 ;;
    --repo) REPO="${2:?--repo needs OWNER/REPO}"; shift 2 ;;
    --label) LABEL="${2:?--label needs a name}"; shift 2 ;;
    --run-url) RUN_URL="${2:?--run-url needs a URL}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,37p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "open-audit-issue: unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$MODE" in
  advisories|cannot-audit) ;;
  *) echo "open-audit-issue: --mode must be advisories or cannot-audit, got: $MODE" >&2; exit 2 ;;
esac

SUMMARY_OK=0
if [[ -n "$SUMMARY" && -s "$SUMMARY" ]] && jq -e '.hits | type == "array"' "$SUMMARY" > /dev/null 2>&1; then
  SUMMARY_OK=1
fi
if [[ "$MODE" == "advisories" && "$SUMMARY_OK" -eq 0 ]]; then
  echo "open-audit-issue: --summary must name a summary written by audit-whole-tree.sh" >&2
  exit 2
fi
if [[ -z "$REPO" ]]; then
  echo "open-audit-issue: no repository: pass --repo OWNER/REPO or set GITHUB_REPOSITORY" >&2
  exit 2
fi

if [[ "$MODE" == "advisories" ]]; then
  COUNT="$(jq '.hits | length' "$SUMMARY")"
  if [[ "$COUNT" -eq 0 ]]; then
    echo "open-audit-issue: the summary has no advisory hits, nothing to open"
    exit 0
  fi
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-audit-issue.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

NOW="$(date -u +%Y-%m-%dT%H:%MZ)"

# Everything below that comes from the registry or from npm (advisory titles, package names,
# lockfile paths, npm error text) is untrusted. Each such field goes through these jq filters
# BEFORE it is printed: CR and LF are folded to a space first (a newline would end the code span
# and put the rest of the text outside it), then the backtick is replaced (it would end the span)
# and, in a table cell, the pipe (it would end the cell). The text is then put in a code span, so
# an @mention or an HTML tag in it stays inert. Ids and severities are cut to a plain charset.
# The program is in a quoted heredoc so the backticks reach jq untouched.
cat > "$WORK/lib.jq" <<'JQ'
def clean: tostring | gsub("[\r\n]+"; " ") | gsub("`"; "’");
def cell: clean | gsub("[|]"; "/");
def tight: tostring | gsub("[^0-9A-Za-z._-]"; "");
def short: .[0:300];
JQ

if [[ "$MODE" == "advisories" ]]; then
  # The set key: sorted unique advisory ids, so the same advisories give the same key however
  # many lockfiles they appear in and in whatever order npm lists them.
  IDS="$(jq -r '[.hits[].id | tostring] | unique | join(",")' "$SUMMARY")"
  if command -v sha256sum > /dev/null; then
    KEY="$(printf '%s' "$IDS" | sha256sum | cut -c1-12)"
  else
    KEY="$(printf '%s' "$IDS" | shasum -a 256 | cut -c1-12)"
  fi
  MARK="[set ${KEY}]"
  { cat "$WORK/lib.jq"; echo '(if .fixture != null then "TEST (planted fixture): " else "" end) + "npm audit: \([.hits[].id | tostring] | unique | length) advisories at \(.level | tight) or above [set " + $key + "]"'; } > "$WORK/title.jq"
  TITLE="$(jq -r --arg key "$KEY" -f "$WORK/title.jq" "$SUMMARY")"

  { cat "$WORK/lib.jq"; echo '.hits[] | "| `\(.dir | cell)` | \(.id | tight) | \(.severity | tight) | `\(.name | cell)` | `\(.title | cell)` |"'; } > "$WORK/rows.jq"
  { cat "$WORK/lib.jq"; echo '.level | tight'; } > "$WORK/level.jq"
  { cat "$WORK/lib.jq"; echo '.examined | tight'; } > "$WORK/examined.jq"
  {
    echo "<!-- npm-audit-set:${KEY} -->"
    echo "The scheduled whole-tree npm audit found advisories at \`$(jq -r -f "$WORK/level.jq" "$SUMMARY")\` or above that are not in \`.claude/audit-allowlist.json\`."
    echo ""
    echo "| lockfile | advisory | severity | package | title |"
    echo "|---|---|---|---|---|"
    jq -r -f "$WORK/rows.jq" "$SUMMARY"
    echo ""
    echo "- Last seen: ${NOW}${RUN_URL:+ in ${RUN_URL}}"
    echo "- Examined: $(jq -r -f "$WORK/examined.jq" "$SUMMARY") packages in $(jq -r '.dirs | length' "$SUMMARY") lockfiles."
    if [[ "$(jq -r '.fixture != null' "$SUMMARY")" == "true" ]]; then
      echo "- TEST RUN: the planted fixture lodash 4.17.20 was added on purpose (workflow_dispatch, plant_fixture on). Close this item after reading it."
    fi
    echo "- Fix: bump the direct dependency that pulls the package (or refresh the lockfile inside its range), as #5225 and #5226 did. An allowlist entry needs a reachability note and an \`until\` date."
    echo "- This issue is updated, not duplicated, while the same advisory set stays red. It is not closed automatically."
  } > "$WORK/body.md"
else
  KEY="cannot-audit"
  IDS="-"
  MARK="[cannot-audit]"
  TITLE="npm audit: the scheduled whole-tree audit could not complete [cannot-audit]"

  { cat "$WORK/lib.jq"; echo '.errors[]? | "- `\(.dir | clean)`: `\(.message | clean | short)`"'; } > "$WORK/errors.jq"
  {
    echo "<!-- npm-audit-cannot-audit -->"
    echo "The scheduled whole-tree npm audit could not complete. Nothing below is a pass and nothing below is an advisory hit: no one knows the state of the tree until this is fixed."
    echo ""
    if [[ -n "$REASON" ]]; then
      echo "- Reason: $(printf '%s' "$REASON" | tr '\r\n' '  ' | cut -c1-300)"
    fi
    if [[ "$SUMMARY_OK" -eq 1 ]]; then
      jq -r -f "$WORK/errors.jq" "$SUMMARY"
    else
      echo "- No summary was written: the audit script did not get as far as auditing. See the audit step log."
    fi
    echo "- Last seen: ${NOW}${RUN_URL:+ in ${RUN_URL}}"
    echo "- This issue is updated, not duplicated, while the audit keeps failing to complete. It is not closed automatically."
  } > "$WORK/body.md"
fi

# One lookup, used by the real run and printed by the dry run: the open issue whose title carries this mark.
cat > "$WORK/lookup.jq" <<'JQ'
[.[] | select(.title | contains($key))] | .[0].number // empty
JQ
LOOKUP_TEXT="$(cat "$WORK/lookup.jq")"
SEARCH=("$GH" issue list --repo "$REPO" --state open --label "$LABEL" --limit 200 --json number,title)

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "open-audit-issue: DRY RUN, no gh command is executed (mode: ${MODE})"
  echo "set key: ${KEY} (ids: ${IDS})"
  echo "placeholders: <N> is the issue number step 1 returns; <body file> is the body printed below the commands."
  echo "1. find an open issue for this mark (the lookup the real run executes):"
  echo "   ${SEARCH[*]} > <open.json>; jq -r --arg key '${MARK}' '${LOOKUP_TEXT}' <open.json>"
  echo "2a. none found: $GH issue create --repo ${REPO} --label ${LABEL} --title '${TITLE}' --body-file <body file>"
  echo "2b. found <N>:  $GH issue edit <N> --repo ${REPO} --body-file <body file>"
  echo "--- body ---"
  cat "$WORK/body.md"
  exit 0
fi

"${SEARCH[@]}" > "$WORK/open.json"
EXISTING="$(jq -r --arg key "$MARK" -f "$WORK/lookup.jq" "$WORK/open.json")"

if [[ -n "$EXISTING" ]]; then
  "$GH" issue edit "$EXISTING" --repo "$REPO" --body-file "$WORK/body.md"
  echo "open-audit-issue: updated existing issue #${EXISTING} for ${MODE} ${KEY}"
else
  "$GH" issue create --repo "$REPO" --label "$LABEL" --title "$TITLE" --body-file "$WORK/body.md"
  echo "open-audit-issue: opened a new issue for ${MODE} ${KEY}"
fi
