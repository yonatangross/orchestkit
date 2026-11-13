#!/usr/bin/env bash
# Whole-tree npm audit: the audit step of .github/workflows/npm-audit-scheduled.yml
# (orchestkit row 10, part 1; conductor335's ruling, condition 1).
#
# Audits every tracked package-lock.json at moderate and up with the same allowlist
# tests/security/test-npm-audit.sh uses (.claude/audit-allowlist.json, numeric npm
# advisory ids, an expired "until" date no longer excuses an entry). It reads the
# lockfiles (--package-lock-only), so it needs no install and no registry auth.
#
# Why a script of its own and not tests/security/test-npm-audit.sh: that test prints
# PASS and FAIL lines for humans and walks a hand-kept list of directories. A job
# that must open an issue needs a machine-readable summary, a way to point it at a
# fixture tree, and a distinct exit status for "could not audit". This script keeps
# the same threshold and the same allowlist, and discovers the lockfiles from git so
# the list cannot drift.
#
# Usage:
#   .github/scripts/audit-whole-tree.sh [--root DIR] [--dir DIR]... [--allowlist FILE]
#                                  [--level low|moderate|high|critical] [--summary-out FILE]
#
# Exit status (three outcomes that must never be confused):
#   0  every lockfile was audited and no advisory at or above the level is left
#   1  at least one advisory at or above the level is not allowlisted (a HIT)
#   2  the audit itself could not be completed (CANNOT AUDIT): a lockfile is missing, the
#      registry did not answer, npm returned no usable report, the allowlist is unreadable,
#      or zero packages were examined. Fail closed: this is never a pass.
# When both happen, 2 wins, and the summary lists the hits and the errors.
#
# Summary JSON (--summary-out): {level, examined, dirs, hits, allowlisted, errors}.
#
# Test seam: ORK_AUDIT_WRAPPER names a replacement for .github/scripts/npm-audit-with-retry.sh,
# so tests/security/test-audit-whole-tree.sh can feed canned reports without the network.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AUDIT_WRAPPER="${ORK_AUDIT_WRAPPER:-$REPO_ROOT/.github/scripts/npm-audit-with-retry.sh}"

ROOT="$REPO_ROOT"
LEVEL="${NPM_AUDIT_LEVEL:-moderate}"
ALLOWLIST=""
SUMMARY_OUT=""
DIRS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) ROOT="${2:?--root needs a directory}"; shift 2 ;;
    --dir) DIRS+=("${2:?--dir needs a directory}"); shift 2 ;;
    --allowlist) ALLOWLIST="${2:?--allowlist needs a file}"; shift 2 ;;
    --level) LEVEL="${2:?--level needs a severity}"; shift 2 ;;
    --summary-out) SUMMARY_OUT="${2:?--summary-out needs a file}"; shift 2 ;;
    -h|--help) sed -n '2,32p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "audit-whole-tree: unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$LEVEL" in
  low|moderate|high|critical) ;;
  *) echo "audit-whole-tree: --level must be low, moderate, high or critical, got: $LEVEL" >&2; exit 2 ;;
esac
if [[ ! -f "$AUDIT_WRAPPER" ]]; then
  echo "audit-whole-tree: audit wrapper not found: $AUDIT_WRAPPER" >&2
  exit 2
fi
if [[ -z "$ALLOWLIST" ]]; then
  ALLOWLIST="$ROOT/.claude/audit-allowlist.json"
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-audit-tree.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
: > "$WORK/errors.jsonl"
: > "$WORK/via.jsonl"
EXAMINED=0
AUDITED_LABELS=()

# record_error <label> <message>: one CANNOT AUDIT entry, kept for the summary.
record_error() {
  jq -cn --arg dir "$1" --arg message "$2" '{dir: $dir, message: $message}' >> "$WORK/errors.jsonl"
  echo "  ✗ $1: cannot audit: $2"
}

# ─── which lockfiles ───────────────────────────────────────────────────────
if [[ "${#DIRS[@]}" -eq 0 ]]; then
  # Every tracked lockfile, so a new workspace is covered the day it is added.
  git -C "$ROOT" ls-files '*package-lock.json' > "$WORK/locks.txt"
  while IFS= read -r lock; do
    case "$lock" in
      ''|*node_modules*) continue ;;
    esac
    reldir="$(dirname "$lock")"
    if [[ "$reldir" == "." ]]; then
      DIRS+=("$ROOT")
    else
      DIRS+=("$ROOT/$reldir")
    fi
  done < "$WORK/locks.txt"
fi

echo "════════════════════════════════════════════════════════════════"
echo "  whole-tree npm audit (severity >= ${LEVEL}), ${#DIRS[@]} lockfile(s)"
echo "════════════════════════════════════════════════════════════════"

if [[ "${#DIRS[@]}" -eq 0 ]]; then
  record_error "(tree)" "no package-lock.json found under $ROOT, nothing to examine"
fi

# ─── active allowlist (numeric advisory ids whose "until" is missing or in the future) ──
TODAY="$(date -u +%Y-%m-%d)"
: > "$WORK/allow.txt"
if [[ -f "$ALLOWLIST" ]]; then
  if ! jq -r --arg today "$TODAY" '
        to_entries[]
        | select(.key | startswith("_") | not)
        | select(.value.until == null or .value.until > $today)
        | .key' "$ALLOWLIST" > "$WORK/allow.txt"; then
    record_error "(allowlist)" "$ALLOWLIST is not readable JSON, refusing to guess what it allows"
  fi
fi

# ─── audit each lockfile ───────────────────────────────────────────────────
IDX=0
for dir in "${DIRS[@]}"; do
  IDX=$((IDX + 1))
  label="${dir#"$ROOT"/}"
  [[ "$dir" == "$ROOT" ]] && label="(root)"
  AUDITED_LABELS+=("$label")

  if [[ ! -f "$dir/package-lock.json" ]]; then
    record_error "$label" "no package-lock.json in $dir"
    continue
  fi

  report="$WORK/report.$IDX.json"
  errfile="$WORK/stderr.$IDX.txt"
  status=0
  # npm audit exits 1 whenever it finds advisories, so the status cannot tell a hit from a
  # failure. The report decides: it must be JSON, must not carry an "error", and must carry counts.
  bash "$AUDIT_WRAPPER" "$dir" "--audit-level=$LEVEL" --package-lock-only --json > "$report" 2> "$errfile" || status=$?

  if [[ ! -s "$report" ]] || ! jq -e . "$report" > /dev/null; then
    record_error "$label" "npm audit produced no usable JSON report (exit $status): $(head -n 3 "$errfile" | tr '\n' ' ')"
    continue
  fi
  if jq -e 'has("error")' "$report" > /dev/null; then
    record_error "$label" "npm audit reported an error: $(jq -r '.error.code // .error.summary // "unknown"' "$report")"
    continue
  fi
  if ! jq -e '.metadata.vulnerabilities | type == "object"' "$report" > /dev/null; then
    record_error "$label" "npm audit report has no vulnerability counts (exit $status)"
    continue
  fi

  total="$(jq -r '.metadata.dependencies.total // 0' "$report")"
  EXAMINED=$((EXAMINED + total))

  # Every advisory (a "via" object) at or above the level. npm lists lower severities in the
  # report as well, and --audit-level only changes npm's exit status, so filter here.
  jq -c --arg dir "$label" --arg level "$LEVEL" '
    {low: 1, moderate: 2, high: 3, critical: 4} as $rank
    | .vulnerabilities // {} | to_entries[] | .value.via[]? | select(type == "object")
    | select(($rank[.severity // "low"] // 1) >= $rank[$level])
    | {dir: $dir, id: ((.id // .source) | tostring), severity: (.severity // "unknown"),
       name: (.name // "?"), title: (.title // "(no title)")}
  ' "$report" >> "$WORK/via.jsonl"
done

if [[ "${#DIRS[@]}" -gt 0 && "$EXAMINED" -eq 0 && ! -s "$WORK/errors.jsonl" ]]; then
  record_error "(tree)" "zero packages were examined across ${#DIRS[@]} lockfile(s), which is not a pass"
fi

# ─── split advisories into hits and allowlisted ────────────────────────────
jq -sc 'unique_by([.dir, .id])' "$WORK/via.jsonl" > "$WORK/via.unique.json"
jq -c --rawfile allow "$WORK/allow.txt" '
  ($allow | split("\n") | map(select(length > 0))) as $ok
  | map(select(.id as $i | $ok | index($i) | not))' "$WORK/via.unique.json" > "$WORK/hits.json"
jq -c --rawfile allow "$WORK/allow.txt" '
  ($allow | split("\n") | map(select(length > 0))) as $ok
  | map(select(.id as $i | $ok | index($i)))' "$WORK/via.unique.json" > "$WORK/allowlisted.json"

HITS="$(jq 'length' "$WORK/hits.json")"
ALLOWLISTED="$(jq 'length' "$WORK/allowlisted.json")"
ERRORS="$(jq -s 'length' "$WORK/errors.jsonl")"

echo ""
jq -r '.[] | "  ✗ \(.dir): \(.id) [\(.severity)] \(.name): \(.title)"' "$WORK/hits.json"
jq -r '.[] | "  ⚠ \(.dir): \(.id) [\(.severity)] \(.title) (allowlisted)"' "$WORK/allowlisted.json"
echo ""
echo "  examined $EXAMINED package(s) in ${#DIRS[@]} lockfile(s): $HITS hit(s), $ALLOWLISTED allowlisted, $ERRORS audit error(s)"

if [[ -n "$SUMMARY_OUT" ]]; then
  jq -n --arg level "$LEVEL" --argjson examined "$EXAMINED" \
        --argjson dirs "$(printf '%s\n' "${AUDITED_LABELS[@]-}" | jq -R . | jq -sc 'map(select(length > 0))')" \
        --slurpfile hits "$WORK/hits.json" --slurpfile allowlisted "$WORK/allowlisted.json" \
        --slurpfile errors "$WORK/errors.jsonl" '
    {level: $level, examined: $examined, dirs: $dirs, hits: $hits[0], allowlisted: $allowlisted[0], errors: $errors}
  ' > "$SUMMARY_OUT"
fi

if [[ "$ERRORS" -gt 0 ]]; then
  echo "  RESULT: CANNOT AUDIT (exit 2). The audit did not complete, so nothing here is a pass."
  exit 2
fi
if [[ "$HITS" -gt 0 ]]; then
  echo "  RESULT: ADVISORIES (exit 1)."
  exit 1
fi
echo "  RESULT: clean (exit 0)."
