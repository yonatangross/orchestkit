#!/usr/bin/env bash
# One npm audit gate for the change (orchestkit row 10, part 2; conductor335's ruling and its
# addendum). The pre-push hook and the pull_request runs of "Security Tests" and "Dependency
# Audit" all decide through this script, so the rule lives in one place and cannot drift.
#
# Two modes, chosen by the EVENT and not by the caller's mood:
#   change  a pull_request event, or a local run that asks for it (the pre-push hook sets
#           ORK_AUDIT_MODE=change and ORK_AUDIT_BASE=<merge base with origin/main>).
#           FAILS on any advisory at the level (default moderate) in a package the change ADDS or
#           CHANGES in any lockfile (name and version compared with the base), and on any HIGH or
#           CRITICAL advisory anywhere in the tree, changed or not. A moderate advisory in an
#           untouched package PASSES and is NAMED as deferred to the scheduled whole-tree audit
#           (.github/workflows/npm-audit-scheduled.yml).
#   whole   every other event (push, schedule, dispatch, ...) and a local run that asks for nothing.
#           The same audit, the same threshold, no narrowing: delegated unchanged to
#           .github/scripts/audit-whole-tree.sh.
# When GITHUB_EVENT_NAME is set it decides the mode: pull_request is change, anything else is whole,
# and ORK_AUDIT_MODE and --mode are ignored, so an env var cannot narrow a push to main.
#
# Fail closed, with its own message, never a pass (exit 2, apart from a hit, exit 1):
#   - CANNOT COMPUTE THE LOCKFILE DIFF: change mode with no base ref, a base ref git cannot
#     resolve, a lockfile git cannot read at the base, or a lockfile that is not JSON with a
#     "packages" map (lockfileVersion 1 included).
#   - CANNOT AUDIT: the advisory source did not answer, no usable report, an unreadable allowlist,
#     or zero packages examined (all raised by audit-whole-tree.sh, which this script runs).
#
# Exit status: 0 clean for this change, 1 at least one failing advisory, 2 cannot decide.
#
# Usage:
#   .github/scripts/audit-gate.sh [--print-mode] [--mode change|whole] [--base REF] [--root DIR]
#                          [--dir DIR]... [--allowlist FILE] [--level low|moderate|high|critical]
#                          [--summary-out FILE]
# --print-mode prints the mode this run would use (change or whole) and exits; tests/security/
# test-npm-audit.sh asks it so the mode rule is written once.
# Base ref, change mode: --base, else ORK_AUDIT_BASE, else origin/$GITHUB_BASE_REF.
# --summary-out (change mode): {mode, base, level, examined, failing, deferred, allowlisted, errors}.
# In whole mode it is passed to audit-whole-tree.sh and has that script's shape.
#
# Test seam: ORK_AUDIT_WRAPPER, read by audit-whole-tree.sh, replaces npm-audit-with-retry.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WHOLE="$SCRIPT_DIR/audit-whole-tree.sh"

ROOT="$REPO_ROOT"
LEVEL="${NPM_AUDIT_LEVEL:-moderate}"
ALLOWLIST=""
SUMMARY_OUT=""
MODE_ARG=""
BASE_ARG=""
PRINT_MODE=0
DIRS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --print-mode) PRINT_MODE=1; shift ;;
    --mode) MODE_ARG="${2:?--mode needs change or whole}"; shift 2 ;;
    --base) BASE_ARG="${2:?--base needs a ref}"; shift 2 ;;
    --root) ROOT="${2:?--root needs a directory}"; shift 2 ;;
    --dir) DIRS+=("${2:?--dir needs a directory}"); shift 2 ;;
    --allowlist) ALLOWLIST="${2:?--allowlist needs a file}"; shift 2 ;;
    --level) LEVEL="${2:?--level needs a severity}"; shift 2 ;;
    --summary-out) SUMMARY_OUT="${2:?--summary-out needs a file}"; shift 2 ;;
    -h|--help) sed -n "2,39p" "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "audit-gate: unknown argument: $1" >&2; exit 2 ;;
  esac
done

# ─── which mode: the event decides ─────────────────────────────────────────
EVENT="${GITHUB_EVENT_NAME:-}"
MODE_SOURCE=""
if [[ -n "$EVENT" ]]; then
  case "$EVENT" in
    pull_request) MODE="change" ;;
    *) MODE="whole" ;;
  esac
  MODE_SOURCE="event $EVENT"
else
  REQUESTED="${MODE_ARG:-${ORK_AUDIT_MODE:-whole}}"
  case "$REQUESTED" in
    change|whole) MODE="$REQUESTED" ;;
    *) echo "audit-gate: mode must be change or whole, got: $REQUESTED" >&2; exit 2 ;;
  esac
  MODE_SOURCE="no event, asked for $REQUESTED"
fi

if [[ "$PRINT_MODE" -eq 1 ]]; then
  echo "$MODE"
  exit 0
fi

# ─── common arguments for audit-whole-tree.sh ──────────────────────────────
WHOLE_ARGS=(--root "$ROOT" --level "$LEVEL")
if [[ -n "$ALLOWLIST" ]]; then
  WHOLE_ARGS+=(--allowlist "$ALLOWLIST")
fi

if [[ "$MODE" == "whole" ]]; then
  echo "audit-gate: mode=whole ($MODE_SOURCE): the whole tree, no narrowing"
  for d in ${DIRS[@]+"${DIRS[@]}"}; do
    WHOLE_ARGS+=(--dir "$d")
  done
  if [[ -n "$SUMMARY_OUT" ]]; then
    WHOLE_ARGS+=(--summary-out "$SUMMARY_OUT")
  fi
  status=0
  bash "$WHOLE" "${WHOLE_ARGS[@]}" || status=$?
  exit "$status"
fi

# ─── change mode ───────────────────────────────────────────────────────────
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-audit-gate.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

# cannot_diff <message>: its own result, not a pass and not an advisory hit.
cannot_diff() {
  echo "  ✗ cannot compute the lockfile diff: $1"
  echo "  RESULT: CANNOT COMPUTE THE LOCKFILE DIFF (exit 2). The change could not be judged, so nothing here is a pass."
  exit 2
}

BASE="${BASE_ARG:-${ORK_AUDIT_BASE:-}}"
if [[ -z "$BASE" && -n "${GITHUB_BASE_REF:-}" ]]; then
  BASE="origin/$GITHUB_BASE_REF"
fi
echo "audit-gate: mode=change ($MODE_SOURCE), base=${BASE:-(none)}"
if [[ -z "$BASE" ]]; then
  cannot_diff "no base ref: pass --base, set ORK_AUDIT_BASE, or run on a pull_request with GITHUB_BASE_REF"
fi
if ! git -C "$ROOT" rev-parse --verify --quiet "${BASE}^{commit}" > /dev/null 2>&1; then
  cannot_diff "the base ref '$BASE' does not resolve to a commit in $ROOT (fetch it first)"
fi

# Every tracked lockfile, so a workspace added later is judged the day it appears.
if [[ "${#DIRS[@]}" -eq 0 ]]; then
  if ! git -C "$ROOT" ls-files '*package-lock.json' > "$WORK/locks.txt" 2> "$WORK/git.err"; then
    cannot_diff "git could not list the tracked lockfiles in $ROOT: $(head -n 1 "$WORK/git.err")"
  fi
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

# ─── per lockfile: the packages (name and version) the change adds or changes ──
# A package is changed when its name@version is in the working-tree lockfile and not in the base
# lockfile. A lockfile new in the change has every package added. A lockfile that is byte-identical
# to the base has none. The audited file and the diffed file are the same file on disk.
: > "$WORK/map.jsonl"
IDX=0
for dir in ${DIRS[@]+"${DIRS[@]}"}; do
  IDX=$((IDX + 1))
  label="${dir#"$ROOT"/}"
  [[ "$dir" == "$ROOT" ]] && label="(root)"
  if [[ "$dir" == "$ROOT" ]]; then
    rel="package-lock.json"
  elif [[ "$dir" == "$ROOT"/* ]]; then
    rel="${dir#"$ROOT"/}/package-lock.json"
  else
    cannot_diff "$dir is outside the repository $ROOT, so there is no base to compare it with"
  fi
  head_lock="$dir/package-lock.json"
  : > "$WORK/changed.$IDX"
  if [[ ! -f "$head_lock" ]]; then
    # audit-whole-tree.sh reports a missing lockfile as CANNOT AUDIT; nothing to diff here.
    jq -Rnc --arg dir "$label" '[inputs | select(length > 0)] | {($dir): .}' "$WORK/changed.$IDX" >> "$WORK/map.jsonl"
    continue
  fi
  if ! git -C "$ROOT" ls-tree --name-only "$BASE" -- "$rel" > "$WORK/tree.$IDX" 2> "$WORK/git.err"; then
    cannot_diff "git could not read $rel at $BASE: $(head -n 1 "$WORK/git.err")"
  fi
  : > "$WORK/base.$IDX.pk"
  if [[ -s "$WORK/tree.$IDX" ]]; then
    if ! git -C "$ROOT" show "$BASE:$rel" > "$WORK/base.$IDX.json" 2> "$WORK/git.err"; then
      cannot_diff "git could not read $rel at $BASE: $(head -n 1 "$WORK/git.err")"
    fi
    if cmp -s "$WORK/base.$IDX.json" "$head_lock"; then
      jq -Rnc --arg dir "$label" '[inputs | select(length > 0)] | {($dir): .}' "$WORK/changed.$IDX" >> "$WORK/map.jsonl"
      continue
    fi
    if ! jq -r '.packages | if type == "object" then to_entries[] | select(.key != "") | [(.value.name // (.key | sub("^(.*/)?node_modules/"; ""))), (.value.version // "unversioned")] | @tsv else error("no packages map") end' "$WORK/base.$IDX.json" > "$WORK/base.$IDX.raw" 2> "$WORK/jq.err"; then
      cannot_diff "the base $rel is not a lockfile this gate can read (it needs a packages map, lockfileVersion 2 or 3): $(head -n 1 "$WORK/jq.err")"
    fi
    LC_ALL=C sort -u "$WORK/base.$IDX.raw" > "$WORK/base.$IDX.pk"
  fi
  if ! jq -r '.packages | if type == "object" then to_entries[] | select(.key != "") | [(.value.name // (.key | sub("^(.*/)?node_modules/"; ""))), (.value.version // "unversioned")] | @tsv else error("no packages map") end' "$head_lock" > "$WORK/head.$IDX.raw" 2> "$WORK/jq.err"; then
    cannot_diff "$rel is not a lockfile this gate can read (it needs a packages map, lockfileVersion 2 or 3): $(head -n 1 "$WORK/jq.err")"
  fi
  LC_ALL=C sort -u "$WORK/head.$IDX.raw" > "$WORK/head.$IDX.pk"
  LC_ALL=C comm -13 "$WORK/base.$IDX.pk" "$WORK/head.$IDX.pk" | cut -f 1 | LC_ALL=C sort -u > "$WORK/changed.$IDX"
  jq -Rnc --arg dir "$label" '[inputs | select(length > 0)] | {($dir): .}' "$WORK/changed.$IDX" >> "$WORK/map.jsonl"
done
jq -sc 'add // {}' "$WORK/map.jsonl" > "$WORK/changed.json"

# ─── the audit itself: audit-whole-tree.sh, then narrow its hits ───────────
for d in ${DIRS[@]+"${DIRS[@]}"}; do
  WHOLE_ARGS+=(--dir "$d")
done
WHOLE_ARGS+=(--summary-out "$WORK/whole.json")
status=0
bash "$WHOLE" "${WHOLE_ARGS[@]}" > "$WORK/whole.out" 2>&1 || status=$?

if [[ "$status" -ne 0 && "$status" -ne 1 ]] || { [[ "$status" -eq 1 ]] && ! jq -e '.hits | type == "array"' "$WORK/whole.json" > /dev/null 2>&1; }; then
  # audit-whole-tree.sh prints its own RESULT line; this script prints the one that counts.
  while IFS= read -r line; do
    case "$line" in
      *"RESULT:"*) ;;
      *) printf '%s\n' "$line" ;;
    esac
  done < "$WORK/whole.out"
  echo "  RESULT: CANNOT AUDIT (exit 2). The audit did not complete, so nothing here is a pass."
  exit 2
fi

EXAMINED=0
ALLOWLISTED=0
if [[ -s "$WORK/whole.json" ]]; then
  EXAMINED="$(jq -r '.examined // 0' "$WORK/whole.json")"
  ALLOWLISTED="$(jq -r '.allowlisted | length' "$WORK/whole.json")"
fi
echo "════════════════════════════════════════════════════════════════"
echo "  npm audit gate for the change (severity >= ${LEVEL}), ${#DIRS[@]} lockfile(s), base ${BASE}"
echo "════════════════════════════════════════════════════════════════"

if [[ "$status" -eq 0 ]]; then
  echo "[]" > "$WORK/classified.json"
else
  jq -c --slurpfile changed "$WORK/changed.json" '
    ($changed[0]) as $c
    | .hits
    | map(. as $h
        | $h + {title: (($h.title // "(no title)") | gsub("[\\r\\n]+"; " ")),
                reason: (if ($h.severity == "high" or $h.severity == "critical")
                           then "high or critical, which fails anywhere in the tree"
                         elif ((($c[$h.dir] // []) | index($h.name)) != null)
                           then "in a package this change adds or changes"
                         else null end)})' "$WORK/whole.json" > "$WORK/classified.json"
fi
jq -c 'map(select(.reason != null))' "$WORK/classified.json" > "$WORK/failing.json"
jq -c 'map(select(.reason == null))' "$WORK/classified.json" > "$WORK/deferred.json"
FAILING="$(jq 'length' "$WORK/failing.json")"
DEFERRED="$(jq 'length' "$WORK/deferred.json")"

echo ""
jq -r '.[] | "  ✗ \(.dir): \(.id) [\(.severity)] \(.name): \(.title) (\(.reason))"' "$WORK/failing.json"
jq -r '.[] | "  ⚠ \(.dir): \(.id) [\(.severity)] \(.name): \(.title) (deferred to the scheduled whole-tree audit: a package this change does not touch, below high)"' "$WORK/deferred.json"
echo ""
echo "  examined $EXAMINED package(s) in ${#DIRS[@]} lockfile(s): $FAILING failing, $DEFERRED deferred to the scheduled whole-tree audit, $ALLOWLISTED allowlisted"

if [[ -n "$SUMMARY_OUT" ]]; then
  jq -n --arg mode "$MODE" --arg base "$BASE" --arg level "$LEVEL" --argjson examined "$EXAMINED" \
        --argjson allowlisted "$ALLOWLISTED" --slurpfile failing "$WORK/failing.json" --slurpfile deferred "$WORK/deferred.json" '
    {mode: $mode, base: $base, level: $level, examined: $examined, failing: $failing[0], deferred: $deferred[0],
     allowlisted: $allowlisted, errors: []}
  ' > "$SUMMARY_OUT"
fi

if [[ "$FAILING" -gt 0 ]]; then
  echo "  RESULT: ADVISORIES (exit 1)."
  exit 1
fi
if [[ "$DEFERRED" -gt 0 ]]; then
  echo "  RESULT: clean for this change (exit 0); $DEFERRED advisory(ies) in untouched packages deferred to the scheduled whole-tree audit."
else
  echo "  RESULT: clean for this change (exit 0)."
fi
