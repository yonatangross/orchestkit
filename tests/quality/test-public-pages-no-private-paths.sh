#!/usr/bin/env bash
# =============================================================================
# Public pages carry no real home or desk paths
# =============================================================================
# docs/site/public/lab/*.html is published to orchestkit.dev/lab, and the docs
# playground sources it is generated from (docs/<slug>/*.html, data.json) are
# committed in the public repo. A page that quotes a real operator path leaks
# the layout of a private machine. Two such pages were found already public:
# the card-only-mode page (a /Users/you/<private dir>/... path) and the v10-ga
# data.json (a home-relative desk path).
#
# The old banned-names test scanned only one PR's own files. This scans EVERY
# published page, every lab manifest fragment and every playground source.
#
# A path is banned when it is:
#   - under the private floor directory (dot-floor followed by a slash), or any
#     desks/ folder
#   - the real operator home (/Users/<operator>, /home/<operator>)
#   - a /Users/<name> or /home/<name> whose name is not a known placeholder
#
# The banned fragments are assembled below so this file does not spell them.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

FLOOR_DIR='\.'"floor"
OPERATOR="yonatan"
PLACEHOLDERS='me|you|op|someone|dev|u|user|ubuntu|example|name|username|runner|home|foo|x'

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# grep exits 1 for "no match", which is the good case here; any other non-zero
# exit is a real error and stops the test. Output goes to the file named first.
grep_to() {
  local out="$1" rc=0
  shift
  grep "$@" >"$out" || rc=$?
  if [[ $rc -gt 1 ]]; then
    echo "FAIL: grep error (exit $rc)" >&2
    exit 2
  fi
}

# Every published page, manifest fragment and playground source.
shopt -s nullglob
files=(
  docs/site/public/lab/*.html
  docs/site/lab-manifest/*.json
  docs/*/*.html
  docs/*/data.json
)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo "FAIL: no public pages found to scan (run from a full checkout)"
  exit 1
fi

fail=0

# 1. private directory paths and the real operator home
grep_to "$WORK/hits" -n -o -i -E \
  ".{0,40}(${FLOOR_DIR}/|desks/|/desks\b|/Users/${OPERATOR}|/home/${OPERATOR}).{0,40}" "${files[@]}"
if [[ -s "$WORK/hits" ]]; then
  echo "FAIL: real home or desk path in a public page:"
  head -40 "$WORK/hits"
  fail=1
fi

# 2. any /Users/<name> or /home/<name> that is not a placeholder
grep_to "$WORK/homes" -n -o -E "(/Users|/home)/[A-Za-z0-9_.-]+" "${files[@]}"
grep_to "$WORK/others" -v -E "(/Users|/home)/(${PLACEHOLDERS}|\.\.\.)\$" "$WORK/homes"
if [[ -s "$WORK/others" ]]; then
  echo "FAIL: home path with a non-placeholder name in a public page:"
  head -40 "$WORK/others"
  fail=1
fi

if [[ $fail -ne 0 ]]; then
  echo "scanned ${#files[@]} public files: private paths found"
  exit 1
fi
echo "PASS: scanned ${#files[@]} public files, no real home or desk paths"
