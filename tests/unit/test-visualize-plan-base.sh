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

# A gh that hangs must not stall the script: the call is bounded at 5s and
# falls back to no issue context (the gap filed from #5194's thread). The
# nested helper wants 7s and leaves a completion marker when it lives - the
# caller must return near 5s AND the marker must stay absent past the point
# it would have been written, proving the descendant died with the lookup.
# pgrep is stubbed to exit 3 (fatal error, not "no match") so any cleanup
# that enumerated the tree would silently strand the helper; the group
# kill must not need enumeration at all.
git checkout -q -b fix/plan-5194
mkdir -p "${WORK}/ghbin"
cat > "${WORK}/ghbin/gh" <<'EOF'
#!/usr/bin/env bash
( sleep 7; touch "$MARKER" ) &
sleep 60
EOF
cat > "${WORK}/ghbin/pgrep" <<'EOF'
#!/usr/bin/env bash
exit 3
EOF
chmod +x "${WORK}/ghbin/gh" "${WORK}/ghbin/pgrep"
rm -f "${WORK}/nested-done"
start=${SECONDS}
out="$(MARKER="${WORK}/nested-done" PATH="${WORK}/ghbin:${PATH}" bash "${DETECT}")"
elapsed=$((SECONDS - start))
if [[ "${elapsed}" -lt 7 ]]; then
  pass "hung gh bounded at ${elapsed}s despite nested helper holding stdout"
else
  fail "hung gh stalled ${elapsed}s (nested helper outlived the deadline)"
fi
expect_line "hung gh" "${out}" "Issue: #5194"
if [[ "${out}" == *"Issue Title:"* ]]; then
  fail "hung gh: a title line was printed"
else
  pass "hung gh: no title line"
fi
# The helper's write fires at 7s when it lives. Wait past that point, then
# the marker must still be absent - a live descendant would have left it.
sleep 4
if [[ -e "${WORK}/nested-done" ]]; then
  fail "hung gh: nested helper survived the kill and completed its write"
else
  pass "hung gh: nested helper died with the lookup (marker never written)"
fi
rm -f "${WORK}/ghbin/pgrep"

# A partial title followed by a stall is discarded: a killed lookup must not
# publish truncated bytes next to the issue number.
cat > "${WORK}/ghbin/gh" <<'EOF'
#!/usr/bin/env bash
printf 'partial title'
sleep 60
EOF
start=${SECONDS}
out="$(PATH="${WORK}/ghbin:${PATH}" bash "${DETECT}")"
elapsed=$((SECONDS - start))
if [[ "${elapsed}" -lt 7 ]]; then
  pass "partial-title gh bounded at ${elapsed}s"
else
  fail "partial-title gh stalled ${elapsed}s"
fi
expect_line "partial gh" "${out}" "Issue: #5194"
if [[ "${out}" == *"Issue Title:"* || "${out}" == *"partial title"* ]]; then
  fail "partial gh: truncated bytes were published"
else
  pass "partial gh: truncated bytes discarded"
fi

# No writable temp dir: the optional title lookup skips itself and the rest
# of the context still prints with exit 0 (mktemp failure must not abort).
cat > "${WORK}/ghbin/gh" <<'EOF'
#!/usr/bin/env bash
echo "stubbed title"
EOF
start=${SECONDS}
out="$(TMPDIR=/nonexistent-dir-xyz PATH="${WORK}/ghbin:${PATH}" bash "${DETECT}")"
rc=$?
elapsed=$((SECONDS - start))
if [[ "${rc}" -eq 0 ]]; then
  pass "missing TMPDIR: exited 0 in ${elapsed}s"
else
  fail "missing TMPDIR: exited ${rc}"
fi
expect_line "no TMPDIR" "${out}" "Issue: #5194"
if [[ "${out}" == *"Issue Title:"* ]]; then
  fail "no TMPDIR: a title line was printed"
else
  pass "no TMPDIR: title skipped, context intact"
fi

# A fast gh still lands the title on the same code path, and promptly - the
# bound must not cost its whole timeout on the success path.
cat > "${WORK}/ghbin/gh" <<'EOF'
#!/usr/bin/env bash
echo "stubbed title"
EOF
start=${SECONDS}
out="$(PATH="${WORK}/ghbin:${PATH}" bash "${DETECT}")"
elapsed=$((SECONDS - start))
expect_line "fast gh" "${out}" "Issue Title: stubbed title"
if [[ "${elapsed}" -lt 2 ]]; then
  pass "fast gh returned promptly at ${elapsed}s"
else
  fail "fast gh took ${elapsed}s (bound cost bled into the success path)"
fi

if [[ "${FAILED}" -gt 0 ]]; then
  echo "✗ ${FAILED} visualize-plan base check(s) failed"
  exit 1
fi
echo "✓ visualize-plan counts only the branch's own work"
