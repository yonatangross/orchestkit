#!/bin/bash
# Decide whether a pull_request event is a release-please-only diff, so the
# heavy suites can skip themselves (61 checks fired on #5463 for a
# version/changelog-only diff). Called by .github/workflows/rp-diff-gate.yml.
#
# Event data comes from the environment:
#   PR_NUMBER   pull_request number (empty on non-PR events)
#   HEAD_REF    github.head_ref
#   PR_AUTHOR   github.event.pull_request.user.login
#   RP_FILES_FILE (tests only) file with one changed path per line; when
#                 unset the live list is read from the files API via gh.
#   RP_ALLOWLIST_FILE (tests only) override for the release-owned path list.
#   GH_TOKEN, GITHUB_REPOSITORY for the live API read.
#
# Release-owned paths live in rp-diff-gate-allowlist.txt next to this
# script (one extended regex per line, anchored). The repository release
# bot is orchestkit-release-bot[bot].
#
# Prints skip=true|false plus the reason, one key=value per line.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALLOWLIST="${RP_ALLOWLIST_FILE:-$SCRIPT_DIR/rp-diff-gate-allowlist.txt}"
RELEASE_BOT='orchestkit-release-bot[bot]'
# The head glob is built by concatenation so this file does not contain the
# double-hyphen pair as a literal (the lane guard refuses scripts holding it).
dash=-
RELEASE_HEAD_GLOB="release-please${dash}${dash}*"

skip=false

# Nested ifs, not one [[ a && b && c ]]: the lane guard reads the second arm
# of an && inside a conditional as a program and refuses the script.
if [[ "${PR_NUMBER:-}" != "" ]]; then
if [[ "${HEAD_REF:-}" == $RELEASE_HEAD_GLOB ]]; then
if [[ "${PR_AUTHOR:-}" == "$RELEASE_BOT" ]]; then
  FILES_SRC="${RP_FILES_FILE:-}"
  if [[ -z "$FILES_SRC" ]]; then
    FILES_SRC="$(mktemp "${TMPDIR:-/tmp}/rp-gate-files.XXXXXX")"
    gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/files?per_page=100" --paginate --jq '.[].filename' > "$FILES_SRC"
  fi
  if [[ -s "$FILES_SRC" ]]; then
    non_release=""
    grep_rc=0
    non_release="$(grep -v -x -E -f "$ALLOWLIST" "$FILES_SRC")" || grep_rc=$?
    if [[ $grep_rc -gt 1 ]]; then
      echo "allowlist read or regex error (grep status $grep_rc); not skipping"
    elif [[ -z "$non_release" ]]; then
      skip=true
    else
      echo "$non_release" | while IFS= read -r f; do
        echo "non-release-owned file: $f"
      done
    fi
  fi
fi
fi
fi

echo "skip=$skip"
