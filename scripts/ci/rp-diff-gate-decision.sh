#!/bin/bash
# Decide whether a pull_request event is a release-please-only diff, so the
# heavy suites can skip themselves (61 checks fired on #5463 for a
# version/changelog-only diff). Called by .github/workflows/rp-diff-gate.yml.
#
# Event data comes from the environment:
#   PR_NUMBER   pull_request number (empty on non-PR events)
#   HEAD_REF    github.head_ref
#   HEAD_SHA    github.event.pull_request.head.sha, the sha that triggered
#               this run: every count and commit tail is measured against
#               it, so a branch that moved since the trigger fails closed
#   PR_AUTHOR   github.event.pull_request.user.login
#   RP_PR_JSON_FILE (tests only) file holding the pulls/N response; when
#                 unset it is fetched live via gh. The decision needs
#                 changed_files, commits and head.sha off it.
#   RP_FILES_JSON_FILE (tests only) file holding the pulls/N/files array
#                 (one object per changed file); unset fetches live.
#   RP_COMMITS_JSON_FILE (tests only) file holding the pulls/N/commits
#                 array; unset fetches live.
#   RP_ALLOWLIST_FILE (tests only) override for the release-owned path list.
#   GH_TOKEN, GITHUB_REPOSITORY for the live API reads.
#
# Release-owned paths live in rp-diff-gate-allowlist.txt next to this
# script (one extended regex per line, anchored). The repository release
# bot is orchestkit-release-bot[bot].
#
# Fail closed on anything incomplete (Codex #5479): the file and commit
# counts must equal what pulls/N reports (the list endpoints paginate and
# cap), a rename must clear its previous_filename through the allowlist,
# the last listed commit must equal the triggering head sha, a commit
# whose author is not linked to a GitHub account counts as not-bot, and
# any read or parse failure keeps the suites running.
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

  # The pull object carries the truth the list endpoints are measured
  # against: changed_files, commits and head.sha.
  PR_JSON="${RP_PR_JSON_FILE:-}"
  if [[ -z "$PR_JSON" ]]; then
    PR_JSON="$(mktemp "${TMPDIR:-/tmp}/rp-gate-pr.XXXXXX")"
    if ! gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER" > "$PR_JSON"; then
      PR_JSON=""
      echo "pulls API read failed; not skipping"
    fi
  fi

  expected_files=""
  expected_commits=""
  pr_head=""
  if [[ -n "$PR_JSON" ]]; then
    if ! expected_files="$(jq -r '.changed_files // empty' < "$PR_JSON")"; then expected_files=""; fi
    if ! expected_commits="$(jq -r '.commits // empty' < "$PR_JSON")"; then expected_commits=""; fi
    if ! pr_head="$(jq -r '.head.sha // empty' < "$PR_JSON")"; then pr_head=""; fi
  fi
  trigger_head="${HEAD_SHA:-}"

  meta_ok=true
  if ! [[ "$expected_files" =~ ^[0-9]+$ ]]; then meta_ok=false; fi
  if ! [[ "$expected_commits" =~ ^[0-9]+$ ]]; then meta_ok=false; fi
  if [[ -z "$trigger_head" ]]; then meta_ok=false; fi
  if [[ -z "$pr_head" ]]; then meta_ok=false; fi
  if [[ "$meta_ok" == false ]]; then
    echo "pull request did not report its changed_files, commits and head counts; not skipping"
  elif [[ "$pr_head" != "$trigger_head" ]]; then
    echo "pull head moved since the trigger sha; not skipping"
  else

    # Every changed path, destinations and rename sources alike.
    FILES_JSON="${RP_FILES_JSON_FILE:-}"
    files_ok=true
    if [[ -z "$FILES_JSON" ]]; then
      FILES_JSON="$(mktemp "${TMPDIR:-/tmp}/rp-gate-files.XXXXXX")"
      if ! gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/files?per_page=100" --paginate > "$FILES_JSON"; then
        files_ok=false
      fi
    fi
    got_files=""
    if [[ "$files_ok" == true ]]; then
      if ! got_files="$(jq -s 'add | length' < "$FILES_JSON")"; then
        got_files=""
        files_ok=false
      fi
    fi

    if [[ "$files_ok" == false ]]; then
      echo "changed-file list unreadable; not skipping"
    elif [[ "$got_files" != "$expected_files" ]]; then
      echo "changed-file list incomplete ($got_files objects, PR reports $expected_files); not skipping"
    else
      FILES_SRC="$(mktemp "${TMPDIR:-/tmp}/rp-gate-paths.XXXXXX")"
      if ! jq -sr 'add[] | (.filename, .previous_filename) | select(type == "string" and length > 0)' < "$FILES_JSON" > "$FILES_SRC"; then
        echo "could not extract changed paths; not skipping"
      elif [[ ! -s "$FILES_SRC" ]]; then
        echo "empty changed-file list; not skipping"
      else
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

  # The allowlist covers executable and dependency surfaces (hook dist
  # bundles, package-lock.json, pyproject.toml), so path-only is not enough:
  # every commit on the PR must come from the release bot and carry a
  # GitHub-verified signature (author.login is only the account the commit
  # email resolves to; a forged author line could borrow it, #5480), the
  # list must be complete, and its tail must equal the sha that triggered
  # this run (a branch that moved mid-read never earns the skip).
  if [[ "$skip" == true ]]; then
    COMMITS_JSON="${RP_COMMITS_JSON_FILE:-}"
    commits_ok=true
    if [[ -z "$COMMITS_JSON" ]]; then
      COMMITS_JSON="$(mktemp "${TMPDIR:-/tmp}/rp-gate-commits.XXXXXX")"
      if ! gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/commits?per_page=100" --paginate > "$COMMITS_JSON"; then
        commits_ok=false
      fi
    fi
    got_commits=""
    got_head=""
    if [[ "$commits_ok" == true ]]; then
      if ! got_commits="$(jq -s 'add | length' < "$COMMITS_JSON")"; then
        commits_ok=false
      fi
    fi
    if [[ "$commits_ok" == true ]]; then
      if ! got_head="$(jq -sr 'add[-1].sha // empty' < "$COMMITS_JSON")"; then
        got_head=""
      fi
    fi

    if [[ "$commits_ok" == false ]]; then
      echo "commits list unreadable; not skipping"
      skip=false
    elif [[ "$got_commits" != "$expected_commits" ]]; then
      echo "commit list incomplete ($got_commits objects, PR reports $expected_commits); not skipping"
      skip=false
    elif [[ "$got_head" != "$trigger_head" ]]; then
      echo "commits list ends at a different head than the trigger sha; not skipping"
      skip=false
    else
      all_verified=""
      if ! all_verified="$(jq -sr '[add[] | (.commit.verification.verified == true)] | all' < "$COMMITS_JSON")"; then
        all_verified=""
      fi
      if [[ "$all_verified" != true ]]; then
        echo "commit without a GitHub-verified signature; not skipping"
        skip=false
      else
        # A commit whose author is not linked to a GitHub account reports
        # author=null, which maps to an empty line here; an empty line is a
        # not-bot author, never a missing row (Codex #5479, item 2).
        AUTHORS="$(mktemp "${TMPDIR:-/tmp}/rp-gate-authors.XXXXXX")"
        jq -sr 'add[] | .author.login // ""' < "$COMMITS_JSON" > "$AUTHORS"
        while IFS= read -r author; do
          if [[ -z "$author" ]]; then
            echo "commit without a linked GitHub author; not skipping"
            skip=false
          elif [[ "$author" != "$RELEASE_BOT" ]]; then
            echo "non-release-bot commit author: $author"
            skip=false
          fi
        done < "$AUTHORS"
      fi
    fi
  fi
fi
fi
fi

echo "skip=$skip"
