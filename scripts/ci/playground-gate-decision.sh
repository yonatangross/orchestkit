#!/usr/bin/env bash
# Decide whether a PR playground is required.
#
# The workflow step in .github/workflows/ci.yml only runs this script.
# Tests call it with the changed paths on stdin so the decision cannot
# drift away from the copy the gate ships.
#
# Env:
#   HEAD_REF     head branch
#   PR_AUTHOR    PR author login
#   IS_FORK      true when the head repo is not this repo
#   PR_NUMBER    when set and stdin has no paths, read the diff via gh
#   GITHUB_OUTPUT  when set, append required=true|false for the workflow
#
# Stdout always includes:
#   required=true|false
#   message=<notice text>
#   ::notice::<notice text>
# Exit 0. A missing diff is required=true (fail closed), not a crash.

set -uo pipefail

HEAD_REF="${HEAD_REF:-}"
PR_AUTHOR="${PR_AUTHOR:-}"
IS_FORK="${IS_FORK:-}"
PR_NUMBER="${PR_NUMBER:-}"

finish() {
  local required="$1"
  local message="$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf 'required=%s\n' "$required" >> "$GITHUB_OUTPUT"
  fi
  printf 'required=%s\n' "$required"
  printf 'message=%s\n' "$message"
  printf '::notice::%s\n' "$message"
  exit 0
}

# Lab page dirs are docs/<type><sep><slug>/ where sep is two hyphen
# characters. Built by concatenation so this file does not contain that
# character pair as a literal. Same encoding the workflow already uses
# when it turns a branch name into a docs directory.
hyphen=-
pair="${hyphen}${hyphen}"
INERT="^(README\\.md|CHANGELOG\\.md|CONTRIBUTING\\.md|SECURITY\\.md|CODE_OF_CONDUCT\\.md|LICENSE|\\.github/.*|vercel\\.json|[^/]*\\.toml|docs/[^/]*${pair}[^/]*/.*|docs/playgrounds/.*|docs/audits/.*|\\.claude/rules/.*|docs/site/public/lab/.*|docs/site/lab-manifest/.*|docs/site/lib/generated/lab-data\\.ts)$"

# Same classifier as src/hooks/src/lib/git.ts (hasTests), which is the
# repo's existing test globs: **/*.test.*, **/*.spec.*, **/__tests__/**,
# tests/**, and test/**.
TEST_FILE_RE='^(tests?/.*|.*/__tests__/.*|__tests__/.*|.*/[^/]*\.(test|spec)\.[^/]*|[^/]*\.(test|spec)\.[^/]*)$'

# Bot PRs never carry a playground.
if [ "$PR_AUTHOR" = "dependabot[bot]" ] || [ "$PR_AUTHOR" = "release-please[bot]" ] || [ "$PR_AUTHOR" = "github-actions[bot]" ] || [ "$PR_AUTHOR" = "orchestkit-release-bot[bot]" ]; then
  finish false "Skipping playground check for bot PR ($PR_AUTHOR)"
fi

# Automated branches, kept as a cheap fast path.
# Here-string, not a pipe: grep -q must not SIGPIPE a producer (#603).
if grep -qE '^(dependabot/|release-please|renovate/|chore/cc-snapshot-|ci/)' <<< "$HEAD_REF"; then
  finish false "Skipping playground check for automated branch ($HEAD_REF)"
fi

# Fork PRs. The Lab artifact is something only a maintainer knows how to
# produce, so a cross-repository PR is exempt. A branch pushed to this
# repo is never cross-repository, so this cannot dodge our own work.
if [ "$IS_FORK" = "true" ]; then
  finish false "Skipping playground check for fork PR ($PR_AUTHOR); maintainer adds the playground at merge time"
fi

FILES=""
if [ ! -t 0 ]; then
  FILES=$(cat)
fi
if [ -z "$FILES" ] && [ -n "$PR_NUMBER" ]; then
  name_only="${pair}name-only"
  FILES=$(gh pr diff "$PR_NUMBER" "$name_only" 2>/dev/null || true)
fi

# gh name-only output ends in a newline, and a here-string adds another.
# An empty line matches neither pattern, so a docs-only or test-only diff
# would be treated as mixed and a playground would be required.
# Drop blank lines before the match. awk reads the whole stream (no
# early exit), so this is not the grep -q SIGPIPE race (#603).
FILES=$(printf '%s\n' "$FILES" | awk 'NF { print }')

has_path=0
while IFS= read -r line || [ -n "$line" ]; do
  [ -n "$line" ] || continue
  has_path=1
  break
done <<< "$FILES"

if [ "$has_path" -eq 0 ]; then
  finish true "Could not read the PR diff; requiring a playground (fail-closed)."
fi

# Here-string, not a pipe into grep -q. grep -q early-exits and would
# SIGPIPE a producer; under pipefail that flips this test (#603).
if ! grep -qvE "$INERT" <<< "$FILES"; then
  finish false "Skipping playground check: every changed file is docs or config only"
fi

# #4301: a hand-written test fix on a normal branch was blocked because
# the only skip was the automated-branch prefix. Exempt the diff only
# when every changed path is a test file. A test file riding along with
# source still requires a playground.
if ! grep -qvE "$TEST_FILE_RE" <<< "$FILES"; then
  finish false "test-only diff, no playground required"
fi

# A combination of exempt paths remains exempt. Testing inert workflow
# changes does not create a user-facing surface. Any source or unknown
# path still fails this union and requires a playground.
if ! grep -qvE "($INERT)|($TEST_FILE_RE)" <<< "$FILES"; then
  finish false "Skipping playground check: every changed file is inert or a test"
fi

finish true "Playground required (PR touches user-facing paths)"
