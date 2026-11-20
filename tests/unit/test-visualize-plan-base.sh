#!/usr/bin/env bash
# GH-5194: visualize-plan counts the branch's own work, not upstream work a
# stale local main has not pulled. Worktrees rarely pull main, so the scripts
# must diff against origin/main (or the remote default branch) when it exists.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SCRIPTS="${PROJECT_ROOT}/src/skills/visualize-plan/scripts"
DETECT="${SCRIPTS}/detect-plan-context.sh"
IMPACT="${SCRIPTS}/analyze-impact.sh"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ork-plan-base.XXXXXX")"
trap 'rm -rf "${WORK}"' EXIT
# shellcheck source=SCRIPTDIR/../fixtures/git-isolate.sh
source "${SCRIPT_DIR}/../fixtures/git-isolate.sh"
git_isolate "${WORK}"

FAILED=0
pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; FAILED=$((FAILED + 1)); }

commit_files() {
  local f
  for f in "$@"; do
    echo "${f}" > "${f}"
    git add "${f}"
    git commit -q -m "add ${f}"
  done
}

# A clone of a bare origin whose default branch is $2, holding one root commit.
new_clone() {
  local name="$1" default="$2"
  git init -q --bare --initial-branch="${default}" "${WORK}/${name}.git"
  git clone -q "${WORK}/${name}.git" "${WORK}/${name}" 2>/dev/null
  cd "${WORK}/${name}"
  git checkout -q -B "${default}"
  commit_files root
  git push -q -u origin "${default}"
}

expect_line() {
  local label="$1" output="$2" line="$3"
  if grep -qxF -- "${line}" <<<"${output}"; then
    pass "${label}: ${line}"
  else
    fail "${label}: expected '${line}', got '$(grep -F -m1 -- "${line%%:*}:" <<<"${output}" || true)'"
  fi
}

echo "visualize-plan base ref (#5194)"

# Local main lags origin/main by five upstream commits; the branch adds two.
new_clone stale main
commit_files up1 up2 up3 up4 up5
git push -q origin main
git checkout -q -b fix/plan-base origin/main
git branch -q -f main HEAD~5
commit_files mine1 mine2
out="$(bash "${DETECT}")"
expect_line "stale main" "${out}" "Base: origin/main"
expect_line "stale main" "${out}" "Commits: 2"
expect_line "stale main" "${out}" "Files: 2 (2 added, 0 modified, 0 deleted)"
expect_line "stale main" "${out}" "Lines: +2 -0"
out="$(bash "${IMPACT}")"
expect_line "stale main impact" "${out}" "Comparing: HEAD vs origin/main"
expect_line "stale main impact" "${out}" "  Files: 2 (2 added, 0 modified, 0 deleted)"
out="$(bash "${IMPACT}" main)"
expect_line "explicit base" "${out}" "Comparing: HEAD vs main"

# A branch cut from origin/dev, with a stale local dev, diffs against origin/dev.
git checkout -q -b dev origin/main
commit_files dev1 dev2 dev3
git push -q -u origin dev
git checkout -q -b feat/on-dev origin/dev
git branch -q -f dev HEAD~3
commit_files feature1
out="$(bash "${DETECT}")"
expect_line "dev branch" "${out}" "Base: origin/dev"
expect_line "dev branch" "${out}" "Commits: 1"

# A dev that main has already moved past does not claim a branch cut from main.
new_clone behind main
git push -q origin main:dev
commit_files up1 up2
git push -q origin main
git checkout -q -b feat/on-main origin/main
commit_files mine1
out="$(bash "${DETECT}")"
expect_line "dev behind main" "${out}" "Base: origin/main"
expect_line "dev behind main" "${out}" "Commits: 1"

# No remote: the local main is all there is.
git init -q --initial-branch=main "${WORK}/local"
cd "${WORK}/local"
commit_files root
git checkout -q -b fix/local
commit_files mine1 mine2 mine3
out="$(bash "${DETECT}")"
expect_line "no remote" "${out}" "Base: main"
expect_line "no remote" "${out}" "Commits: 3"

# No main anywhere: fall back to the remote's default branch.
new_clone legacy master
git remote set-head origin master
git checkout -q -b fix/on-master
commit_files mine1
out="$(bash "${DETECT}")"
expect_line "default branch" "${out}" "Base: origin/master"
expect_line "default branch" "${out}" "Commits: 1"

if [[ "${FAILED}" -gt 0 ]]; then
  echo "✗ ${FAILED} visualize-plan base check(s) failed"
  exit 1
fi
echo "✓ visualize-plan counts only the branch's own work"
