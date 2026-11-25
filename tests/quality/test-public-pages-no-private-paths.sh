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

WORK="$(mktemp -d "${TMPDIR:-/tmp}/public-pages-paths.XXXXXX")"
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

# Every published page, manifest fragment and playground source, listed from
# inside a checkout root.
public_files() {
  shopt -s nullglob
  printf '%s\n' \
    docs/site/public/lab/*.html \
    docs/site/lab-manifest/*.json \
    docs/*/*.html \
    docs/*/data.json
}

# Scans the public files of the checkout at $1. Exit status: 0 clean, 1 a
# private path was found, 2 a grep error, 3 nothing to scan.
scan() {
  local root="$1" tag="$2"
  (
    cd "$root"
    files=()
    while IFS= read -r f; do files+=("$f"); done < <(public_files)

    if [[ ${#files[@]} -eq 0 ]]; then
      echo "FAIL: no public pages found to scan (run from a full checkout)"
      exit 3
    fi

    fail=0

    # 1. private directory paths and the real operator home
    grep_to "$WORK/$tag.hits" -n -o -i -E \
      ".{0,40}(${FLOOR_DIR}/|desks/|/desks\b|/Users/${OPERATOR}|/home/${OPERATOR}).{0,40}" "${files[@]}"
    if [[ -s "$WORK/$tag.hits" ]]; then
      echo "FAIL: real home or desk path in a public page:"
      head -40 "$WORK/$tag.hits"
      fail=1
    fi

    # 2. any /Users/<name> or /home/<name> that is not a placeholder
    grep_to "$WORK/$tag.homes" -n -o -E "(/Users|/home)/[A-Za-z0-9_.-]+" "${files[@]}"
    grep_to "$WORK/$tag.others" -v -E "(/Users|/home)/(${PLACEHOLDERS}|\.\.\.)\$" "$WORK/$tag.homes"
    if [[ -s "$WORK/$tag.others" ]]; then
      echo "FAIL: home path with a non-placeholder name in a public page:"
      head -40 "$WORK/$tag.others"
      fail=1
    fi

    if [[ $fail -ne 0 ]]; then
      echo "scanned ${#files[@]} public files: private paths found"
      exit 1
    fi
    echo "PASS: scanned ${#files[@]} public files, no real home or desk paths"
  )
}

# A throwaway git checkout holding a neutral page and a neutral nested source.
new_fixture() {
  local dir="$WORK/$1"
  mkdir -p "$dir/docs/site/public/lab" "$dir/docs/playgrounds/dev"
  git init -q "$dir"
  printf '<p>/Users/you/app</p>\n' >"$dir/docs/site/public/lab/page.html"
  printf '<p>/Users/you/app</p>\n' >"$dir/docs/playgrounds/dev/control.html"
  printf '%s' "$dir"
}

# Self-check, so the scan cannot go blind at a depth: a neutral nested source
# passes, and a private path in a source at any depth below docs/ is caught.
dir="$(new_fixture control)"
git -C "$dir" add -A
if ! scan "$dir" control >"$WORK/control.out" 2>&1; then
  echo "FAIL: self-check: a neutral nested source was refused"
  cat "$WORK/control.out"
  exit 1
fi

expect_caught() {
  local rel="$1" content="$2" dir
  dir="$(new_fixture "caught-${rel//\//_}")"
  mkdir -p "$(dirname "$dir/$rel")"
  printf '%s\n' "$content" >"$dir/$rel"
  git -C "$dir" add -A
  if scan "$dir" "caught-${rel//\//_}" >"$WORK/caught.out" 2>&1; then
    echo "FAIL: self-check: a private path in $rel was not caught"
    exit 1
  fi
}
expect_caught docs/playgrounds/dev/fault.html "<p>/home/${OPERATOR}/notes</p>"
expect_caught docs/playgrounds/dev/deeper/more/fault.html "<p>/home/${OPERATOR}/notes</p>"
expect_caught docs/a/b/c/data.json '{"p": "/Users/alice/notes"}'

rc=0
scan "$REPO_ROOT" repo || rc=$?
exit "$rc"
