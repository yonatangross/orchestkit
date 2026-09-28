#!/usr/bin/env bash
# Standards gate verdict: judge a PR head tree with TRUSTED code and a BASE floor.
#
#   scripts/standards-gate-verdict.sh --trusted DIR --base DIR --head DIR [--github]
#
# Run by .github/workflows/standards-gate.yml under pull_request_target, from the
# default branch checkout (--trusted). The three trees:
#   --trusted  default branch tip, the same commit as the workflow YAML. Every
#              program this script runs comes from here.
#   --base     the PR base commit (only configs/ is needed): the floor. The
#              allowlists and the baseline a PR is judged by come from here.
#   --head     the PR head: DATA ONLY. Read as text by the trusted reader; this
#              script never executes, sources or installs anything from it and
#              never changes directory into it.
#
# A PR therefore cannot weaken the gate that judges it: editing
# scripts/check-frontmatter.py, loosening configs/standards.json or raising
# configs/frontmatter-baseline.json in the head changes nothing about the
# verdict. The loosening and the raise are reported as failures of their own.
#
# Steps (all run, so one red step does not hide another):
#   1. refuse symlinked gate configs in the head (the reader refuses symlinked
#      SKILL.md and agents/*.md itself)
#   2. the head allowlists may not be looser than the floor (--widening-from)
#   3. the head tree, judged by the FLOOR allowlists and the FLOOR baseline
#   4. the head baseline may only fall versus the floor baseline
#
# The floor file is the base copy when it exists. On a base branch that does
# not carry it yet (main before the gate is promoted) the trusted default branch
# copy is the floor instead, and a notice says so. Neither source is PR-controlled.
#
# The mirror image holds on the head side, with one guard: a head that lacks
# the configs AND the gate script predates the gate, so steps 2 and 4 skip
# with a notice instead of failing rc=2 on a missing file. A head that has
# the gate script but is missing a config deleted the file; that is not a
# pre-gate head, it is an attack, and it fails (gate inputs may not be
# deleted). Step 3 still judges the tree on the floor either way.
#
# Exit: 0 pass, 1 a violation or a widening or a raised baseline, 2 cannot run.
# Proven by tests/unit/test-standards-gate-base-trust.sh.

set -euo pipefail

TRUSTED="" BASE="" HEAD="" GITHUB=""
while [ $# -gt 0 ]; do
  case "$1" in
    --trusted) TRUSTED="${2:?--trusted needs a directory}"; shift 2 ;;
    --base) BASE="${2:?--base needs a directory}"; shift 2 ;;
    --head) HEAD="${2:?--head needs a directory}"; shift 2 ;;
    --github) GITHUB=1; shift ;;
    *) echo "usage: $0 --trusted DIR --base DIR --head DIR [--github]" >&2; exit 2 ;;
  esac
done
for d in "$TRUSTED" "$BASE" "$HEAD"; do
  if [ -z "$d" ] || [ ! -d "$d" ]; then
    echo "ERROR: --trusted, --base and --head must all be existing directories" >&2
    exit 2
  fi
done

GATE="$TRUSTED/scripts/check-frontmatter.py"
REGISTRY_REL="configs/standards.json"
BASELINE_REL="configs/frontmatter-baseline.json"
if [ ! -f "$GATE" ]; then
  echo "ERROR: trusted gate $GATE is missing" >&2
  exit 2
fi

annotate() {
  # annotate <level> <message>: a GitHub annotation when --github, else plain.
  if [ -n "$GITHUB" ]; then
    echo "::$1 title=standards gate::$2"
  else
    echo "$1: $2"
  fi
}

floor() {
  # floor <relpath>: the base copy, else the trusted default branch copy.
  local rel="$1"
  if [ -f "$BASE/$rel" ] && [ ! -L "$BASE/$rel" ]; then
    printf '%s\n' "$BASE/$rel"
  else
    annotate notice "$rel is absent on the PR base; the floor is the default branch copy" >&2
    printf '%s\n' "$TRUSTED/$rel"
  fi
}

# 1. Symlinked gate configs in the head are refused outright (exit 2).
for rel in "$REGISTRY_REL" "$BASELINE_REL"; do
  if [ -L "$HEAD/$rel" ]; then
    annotate error "$rel is a symlink in the PR head; the gate reads only regular files"
    exit 2
  fi
done

FLOOR_REGISTRY="$(floor "$REGISTRY_REL")"
FLOOR_BASELINE="$(floor "$BASELINE_REL")"
echo "trusted gate:   $GATE"
echo "floor registry: $FLOOR_REGISTRY"
echo "floor baseline: $FLOOR_BASELINE"
echo "head (data):    $HEAD"

WORST=0
step() {
  # step <label> <command...>: run, report, keep the worst exit code.
  local label="$1" rc=0
  shift
  echo
  echo "== $label"
  "$@" || rc=$?
  if [ "$rc" -ne 0 ]; then
    annotate error "$label: failed (rc=$rc)"
    if [ "$rc" -gt "$WORST" ]; then WORST="$rc"; fi
  fi
}

# 2. Allowlists may not widen versus the floor. A head that lacks both the
# registry and the gate script predates the gate, so there is nothing to
# widen. A head that has the gate but not the registry deleted it; gate
# inputs may not be deleted.
if [ -f "$HEAD/$REGISTRY_REL" ]; then
  step "allowlists may not widen versus the base" \
    python3 -I "$GATE" ${GITHUB:+--github} \
    --registry "$HEAD/$REGISTRY_REL" --widening-from "$FLOOR_REGISTRY"
elif [ ! -f "$HEAD/scripts/check-frontmatter.py" ]; then
  echo
  echo "== allowlists may not widen versus the base"
  annotate notice "$REGISTRY_REL absent on the PR head; head predates the gate, nothing to widen"
else
  echo
  echo "== allowlists may not widen versus the base"
  annotate error "$REGISTRY_REL is missing on a head that carries the gate; gate inputs may not be deleted"
  if [ "$WORST" -lt 1 ]; then WORST=1; fi
fi

# 3. The head tree, judged by the floor allowlists and the floor baseline.
step "head tree judged by base rules and base baseline" \
  python3 -I "$GATE" ${GITHUB:+--github} \
  --root "$HEAD" --registry "$FLOOR_REGISTRY" --baseline "$FLOOR_BASELINE"

# 4. The head baseline may only fall versus the floor baseline. Same guard:
# absent together with the gate script means pre-gate; absent alone means
# deleted, and gate inputs may not be deleted.
if [ -f "$HEAD/$BASELINE_REL" ]; then
  step "head baseline may only fall versus the base" \
    python3 -I "$GATE" \
    --root "$HEAD" --registry "$FLOOR_REGISTRY" \
    --baseline "$HEAD/$BASELINE_REL" --base-baseline "$FLOOR_BASELINE"
elif [ ! -f "$HEAD/scripts/check-frontmatter.py" ]; then
  echo
  echo "== head baseline may only fall versus the base"
  annotate notice "$BASELINE_REL absent on the PR head; head predates the gate, nothing to raise"
else
  echo
  echo "== head baseline may only fall versus the base"
  annotate error "$BASELINE_REL is missing on a head that carries the gate; gate inputs may not be deleted"
  if [ "$WORST" -lt 1 ]; then WORST=1; fi
fi

echo
if [ "$WORST" -gt 2 ]; then WORST=2; fi
echo "standards gate verdict: rc=$WORST"
exit "$WORST"
